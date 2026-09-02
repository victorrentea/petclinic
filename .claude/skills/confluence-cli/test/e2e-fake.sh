#!/usr/bin/env bash
# Hermetic e2e: boots the fake Confluence on a random port and drives confluence.sh
# against it over real HTTP. No licence, no container, no network, no Cloud site.
#
# The scenario runs TWICE against the same server:
#   - as Data Center  (PAT auth, REST v1 page CRUD)
#   - as Cloud        (Basic auth, /wiki prefix, REST v2 page CRUD)
# because those are two genuinely different code paths through confluence.sh, and
# a green v1 run says nothing about v2.
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL=$(dirname "$HERE")
# shellcheck source=lib.sh
source "$HERE/lib.sh"

command -v jq >/dev/null || { echo "jq is required"; exit 2; }
PY=${PYTHON:-python3}
command -v "$PY" >/dev/null || { echo "python3 is required for the fake server"; exit 2; }

WORK=$(mktemp -d -t conflcli-e2e)
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
( "$PY" "$HERE/fake_confluence.py" 0 > "$WORK/port" 2>"$WORK/server.log" & echo $! > "$WORK/pid" ) &
PORT=$(head -1 < "$WORK/port")
SERVER_PID=$(cat "$WORK/pid" 2>/dev/null || true)
[[ -n $PORT ]] || { echo "fake Confluence failed to start:"; cat "$WORK/server.log"; exit 2; }
BASE="http://127.0.0.1:$PORT"

for _ in $(seq 1 50); do
  curl -sf "$BASE/__health" >/dev/null && break
  perl -e 'select(undef,undef,undef,0.1)' 2>/dev/null || true
done
curl -sf "$BASE/__health" >/dev/null || { echo "fake Confluence never became healthy"; exit 2; }
echo "fake Confluence listening on $BASE (pid $SERVER_PID)"

# ---- credentials, exactly as a user would write them --------------------------
cat > "$WORK/dc.env" <<EOF
CONFLUENCE_URL=$BASE
CONFLUENCE_PAT=test-pat-12345
EOF
cat > "$WORK/cloud.env" <<EOF
CONFLUENCE_URL=$BASE
CONFLUENCE_USER=you@example.com
CONFLUENCE_API_TOKEN=test-cloud-token
EOF
chmod 600 "$WORK"/*.env

export CONFLUENCE="$SKILL/confluence.sh"

# ---- things only the fake can prove ------------------------------------------
section "Configuration and auth"

out=$("$CONFLUENCE" --help 2>&1)
assert_contains "--help works without any credentials" "$out" "Confluence from the shell"

out=$(CONFLUENCE_ENV_FILE="$WORK/dc.env" "$CONFLUENCE" config 2>&1)
assert_contains "config reports which env file was loaded" "$out" "$WORK/dc.env"
assert_contains "config recommends the shared home location" "$out" "~/.claude/confluence.env"
assert_contains "config reports the DC flavor" "$out" "Flavor: server"
assert_contains "config reports v1 page CRUD on DC" "$out" "page API: v1"
assert_not_contains "config never prints the token itself" "$out" "test-pat-12345"

out=$(CONFLUENCE_ENV_FILE="$WORK/cloud.env" "$CONFLUENCE" config 2>&1)
assert_contains "config reports the Cloud flavor" "$out" "Flavor: cloud"
assert_contains "config reports v2 page CRUD on Cloud" "$out" "page API: v2"
assert_contains "Cloud puts the API under /wiki" "$out" "/wiki/api/v2"

cat > "$WORK/empty.env" <<'EOF'
CONFLUENCE_URL=http://127.0.0.1:1
EOF
assert_fails "missing credentials are reported clearly" "no credentials" \
  env CONFLUENCE_ENV_FILE="$WORK/empty.env" "$CONFLUENCE" whoami

cat > "$WORK/bad.env" <<EOF
CONFLUENCE_URL=$BASE
CONFLUENCE_PAT=wrong-token
EOF
assert_fails "a rejected PAT surfaces as HTTP 401" "HTTP 401" \
  env CONFLUENCE_ENV_FILE="$WORK/bad.env" "$CONFLUENCE" whoami

# v2 does not exist on Data Center, and asking for it should say so rather than
# 404 mysteriously three calls later.
cat > "$WORK/v2onserver.env" <<EOF
CONFLUENCE_URL=$BASE
CONFLUENCE_PAT=test-pat-12345
CONFLUENCE_PAGE_API=v2
EOF
assert_fails "asking for v2 against a DC instance fails fast" "Cloud-only" \
  env CONFLUENCE_ENV_FILE="$WORK/v2onserver.env" "$CONFLUENCE" whoami

# A project-local .confluence.env must win over the one in $HOME.
mkdir -p "$WORK/proj"
cat > "$WORK/proj/.confluence.env" <<EOF
CONFLUENCE_URL=$BASE
CONFLUENCE_PAT=test-pat-12345
CONFLUENCE_DEFAULT_SPACE=SAND
EOF
out=$(cd "$WORK/proj" && env -u CONFLUENCE_ENV_FILE HOME="$WORK" \
  "$CONFLUENCE" create -t "picked up from ./.confluence.env" --text hi 2>&1)
assert_contains "./.confluence.env overrides \$HOME and supplies the default space" "$out" "created "

section "Local totals"
summary
LOCAL=$?

# ---- the shared lifecycle, once per API path ---------------------------------
run_flavor() {
  local name=$1 envfile=$2
  printf '\n\033[1m### scenario as %s ###\033[0m\n' "$name"
  curl -sf -X POST "$BASE/__reset" >/dev/null
  CONFLUENCE_ENV_FILE="$envfile" TEST_SPACE=DOCS "$HERE/scenario.sh"
}

run_flavor "Data Center (REST v1)" "$WORK/dc.env"; DC=$?
run_flavor "Cloud (REST v2)" "$WORK/cloud.env"; CLOUD=$?

echo
[[ $LOCAL -eq 0 && $DC -eq 0 && $CLOUD -eq 0 ]] || {
  echo "e2e (fake Confluence): RED"
  exit 1
}
echo "e2e (fake Confluence): green - both v1 and v2 paths"
