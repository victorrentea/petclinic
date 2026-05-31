#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> git: enabling project hooks (.githooks/)"
git -C "$ROOT" config core.hooksPath .githooks

echo "==> npm install + build: petclinic-backend-ts"
(cd "$ROOT/petclinic-backend-ts" && npm install && npm run build)

echo "==> npm install: petclinic-frontend"
(cd "$ROOT/petclinic-frontend" && npm install)

echo "==> npm install: petclinic-ui-test"
(cd "$ROOT/petclinic-ui-test" && npm install)

echo ""
echo "All dependencies installed."
