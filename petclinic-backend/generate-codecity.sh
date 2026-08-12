#!/usr/bin/env bash
# Regenerate this repo's Code City.
#
# The generators are NOT in this repo — they are a tool of their own, reusable on any
# Java checkout: https://github.com/victorrentea/code-city . This script keeps a clone
# of them under petclinic-backend/.codecity-tool/ (gitignored, kept beside the docs it
# generates) and runs it against PetClinic, with the same title and output folder the
# committed page already uses, so re-running produces a clean diff of what actually
# changed in the code, not of how it was generated.
#
#   petclinic-backend/generate-codecity.sh            # refresh the tool, then rebuild the page
#   CODECITY_NO_PULL=1 petclinic-backend/generate-codecity.sh   # keep the tool as-is (offline / pinned)
set -euo pipefail

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$BACKEND/.." && pwd)"
TOOL_URL="${CODECITY_TOOL_URL:-https://github.com/victorrentea/code-city.git}"
TOOL_DIR="${CODECITY_TOOL_DIR:-$BACKEND/.codecity-tool}"
OUT="$BACKEND/docs/generated/codecity"

if [ ! -d "$TOOL_DIR/.git" ]; then
  echo "cloning the Code City generators into $TOOL_DIR ..."
  git clone --depth 1 "$TOOL_URL" "$TOOL_DIR"
elif [ -z "${CODECITY_NO_PULL:-}" ]; then
  echo "updating the Code City generators in $TOOL_DIR ..."
  git -C "$TOOL_DIR" pull --ff-only --quiet
fi

# The title is pinned here (not derived from the folder name) because this page is
# committed and published on GitHub Pages: a contributor whose checkout is called
# something else must still regenerate byte-identical headings.
CODECITY_TITLE="Code City" "$TOOL_DIR/generate.sh" "$REPO" "$OUT"

# The tool also renders a 2-D view and leaves its .tsv inputs behind; we publish only
# the city, and codecity.html is self-contained.
find "$OUT" -maxdepth 1 -type f ! -name codecity.html -delete

echo
echo "open $OUT/codecity.html"
