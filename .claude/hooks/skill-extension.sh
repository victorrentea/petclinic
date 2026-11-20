#!/usr/bin/env bash
# PostToolUse hook (Skill): when a skill is activated, append .claude/<skill-name>.ext.md
# to the agent's context, if that file exists. Extends any skill — even one installed
# from a plugin — with project-specific rules, without touching its SKILL.md.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 0

python3 -c '
import sys, json, os
try:
  d = json.load(sys.stdin)
except Exception:
  raise SystemExit
skill = ((d.get("tool_input") or {}).get("skill") or "").split(":")[-1]
path = os.path.join(sys.argv[1], ".claude", skill + ".ext.md")
if not skill or not os.path.isfile(path):
  raise SystemExit
print(json.dumps({"hookSpecificOutput": {
  "hookEventName": "PostToolUse",
  "additionalContext": open(path, encoding="utf-8").read()}}))
' "$REPO_ROOT"
