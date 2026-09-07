#!/bin/bash
set -euo pipefail

printf '\033]0;DB\007'  # set terminal/tab title

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$SCRIPT_DIR/petclinic-database"
JAR="$DB_DIR/target/petclinic-database.jar"

source "$SCRIPT_DIR/scripts/preflight.sh"
# Before the build and, above all, before `rm -rf data` below: wiping the data dir
# out from under a still-running postmaster is what turns a plain "port busy" into
# a corrupted cluster that fails much later and far less legibly.
require_ports_free petclinic-database 5432 15432:"latency proxy"

if [[ ! -f "$JAR" ]]; then
  echo "Building petclinic-database launcher..."
  (cd "$DB_DIR" && mvn -q -DskipTests package)
fi

if [[ -d "$DB_DIR/data" ]]; then
  echo "🧹 Wiping existing data dir: $DB_DIR/data"
  rm -rf "$DB_DIR/data"
fi

echo "🐘 Starting embedded Postgres on localhost:5432..."
echo "Data dir: $DB_DIR/data"
echo ""

cd "$DB_DIR"
announce_exit_failures petclinic-database
java -jar "$JAR"
