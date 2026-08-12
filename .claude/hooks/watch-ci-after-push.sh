#!/usr/bin/env bash
# PostToolUse hook (Bash): after a `git push` LANDS in this repo, this tripwire
# tells Claude to start a BACKGROUND watch of the resulting CI run and to fix it
# in case it FAILED❌, staying in the loop until CI is GREEN✅
#
###### Implementation #####
#
# A hook can only return context synchronously — it cannot call back later when
# CI completes. So instead of watching here, it instructs the agent to launch
# `watch-ci.sh` as a background Bash task; the harness re-invokes the agent with
# the result when that task exits. All polling logic lives there, so the injected
# instruction stays one short line.
#
# We do NOT parse the Bash command to work out whether it was a push, or which
# directory it ran in. Git already knows: a push that lands writes a reflog entry
# on the upstream remote-tracking ref, carrying both the SHA it delivered and a
# timestamp. That is authoritative — a push in the OTHER petclinic checkout never
# touches this repo's reflog — and it costs no shell parsing. (Requires
# core.logallrefupdates, on by default for non-bare repos.)
set -uo pipefail

# Cheap pre-filter on the hook JSON: skip the (common) Bash calls that never
# mention a push, before paying for any git work.
grep -q 'git push' || exit 0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 0
cd "$REPO_ROOT" || exit 0
command -v gh >/dev/null 2>&1 || exit 0   # need gh to watch runs at all

UP_FULL=$(git rev-parse --symbolic-full-name '@{u}' 2>/dev/null) || exit 0
[ -n "$UP_FULL" ] || exit 0
REMOTE=${UP_FULL#refs/remotes/}; REMOTE=${REMOTE%%/*}

# Only act on a github.com/victorrentea/* remote (where gh + Actions apply).
git remote get-url "$REMOTE" 2>/dev/null |
  grep -qiE 'github\.com[:/]victorrentea/' || exit 0

# Newest reflog entry on the upstream ref: "<ref>@{<unix>}<TAB><sha><TAB><subject>"
entry=$(git log -g -1 --date=unix --format='%gd%x09%H%x09%gs' "$UP_FULL" 2>/dev/null) || exit 0
[ -n "$entry" ] || exit 0
sel=${entry%%$'\t'*}; rest=${entry#*$'\t'}
SHA=${rest%%$'\t'*}; subject=${rest#*$'\t'}
ts=${sel##*@\{}; ts=${ts%\}}

# It must be a push (not a fetch/reset) and it must be THIS push, not an old one.
case "$subject" in *push*|*forced-update*) ;; *) exit 0 ;; esac
case "$ts" in ''|*[!0-9]*) exit 0 ;; esac
[ $(( $(date +%s) - ts )) -le 180 ] || exit 0

# One watch per delivered SHA: several Bash calls can follow a single push.
stamp="$(git rev-parse --git-dir)/pushwatch-last-sha"
[ "$(cat "$stamp" 2>/dev/null)" = "$SHA" ] && exit 0
printf '%s' "$SHA" >"$stamp"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
CMD="bash $REPO_ROOT/.claude/skills/ci-watch/scripts/watch-ci.sh $SHA"

# The repair protocol lives in .claude/skills/ci-watch/SKILL.md, NOT inline here.
# Green is the overwhelmingly common outcome and needs none of it, so paying for
# that prose on every single push — in a JSON string that has to be \n-escaped by
# hand — buys nothing. Point at the skill instead, and let it be loaded on red.
cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Push landed: ${SHA:0:7} on $BRANCH. Launch the CI watch in the BACKGROUND (run_in_background:true), then keep working — do not block:\n\n$CMD\n\nExit 0 = CI green: just report it. Non-zero = RED: invoke the 'ci-watch' skill and follow its repair protocol — repair the build automatically, without asking permission, even if someone else broke it. Output starting with ⚠️ is NOT a verdict: do not repair and do not claim green — read the ci-watch skill for what it means."}}
EOF
