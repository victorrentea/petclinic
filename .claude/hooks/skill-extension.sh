#!/usr/bin/env bash
# Post-tool-use hook: runs after the agent activates a skill.
#
# Bolts a personal rule file onto a team skill without editing the skill. When the
# `Skill` tool activates one of the skills listed below, the matching markdown is
# injected as additional context, right behind the skill's own body.
#
# Why a hook and not just more text in the skill: the skill is shared (and headed for
# a plugin someone else owns), so a local rule added inside it is a merge conflict
# waiting to happen. Here the two files never touch.
#
# Registered in .claude/settings.json under PostToolUse, matcher "Skill".

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"

# skill name -> markdown appended when it activates. A skill with no entry is ignored.
extension_for() {
    case "$1" in
    java-code-style) echo "$ROOT/.claude/java-code-style-extension.md" ;;
    *) echo "" ;;
    esac
}

INPUT=$(cat)

# The tool is invoked as Skill(skill="java-code-style"); a skill coming from a plugin
# is addressed "<plugin>:<name>", and a directory-scoped one "path/to/dir:<name>", so
# strip anything up to the last colon before matching.
SKILL=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print(''); raise SystemExit
args = d.get('tool_input') or d.get('toolArgs') or {}
print(str(args.get('skill') or '').rsplit(':', 1)[-1].strip())
" 2>/dev/null || true)

[ -n "$SKILL" ] || exit 0

EXT="$(extension_for "$SKILL")"
[ -n "$EXT" ] && [ -f "$EXT" ] || exit 0

EXT_PATH="$EXT" SKILL="$SKILL" python3 -c "
import json, os
path = os.environ['EXT_PATH']
with open(path, encoding='utf-8') as f:
    body = f.read()
msg = (
    'Local additions to the ' + os.environ['SKILL'] + ' skill, from ' + path + '.\n'
    'These are not part of the shared skill; apply them alongside it.\n\n' + body
)
out = {'hookEventName': 'PostToolUse', 'additionalContext': msg}
print(json.dumps({'hookSpecificOutput': out}))
"
