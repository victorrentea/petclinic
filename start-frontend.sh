#!/bin/bash

set -euo pipefail

printf '\033]0;FE\007'  # set terminal/tab title

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/petclinic-frontend"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend directory not found: $FRONTEND_DIR" >&2
  exit 1
fi

source "$SCRIPT_DIR/scripts/preflight.sh"
require_ports_free petclinic-frontend 4200

echo "🚀 Starting Petclinic Frontend (Angular)..."
echo "Frontend will be available at: http://localhost:4200/"
echo ""

cd "$FRONTEND_DIR"

announce_exit_failures petclinic-frontend

# ng serve keeps running, so a plain echo here would print before the dev server
# is actually ready: run it in the background and poll instead. The poll watches
# the ng process too — a compile error that kills it must end the wait at once,
# not leave a watcher hanging until its own timeout.
npm start &
NPM_PID=$!

for _ in {1..120}; do
  if curl -fsS http://localhost:4200/ >/dev/null 2>&1; then
    echo "✅ started petclinic-frontend on port 4200"
    break
  fi
  if ! kill -0 "$NPM_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

wait "$NPM_PID"
