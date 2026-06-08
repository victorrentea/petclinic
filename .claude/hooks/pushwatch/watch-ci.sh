#!/usr/bin/env bash
# Watch the GitHub Actions run for a commit; the process exit status is the CI
# verdict (0 = passed, non-zero = failed). Meant to be launched by the agent as
# a BACKGROUND Bash task after a push — the post-push hook hands over the SHA so
# the agent only has to run this one short line.
set -uo pipefail

SHA="${1:?usage: watch-ci.sh <sha>}"
short="${SHA:0:7}"

# GitHub lags a few seconds registering the run after a push — poll up to ~2min.
id=""
for _ in $(seq 1 24); do
  id=$(gh run list --commit "$SHA" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
  [ -n "$id" ] && break
  sleep 5
done
[ -z "$id" ] && { echo "No CI run found for $short after ~2min"; exit 1; }

echo "Watching CI run $id for $short"
exec gh run watch "$id" --exit-status
