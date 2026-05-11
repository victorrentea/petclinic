#!/bin/bash
# Fires after any Skill tool use. Handles openspec workflow checkpoints.
INPUT=$(cat)
SKILL=$(echo "$INPUT" | jq -r '.tool_input.skill // empty')
SESSION=$(echo "$INPUT" | jq -r '.session_id // empty')

case "$SKILL" in
    "openspec-propose"|"opsx:propose")
        echo "REQUIRED: Artifacts just generated. You MUST now invoke the openspec-review skill (using the Skill tool) to review them before prompting the user to implement. Do not skip this step."
        ;;
    "openspec-review")
        [[ -n "$SESSION" ]] && touch "/tmp/openspec-review-done-$SESSION"
        ;;
esac
