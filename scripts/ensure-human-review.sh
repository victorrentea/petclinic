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
#   3. the installed plugin, read from the CLI's own `installed_plugins.json`, which
#      records an `installPath` per scope. That indirection is not ceremony: the install
#      lives under `cache/human-review/human-review/<sha>/`, a directory whose name changes
#      on every plugin update, and updating leaves the *previous* sha's directory in place
#      with an identical mtime — so "newest by timestamp" is a coin toss that silently
#      resolves a stale copy of the skill (observed: `ls -td` tie-broke alphabetically and
#      picked the superseded one), and "the only directory there" stops being true after
#      the first update. The CLI knows which one it installed; ask it.
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

# The installed plugin, as the CLI itself records it. Falls back to a directory scan when
# the manifest is missing or unreadable (an older CLI, a hand-managed install) — and that
# fallback deliberately answers only when there is exactly one candidate, because guessing
# between two sha directories is precisely how a stale skill gets resolved unnoticed.
plugin_install() {
  cfg="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins"
  manifest="$cfg/installed_plugins.json"
  if [ -f "$manifest" ] && command -v python3 >/dev/null 2>&1; then
    from_manifest="$(python3 -c '
import json, sys
try:
    entries = json.load(open(sys.argv[1])).get("plugins", {}).get("human-review@human-review")
except Exception:
    sys.exit(1)
for e in entries or []:
    if e.get("installPath"):
        print(e["installPath"].rstrip("/") + "/skills/human-review")
        break
' "$manifest" 2>/dev/null || true)"
    if [ -n "$from_manifest" ]; then
      printf '%s\n' "$from_manifest"
      return 0
    fi
  fi
  base="$cfg/cache/human-review/human-review"
  [ -d "$base" ] || return 0
  only="$(find "$base" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)"
  [ "$(printf '%s\n' "$only" | grep -c .)" = "1" ] || return 0
  printf '%s\n' "${only%/}/skills/human-review"
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
