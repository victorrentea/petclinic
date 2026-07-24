#!/usr/bin/env bash
#
# Import the PetClinic monitoring dashboard into a running Grafana.
#
# Prerequisites: the observability stack is up (./start-grafana.sh) and the
# backend was started AFTER it, so the OTel Java agent is attached and metrics
# are flowing. See ./README.md for details.
#
# Usage:
#   ./import-dashboard.sh                       # localhost:3300, admin/admin
#   GRAFANA_URL=http://host:3300 ./import-dashboard.sh
#   GRAFANA_USER=admin GRAFANA_PASS=secret ./import-dashboard.sh
#
# Re-running is safe: the dashboard has a stable uid and is overwritten in place.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_JSON="$SCRIPT_DIR/petclinic-app-monitoring.json"

GRAFANA_URL="${GRAFANA_URL:-http://localhost:3300}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASS="${GRAFANA_PASS:-admin}"

if [[ ! -f "$DASHBOARD_JSON" ]]; then
  echo "❌ Dashboard model not found: $DASHBOARD_JSON" >&2
  exit 1
fi

if ! curl -fsS -o /dev/null "$GRAFANA_URL/api/health"; then
  echo "❌ Grafana is not reachable at $GRAFANA_URL — run ./start-grafana.sh first." >&2
  exit 1
fi

echo "📊 Importing dashboard into $GRAFANA_URL ..."

# Wrap the dashboard model in the /api/dashboards/db envelope. Embedding the
# file as a JSON value needs no jq/python — the file is already valid JSON.
payload=$(printf '{"dashboard": %s, "overwrite": true, "message": "Imported via import-dashboard.sh"}' "$(cat "$DASHBOARD_JSON")")

response=$(curl -fsS -u "$GRAFANA_USER:$GRAFANA_PASS" \
  -H "Content-Type: application/json" \
  -X POST "$GRAFANA_URL/api/dashboards/db" \
  -d "$payload")

# Pull the dashboard path out of the response without a JSON parser dependency.
url_path=$(printf '%s' "$response" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')

if [[ -n "$url_path" ]]; then
  echo "✅ Imported. Open it at: $GRAFANA_URL$url_path"
else
  echo "⚠️  Import call returned an unexpected response:"
  echo "$response"
  exit 1
fi
