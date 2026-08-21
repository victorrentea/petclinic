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
# Locally the skill is symlinked into .claude/skills/, so the differs are already on disk.
# On a CI runner nothing is symlinked, so they are cloned into a gitignored .tools/ —
# the same shape as the Code City renderer and the OTel agent.
#
# Usage:  SKILL="$(scripts/ensure-human-review.sh)"
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SKILL_COPY="$ROOT/.claude/skills/human-review"
VENDORED="$ROOT/petclinic-backend/.tools/human-review/skills/human-review"
REPO="https://github.com/victorrentea/human-review.git"

if [ -f "$SKILL_COPY/puml-diff/puml_diff.py" ]; then
  echo "$SKILL_COPY"
  exit 0
fi

if [ ! -f "$VENDORED/puml-diff/puml_diff.py" ]; then
  echo "[human-review] fetching the skill from $REPO" >&2
  rm -rf "$(dirname "$(dirname "$(dirname "$VENDORED")")")"
  git clone --depth 1 --quiet "$REPO" "$ROOT/petclinic-backend/.tools/human-review"
fi

[ -f "$VENDORED/puml-diff/puml_diff.py" ] || { echo "[human-review] could not obtain the skill" >&2; exit 2; }
echo "$VENDORED"
