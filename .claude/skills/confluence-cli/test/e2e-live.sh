#!/usr/bin/env bash
# Live e2e: runs the SAME scenario as the fake suite, but against a real Confluence -
# a free Cloud site, or any DC/Server instance you can reach.
#
# It creates and then deletes a handful of throwaway pages, so point it at a
# sandbox space, never at a real one.
#
#   CONFLUENCE_TEST_ENV_FILE=~/.claude/confluence-test.env \
#   CONFLUENCE_TEST_SPACE=SAND \
#     .claude/skills/confluence-cli/test/e2e-live.sh
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL=$(dirname "$HERE")

ENV_FILE=${CONFLUENCE_TEST_ENV_FILE:-${CONFLUENCE_ENV_FILE:-$HOME/.claude/confluence-test.env}}
SPACE=${CONFLUENCE_TEST_SPACE:-}

if [[ ! -f $ENV_FILE ]]; then
  cat >&2 <<EOF
No credentials for the live run.

Expected an env file at: $ENV_FILE
Set CONFLUENCE_TEST_ENV_FILE to point elsewhere, or create it:

  install -m 600 /dev/null $ENV_FILE

For Confluence Cloud (free for 10 users - the cheapest real backend there is):
  CONFLUENCE_URL=https://<you>.atlassian.net
  CONFLUENCE_USER=you@example.com
  CONFLUENCE_API_TOKEN=<id.atlassian.com/manage-profile/security/api-tokens>

The very same API token also authenticates Jira Cloud on that site, so one free
site and one token cover both this suite and jira-cli's live suite.

For Confluence Data Center / Server:
  CONFLUENCE_URL=https://confluence.your-company.com
  CONFLUENCE_PAT=<Settings -> Personal Access Tokens -> Create token>

Then tell the suite which sandbox space to scribble in:
  export CONFLUENCE_TEST_SPACE=SAND
EOF
  exit 2
fi

if [[ -z $SPACE ]]; then
  echo "Set CONFLUENCE_TEST_SPACE to a throwaway space key (the suite creates and deletes pages in it)." >&2
  exit 2
fi

export CONFLUENCE_ENV_FILE="$ENV_FILE"
export CONFLUENCE="$SKILL/confluence.sh"
export TEST_SPACE="$SPACE"

url=$(bash -c 'set -a; source "$CONFLUENCE_ENV_FILE"; echo "$CONFLUENCE_URL"')
echo "live Confluence: $url   space: $SPACE"
"$CONFLUENCE" config | grep -E '^(Flavor|Auth):' || true
echo

if ! "$CONFLUENCE" whoami >/dev/null 2>&1; then
  echo "Cannot authenticate against $url - check the credentials in $ENV_FILE." >&2
  "$CONFLUENCE" whoami || true
  exit 2
fi

"$HERE/scenario.sh"
status=$?
echo
[[ $status -eq 0 ]] && echo "e2e (live Confluence): green" || echo "e2e (live Confluence): RED"
exit $status
