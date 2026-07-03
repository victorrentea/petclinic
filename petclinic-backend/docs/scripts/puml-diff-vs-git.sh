#!/usr/bin/env bash
# Review-time diff of a committed PlantUML diagram: a previous snapshot (from git)
# vs the current working-tree snapshot. Additions render red, removals red +
# struck-through. This is the on-demand counterpart to the plain snapshot the
# generators commit — the git artifact stays a picture of current reality.
#
# Usage:
#   puml-diff-vs-git.sh <path-to.puml> [old-ref]      # old-ref defaults to HEAD
#   puml-diff-vs-git.sh petclinic-backend/docs/generated/DomainModel.puml
#   puml-diff-vs-git.sh petclinic-backend/docs/generated/DB.puml origin/main
#
# Writes <name>.diff.puml to a temp dir and, when plantuml is installed, renders
# <name>.diff.png and opens it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

FILE="${1:?usage: puml-diff-vs-git.sh <path-to.puml> [old-ref]}"
OLD_REF="${2:-HEAD}"

ABS="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
REL="${ABS#"$ROOT"/}"

TMP="$(mktemp -d)"
OLD="$TMP/previous.puml"
MERGED="$TMP/$(basename "${FILE%.puml}").diff.puml"

if ! git -C "$ROOT" show "$OLD_REF:$REL" >"$OLD" 2>/dev/null; then
  echo "[puml-diff] no '$REL' at $OLD_REF — treating the previous snapshot as empty" >&2
  : >"$OLD"
fi

python3 "$SCRIPT_DIR/puml_diff.py" "$OLD" "$ABS" --out "$MERGED"
echo "[puml-diff] wrote $MERGED" >&2

if command -v plantuml >/dev/null 2>&1; then
  plantuml -tpng "$MERGED" >&2
  PNG="${MERGED%.puml}.png"
  echo "[puml-diff] rendered $PNG" >&2
  command -v open >/dev/null 2>&1 && open "$PNG" || true
else
  echo "[puml-diff] plantuml not on PATH — render $MERGED yourself to view the diff" >&2
fi
