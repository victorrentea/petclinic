#!/usr/bin/env bash
# PostToolUse hook (Bash): after a successful `git push` to this repo's
# github.com/victorrentea/* remote, tell Claude to start a BACKGROUND watch of
# the resulting CI run so it can report pass/fail when the run finishes.
#
# A hook can only return context synchronously — it cannot call back later when
# CI completes. So instead of watching here, it instructs the agent to launch
# `gh run watch --exit-status` as a background Bash task; the harness re-invokes
# the agent with the result when that task exits.
set -uo pipefail

INPUT=$(cat)

# Cheap pre-filter: skip the (common) Bash calls that aren't a push at all.
printf '%s' "$INPUT" | grep -q 'git push' || exit 0

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('command', ''))
" 2>/dev/null || true)

# Authoritative check: an actual `git push` invocation (not e.g. an echo).
printf '%s' "$COMMAND" | grep -qE '(^|&&|\|\||;)\s*git push\b' || exit 0

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# This hook is scoped to THIS repo. A single session may push to other working
# copies (e.g. `cd ~/workspace/other && git push`); without this guard the hook
# attributes those pushes to this repo and watches the wrong CI. Resolve the
# directory the push actually ran in (honoring a leading/embedded `cd`) and bail
# unless it resolves to this repo's working tree.
DECISION=$(COMMAND="$COMMAND" REPO_ROOT="$REPO_ROOT" python3 - <<'PYEOF'
import os, re, shlex, subprocess

def toplevel(d):
    try:
        r = subprocess.run(['git', '-C', d, 'rev-parse', '--show-toplevel'],
                           capture_output=True, text=True)
        out = r.stdout.strip()
        return os.path.realpath(out) if r.returncode == 0 and out else ''
    except Exception:
        return ''

cmd = os.environ.get('COMMAND', '')
repo_root = os.environ.get('REPO_ROOT', '')

# Effective working dir = the last `cd` before `git push` (else the session cwd).
workdir = ''
for seg in re.split(r'(?:&&|\|\||;|\n)', cmd):
    s = seg.strip()
    if s.startswith('cd '):
        rest = s[3:].strip()
        try:
            parts = shlex.split(rest)
        except ValueError:
            parts = rest.split()
        if parts:
            workdir = parts[0]
    if re.search(r'\bgit\s+push\b', s):
        break

repo_top = toplevel(repo_root) or os.path.realpath(repo_root)
if not workdir:
    push_top = repo_top
else:
    workdir = os.path.expanduser(os.path.expandvars(workdir))
    if not os.path.isabs(workdir):
        workdir = os.path.join(repo_root, workdir)
    push_top = toplevel(workdir)

print('MATCH' if push_top and push_top == repo_top else 'SKIP')
PYEOF
)
[[ "$DECISION" == "MATCH" ]] || exit 0

cd "$REPO_ROOT" || exit 0

# Need gh to watch runs at all.
command -v gh >/dev/null 2>&1 || exit 0

# Did the push land? Upstream must exist and match HEAD. If HEAD is ahead of its
# upstream, the push was blocked/failed (e.g. by pre-push) — stay silent.
UPSTREAM_REF=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null) || exit 0
[[ -n "$UPSTREAM_REF" ]] || exit 0
[[ "$(git rev-parse @ 2>/dev/null)" == "$(git rev-parse '@{u}' 2>/dev/null)" ]] || exit 0

# Only act on a github.com/victorrentea/* remote (where gh + Actions apply).
REMOTE="${UPSTREAM_REF%%/*}"
REMOTE_URL=$(git remote get-url "$REMOTE" 2>/dev/null || true)
printf '%s' "$REMOTE_URL" | grep -qiE 'github\.com[:/]victorrentea/' || exit 0

SHA=$(git rev-parse HEAD 2>/dev/null) || exit 0
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)

SHA="$SHA" BRANCH="$BRANCH" REMOTE_URL="$REMOTE_URL" python3 -c "
import json, os
sha = os.environ['SHA']
short = sha[:7]
branch = os.environ['BRANCH']
remote = os.environ['REMOTE_URL']

# Poll until the run for this commit registers (GitHub lags a few seconds after
# push), then watch it with --exit-status so the exit code carries pass/fail.
watch_cmd = (
    'for i in \$(seq 1 24); do '
    'id=\$(gh run list --commit ' + sha + ' --limit 1 --json databaseId --jq \".[0].databaseId\" 2>/dev/null); '
    '[ -n \"\$id\" ] && break; sleep 5; done; '
    '[ -z \"\$id\" ] && { echo \"No CI run found for ' + short + ' after ~2min\"; exit 1; }; '
    'echo \"Watching CI run \$id for ' + short + ' (branch ' + branch + ')\"; '
    'gh run watch \"\$id\" --exit-status'
)

msg = (
    '✅ git push to ' + remote + ' succeeded — HEAD ' + short + ' (branch ' + branch + ') now matches upstream.\n'
    'Per this repo: start a BACKGROUND watch of the CI run for this commit so you report pass/fail when it finishes.\n'
    'Run EXACTLY this as a Bash tool call with run_in_background: true, then continue other work — do NOT block on it:\n\n'
    + watch_cmd + '\n\n'
    'When the background task completes, its exit status is the verdict (0 = CI passed, non-zero = failed). '
    'Summarize the CI result to the user; if it failed, surface the failing job/step and offer to investigate and fix it.'
)
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': msg}}))
"
