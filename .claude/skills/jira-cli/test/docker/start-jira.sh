#!/usr/bin/env bash
# Bring up the official Atlassian JIRA image and wait until it answers, then
# print the (manual, licence-gated) steps that only a human can do.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
URL=${JIRA_LOCAL_URL:-http://localhost:8082}

command -v docker >/dev/null || { echo "docker is not installed"; exit 2; }

case ${1:-up} in
  down)
    docker compose -f "$HERE/docker-compose.yml" down
    exit 0
    ;;
  destroy)
    # -v also drops the volumes, i.e. the JIRA home and the database.
    docker compose -f "$HERE/docker-compose.yml" down -v
    exit 0
    ;;
  logs)
    docker compose -f "$HERE/docker-compose.yml" logs -f jira
    exit 0
    ;;
esac

docker compose -f "$HERE/docker-compose.yml" up -d

echo "waiting for JIRA at $URL (first boot takes 3-5 minutes)"
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/status" || true)
  if [[ $code == 200 ]]; then
    state=$(curl -s "$URL/status" || true)
    printf '\r  [%3ds] %s\n' "$((i * 5))" "$state"
    break
  fi
  printf '\r  [%3ds] not up yet (http %s)' "$((i * 5))" "${code:-000}"
  sleep 5
done
echo

cat <<EOF

JIRA is reachable at $URL

Three things still need a human, because they are licence- and UI-gated:

  1. Open $URL and finish the setup wizard.
      It asks for a Data Center licence key, which you must already have:
      since 30 March 2026 Atlassian no longer issues self-serve DC trial
      licences, and Jira Server is end-of-life. If you do not have a key,
      stop here and use the hermetic fake or Jira Cloud Free instead -
      see SKILL.md, "Getting a real JIRA to point the live suite at".

  2. Create a throwaway project, e.g. key SAND, from any template.

  3. Mint a Personal Access Token:
      avatar -> Profile -> Personal Access Tokens -> Create token
      Then write it down where jira.sh will find it:

        install -m 600 /dev/null ~/.claude/jira-test.env
        cat > ~/.claude/jira-test.env <<'CREDS'
        JIRA_URL=$URL
        JIRA_PAT=<the token>
        CREDS

Then run the live suite:

  JIRA_TEST_PROJECT=SAND $HERE/../e2e-live.sh

Other commands: $(basename "$0") logs | down | destroy
EOF
