#!/bin/bash
# Fires before openspec-apply-change. Blocks implementation if review hasn't been run this session.
INPUT=$(cat)
SKILL=$(echo "$INPUT" | jq -r '.tool_input.skill // empty')
SESSION=$(echo "$INPUT" | jq -r '.session_id // empty')

case "$SKILL" in
    "openspec-apply-change"|"opsx:apply")
        FLAG="/tmp/openspec-review-done-$SESSION"
        if [[ -f "$FLAG" ]]; then
            rm -f "$FLAG"
        else
            echo "openspec-review has not been run for this change. Invoke the openspec-review skill first, then retry." >&2
            exit 2
        fi
        ;;
esac
