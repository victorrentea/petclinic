#!/usr/bin/env bash
# PreToolUse(Write|Edit): refuse to let an agent write project rules into CLAUDE.md.
#
# CLAUDE.md in this repo is a one-line `@AGENTS.md` import and nothing else.
# AGENTS.md holds the actual rules, because Copilot CLI and Codex read AGENTS.md
# natively and have no import mechanism of their own — measured, not assumed:
# a markdown link and an `@path` line in .github/copilot-instructions.md both
# stay inert. A rule written into CLAUDE.md would therefore reach Claude Code
# only, and silently miss every other agent.
#
# Exit 2 blocks the tool call and feeds stderr back to the model.
set -u

payload="$(cat)"

path="$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))
except Exception:
    print("")
' 2>/dev/null)"

[ -n "$path" ] || exit 0
[ "$(basename "$path")" = "CLAUDE.md" ] || exit 0
case "$path" in *.claude/*) exit 0 ;; esac

cat >&2 <<EOF
Blocked: CLAUDE.md is not the rules file in this repo.

  rules go in : $(dirname "$path")/AGENTS.md
  you targeted: $path  (one line, "@AGENTS.md", never edited)

AGENTS.md is what Copilot CLI and Codex read natively; Claude Code reaches it
through that import. Writing here would make the rule Claude-only. Put your
change in AGENTS.md in the same directory instead.
EOF
exit 2
