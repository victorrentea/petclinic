#!/usr/bin/env bash
# Visual PR review for the living architecture: render the DELTA of every configured
# architecture diagram between two git refs into a gallery markdown. A PR that touches
# the domain becomes a wall of red-delta images instead of a wall of text.
#
#   red            = added (new element / member / relationship)
#   red strike-out = removed (kept in place, struck through)
#
# For each diagram we `git show <ref>:<path>` both sides and:
#   * identical           -> skip, list it as "unchanged";
#   * changed             -> puml_diff.py builds a colourised merged .diff.puml which
#                            plantuml renders to <name>.diff.png (reusing puml_diff's
#                            colour logic — not reinvented here);
#   * puml_diff won't render (sequence / component diagrams) -> FALL BACK to an
#                            ImageMagick `compare` of the before/after PNGs (differences
#                            in red) so every changed diagram still yields a visual delta.
#
# Usage:
#   architecture-diff.sh <baseRef> <headRef> [outDir]
#   architecture-diff.sh 4e0f9e2 HEAD
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve the repo root robustly: unset the git env vars a hook would export, otherwise a
# leaked GIT_DIR makes `rev-parse --show-toplevel` return $SCRIPT_DIR (esp. in worktrees).
ROOT="$(unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE; git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

BASE_REF="${1:?usage: architecture-diff.sh <baseRef> <headRef> [outDir]}"
HEAD_REF="${2:?usage: architecture-diff.sh <baseRef> <headRef> [outDir]}"
OUT_DIR="${3:-$ROOT/petclinic-backend/docs/generated/diff}"

# ── The living-architecture diagram set (repo-relative paths) ───────────────
DIAGRAMS=(
  "petclinic-backend/docs/generated/DomainModel.puml"
  "petclinic-backend/docs/generated/DB.puml"
  "petclinic-backend/docs/packages.puml"
  "petclinic-ui-test/features/generated_sequences/add-a-visit-to-an-existing-pet.puml"
  "petclinic-backend/docs/generated/c4views/C1-Context.puml"
)

command -v plantuml >/dev/null 2>&1 || { echo "[arch-diff] plantuml not on PATH" >&2; exit 1; }

mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

MD="$ROOT/ARCHITECTURE.diff.md"
CHANGED_MD="$TMP/changed.md"
: >"$CHANGED_MD"
UNCHANGED=()

# git show <ref>:<path> into $2; a missing path (added/removed diagram) becomes empty.
show_into() {
  local ref="$1" path="$2" dest="$3"
  if ! git -C "$ROOT" show "$ref:$path" >"$dest" 2>/dev/null; then
    : >"$dest"
  fi
}

# Render a .puml with plantuml; succeed only if a non-empty PNG is produced and PlantUML
# reported no syntax error (sequence/component diffs slip past puml_diff's class/ER parser).
render_png() {
  local puml="$1" errlog="$2"
  local png="${puml%.puml}.png"
  rm -f "$png"
  if plantuml -tpng -failfast2 "$puml" >"$errlog" 2>&1 \
       && [ -s "$png" ] \
       && ! grep -qiE 'syntax error|cannot find|assertion' "$errlog"; then
    return 0
  fi
  return 1
}

# ImageMagick fallback: pad both PNGs to a common canvas, then `compare` (differences in red).
imagemagick_delta() {
  local oldpng="$1" newpng="$2" outpng="$3"
  local ow oh nw nh W H
  ow=$(magick identify -format '%w' "$oldpng"); oh=$(magick identify -format '%h' "$oldpng")
  nw=$(magick identify -format '%w' "$newpng"); nh=$(magick identify -format '%h' "$newpng")
  W=$(( ow > nw ? ow : nw )); H=$(( oh > nh ? oh : nh ))
  magick "$oldpng" -background white -gravity NorthWest -extent "${W}x${H}" "$TMP/im_old.png"
  magick "$newpng" -background white -gravity NorthWest -extent "${W}x${H}" "$TMP/im_new.png"
  # compare exits 1 when images differ (expected); only >=2 is a real error.
  compare "$TMP/im_old.png" "$TMP/im_new.png" "$outpng" 2>/dev/null || true
  [ -s "$outpng" ]
}

echo "[arch-diff] $BASE_REF -> $HEAD_REF" >&2
for rel in "${DIAGRAMS[@]}"; do
  name="$(basename "${rel%.puml}")"
  old="$TMP/$name.old.puml"
  new="$TMP/$name.new.puml"
  show_into "$BASE_REF" "$rel" "$old"
  show_into "$HEAD_REF" "$rel" "$new"

  if cmp -s "$old" "$new"; then
    echo "[arch-diff] $name: unchanged" >&2
    UNCHANGED+=("$name")
    continue
  fi

  merged="$OUT_DIR/$name.diff.puml"
  delta_png="$OUT_DIR/$name.diff.png"
  method=""

  # Primary: reuse puml_diff.py's colour logic, then render.
  if python3 "$SCRIPT_DIR/puml_diff.py" "$old" "$new" --out "$merged" 2>"$TMP/pd.err" \
       && render_png "$merged" "$TMP/plantuml.err"; then
    method="puml_diff"
  else
    # Fallback: render before/after independently and ImageMagick-compare them.
    ok_old=1; ok_new=1
    cp "$old" "$TMP/$name.beforesrc.puml"; cp "$new" "$TMP/$name.aftersrc.puml"
    render_png "$TMP/$name.beforesrc.puml" "$TMP/b.err" || ok_old=0
    render_png "$TMP/$name.aftersrc.puml"  "$TMP/a.err" || ok_new=0
    if [ "$ok_old" = 1 ] && [ "$ok_new" = 1 ] \
         && imagemagick_delta "$TMP/$name.beforesrc.png" "$TMP/$name.aftersrc.png" "$delta_png"; then
      method="imagemagick"
    fi
  fi

  if [ -z "$method" ]; then
    echo "[arch-diff] $name: CHANGED but could not render a delta" >&2
    printf '### %s\n\n_changed, but a delta image could not be rendered._\n\n' "$name" >>"$CHANGED_MD"
    continue
  fi

  echo "[arch-diff] $name: changed (via $method) -> $delta_png" >&2
  rel_png="${delta_png#"$ROOT"/}"
  printf '### %s\n\n<sub>delta via %s</sub>\n\n![%s delta](%s)\n\n' \
    "$name" "$method" "$name" "$rel_png" >>"$CHANGED_MD"
done

# ── Assemble the gallery markdown ───────────────────────────────────────────
{
  echo "# Architecture delta — visual PR review"
  echo
  echo "Comparing \`$BASE_REF\` → \`$HEAD_REF\`."
  echo
  echo "**Legend:** red = added · ~~red strike-through~~ = removed."
  echo
  if [ -s "$CHANGED_MD" ]; then
    cat "$CHANGED_MD"
  else
    echo "_No architecture diagrams changed._"
    echo
  fi
  if [ "${#UNCHANGED[@]}" -gt 0 ]; then
    echo "---"
    echo
    joined="$(printf '%s, ' "${UNCHANGED[@]}")"
    echo "Unchanged: ${joined%, }."
  fi
} >"$MD"

echo "[arch-diff] wrote $MD" >&2
echo "[arch-diff] delta PNGs in $OUT_DIR" >&2
