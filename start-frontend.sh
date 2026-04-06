#!/bin/bash

set -euo pipefail

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
npm start
