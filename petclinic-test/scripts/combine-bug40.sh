#!/usr/bin/env bash
# Join the two takes of record-bug40.sh into one film, each behind a title card:
#
#   BEFORE  →  bug40-before.webm      AFTER  →  bug40-after.webm
#
# The takes are recorded at different times against different code — the "before" one only
# exists while the bug does — so this is a separate step rather than part of the recorder.
# Output is H.264/.mp4, which macOS plays without installing anything, plus a merged .srt
# whose timestamps are shifted onto the joined timeline.
#
# Usage:
#   petclinic-test/scripts/combine-bug40.sh <before.webm> <after.webm> <out.mp4>
set -euo pipefail

BEFORE="${1:?usage: combine-bug40.sh <before.webm> <after.webm> <out.mp4>}"
AFTER="${2:?usage: combine-bug40.sh <before.webm> <after.webm> <out.mp4>}"
OUT="${3:?usage: combine-bug40.sh <before.webm> <after.webm> <out.mp4>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/combine-bug40.py" "$BEFORE" "$AFTER" "$OUT"
