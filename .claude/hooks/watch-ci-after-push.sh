#!/usr/bin/env bash
# PostToolUse hook (Bash): after a `git push` LANDS in this repo, this tripwire
# tells the agent to watch the resulting CI run and to fix it in case it
# FAILED❌, staying in the loop until CI is GREEN✅
#
# ONE script, TWO agents. Both Claude Code and Copilot CLI have a post-tool-use
# hook that can inject context, so the detection logic below is shared verbatim;
# only the JSON envelope and one sentence of the instruction differ:
#
#   (no arg)    Claude Code  — registered in .claude/settings.json
#   --copilot   Copilot CLI  — registered in .github/hooks/watch-ci-after-push.json
#
###### Implementation #####
#
# A hook can only return context synchronously — it cannot call back later when
# CI completes. So instead of watching here, it instructs the agent to run
# `watch-ci.sh` and consume its exit status. All polling logic lives there, so
# the injected instruction stays one short line.
#
# We do NOT parse the Bash command to work out whether it was a push, or which
# directory it ran in. Git already knows: a push that lands writes a reflog entry
# on the upstream remote-tracking ref, carrying both the SHA it delivered and a
# timestamp. That is authoritative — a push in the OTHER petclinic checkout never
# touches this repo's reflog — and it costs no shell parsing. (Requires
# core.logallrefupdates, on by default for non-bare repos.)
set -uo pipefail

AGENT=claude
[ "${1:-}" = "--copilot" ] && AGENT=copilot

# Cheap pre-filter on the hook JSON: skip the (common) tool calls that never
# mention a push, before paying for any git work. Both agents put the executed
# command in the payload on stdin, so one grep serves both.
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

# One watch per delivered SHA: several tool calls can follow a single push. The
# stamp is per-agent: Claude and Copilot are separate sessions that each need
# their own watch, so a shared stamp would let whoever fires first mute the other.
stamp="$(git rev-parse --git-dir)/pushwatch-last-sha.$AGENT"
[ "$(cat "$stamp" 2>/dev/null)" = "$SHA" ] && exit 0
printf '%s' "$SHA" >"$stamp"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
CMD="bash $REPO_ROOT/.claude/skills/ci-watch/scripts/watch-ci.sh $SHA"

# How to run the watch is the ONE thing that genuinely differs between the two
# agents, because only one of them can be woken up again:
#   Claude Code re-invokes the agent when a background Bash task exits, so the
#     watch belongs in the background and the session stays responsive.
#   Copilot CLI has no such callback — a backgrounded command's exit status
#     would simply be lost, and the verdict IS the exit status. So it must block.
if [ "$AGENT" = copilot ]; then
  HOW="Run the CI watch NOW and WAIT for it to finish — foreground, no '&', no backgrounding. Your shell tool caps a command at ~3 min and hands back control while it is STILL RUNNING: that is not a verdict, so keep reading the command's output until it actually exits. Its EXIT STATUS is the verdict:"
else
  HOW="Launch the CI watch in the BACKGROUND (run_in_background:true), then keep working — do not block:"
fi

# The repair protocol lives in .claude/skills/ci-watch/SKILL.md, NOT inline here.
# Green is the overwhelmingly common outcome and needs none of it, so paying for
# that prose on every single push — in a JSON string that has to be \n-escaped by
# hand — buys nothing. Point at the skill instead, and let it be loaded on red.
MSG="Push landed: ${SHA:0:7} on $BRANCH. $HOW\n\n$CMD\n\nExit 0 = CI green: just report it. Non-zero = RED: read the 'ci-watch' skill and follow its repair protocol — repair the build automatically, without asking permission, even if someone else broke it. Output starting with ⚠️ is NOT a verdict: do not repair and do not claim green — read the ci-watch skill for what it means."

# Same context, different envelope: Copilot's postToolUse takes additionalContext
# at the top level, Claude Code nests it under hookSpecificOutput.
if [ "$AGENT" = copilot ]; then
  printf '{"additionalContext":"%s"}\n' "$MSG"
else
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$MSG"
fi
