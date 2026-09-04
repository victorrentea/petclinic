#!/usr/bin/env bash
# Print the /human-review skill directory, fetching it if it is not already here.
#
# The PlantUML differs used to live in this repo. They now ship with the /human-review
# skill (github.com/victorrentea/human-review),
# which is where it is developed — a second copy here would be a private fork of the
# review pipeline, drifting in silence.
#
# Callers reach into it, e.g. `$(ensure-human-review.sh)/puml-diff/puml_diff.py`.
#
# Three ways it can already be here, tried in that order: an installed Claude Code
# plugin (the ordinary case — `/plugin install human-review@human-review`), a local
# checkout symlinked into .claude/skills/ for developing the skill itself, or nothing,
# in which case it is cloned into a gitignored .tools/ — the same shape as the Code
# City renderer and the OTel agent.
#
# The symlink is untracked on purpose: it points at one machine's home directory, so
# committing it put a path that resolves for exactly one person into a public repo.
#
# Usage:  SKILL="$(scripts/ensure-human-review.sh)"
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PLUGIN="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/human-review}/skills/human-review"
SKILL_COPY="$ROOT/.claude/skills/human-review"
VENDORED="$ROOT/petclinic-backend/.tools/human-review/skills/human-review"
REPO="https://github.com/victorrentea/human-review.git"

for candidate in "$PLUGIN" "$SKILL_COPY"; do
  if [ -f "$candidate/puml-diff/puml_diff.py" ]; then
    echo "$candidate"
    exit 0
  fi
done

if [ ! -f "$VENDORED/puml-diff/puml_diff.py" ]; then
  echo "[human-review] fetching the skill from $REPO" >&2
  rm -rf "$(dirname "$(dirname "$(dirname "$VENDORED")")")"
  git clone --depth 1 --quiet "$REPO" "$ROOT/petclinic-backend/.tools/human-review"
fi

[ -f "$VENDORED/puml-diff/puml_diff.py" ] || { echo "[human-review] could not obtain the skill" >&2; exit 2; }
echo "$VENDORED"
