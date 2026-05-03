#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop or Colima first." >&2
  exit 1
fi

echo "🚀 Starting Grafana LGTM (metrics, logs, traces)..."
docker compose up -d lgtm

echo "⏳ Waiting for Grafana to be ready..."
for i in {1..60}; do
  if curl -fsS http://localhost:3300/api/health >/dev/null 2>&1; then
    echo "✅ Grafana ready at http://localhost:3300 (admin/admin)"
    exit 0
  fi
  sleep 1
done
echo "⚠️  Grafana did not become ready in 60s — check 'docker compose logs lgtm'" >&2
exit 1
