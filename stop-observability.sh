#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "🛑 Stopping Grafana LGTM..."
docker compose down
echo "✅ Stopped (data persisted in volume 'lgtm-data')"
