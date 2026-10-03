#!/usr/bin/env bash
# Pre-tool-use hook: refuse to let an agent create or write a CLAUDE.md.
#
# This repo has no CLAUDE.md on purpose. AGENTS.md holds the rules, and every
# agent reads it natively: Copilot CLI and Codex always, Claude Code (>= 2.1.277)
# only in a project with NO CLAUDE.md — root or nested AGENTS.md alike. So a
# single CLAUDE.md, anywhere, would silently switch off every AGENTS.md here for
# Claude Code, and a rule written into it would miss every other agent.
#
# ONE script, TWO agents, same split as the other hooks here:
#
#   (no arg)    Claude Code  — registered in .claude/settings.json
#   --copilot   Copilot CLI  — registered in .github/hooks/protect-claude-md.json
#
# Two things differ. The edited file sits under a different key (`tool_input.
# file_path` vs `toolArgs.path`), so we read either. And the way you refuse a
# tool call is NOT the same, measured on Copilot CLI 1.0.85 — four variants
# tried, only one both blocks and explains:
#
#   exit 2 + stderr                    Claude: blocks, model reads stderr
#                                      Copilot: blocks, but the model is told only
#                                        "hook exited with code 2" — the reason is
#                                        dropped, and it happily retries via bash.
#   {"permissionDecision":"deny",      Copilot: blocks AND surfaces the reason as
#    "permissionDecisionReason":…}       "Denied by preToolUse hook: <reason>"
#   {"decision":"block","reason":…}    Copilot: ignored outright, the write lands.
#
# So Claude keeps exit 2, Copilot gets the JSON verdict (and exit 0 — its verdict
# is the JSON, not the status).
set -u

AGENT=claude
[ "${1:-}" = "--copilot" ] && AGENT=copilot

payload="$(cat)"

# A file tool hands us a path; a shell tool hands us a command line. Both can
# land content in CLAUDE.md, and Copilot reaches for the shell unprompted: asked
# to "append a line", 1.0.85 skipped `create`/`edit` entirely and ran `echo >>`,
# sailing past a guard that only watched the file tools. So we look at both, and
# only at a command that WRITES — reading CLAUDE.md stays perfectly fine.
path="$(printf '%s' "$payload" | python3 -c '
import json, re, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit

args = d.get("tool_input") or d.get("toolArgs") or {}
path = args.get("file_path") or args.get("path") or ""
if path:
    print(path); raise SystemExit

cmd = args.get("command") or ""
m = re.search(r"(\S*CLAUDE\.md)\b", cmd)
if not m:
    print(""); raise SystemExit
# write-ish shapes only: redirection into it, or a tool known to rewrite in place
writes = (re.search(r">>?\s*\S*CLAUDE\.md\b", cmd)
          or re.search(r"\b(tee|truncate|install|dd)\b[^|;&]*\bCLAUDE\.md\b", cmd)
          or re.search(r"\b(sed|perl)\b[^|;&]*\s-i\b[^|;&]*\bCLAUDE\.md\b", cmd)
          or re.search(r"\b(cp|mv)\b[^|;&]*\s\S*CLAUDE\.md\b", cmd))
print(m.group(1) if writes else "")
' 2>/dev/null)"

[ -n "$path" ] || exit 0
[ "$(basename "$path")" = "CLAUDE.md" ] || exit 0
case "$path" in *.claude/*) exit 0 ;; esac

REASON="Blocked: this repo has no CLAUDE.md, on purpose.

  rules go in : $(dirname "$path")/AGENTS.md
  you targeted: $path

Every agent reads AGENTS.md natively, but Claude Code reads it only while the
project has no CLAUDE.md: creating one would silently switch off every AGENTS.md
here. Put your change in AGENTS.md in the same directory instead. Do not work
around this with a shell command — the rule is the point, not the tool."

if [ "$AGENT" = copilot ]; then
  REASON="$REASON" python3 -c "
import json, os
print(json.dumps({'permissionDecision': 'deny',
                  'permissionDecisionReason': os.environ['REASON']}))
"
  exit 0
fi

printf '%s\n' "$REASON" >&2
exit 2
