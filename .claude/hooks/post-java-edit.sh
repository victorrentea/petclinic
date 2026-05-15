#!/usr/bin/env bash
# PostToolUse hook: runs after editing a Java file.
#   1. Spotless: format the file via spotless:apply
#   2. FQCN check: warn Claude when fully-qualified class names appear in code
set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)

printf '%s' "$FILE" | grep -qE '\.java$' || exit 0

# ── 1. Spotless ───────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT=$(cd "$REPO_ROOT/petclinic-backend" && ./mvnw spotless:apply -q 2>&1)
STATUS=$?
if [ $STATUS -ne 0 ]; then
    echo "$OUTPUT"
    exit $STATUS
fi

# ── 2. FQCN check ─────────────────────────────────────────────────────────────
[[ -f "$FILE" ]] || exit 0

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
