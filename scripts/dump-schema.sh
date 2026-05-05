#!/usr/bin/env bash
# Dumps the current PostgreSQL schema to db.sql at project root.
# Run manually or triggered by the Claude Code hook when a migration file changes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$PROJECT_ROOT/db.sql"
PG_DUMP=/opt/homebrew/Cellar/libpq/17.5/bin/pg_dump

"$PG_DUMP" -h localhost -p 5432 -U petclinic -d petclinic \
  --schema-only \
  --no-owner \
  --no-acl \
  --no-comments \
  > "$OUT"

echo "Schema dumped to $OUT"
