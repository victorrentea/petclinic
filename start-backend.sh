#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/petclinic-backend"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

AGENT_VERSION="2.10.0"
AGENT_DIR="$BACKEND_DIR/.tools"
AGENT_JAR="$AGENT_DIR/opentelemetry-javaagent.jar"
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
  export OTEL_SERVICE_NAME=petclinic-backend
  export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
  export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
  export OTEL_LOGS_EXPORTER=otlp
  export OTEL_METRICS_EXPORTER=otlp
  export OTEL_TRACES_EXPORTER=otlp
  export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=local
  OTEL_JVM_ARGS="-javaagent:$AGENT_JAR"
fi

echo "🚀 Starting Petclinic Backend (Spring Boot)..."
echo "Backend will be available at: http://localhost:8080/"
if [[ -n "$OTEL_JVM_ARGS" ]]; then
  echo "📡 OpenTelemetry agent attached → http://localhost:4318"
fi
echo ""

cd "$BACKEND_DIR"
if [[ -n "$OTEL_JVM_ARGS" ]]; then
  ./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="$OTEL_JVM_ARGS"
else
  ./mvnw spring-boot:run
fi
