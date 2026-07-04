#!/usr/bin/env bash
# Regenerate petclinic-backend/docs/generated/DB.puml from petclinic-backend/DB.sql
# as a PLAIN SNAPSHOT of the current schema — no diff highlighting. Comparing a
# snapshot against a previous one (e.g. at review time) is the puml-diff tool's job.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Discover the repo root. Unset the git env vars git exports when this runs from a
# hook: a leaked GIT_DIR makes `rev-parse --show-toplevel` return $SCRIPT_DIR (the
# cwd) instead of the work tree, which then mangles the DB.sql path (esp. in worktrees).
ROOT="$(unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE; git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
DB_SQL="$ROOT/petclinic-backend/DB.sql"
# OUT defaults to the committed diagram, but can be redirected (e.g. the pre-push hook
# regenerates to a temp file to verify DB.puml is in sync without touching the work tree).
OUT="${DB_PUML_OUT:-$ROOT/petclinic-backend/docs/generated/DB.puml}"
VENV="$SCRIPT_DIR/.venv"

# ── Bootstrap the venv (idempotent; only installs on first run) ─────────────
if [ ! -x "$VENV/bin/python" ]; then
  echo "[db-schema-diagram] creating venv + installing sqlglot…" >&2
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$SCRIPT_DIR/requirements.txt"
fi

"$VENV/bin/python" "$SCRIPT_DIR/db_schema_to_puml.py" --current "$DB_SQL" --out "$OUT"

echo "[db-schema-diagram] wrote $OUT" >&2
