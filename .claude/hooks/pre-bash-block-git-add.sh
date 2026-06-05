#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash): deny any command containing a `git add`
# invocation, even inside compound commands (cd x && git add y) that bypass
# the prefix-based "Bash(git add*)" deny rule. Staging is user-only here.
cmd=$(jq -r '.tool_input.command // ""')
if grep -qE '(^|[^[:alnum:]_./-])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^[:space:]]+)?)*[[:space:]]+add([[:space:]]|$)' <<<"$cmd"; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"git add is blocked: staging is user-only in this repo"}}'
fi
exit 0
