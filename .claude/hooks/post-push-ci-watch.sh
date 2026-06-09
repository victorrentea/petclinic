#!/usr/bin/env bash
# PostToolUse hook (Bash): after a successful `git push` to this repo's
# github.com/victorrentea/* remote, tell Claude to start a BACKGROUND watch of
# the resulting CI run so it can report pass/fail when the run finishes.
#
# A hook can only return context synchronously — it cannot call back later when
# CI completes. So instead of watching here, it instructs the agent to launch
# `gh run watch --exit-status` as a background Bash task; the harness re-invokes
# the agent with the result when that task exits.
#
# The Bash command is parsed into a real shell AST by the `pushwatch` Go helper
# (mvdan.cc/sh) rather than regex/shlex — so quoting, `cd` chains, and
# `git -C <dir>` are interpreted correctly. The helper reports whether the
# command is an actual `git push` and the working directory it runs in.
set -uo pipefail

INPUT=$(cat)

# Cheap pre-filter: skip the (common) Bash calls that aren't a push at all,
# before paying for the Go helper.
printf '%s' "$INPUT" | grep -q 'git push' || exit 0

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PW_DIR="$HOOK_DIR/pushwatch"
BIN="$PW_DIR/pushwatch"

# Lazy build: compile the helper on first use (or when its source changed).
# The binary is gitignored; a fresh clone pays the build cost once.
if [ ! -x "$BIN" ] || [ "$PW_DIR/main.go" -nt "$BIN" ]; then
  command -v go >/dev/null 2>&1 || exit 0
  ( cd "$PW_DIR" && go build -o pushwatch . ) >/dev/null 2>&1 || exit 0
fi

# Helper output: line 1 = PUSH|NOPUSH, line 2 = effective working dir ("" = cwd).
DECISION="$(printf '%s' "$INPUT" | "$BIN" 2>/dev/null)" || exit 0
VERDICT="$(printf '%s\n' "$DECISION" | sed -n '1p')"
WORKDIR="$(printf '%s\n' "$DECISION" | sed -n '2p')"
[ "$VERDICT" = "PUSH" ] || exit 0

REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"

# This hook is scoped to THIS repo. A single session may push to other working
# copies (e.g. `cd ~/workspace/other && git push`); without this guard the hook
# attributes those pushes to this repo and watches the wrong CI. Resolve the
# directory the push actually ran in (the helper honored any `cd`/`git -C`) and
# bail unless it resolves to this repo's working tree.
repo_top="$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null)"
[ -n "$repo_top" ] || repo_top="$REPO_ROOT"

if [ -z "$WORKDIR" ]; then
  push_top="$repo_top"
else
  case "$WORKDIR" in
    "~") WORKDIR="$HOME" ;;
    "~/"*) WORKDIR="$HOME/${WORKDIR#\~/}" ;;
  esac
  case "$WORKDIR" in
    /*) : ;;
    *) WORKDIR="$REPO_ROOT/$WORKDIR" ;;
  esac
  push_top="$(git -C "$WORKDIR" rev-parse --show-toplevel 2>/dev/null)"
fi
[ -n "$push_top" ] && [ "$push_top" = "$repo_top" ] || exit 0

cd "$REPO_ROOT" || exit 0

# Need gh to watch runs at all.
command -v gh >/dev/null 2>&1 || exit 0

# Did the push land? Upstream must exist and match HEAD. If HEAD is ahead of its
# upstream, the push was blocked/failed (e.g. by pre-push) — stay silent.
UPSTREAM_REF=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null) || exit 0
[[ -n "$UPSTREAM_REF" ]] || exit 0
[[ "$(git rev-parse @ 2>/dev/null)" == "$(git rev-parse '@{u}' 2>/dev/null)" ]] || exit 0

# Only act on a github.com/victorrentea/* remote (where gh + Actions apply).
REMOTE="${UPSTREAM_REF%%/*}"
REMOTE_URL=$(git remote get-url "$REMOTE" 2>/dev/null || true)
printf '%s' "$REMOTE_URL" | grep -qiE 'github\.com[:/]victorrentea/' || exit 0

SHA=$(git rev-parse HEAD 2>/dev/null) || exit 0
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)

# Hand the agent a single short line to launch. All the polling/watching logic
# lives in watch-ci.sh, so the instruction stays tiny (minimal tokens spent on
# the agent side). The exit status of that background task is the CI verdict.
SHA="$SHA" BRANCH="$BRANCH" CMD="bash $PW_DIR/watch-ci.sh $SHA" python3 -c "
import json, os
short = os.environ['SHA'][:7]
msg = (
    'Push landed: ' + short + ' on ' + os.environ['BRANCH'] + '. '
    'Launch the CI watch in the BACKGROUND (run_in_background:true), then keep working — do not block:\n\n'
    + os.environ['CMD'] + '\n\n'
    'Exit 0 = CI green, non-zero = red. On green, just report it. On RED you MUST repair the build automatically — do NOT ask for permission: pull the failing job logs (gh run view <id> --log-failed), diagnose the root cause, apply the fix, commit, and push. Repair it even if someone else broke the build — any red build you catch is yours to fix. Report what you changed when done.'
)
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': msg}}))
"
