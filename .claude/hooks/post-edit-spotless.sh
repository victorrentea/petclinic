#!/usr/bin/env bash
# PostToolUse hook: runs spotless:apply after editing a Java file.
set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null || true)

if ! printf '%s' "$FILE" | grep -qE '\.java$'; then
    exit 0
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT=$(cd "$REPO_ROOT/petclinic-backend" && ./mvnw spotless:apply -q 2>&1)
STATUS=$?
if [ $STATUS -ne 0 ]; then
    echo "$OUTPUT"
    exit $STATUS
fi
