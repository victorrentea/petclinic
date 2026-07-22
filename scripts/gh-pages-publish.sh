#!/usr/bin/env bash
# Publish (or remove) one directory on the `gh-pages` branch, without touching main.
#
# gh-pages is a *derived* branch: pages-mirror.yml keeps it in step with main's
# tree, and this script owns everything under pr/. Nothing is ever merged from
# gh-pages back into main, which is what makes a preview published here
# structurally incapable of reaching the source of truth.
#
# Usage:
#   gh-pages-publish.sh <dest-path> <src-dir> <commit-message>
#   gh-pages-publish.sh --remove <dest-path> <commit-message>
#
# Environment:
#   GH_TOKEN          required in CI; a token with contents:write
#   GITHUB_REPOSITORY owner/repo (set by Actions; falls back to the origin remote)
set -euo pipefail

REMOVE=0
if [ "${1:-}" = "--remove" ]; then
  REMOVE=1
  shift
fi

DEST="${1:?usage: gh-pages-publish.sh [--remove] <dest-path> [src-dir] <commit-message>}"
if [ "$REMOVE" -eq 1 ]; then
  SRC=""
  MESSAGE="${2:?commit message required}"
else
  SRC="${2:?src-dir required}"
  MESSAGE="${3:?commit message required}"
fi

REPO="${GITHUB_REPOSITORY:-$(git remote get-url origin | sed -E 's#.*github\.com[:/]##; s#\.git$##')}"
if [ -n "${GH_TOKEN:-}" ]; then
  REMOTE="https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
else
  REMOTE="$(git remote get-url origin)"     # local runs: rely on the ambient credentials
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git -c advice.detachedHead=false clone --quiet --depth 1 --branch gh-pages --single-branch \
    "$REMOTE" "$WORK" 2>/dev/null || {
  echo "[gh-pages] branch absent — creating it as an orphan" >&2
  git clone --quiet --depth 1 "$REMOTE" "$WORK"
  git -C "$WORK" checkout --quiet --orphan gh-pages
  git -C "$WORK" rm -rq --cached . 2>/dev/null || true   # empty index on a fresh repo
  find "$WORK" -mindepth 1 -maxdepth 1 -not -name .git -exec rm -rf {} +
  touch "$WORK/.nojekyll"
}

git -C "$WORK" config user.name  'github-actions[bot]'
git -C "$WORK" config user.email '41898282+github-actions[bot]@users.noreply.github.com'

if [ "$REMOVE" -eq 1 ]; then
  if [ ! -e "$WORK/$DEST" ]; then
    echo "[gh-pages] $DEST is already absent — nothing to remove" >&2
    exit 0
  fi
  rm -rf "${WORK:?}/$DEST"
else
  rm -rf "${WORK:?}/$DEST"                  # replace wholesale, never merge stale files in
  mkdir -p "$WORK/$DEST"
  # Only the reviewable outputs: the .puml sources stay in the PR branch.
  cp "$SRC"/*.svg "$SRC"/*.html "$WORK/$DEST"/ 2>/dev/null || true
  [ -f "$SRC/SUMMARY.md" ] && cp "$SRC/SUMMARY.md" "$WORK/$DEST"/
fi

cd "$WORK"
git add -A
if git diff --cached --quiet; then
  echo "[gh-pages] no change at $DEST — skipping commit" >&2
  exit 0
fi
git commit --quiet -m "$MESSAGE"

# Two workflows write this branch (mirror + preview); a concurrency group serialises
# them, but a retry costs nothing and turns a lost race into a slow success.
for attempt in 1 2 3; do
  if git push --quiet origin gh-pages 2>/dev/null; then
    echo "[gh-pages] $([ "$REMOVE" -eq 1 ] && echo removed || echo published) $DEST" >&2
    exit 0
  fi
  echo "[gh-pages] push rejected (attempt $attempt) — rebasing onto the remote tip" >&2
  git fetch --quiet origin gh-pages
  git rebase --quiet origin/gh-pages || { git rebase --abort || true; }
done

echo "[gh-pages] could not push after 3 attempts" >&2
exit 1
