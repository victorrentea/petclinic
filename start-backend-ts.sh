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
# Override with PORT, e.g. `PORT=8082 ./start-backend-ts.sh`, to run it
# alongside the Java backend for side-by-side comparison.
PORT="${PORT:-8080}"

if [[ ! -d node_modules ]]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🔨 Building (nest build)..."
npm run build

# TypeORM migrations create the schema + seed data on a fresh database and are
# idempotent (already-applied migrations are skipped). Run ./start-database.sh
# first. NOTE: this backend owns the schema via TypeORM migrations — point it at
# a fresh DB, not one already populated by the Java backend's Flyway.
echo "🗄️  Running TypeORM migrations..."
npm run migration:run

echo ""
echo "🚀 Starting Petclinic TS Backend (NestJS)..."
echo "Backend will be available at: http://localhost:${PORT}/"
echo "Swagger UI:                   http://localhost:${PORT}/swagger-ui"
echo ""

PORT="$PORT" exec node dist/main
