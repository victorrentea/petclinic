#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/petclinic-backend"
FRONTEND_DIR="$SCRIPT_DIR/petclinic-frontend"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo "Stopping backend and frontend..."

  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID"
  fi

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID"
  fi
}

trap cleanup EXIT SIGINT SIGTERM

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend directory not found: $FRONTEND_DIR" >&2
  exit 1
fi

echo "Starting Petclinic Backend (Spring Boot)..."
(
  cd "$BACKEND_DIR"
  ./mvnw spring-boot:run
) &
BACKEND_PID=$!

echo "Starting Petclinic Frontend (Angular)..."
(
  cd "$FRONTEND_DIR"
  npm start
) &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Both services are starting. Press Ctrl+C to stop both."
echo "Frontend: http://localhost:4200/"
echo "Backend:  http://localhost:8080/"

wait "$BACKEND_PID" "$FRONTEND_PID"
