#!/bin/bash

set -euo pipefail

printf '\033]0;FE\007'  # set terminal/tab title

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/petclinic-frontend"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend directory not found: $FRONTEND_DIR" >&2
  exit 1
fi

echo "🚀 Starting Petclinic Frontend (Angular)..."
echo "Frontend will be available at: http://localhost:4200/"
echo ""

cd "$FRONTEND_DIR"

# ng serve runs in the foreground, so a plain echo here would print before the
# dev server is actually ready. Instead poll port 4200 in the background and
# print the green-check banner only once the server is accepting connections.
(
  for _ in {1..120}; do
    if curl -fsS http://localhost:4200/ >/dev/null 2>&1; then
      echo "✅ started petclinic-frontend on port 4200"
      break
    fi
    sleep 1
  done
) &

npm start
