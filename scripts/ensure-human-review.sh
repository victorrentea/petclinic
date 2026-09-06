#!/usr/bin/env bash
# Print the /human-review skill directory, fetching it if it is not already here.
#
# The PlantUML differs used to live in this repo. They now ship with the /human-review
# skill (github.com/victorrentea/human-review), which is where it is developed — a second
# copy here would be a private fork of the review pipeline, drifting in silence.
#
# Callers reach into it, e.g. `$(ensure-human-review.sh)/puml-diff/puml_diff.py`.
#
# Five ways it can already be on this machine, tried in that order:
#
#   1. $CLAUDE_PLUGIN_ROOT — set only when something inside the plugin is running. Exact
#      when it is set, absent the rest of the time, so it can only ever be first.
#   2. $HUMAN_REVIEW_HOME — an explicit override, for developing the skill against this
#      repo without installing anything. It beats the installed plugin on purpose: someone
#      who sets it means it.
#   3. the installed plugin. Its path carries the installed commit
#      (`cache/human-review/human-review/<sha>/`), so this globs and takes the newest
#      rather than hardcoding a directory name that changes on every plugin update — the
#      exact rot this cascade exists to avoid.
#   4. the marketplace's own clone, which is stable and present whenever the marketplace
#      is registered, even if the plugin itself is not installed.
#   5. a local checkout symlinked into .claude/skills/. There is none here any more and it
#      is gitignored: it points at one machine's home directory, so committing it put a
#      path that resolves for exactly one person into a public repository.
#
# Failing all five (a CI runner, ordinarily) it is cloned into a gitignored .tools/ —
# the same shape as the Code City renderer and the OTel agent.
#
# Usage:  SKILL="$(scripts/ensure-human-review.sh)"
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
VENDORED="$ROOT/petclinic-backend/.tools/human-review/skills/human-review"
REPO="https://github.com/victorrentea/human-review.git"
MARKER="puml-diff/puml_diff.py"          # any file that proves this is the skill, not a stub

# `ls -td` puts the newest first; the glob is quoted out of `set -u`'s way and a no-match
# simply yields nothing, since nullglob is not on.
plugin_install() {
  local base="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/cache/human-review/human-review"
  [ -d "$base" ] || return 0
  ls -td "$base"/*/ 2>/dev/null | while read -r d; do
    [ -f "$d/skills/human-review/$MARKER" ] && { printf '%s\n' "${d%/}/skills/human-review"; break; }
  done
}

for candidate in \
    "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/skills/human-review" \
    "${HUMAN_REVIEW_HOME:-}" \
    "$(plugin_install)" \
    "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/marketplaces/human-review/skills/human-review" \
    "$ROOT/.claude/skills/human-review"; do
  if [ -n "$candidate" ] && [ -f "$candidate/$MARKER" ]; then
    echo "$candidate"
    exit 0
  fi
done

if [ ! -f "$VENDORED/$MARKER" ]; then
  echo "[human-review] fetching the skill from $REPO" >&2
  rm -rf "$ROOT/petclinic-backend/.tools/human-review"
  git clone --depth 1 --quiet "$REPO" "$ROOT/petclinic-backend/.tools/human-review"
fi

[ -f "$VENDORED/$MARKER" ] || { echo "[human-review] could not obtain the skill" >&2; exit 2; }
echo "$VENDORED"
