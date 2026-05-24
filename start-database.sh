#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$SCRIPT_DIR/petclinic-database"
JAR="$DB_DIR/target/petclinic-database.jar"

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
exec java -jar "$JAR"
