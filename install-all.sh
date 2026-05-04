#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> mvn install: petclinic-database"
(cd "$ROOT/petclinic-database" && mvn install -DskipTests)

echo "==> mvn install: petclinic-backend"
(cd "$ROOT/petclinic-backend" && mvn install -DskipTests)

echo "==> npm install: petclinic-frontend"
(cd "$ROOT/petclinic-frontend" && npm install)

echo "==> npm install: petclinic-ui-test"
(cd "$ROOT/petclinic-ui-test" && npm install)

echo ""
echo "All dependencies installed."
