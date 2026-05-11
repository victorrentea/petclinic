#!/usr/bin/env bash
# PostToolUse hook: warns Claude when fully-qualified class names appear in Java code bodies
set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)

printf '%s' "$FILE" | grep -qE '\.java$' || exit 0
[[ -f "$FILE" ]] || exit 0

# Find FQCNs (e.g. java.util.List) not on import/package/comment lines
FQCNS=$(grep -nE '[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+\.[A-Z][a-zA-Z0-9]*' "$FILE" \
    | grep -vE '^[0-9]+:[[:space:]]*(import |package |//|\*)' \
    2>/dev/null || true)

[[ -z "$FQCNS" ]] && exit 0

FQCNS="$FQCNS" FILE_PATH="$FILE" python3 -c "
import json, os
file_path = os.environ['FILE_PATH']
findings = os.environ['FQCNS']
msg = 'FQCNs found in ' + file_path + ' — replace with simple names + add imports:\n' + findings
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': msg}}))
"
