#!/bin/bash
set -euo pipefail
printf '\033]0;Grafana\007'  # set terminal/tab title
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/petclinic-observability"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop or Colima first." >&2
  exit 1
fi

cleanup() {
  echo ""
  echo "🛑 Shutting down Grafana LGTM..."
  docker compose down
  echo "✅ Stopped (data persisted in volume 'lgtm-data')"
}
trap cleanup EXIT

echo "🚀 Starting Grafana LGTM (metrics, logs, traces)..."
docker compose up -d lgtm

echo "⏳ Waiting for Grafana to be ready..."
for i in {1..60}; do
  if curl -fsS http://localhost:3300/api/health >/dev/null 2>&1; then
    echo "✅ Grafana ready at http://localhost:3300 (admin/admin)"
    echo "✅ started observability on port 3300"
    break
  fi
  sleep 1
done

# The backend only attaches the OpenTelemetry Java agent if :4318 was already
# listening when it booted, so a backend started before this script produces no
# traces at all — and therefore no sequence diagrams. Say so now, loudly, rather
# than letting an e2e run silently generate nothing.
backend_pid="$(lsof -nP -iTCP:8080 -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [[ -z "$backend_pid" ]]; then
  echo "ℹ️  Backend not up yet — start it now (./start-backend.sh) so it picks up the OTel agent."
elif ps -o command= -p "$backend_pid" 2>/dev/null | grep -q 'opentelemetry-javaagent.jar'; then
  echo "✅ Backend on :8080 already has the OTel agent attached — traces will be collected."
else
  echo "⚠️  Backend on :8080 is running WITHOUT the OpenTelemetry agent."
  echo "   Restart it (./start-backend.sh) or e2e runs will produce no sequence diagrams."
fi

# The frontend decides per page load whether the collector is reachable, so a
# dev server started earlier is fine — but any tab opened before now must be
# reloaded to start emitting spans.
if curl -fsS "http://127.0.0.1:4200/" >/dev/null 2>&1; then
  echo "ℹ️  Frontend on :4200 is up — reload any open tab so it starts exporting browser spans."
fi

echo "📜 Tailing logs — press Ctrl+C to stop and tear everything down."
docker compose logs -f lgtm
