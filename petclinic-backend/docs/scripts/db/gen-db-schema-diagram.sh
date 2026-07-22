#!/usr/bin/env bash
# Regenerate petclinic-backend/docs/generated/DB.puml from petclinic-backend/DB.sql
# as a PLAIN SNAPSHOT of the current schema — no diff highlighting. Comparing a
# snapshot against a previous one (e.g. at review time) is the puml-diff tool's job.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Clear GIT_DIR/GIT_WORK_TREE: git exports them when this runs from a hook (pre-commit stages
# DB.sql, pre-push verifies the diagram), and with GIT_DIR set --show-toplevel reports the -C
# directory itself as the root, so ROOT would resolve to SCRIPT_DIR instead of the repo.
ROOT="$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
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
