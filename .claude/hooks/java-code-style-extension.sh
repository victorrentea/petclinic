#!/usr/bin/env bash
# Post-tool-use hook on Skill: when the company plugin's java-code-style skill loads,
# append this project's own rules (.claude/java-code-style-extension.md) to the context.
# The plugin stays untouched; the project only extends it.

set -uo pipefail

SKILL=$(python3 -c "
import sys, json
try:
    print((json.load(sys.stdin).get('tool_input') or {}).get('skill', ''))
except Exception:
    print('')
" 2>/dev/null || true)

[ "$SKILL" = "java-code-style:java-code-style" ] || exit 0

EXTENSION="$(git rev-parse --show-toplevel)/.claude/java-code-style-extension.md"
[[ -f "$EXTENSION" ]] || exit 0

EXTENSION="$EXTENSION" python3 -c "
import json, os
rules = open(os.environ['EXTENSION']).read()
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': rules}}))
"
