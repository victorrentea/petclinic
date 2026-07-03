#!/usr/bin/env bash
# Regenerate petclinic-backend/docs/generated/DB.puml from petclinic-backend/DB.sql
# as a plain projection of the current schema (no cross-commit diffing —
# comparing revisions is a separate tool's job).
#
# Usage:
#   gen-db-schema-diagram.sh              # source = working-tree DB.sql
#   gen-db-schema-diagram.sh --staged     # source = staged DB.sql (for the pre-commit hook)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
DB_SQL="$ROOT/petclinic-backend/DB.sql"
OUT="$ROOT/petclinic-backend/docs/generated/DB.puml"
VENV="$SCRIPT_DIR/.venv"

MODE="working"
for arg in "$@"; do
  case "$arg" in
    --staged) MODE="staged" ;;
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

# ── Resolve source schema ───────────────────────────────────────────────────
if [ "$MODE" = "staged" ]; then
  git -C "$ROOT" show :petclinic-backend/DB.sql >"$CUR" 2>/dev/null || cp "$DB_SQL" "$CUR"
else
  cp "$DB_SQL" "$CUR"
fi

"$VENV/bin/python" "$SCRIPT_DIR/db_schema_to_puml.py" --current "$CUR" --out "$OUT"

echo "[db-schema-diagram] wrote $OUT" >&2
