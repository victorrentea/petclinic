#!/usr/bin/env bash
# Regenerate petclinic-backend/docs/generated/DbSchema.puml from DB.sql,
# highlighting in red the schema changes vs the previous committed DB.sql.
#
# Usage:
#   gen-db-schema-diagram.sh              # current = working-tree DB.sql, baseline = HEAD:DB.sql
#   gen-db-schema-diagram.sh --staged     # current = staged DB.sql (for the pre-commit hook)
#   gen-db-schema-diagram.sh --no-baseline # bootstrap snapshot, no red highlights
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
DB_SQL="$ROOT/DB.sql"
OUT="$ROOT/petclinic-backend/docs/generated/DbSchema.puml"
VENV="$SCRIPT_DIR/.venv"

MODE="working"
for arg in "$@"; do
  case "$arg" in
    --staged) MODE="staged" ;;
    --no-baseline) MODE="bootstrap" ;;
    *) echo "[db-schema-diagram] unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ── Bootstrap the venv (idempotent; only installs on first run) ─────────────
if [ ! -x "$VENV/bin/python" ]; then
  echo "[db-schema-diagram] creating venv + installing sqlglot…" >&2
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$SCRIPT_DIR/requirements.txt"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
CUR="$TMP_DIR/current.sql"
BASE="$TMP_DIR/baseline.sql"

# ── Resolve current schema ──────────────────────────────────────────────────
if [ "$MODE" = "staged" ]; then
  git -C "$ROOT" show :DB.sql >"$CUR" 2>/dev/null || cp "$DB_SQL" "$CUR"
else
  cp "$DB_SQL" "$CUR"
fi

# ── Resolve baseline schema (previous committed DB.sql) ─────────────────────
BASE_ARG=""
if [ "$MODE" != "bootstrap" ]; then
  if git -C "$ROOT" show HEAD:DB.sql >"$BASE" 2>/dev/null; then
    BASE_ARG="$BASE"
  fi
fi

"$VENV/bin/python" "$SCRIPT_DIR/db_schema_to_puml.py" \
  --current "$CUR" --baseline "$BASE_ARG" --out "$OUT"

echo "[db-schema-diagram] wrote $OUT" >&2
