#!/usr/bin/env bash
# Exercises the resolution cascade in ensure-human-review.sh against fake layouts.
#
# The cascade is the kind of code that rots without anyone noticing: it is only ever
# exercised by whichever layout the author happens to have, and every branch that does not
# fire on their laptop is untested. This repo has already been bitten by exactly that — the
# skill used to be resolved through a committed symlink into one person's home directory,
# which worked for one person and for nobody else.
#
# The branch most likely to rot is the installed plugin's, because its path carries the
# installed commit (`cache/human-review/human-review/<sha>/`) and therefore changes on every
# plugin update. A hardcoded directory name would keep working until the next update and
# then silently fall through to cloning the repo on every invocation.
#
# Run:  scripts/ensure-human-review-test.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENSURE="$ROOT/scripts/ensure-human-review.sh"
MARKER="puml-diff/puml_diff.py"

fail() { echo "[ensure-human-review-test] ❌ $*" >&2; exit 1; }
ok()   { echo "[ensure-human-review-test] ✓ $*"; }

[ -x "$ENSURE" ] || fail "$ENSURE is not executable"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# A git repo to run in, so `git rev-parse --show-toplevel` answers.
REPO="$TMP/repo"
mkdir -p "$REPO"
git init -q "$REPO"
# `git rev-parse --show-toplevel` reports the *resolved* path, and on macOS `mktemp -d`
# hands back /var/... which is a symlink to /private/var/... . Comparing against the
# unresolved name would fail here for a reason that has nothing to do with the cascade.
REPO="$(cd "$REPO" && pwd -P)"

# A fake CLAUDE_CONFIG_DIR holding both an installed plugin (under two commit shas, so the
# newest-wins rule is actually exercised) and the marketplace clone.
CFG="$TMP/claude"
OLD_SHA="$CFG/plugins/cache/human-review/human-review/aaaaaaaaaaaa/skills/human-review"
NEW_SHA="$CFG/plugins/cache/human-review/human-review/bbbbbbbbbbbb/skills/human-review"
MARKET="$CFG/plugins/marketplaces/human-review/skills/human-review"
for d in "$OLD_SHA" "$NEW_SHA" "$MARKET"; do
  mkdir -p "$d/puml-diff"
  : > "$d/$MARKER"
done
# `ls -td` orders by mtime, so make the intended winner unambiguously newer.
touch -t 202001010000 "$CFG/plugins/cache/human-review/human-review/aaaaaaaaaaaa"
touch -t 203001010000 "$CFG/plugins/cache/human-review/human-review/bbbbbbbbbbbb"

run() { (cd "$REPO" && env "$@" bash "$ENSURE"); }

# 1. The installed plugin, newest commit, when nothing overrides it.
got="$(run CLAUDE_CONFIG_DIR="$CFG")"
[ "$got" = "$NEW_SHA" ] || fail "expected the newest installed plugin, got: $got"
ok "the installed plugin wins, and the newest commit of it"

# 2. $HUMAN_REVIEW_HOME beats the installed plugin — somebody who sets it means it.
HOME_DIR="$TMP/dev/skills/human-review"
mkdir -p "$HOME_DIR/puml-diff"; : > "$HOME_DIR/$MARKER"
got="$(run CLAUDE_CONFIG_DIR="$CFG" HUMAN_REVIEW_HOME="$HOME_DIR")"
[ "$got" = "$HOME_DIR" ] || fail "expected \$HUMAN_REVIEW_HOME to win, got: $got"
ok "\$HUMAN_REVIEW_HOME overrides the installed plugin"

# 3. An override pointing at nothing must not hijack the cascade into failing.
got="$(run CLAUDE_CONFIG_DIR="$CFG" HUMAN_REVIEW_HOME=/nope/nothing)"
[ "$got" = "$NEW_SHA" ] || fail "a bogus override broke the cascade, got: $got"
ok "a bogus \$HUMAN_REVIEW_HOME falls through instead of failing"

# 4. With no plugin installed, the marketplace's own clone answers.
rm -rf "$CFG/plugins/cache"
got="$(run CLAUDE_CONFIG_DIR="$CFG")"
[ "$got" = "$MARKET" ] || fail "expected the marketplace clone, got: $got"
ok "the marketplace clone answers when the plugin is not installed"

# 5. A local checkout symlinked into .claude/skills/ still works, for skill development.
rm -rf "$CFG/plugins"
LOCAL="$TMP/checkout/skills/human-review"
mkdir -p "$LOCAL/puml-diff"; : > "$LOCAL/$MARKER"
mkdir -p "$REPO/.claude/skills"
ln -sfn "$LOCAL" "$REPO/.claude/skills/human-review"
got="$(run CLAUDE_CONFIG_DIR="$CFG")"
[ "$got" = "$REPO/.claude/skills/human-review" ] || fail "expected the local symlink, got: $got"
ok "a local checkout symlinked in is still honoured"

# 6. $CLAUDE_PLUGIN_ROOT beats everything, since it is exact whenever it is set at all.
PLUGROOT="$TMP/plugroot"
mkdir -p "$PLUGROOT/skills/human-review/puml-diff"; : > "$PLUGROOT/skills/human-review/$MARKER"
got="$(run CLAUDE_CONFIG_DIR="$CFG" CLAUDE_PLUGIN_ROOT="$PLUGROOT")"
[ "$got" = "$PLUGROOT/skills/human-review" ] || fail "expected \$CLAUDE_PLUGIN_ROOT, got: $got"
ok "\$CLAUDE_PLUGIN_ROOT wins outright"

# 7. A directory that exists but holds no marker is not the skill. This is the Windows
#    symlink-as-text-stub failure the AGENTS.md guard also watches for: something is there,
#    and it is not what it claims to be.
rm -f "$REPO/.claude/skills/human-review"
mkdir -p "$REPO/.claude/skills/human-review"
got="$(run CLAUDE_CONFIG_DIR="$CFG" HUMAN_REVIEW_HOME="$HOME_DIR")"
[ "$got" = "$HOME_DIR" ] || fail "an empty directory was accepted as the skill: $got"
ok "a directory without the differ is not mistaken for the skill"

echo "[ensure-human-review-test] all cascade branches behave"
