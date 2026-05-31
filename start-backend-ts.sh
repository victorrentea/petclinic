#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/petclinic-backend-ts"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "TS backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

cd "$BACKEND_DIR"

# Runs on 8080 by default so the Angular frontend (which targets
# http://localhost:8080/api) talks to this TS backend with no changes.
# Override with PORT, e.g. `PORT=8082 ./start-backend-ts.sh`, to run it on a
# different port.
PORT="${PORT:-8080}"

if [[ ! -d node_modules ]]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🔨 Building (nest build)..."
npm run build

# TypeORM migrations create the schema + seed data on a fresh database and are
# idempotent (already-applied migrations are skipped). Run ./start-database.sh
# first. This backend owns the schema via TypeORM migrations.
echo "🗄️  Running TypeORM migrations..."
npm run migration:run

# OpenTelemetry zero-code auto-instrumentation: when the OTLP collector (Grafana
# LGTM, started by ./start-observability.sh) is reachable on :4318, load the
# auto-instrumentations register hook via NODE_OPTIONS. The `node` command below
# stays argument-free — traces/metrics/logs are exported with NO code changes.
if (echo > /dev/tcp/localhost/4318) 2>/dev/null; then
  export OTEL_SERVICE_NAME="petclinic-backend-ts"
  export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
  export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
  export OTEL_TRACES_EXPORTER="otlp"
  export OTEL_METRICS_EXPORTER="otlp"
  export OTEL_LOGS_EXPORTER="otlp"
  export OTEL_RESOURCE_ATTRIBUTES="deployment.environment=local"
  export NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"
  echo "📡 OpenTelemetry → http://localhost:4318 (service: petclinic-backend-ts)"
else
  echo "ℹ️  OTLP collector not on :4318 — telemetry disabled. Run ./start-observability.sh to enable."
fi

echo ""
echo "🚀 Starting Petclinic TS Backend (NestJS)..."
echo "Backend will be available at: http://localhost:${PORT}/"
echo "Swagger UI:                   http://localhost:${PORT}/swagger-ui"
echo ""

PORT="$PORT" exec node dist/main
