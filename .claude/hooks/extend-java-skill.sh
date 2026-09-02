#!/usr/bin/env bash
# PreToolUse(Skill): bolt extra rules onto the `java` skill at activation time.
#
# Why a hook and not just more lines in SKILL.md: the extra rules stand in for
# rules a *team plugin* would ship. Keeping them in a separate markdown file that
# the hook injects means the skill body stays the project's own, and the
# extension can be swapped, versioned or removed without editing the skill.
#
# The hook fires on every Skill call, ignores every skill but `java`, and returns
# the extension file as additionalContext, which Claude Code delivers as a
# system-reminder before the skill body is read.
set -uo pipefail

EXT="${CLAUDE_PROJECT_DIR:-.}/.claude/java-ext.md"
[ -f "$EXT" ] || exit 0

payload="$(cat)"

skill="$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    ti = json.load(sys.stdin).get("tool_input", {})
except Exception:
    ti = {}
print(ti.get("skill") or "")
' 2>/dev/null)"

# tolerate a plugin prefix such as "team-plugin:java", then match exactly
case "${skill##*:}" in java) ;; *) exit 0 ;; esac

EXT="$EXT" python3 -c '
import json, os
body = open(os.environ["EXT"], encoding="utf-8").read()
msg = (
    "Additional `java` skill rules, injected by the project PreToolUse(Skill) hook "
    "from .claude/java-ext.md. They extend the skill body you are about to read and "
    "carry exactly the same weight:\n\n" + body
)
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "java skill extended from .claude/java-ext.md",
    "additionalContext": msg,
}}))
'
