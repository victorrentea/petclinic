#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/petclinic-backend"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

echo "🚀 Starting Petclinic Backend (Spring Boot)..."
echo "Backend will be available at: http://localhost:8080/"
echo ""

cd "$BACKEND_DIR"
./mvnw spring-boot:run
