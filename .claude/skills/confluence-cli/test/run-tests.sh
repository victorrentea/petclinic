#!/usr/bin/env bash
# Entry point for the confluence-cli test suite.
#
#   run-tests.sh          hermetic only (fake Confluence, v1 + v2, no network)
#   run-tests.sh --live   live only     (real Confluence, needs creds + sandbox space)
#   run-tests.sh --all    both
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mode=${1:---fake}

run_fake() {
  printf '\n=== hermetic e2e (fake Confluence, v1 + v2) ===\n'
  "$HERE/e2e-fake.sh"
}

run_live() {
  printf '\n=== live e2e (real Confluence) ===\n'
  "$HERE/e2e-live.sh"
}

case $mode in
  --fake) run_fake ;;
  --live) run_live ;;
  --all)
    run_fake; a=$?
    run_live; b=$?
    # A missing live config (exit 2) is "skipped", not "failed".
    [[ $b -eq 2 ]] && echo "(live suite skipped - no credentials configured)" && b=0
    [[ $a -eq 0 && $b -eq 0 ]]
    ;;
  -h|--help)
    sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "unknown option '$mode' (try --fake, --live, --all)" >&2
    exit 2
    ;;
esac
