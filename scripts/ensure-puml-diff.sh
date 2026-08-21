#!/usr/bin/env bash
# Print the directory holding the PlantUML differs, fetching them if they are not here.
#
# They used to live in this repo. They now ship with the /human-review skill
# (github.com/victorrentea/human-review), which is where they are developed — a second
# copy here would be a private fork of the review pipeline, drifting in silence.
#
# Locally the skill is symlinked into .claude/skills/, so the differs are already on disk.
# On a CI runner nothing is symlinked, so they are cloned into a gitignored .tools/ —
# the same shape as the Code City renderer and the OTel agent.
#
# Usage:  PUML_DIFF_DIR="$(scripts/ensure-puml-diff.sh)"
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SKILL_COPY="$ROOT/.claude/skills/human-review/puml-diff"
VENDORED="$ROOT/petclinic-backend/.tools/human-review/skills/human-review/puml-diff"
REPO="https://github.com/victorrentea/human-review.git"

if [ -f "$SKILL_COPY/puml_diff.py" ]; then
  echo "$SKILL_COPY"
  exit 0
fi

if [ ! -f "$VENDORED/puml_diff.py" ]; then
  echo "[puml-diff] fetching the differs from $REPO" >&2
  rm -rf "$(dirname "$(dirname "$(dirname "$VENDORED")")")"
  git clone --depth 1 --quiet "$REPO" "$ROOT/petclinic-backend/.tools/human-review"
fi

[ -f "$VENDORED/puml_diff.py" ] || { echo "[puml-diff] could not obtain the differs" >&2; exit 2; }
echo "$VENDORED"
