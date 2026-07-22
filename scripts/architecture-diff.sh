#!/usr/bin/env bash
# Review-time architecture delta for a whole PR/branch.
#
# The generators commit each diagram as a plain snapshot of *current* reality;
# this script answers the other question a reviewer actually has — "what did this
# branch change?" — by diffing every architecture diagram against the base branch
# and rendering the red add/remove delta.
#
# Output lands in pr-diff/ (git-ignored) as:
#   pr-diff/<name>.diff.puml   the merged delta diagram, per changed diagram
#   pr-diff/SUMMARY.md         a review gallery, each delta embedded as an SVG
#                              rendered by the public PlantUML server
#
# The SVGs are encoded into the URL (see plantuml_url.py) rather than proxied off
# GitHub raw: a delta diagram is never committed, so there is nothing to proxy.
#
# Usage:
#   scripts/architecture-diff.sh [base-ref]     # base-ref defaults to origin/main
#   scripts/architecture-diff.sh HEAD~3
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
BASE_REF="${1:-origin/main}"

PUML_DIFF="$ROOT/petclinic-backend/docs/scripts/puml-diff/puml_diff.py"
PLANTUML_URL="$SCRIPT_DIR/plantuml_url.py"
OUT_DIR="$ROOT/pr-diff"
SUMMARY="$OUT_DIR/SUMMARY.md"

# The architecture diagrams worth diffing, as `path|title`. Deliberately explicit
# rather than a glob over *.puml: generated_sequences/ and the C4 views are noisy
# per-run artifacts, not the structural picture a reviewer needs.
DIAGRAMS=(
  "petclinic-backend/docs/generated/DomainModel.puml|Domain model"
  "petclinic-backend/docs/generated/DB.puml|Database schema (ERD)"
  "petclinic-backend/docs/packages.puml|Logical architecture (packages)"
)

if ! git -C "$ROOT" rev-parse --verify --quiet "$BASE_REF^{commit}" >/dev/null; then
  echo "[architecture-diff] unknown base ref '$BASE_REF'" >&2
  exit 2
fi

# Diff against the merge-base, not the base tip: otherwise unrelated commits that
# landed on main after this branch started show up as "changes in this PR".
MERGE_BASE="$(git -C "$ROOT" merge-base "$BASE_REF" HEAD)"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

changed=()   # "path|title|difffile"
unchanged=()

for entry in "${DIAGRAMS[@]}"; do
  rel="${entry%%|*}"
  title="${entry##*|}"
  current="$ROOT/$rel"
  name="$(basename "${rel%.puml}")"

  if [ ! -f "$current" ]; then
    echo "[architecture-diff] $rel missing in the work tree — skipping" >&2
    continue
  fi

  old="$TMP/$name.base.puml"
  if ! git -C "$ROOT" show "$MERGE_BASE:$rel" >"$old" 2>/dev/null; then
    echo "[architecture-diff] $rel is new since $BASE_REF — diffing against empty" >&2
    : >"$old"
  fi

  if cmp -s "$old" "$current"; then
    unchanged+=("$title")
    continue
  fi

  diff_puml="$OUT_DIR/$name.diff.puml"
  python3 "$PUML_DIFF" "$old" "$current" --out "$diff_puml"
  changed+=("$rel|$title|$diff_puml")
  echo "[architecture-diff] $rel changed → $diff_puml" >&2
done

# ── Review gallery ──────────────────────────────────────────────────────────
{
  echo "# Architecture delta"
  echo
  echo "\`$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)\` vs \`$BASE_REF\` (merge-base \`$(git -C "$ROOT" rev-parse --short "$MERGE_BASE")\`)."
  echo
  if [ ${#changed[@]} -eq 0 ]; then
    echo "No architecture diagram changed on this branch."
  else
    echo "Red = added, red struck-through = removed. Each image is the *delta*, not the snapshot."
    echo
    for entry in "${changed[@]}"; do
      rel="${entry%%|*}"
      rest="${entry#*|}"
      title="${rest%%|*}"
      diff_puml="${rest##*|}"
      echo "## $title"
      echo
      echo "\`$rel\`"
      echo
      echo "![$title]($(python3 "$PLANTUML_URL" "$diff_puml" --format svg))"
      echo
    done
  fi
  if [ ${#unchanged[@]} -gt 0 ]; then
    joined="$(printf '%s, ' "${unchanged[@]}")"
    echo "<sub>Unchanged on this branch: ${joined%, }.</sub>"
  fi
} > "$SUMMARY"

echo "[architecture-diff] ${#changed[@]} diagram(s) changed — wrote $SUMMARY" >&2
