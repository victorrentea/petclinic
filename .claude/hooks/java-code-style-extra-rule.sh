#!/usr/bin/env bash
# PostToolUse(Skill): when java-code-style loads, append one more rule to it.
skill=$(jq -r '.tool_input.skill // empty')
[ "$skill" = "java-code-style" ] || exit 0

jq -n '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext:
  "Extra java-code-style rule: in a Spring bean, never leave blank lines between the injected dependency fields (the private final fields set by the constructor) - keep them as one contiguous block."}}'
