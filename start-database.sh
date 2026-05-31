#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop or Colima first." >&2
  exit 1
fi

echo "🐘 Starting PostgreSQL (Docker Compose) on localhost:5432..."
docker compose up -d db

# Stop the container when this script is interrupted (Ctrl+C), keeping the
# data volume. Use `docker compose down -v` to wipe data.
cleanup() {
  echo ""
  echo "🛑 Stopping PostgreSQL..."
  docker compose stop db >/dev/null 2>&1 || true
  echo "✅ Stopped (data persisted in volume 'petclinic-db-data')"
}
trap cleanup EXIT

echo "⏳ Waiting for Postgres to be ready..."
for i in {1..40}; do
  if docker compose exec -T db pg_isready -U petclinic -d petclinic >/dev/null 2>&1; then
    echo "✅ Postgres ready at localhost:5432 (db / user / password: petclinic)"
    break
  fi
  sleep 1
done

echo ""
echo "ℹ️  Schema + seed data are created by the backend's TypeORM migrations —"
echo "    run ./start-backend-ts.sh (it applies them automatically)."
echo ""
echo "📜 Tailing Postgres logs — press Ctrl+C to stop the database."
docker compose logs -f db
