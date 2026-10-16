#!/usr/bin/env bash
# Post-tool-use hook: runs after the agent activates the `java-code-style` skill.
#   Appends the company-wide rules in my-java-code-style.md to the same context,
#   so the project's skill stays project-only and the company's rules live apart.
# The skill is path-scoped (`paths: **/*.java`), but it is still activated
# through a Skill tool call: {"tool_name":"Skill","tool_input":{"skill":"java-code-style"}}

set -uo pipefail

SKILL=$(python3 -c "
import sys, json
try:
    print((json.load(sys.stdin).get('tool_input') or {}).get('skill', ''))
except Exception:
    print('')
" 2>/dev/null || true)

# tolerate a plugin prefix, e.g. some-plugin:java-code-style
printf '%s' "$SKILL" | grep -qE '(^|:)java-code-style$' || exit 0

STYLE_FILE="$(dirname "$0")/my-java-code-style.md"
[[ -f "$STYLE_FILE" ]] || exit 0

STYLE_FILE="$STYLE_FILE" python3 -c "
import json, os
rules = open(os.environ['STYLE_FILE'], encoding='utf-8').read()
print(json.dumps({'hookSpecificOutput': {
  'hookEventName': 'PostToolUse',
  'additionalContext': rules,
}}))
"
