#!/usr/bin/env bash
# Regenerate this repo's Code City (and the 2-D codemap beside it).
#
# The generators are NOT in this repo — they are a tool of their own, reusable on any
# Java checkout: https://github.com/victorrentea/code-city . This script keeps a clone
# of them under petclinic-backend/.codecity-tool/ (gitignored, kept beside the docs it
# generates rather than at the repo root) and runs it against PetClinic, with the
# same title and output folder the committed pages already use, so re-running produces
# a clean diff of what actually changed in the code, not of how it was generated.
#
#   ./generate-codecity.sh            # refresh the tool, then rebuild the pages
#   CODECITY_NO_PULL=1 ./generate-codecity.sh   # keep the tool as-is (offline / pinned)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_URL="${CODECITY_TOOL_URL:-https://github.com/victorrentea/code-city.git}"
TOOL_DIR="${CODECITY_TOOL_DIR:-$REPO/petclinic-backend/.codecity-tool}"
OUT="$REPO/petclinic-backend/docs/generated/codemap"

if [ ! -d "$TOOL_DIR/.git" ]; then
  echo "cloning the Code City generators into $TOOL_DIR ..."
  git clone --depth 1 "$TOOL_URL" "$TOOL_DIR"
elif [ -z "${CODECITY_NO_PULL:-}" ]; then
  echo "updating the Code City generators in $TOOL_DIR ..."
  git -C "$TOOL_DIR" pull --ff-only --quiet
fi

# Titles are pinned here (not derived from the folder name) because these pages are
# committed and published on GitHub Pages: a contributor whose checkout is called
# something else must still regenerate byte-identical headings.
HEATMAP_TITLE="Spring PetClinic Codemap" \
  CODECITY_TITLE="Code City" \
  "$TOOL_DIR/generate.sh" "$REPO" "$OUT"

echo
echo "open $OUT/codecity.html"
