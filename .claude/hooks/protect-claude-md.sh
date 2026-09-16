#!/usr/bin/env bash
# Pre-tool-use hook: refuse to let an agent write project rules into CLAUDE.md.
#
# CLAUDE.md in this repo is a one-line `@AGENTS.md` import and nothing else.
# AGENTS.md holds the actual rules, because Copilot CLI and Codex read AGENTS.md
# natively and have no import mechanism of their own — measured, not assumed:
# a markdown link and an `@path` line in .github/copilot-instructions.md both
# stay inert. A rule written into CLAUDE.md would therefore reach Claude Code
# only, and silently miss every other agent.
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

REASON="Blocked: CLAUDE.md is not the rules file in this repo.

  rules go in : $(dirname "$path")/AGENTS.md
  you targeted: $path  (one line, \"@AGENTS.md\", never edited)

AGENTS.md is what Copilot CLI and Codex read natively; Claude Code reaches it
through that import. Writing here would make the rule Claude-only. Put your
change in AGENTS.md in the same directory instead. Do not work around this with
a shell command — the rule is the point, not the tool."

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
