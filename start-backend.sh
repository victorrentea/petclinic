#!/bin/bash

set -euo pipefail

printf '\033]0;BE\007'  # set terminal/tab title

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/petclinic-backend"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

# 2.20+ is what can capture bound query parameters (db.query.parameter.<n>);
# 2.10 has no such flag, so the diagrams could only ever show `?`.
AGENT_VERSION="2.20.1"
AGENT_DIR="$BACKEND_DIR/.tools"
# version in the filename: an already-downloaded jar would otherwise make a
# version bump a no-op on every machine that ran the old one
AGENT_JAR="$AGENT_DIR/opentelemetry-javaagent-$AGENT_VERSION.jar"
AGENT_URL="https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${AGENT_VERSION}/opentelemetry-javaagent.jar"

if [[ ! -f "$AGENT_JAR" ]]; then
  mkdir -p "$AGENT_DIR"
  echo "⬇️  Downloading OpenTelemetry Java agent v${AGENT_VERSION}..."
  if curl -fsSL -o "$AGENT_JAR" "$AGENT_URL"; then
    echo "✅ Downloaded OTel agent"
  else
    echo "⚠️  Could not download OTel agent — booting WITHOUT observability"
    rm -f "$AGENT_JAR"
  fi
fi

OTEL_JVM_ARGS=""
if [[ -f "$AGENT_JAR" ]]; then
  if (echo > /dev/tcp/localhost/4318) 2>/dev/null; then
    export OTEL_SERVICE_NAME=petclinic-backend
    export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
    export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
    export OTEL_LOGS_EXPORTER=otlp
    export OTEL_METRICS_EXPORTER=otlp
    export OTEL_TRACES_EXPORTER=otlp
    export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=local
    # Capture the *most* detail the agent can give; what a sequence diagram
    # actually shows is decided at render time (petclinic-test SEQ_SQL=…), so a
    # different level of detail never costs another test run.
    # Bound parameters are only captured when the sanitizer is off — the
    # sanitizer is what rewrites literals to `?` in the first place.
    export OTEL_INSTRUMENTATION_COMMON_DB_STATEMENT_SANITIZER_ENABLED=false
    export OTEL_INSTRUMENTATION_JDBC_EXPERIMENTAL_CAPTURE_QUERY_PARAMETERS=true
    # db.query.parameter.<n> only exists in the stable database semconv; `/dup`
    # emits the old attribute names alongside it, so nothing that reads
    # db.statement / db.system breaks.
    export OTEL_SEMCONV_STABILITY_OPT_IN=database/dup
    OTEL_JVM_ARGS="-javaagent:$AGENT_JAR"
  else
    echo "ℹ️  OTel collector not running on :4318 — telemetry disabled. Run ./start-grafana.sh to enable."
  fi
fi

echo "🚀 Starting Petclinic Backend (Spring Boot)..."
echo "Backend will be available at: http://localhost:8080/"
if [[ -n "$OTEL_JVM_ARGS" ]]; then
  echo "📡 OpenTelemetry agent attached → http://localhost:4318"
fi
echo ""

cd "$BACKEND_DIR"
if [[ -n "$OTEL_JVM_ARGS" ]]; then
  mvn clean spring-boot:run -Dspring-boot.run.jvmArguments="$OTEL_JVM_ARGS"
else
  mvn clean spring-boot:run
fi
