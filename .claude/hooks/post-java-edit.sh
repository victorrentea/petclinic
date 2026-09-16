#!/usr/bin/env bash
# Post-tool-use hook: runs after editing a Java file.
#   FQCN check: warn the agent when fully-qualified class names appear in code
# example: victor.training.petclinic.rest.error.ExceptionControllerAdvice.buildProblemDetail
# NOTE: Spotless formatting moved to .githooks/pre-commit — reformatting files
# right after an edit invalidated the agent's read cache (file changed on disk
# behind its back).
#
# ONE script, TWO agents, same split as watch-ci-after-push.sh:
#
#   (no arg)    Claude Code  — registered in .claude/settings.json
#   --copilot   Copilot CLI  — registered in .github/hooks/post-java-edit.json
#
# Two things differ between them and nothing else: where the edited file sits in
# the payload (`tool_input.file_path` vs `toolArgs.path`, so we read either), and
# the envelope the injected context has to be wrapped in.

set -uo pipefail

AGENT=claude
[ "${1:-}" = "--copilot" ] && AGENT=copilot

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print(''); raise SystemExit
args = d.get('tool_input') or d.get('toolArgs') or {}
print(args.get('file_path') or args.get('path') or '')
" 2>/dev/null || true)

printf '%s' "$FILE" | grep -qE '\.java$' || exit 0

# ── FQCN check ────────────────────────────────────────────────────────────────
[[ -f "$FILE" ]] || exit 0

FQCNS=$(grep -nE '[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+\.[A-Z][a-zA-Z0-9]*' "$FILE" \
    | grep -vE '^[0-9]+:[[:space:]]*(import |package |//|\*)' \
    2>/dev/null || true)

[[ -z "$FQCNS" ]] && exit 0

# Copilot CLI takes additionalContext at the top level; Claude Code nests it
# under hookSpecificOutput. Same finding, different envelope.
FQCNS="$FQCNS" FILE_PATH="$FILE" AGENT="$AGENT" python3 -c "
import json, os
head = 'FQCNs found in ' + os.environ['FILE_PATH']
msg = head + ' — replace with simple names + add imports:\n' + os.environ['FQCNS']
ctx = {'additionalContext': msg}
if os.environ['AGENT'] != 'copilot':
  ctx = {'hookSpecificOutput': dict(ctx, hookEventName='PostToolUse')}
print(json.dumps(ctx))
"
