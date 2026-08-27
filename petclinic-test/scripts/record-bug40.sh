#!/usr/bin/env bash
# Film GitHub issue #40 — "Visit date has no range validation" — in a real browser.
#
# Two takes of the same script, so the pair can be watched side by side:
#   before  the bug reproduced: an absurd date sails through the form AND the API
#   after   the same keystrokes rejected, by the form AND by the API
#
# The narration is written as the run happens (never guessed afterwards) and burned into
# the frame by the review pipeline's annotate-feature-video.py, together with a spotlight
# on the element each line is about — Playwright does not record the mouse pointer, so
# without that a viewer cannot tell which widget just changed.
#
# Usage:
#   petclinic-test/scripts/record-bug40.sh before|after <out.webm>
#
# Writes, next to <out.webm>:
#   <out>.cues.json  the narration, timestamped, one entry per caption
#   <out>.srt        the same narration as a subtitle file, for players that want one
#   <out>.raw.webm   the film without the burned-in captions
set -euo pipefail

MODE="${1:?usage: record-bug40.sh before|after <out.webm>}"
OUT="${2:?usage: record-bug40.sh before|after <out.webm>}"
case "$MODE" in before|after) ;; *) echo "mode must be 'before' or 'after'" >&2; exit 2;; esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
ANNOTATE="$ROOT/.claude/skills/human-review/scripts/annotate-feature-video.py"

case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac
RAW="${OUT%.webm}.raw.webm"
CUES="${OUT%.webm}.cues.json"

BASE_URL="${BASE_URL:-http://localhost:4200}"
API_URL="${API_URL:-http://localhost:8080}"

curl -fsS -o /dev/null "$BASE_URL/" || { echo "[video] frontend not up at $BASE_URL" >&2; exit 2; }
curl -fsS -o /dev/null "$API_URL/api/pettypes" || { echo "[video] backend not up at $API_URL" >&2; exit 2; }

mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

NODE_PATH="$ROOT/petclinic-test/node_modules" node "$SCRIPT_DIR/record-bug40.js" \
    "$MODE" "$BASE_URL" "$API_URL" "$TMP" "$RAW" "$CUES"

python3 "$ANNOTATE" "$RAW" "$CUES" "$OUT"

# The same lines as a sidecar .srt: the burned-in bar is what you see, this is what you
# can grep, diff or hand to a player that renders its own subtitles.
python3 "$SCRIPT_DIR/cues-to-srt.py" "$CUES" "${OUT%.webm}.srt" "$OUT"

if command -v ffprobe >/dev/null 2>&1; then
  echo "[video] $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s, $(du -h "$OUT" | cut -f1)" >&2
fi
