#!/usr/bin/env bash
# Collect every mechanical review artifact for a change set into review/assets/,
# so /human-review-guide spends its turns on judgement rather than on plumbing.
#
# Deliberately a thin orchestrator over the repo's canonical generators — it
# copies none of their logic. Duplicating puml_diff.py or architecture-diff.sh
# into the skill would give the skill its own quietly drifting fork of the
# review pipeline, which is the exact failure the guardrail tests exist to catch.
#
# Produces, when the change set warrants it:
#   review/assets/<name>.diff.svg   one per changed architecture diagram
#   review/assets/architecture.html the standalone gallery page
#   review/assets/SUMMARY.md        the same deltas as remote-rendered markdown
#
# Usage:
#   collect-review-artifacts.sh <BASE-REF> [output-dir]
#
# Exit codes: 0 = artifacts written (or nothing changed, which is not an error),
#             2 = usage/environment problem.
set -euo pipefail

BASE_REF="${1:?usage: collect-review-artifacts.sh <BASE-REF> [output-dir]}"
OUT_DIR="${2:-review/assets}"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DIFF_TOOL="scripts/architecture-diff.sh"
GALLERY="scripts/build_pr_gallery.py"

[ -x "$DIFF_TOOL" ] || { echo "[review-artifacts] missing $DIFF_TOOL" >&2; exit 2; }

mkdir -p "$OUT_DIR"

# ── 1. Architecture deltas (domain model, DB schema, packages) ──────────────
"$DIFF_TOOL" "$BASE_REF"

shopt -s nullglob
deltas=(pr-diff/*.diff.puml)
if [ ${#deltas[@]} -eq 0 ]; then
  echo "[review-artifacts] no architecture diagram changed — nothing to collect" >&2
  exit 0
fi
echo "[review-artifacts] ${#deltas[@]} diagram(s) changed" >&2

# ── 2. Render locally when we can; fall back to the encoded remote URLs ─────
# SUMMARY.md always carries plantuml.com URLs, so a missing local PlantUML costs
# offline-readability, not the section itself.
if command -v plantuml >/dev/null 2>&1; then
  plantuml -tsvg pr-diff/*.diff.puml
  cp pr-diff/*.diff.svg "$OUT_DIR"/
  echo "[review-artifacts] rendered $(ls -1 "$OUT_DIR"/*.diff.svg | wc -l | tr -d ' ') SVG(s) into $OUT_DIR" >&2

  if [ -f "$GALLERY" ]; then
    PR_NUMBER="${PR_NUMBER:-local}" \
    PR_TITLE="${PR_TITLE:-Local review}" \
    PR_BRANCH="${PR_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}" \
    PR_BASE="${PR_BASE:-$BASE_REF}" \
    REPO="${REPO:-}" \
      python3 "$GALLERY" pr-diff
    cp pr-diff/index.html "$OUT_DIR/architecture.html"
  fi
else
  echo "[review-artifacts] plantuml not on PATH — embedding the remote URLs from SUMMARY.md instead" >&2
fi

cp pr-diff/SUMMARY.md "$OUT_DIR"/
echo "[review-artifacts] wrote $OUT_DIR" >&2
