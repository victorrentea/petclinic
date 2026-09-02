#!/usr/bin/env bash
# Hermetic e2e: boots the fake JIRA on a random port and drives jira.sh against it
# over real HTTP. No licence, no container, no network. Runs in a couple of seconds.
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL=$(dirname "$HERE")
# shellcheck source=lib.sh
source "$HERE/lib.sh"

command -v jq >/dev/null || { echo "jq is required"; exit 2; }
PY=${PYTHON:-python3}
command -v "$PY" >/dev/null || { echo "python3 is required for the fake server"; exit 2; }

WORK=$(mktemp -d -t jiracli-e2e)
SERVER_PID=""

cleanup() {
  [[ -n $SERVER_PID ]] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$WORK"
}
trap cleanup EXIT

# ---- boot the fake -----------------------------------------------------------
# The server prints the port it bound to on its first line of stdout.
mkfifo "$WORK/port"
# Detached through a subshell so bash does not track it as a job and print
# "Terminated: 15" over the test output when cleanup kills it.
( "$PY" "$HERE/fake_jira.py" 0 > "$WORK/port" 2>"$WORK/server.log" & echo $! > "$WORK/pid" ) &
PORT=$(head -1 < "$WORK/port")
SERVER_PID=$(cat "$WORK/pid" 2>/dev/null || true)
[[ -n $PORT ]] || { echo "fake JIRA failed to start:"; cat "$WORK/server.log"; exit 2; }
BASE="http://127.0.0.1:$PORT"

for _ in $(seq 1 50); do
  curl -sf "$BASE/__health" >/dev/null && break
  perl -e 'select(undef,undef,undef,0.1)' 2>/dev/null || true
done
curl -sf "$BASE/__health" >/dev/null || { echo "fake JIRA never became healthy"; exit 2; }
echo "fake JIRA listening on $BASE (pid $SERVER_PID)"

# ---- credentials, exactly as a user would write them --------------------------
cat > "$WORK/jira.env" <<EOF
JIRA_URL=$BASE
JIRA_PAT=test-pat-12345
EOF
chmod 600 "$WORK/jira.env"

export JIRA_ENV_FILE="$WORK/jira.env"
export JIRA="$SKILL/jira.sh"
export TEST_PROJECT=PET

# ---- things only the fake can prove ------------------------------------------
section "Configuration and auth"

out=$("$JIRA" --help 2>&1)
assert_contains "--help works without any credentials" "$out" "JIRA from the shell"

out=$(JIRA_ENV_FILE="$WORK/jira.env" "$JIRA" config 2>&1)
assert_contains "config reports which env file was loaded" "$out" "$WORK/jira.env"
assert_contains "config recommends the shared home location" "$out" "~/.claude/jira.env"
assert_not_contains "config never prints the token itself" "$out" "test-pat-12345"

cat > "$WORK/empty.env" <<'EOF'
JIRA_URL=http://127.0.0.1:1
EOF
assert_fails "missing credentials are reported clearly" "no credentials" \
  env JIRA_ENV_FILE="$WORK/empty.env" "$JIRA" whoami

cat > "$WORK/bad.env" <<EOF
JIRA_URL=$BASE
JIRA_PAT=wrong-token
EOF
assert_fails "a rejected PAT surfaces as HTTP 401" "HTTP 401" \
  env JIRA_ENV_FILE="$WORK/bad.env" "$JIRA" whoami

# A project-local .jira.env must win over the one in $HOME.
mkdir -p "$WORK/proj"
cat > "$WORK/proj/.jira.env" <<EOF
JIRA_URL=$BASE
JIRA_PAT=test-pat-12345
JIRA_DEFAULT_PROJECT=SAND
EOF
out=$(cd "$WORK/proj" && env -u JIRA_ENV_FILE HOME="$WORK" "$JIRA" create -s "picked up from ./.jira.env" 2>&1)
assert_contains "./.jira.env overrides \$HOME and supplies JIRA_DEFAULT_PROJECT" "$out" "created SAND-"

# ---- the shared lifecycle ----------------------------------------------------
"$HERE/scenario.sh"
SCENARIO=$?

section "Fake-backend totals"
summary
LOCAL=$?

[[ $SCENARIO -eq 0 && $LOCAL -eq 0 ]] || exit 1
echo
echo "e2e (fake JIRA): green"
