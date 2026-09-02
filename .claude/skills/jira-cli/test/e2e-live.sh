#!/usr/bin/env bash
# Live e2e: runs the SAME scenario as the fake suite, but against a real JIRA -
# the Docker one from test/docker/, or any Server/DC instance you can reach.
#
# It creates and then deletes a handful of throwaway issues, so point it at a
# sandbox project, never at a real one.
#
#   JIRA_TEST_ENV_FILE=~/.claude/jira-test.env \
#   JIRA_TEST_PROJECT=SAND \
#     .claude/skills/jira-cli/test/e2e-live.sh
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL=$(dirname "$HERE")

ENV_FILE=${JIRA_TEST_ENV_FILE:-${JIRA_ENV_FILE:-$HOME/.claude/jira-test.env}}
PROJECT=${JIRA_TEST_PROJECT:-}

if [[ ! -f $ENV_FILE ]]; then
  cat >&2 <<EOF
No credentials for the live run.

Expected an env file at: $ENV_FILE
Set JIRA_TEST_ENV_FILE to point elsewhere, or create it:

  install -m 600 /dev/null $ENV_FILE
  cat > $ENV_FILE <<'CREDS'
  JIRA_URL=http://localhost:8082
  JIRA_PAT=<paste a Personal Access Token>
  CREDS

For JIRA Cloud (free for 10 users) use Basic auth instead of a PAT:
  JIRA_URL=https://<you>.atlassian.net
  JIRA_USER=you@example.com
  JIRA_API_TOKEN=<id.atlassian.com/manage-profile/security/api-tokens>

Then tell the suite which sandbox project to scribble in:
  export JIRA_TEST_PROJECT=SAND

Self-hosted JIRA needs a Data Center licence you already own - Atlassian stopped
issuing self-serve trial licences on 2026-03-30. See SKILL.md for the options.
EOF
  exit 2
fi

if [[ -z $PROJECT ]]; then
  echo "Set JIRA_TEST_PROJECT to a throwaway project key (the suite creates and deletes issues in it)." >&2
  exit 2
fi

export JIRA_ENV_FILE="$ENV_FILE"
export JIRA="$SKILL/jira.sh"
export TEST_PROJECT="$PROJECT"

url=$(bash -c 'set -a; source "$JIRA_ENV_FILE"; echo "$JIRA_URL"')
echo "live JIRA: $url   project: $PROJECT"
echo

if ! "$JIRA" whoami >/dev/null 2>&1; then
  echo "Cannot authenticate against $url - check JIRA_URL and JIRA_PAT in $ENV_FILE." >&2
  "$JIRA" whoami || true
  exit 2
fi

"$HERE/scenario.sh"
status=$?
echo
[[ $status -eq 0 ]] && echo "e2e (live JIRA): green" || echo "e2e (live JIRA): RED"
exit $status
