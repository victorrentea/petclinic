#!/usr/bin/env bash
# The full jira.sh lifecycle, written once and run against BOTH backends:
#   - the hermetic fake JIRA (test/e2e-fake.sh)
#   - a real JIRA in Docker or on your network (test/e2e-live.sh)
# That is the whole point: whatever the fake proves, the live run re-proves for real.
#
# Required env: JIRA (path to jira.sh), JIRA_ENV_FILE, TEST_PROJECT.
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$HERE/lib.sh"

: "${JIRA:?scenario.sh needs \$JIRA pointing at jira.sh}"
: "${JIRA_ENV_FILE:?scenario.sh needs \$JIRA_ENV_FILE}"
: "${TEST_PROJECT:?scenario.sh needs \$TEST_PROJECT}"
export JIRA_ENV_FILE

TAG="jiracli-e2e-$$"
CREATED=()

cleanup() {
  local k
  for k in ${CREATED[@]+"${CREATED[@]}"}; do
    "$JIRA" delete "$k" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

new_issue() {
  local summary=$1; shift
  local key
  key=$("$JIRA" create -p "$TEST_PROJECT" -t Task -s "$summary" -l "$TAG" "$@" | awk '{print $2}')
  [[ -n $key ]] && CREATED+=("$key")
  printf '%s' "$key"
}

# ------------------------------------------------------------------ read ----
section "Connectivity and read"

out=$("$JIRA" whoami 2>&1)
assert_not_contains "whoami authenticates" "$out" "HTTP 401"
[[ -n ${out// /} ]] && pass "whoami returns a user" || fail "whoami returns a user" "$out"

assert_contains "projects lists the test project" "$("$JIRA" projects 2>&1)" "$TEST_PROJECT"
assert_contains "issuetypes lists Task" "$("$JIRA" issuetypes "$TEST_PROJECT" 2>&1)" "Task"
assert_contains "fields finds the summary field" "$("$JIRA" fields summary 2>&1)" "summary"

# ---------------------------------------------------------------- create ----
section "Create and read back"

KEY=$(new_issue "e2e smoke issue $TAG" -d "created by scenario.sh")
assert_contains "create returns a key in the project" "$KEY" "$TEST_PROJECT-"

got=$("$JIRA" get "$KEY" 2>&1)
assert_contains "get shows the summary" "$got" "e2e smoke issue $TAG"
assert_contains "get shows the description" "$got" "created by scenario.sh"
assert_contains "get shows the seed label" "$got" "$TAG"

json=$("$JIRA" --json get "$KEY" 2>&1)
assert_eq "--json emits parseable JSON with the key" \
  "$(printf '%s' "$json" | jq -r '.key' 2>/dev/null)" "$KEY"

# ---------------------------------------------------------------- update ----
section "Update"

"$JIRA" update "$KEY" -s "renamed by e2e $TAG" >/dev/null 2>&1
assert_contains "update rewrites the summary" "$("$JIRA" get "$KEY" 2>&1)" "renamed by e2e $TAG"

"$JIRA" update "$KEY" -d "second description" >/dev/null 2>&1
assert_contains "update rewrites the description" "$("$JIRA" get "$KEY" 2>&1)" "second description"

# --------------------------------------------------------------- comment ----
section "Comment"

"$JIRA" comment "$KEY" "first comment from e2e" >/dev/null 2>&1
printf 'comment piped over stdin\n' | "$JIRA" comment "$KEY" - >/dev/null 2>&1
comments=$("$JIRA" comments "$KEY" 2>&1)
assert_contains "comment body is stored" "$comments" "first comment from e2e"
assert_contains "comment reads the body from stdin" "$comments" "comment piped over stdin"

assert_contains "a comment with quotes and \$ survives shell quoting" \
  "$("$JIRA" comment "$KEY" 'he said "done" & $PATH is 100% fine' >/dev/null 2>&1; \
      "$JIRA" comments "$KEY" 2>&1)" \
  'he said "done" & $PATH is 100% fine'

# ----------------------------------------------------------------- label ----
section "Label (tagging)"

"$JIRA" label add "$KEY" alpha beta >/dev/null 2>&1
labels=$("$JIRA" --json get "$KEY" 2>&1 | jq -r '.fields.labels | sort | join(",")')
assert_contains "label add adds alpha" "$labels" "alpha"
assert_contains "label add adds beta" "$labels" "beta"
assert_contains "label add keeps the existing label" "$labels" "$TAG"

"$JIRA" label rm "$KEY" alpha >/dev/null 2>&1
labels=$("$JIRA" --json get "$KEY" 2>&1 | jq -r '.fields.labels | sort | join(",")')
assert_not_contains "label rm drops alpha" "$labels" "alpha"
assert_contains "label rm leaves beta" "$labels" "beta"

"$JIRA" label set "$KEY" "$TAG" only-this >/dev/null 2>&1
labels=$("$JIRA" --json get "$KEY" 2>&1 | jq -r '.fields.labels | sort | join(",")')
assert_contains "label set installs the new label" "$labels" "only-this"
assert_not_contains "label set replaces the whole list" "$labels" "beta"

# ---------------------------------------------------------------- assign ----
section "Assign"

ME=$("$JIRA" --json whoami 2>&1 | jq -r 'if (.accountId // "") != "" and (.name // "") == "" then .accountId else (.name // .key) end')
if [[ -n $ME && $ME != "null" ]]; then
  "$JIRA" assign "$KEY" "$ME" >/dev/null 2>&1
  assignee=$("$JIRA" --json get "$KEY" 2>&1 | jq -r '.fields.assignee | (.name // .accountId // "")')
  assert_contains "assign sets the assignee" "$assignee" "$ME"
  "$JIRA" assign "$KEY" - >/dev/null 2>&1
  assignee=$("$JIRA" --json get "$KEY" 2>&1 | jq -r '.fields.assignee // "null"')
  assert_eq "assign - unassigns" "$assignee" "null"
else
  fail "assign" "could not resolve the current user from whoami"
fi

# ------------------------------------------------------------ transition ----
section "Transition"

tr=$("$JIRA" transitions "$KEY" 2>&1)
[[ -n ${tr// /} ]] && pass "transitions lists at least one option" \
  || fail "transitions lists at least one option" "$tr"
tr_name=$(printf '%s' "$tr" | head -1 | cut -f2 | sed 's/ -> .*//')
tr_target=$(printf '%s' "$tr" | head -1 | sed 's/.* -> //')
if [[ -n $tr_name ]]; then
  "$JIRA" transition "$KEY" "$tr_name" >/dev/null 2>&1
  status=$("$JIRA" --json get "$KEY" 2>&1 | jq -r '.fields.status.name')
  assert_eq "transition '$tr_name' moves the issue to '$tr_target'" "$status" "$tr_target"
fi
assert_fails "an unknown transition name is rejected with the available list" \
  "Available:" "$JIRA" transition "$KEY" "No Such Transition"

# --------------------------------------------------------------- worklog ----
section "Worklog, watchers, attachments"

out=$("$JIRA" worklog "$KEY" 30m "e2e pairing" 2>&1)
assert_contains "worklog is accepted" "$out" "logged 30m"

"$JIRA" watch "$KEY" >/dev/null 2>&1
assert_contains "watch registers a watcher" "$("$JIRA" --json watchers "$KEY" 2>&1)" "watchers"

tmpfile=$(mktemp -t jiracli); printf 'hello from the e2e suite\n' > "$tmpfile"
mv "$tmpfile" "$tmpfile.txt"
out=$("$JIRA" attach "$KEY" "$tmpfile.txt" 2>&1)
assert_contains "attach uploads the file" "$out" "$(basename "$tmpfile.txt")"
assert_contains "attachments lists the upload" "$("$JIRA" attachments "$KEY" 2>&1)" \
  "$(basename "$tmpfile.txt")"
rm -f "$tmpfile.txt"

# ------------------------------------------------------------------ link ----
section "Link"

KEY2=$(new_issue "e2e link target $TAG")
ltype=$("$JIRA" linktypes 2>&1 | head -1 | cut -f1)
if [[ -n $ltype ]]; then
  out=$("$JIRA" link "$KEY" "$ltype" "$KEY2" 2>&1)
  assert_contains "link connects two issues" "$out" "linked $KEY"
else
  fail "link" "linktypes returned nothing"
fi

# ---------------------------------------------------------------- search ----
section "Search and pagination"

out=$("$JIRA" search "key = $KEY" 2>&1)
assert_contains "search by key finds the issue" "$out" "$KEY"

for n in 1 2 3; do new_issue "e2e paging $n $TAG" >/dev/null; done
# 5 issues now carry $TAG (KEY, KEY2, and 3 more). The fake caps a page at 2, so
# anything less than 5 here means jira.sh stopped after the first page.
out=$("$JIRA" --json search "labels = $TAG" -n 50 2>&1)
count=$(printf '%s' "$out" | jq -r '.issues | length' 2>/dev/null)
assert_eq "search paginates past the server page cap" "$count" "5"

out=$("$JIRA" --json search "labels = $TAG" -n 3 2>&1)
count=$(printf '%s' "$out" | jq -r '.issues | length' 2>/dev/null)
assert_eq "search honours -n as a hard limit" "$count" "3"

out=$("$JIRA" --json search "labels = no-such-label-$TAG" 2>&1)
assert_eq "search with no matches returns an empty list" \
  "$(printf '%s' "$out" | jq -r '.issues | length')" "0"

# ----------------------------------------------------------------- error ----
section "Error handling"

assert_fails "unknown issue key reports the HTTP status" "HTTP 404" "$JIRA" get "$TEST_PROJECT-999999"
assert_fails "unknown subcommand is rejected" "unknown command" "$JIRA" frobnicate
assert_fails "create without a summary is rejected" "summary" "$JIRA" create -p "$TEST_PROJECT"
assert_fails "malformed --field is rejected before the request" "key=value" \
  "$JIRA" update "$KEY" -f "not-a-pair"

# ---------------------------------------------------------------- delete ----
section "Delete"

"$JIRA" delete "$KEY2" >/dev/null 2>&1
assert_fails "deleted issue is gone" "HTTP 404" "$JIRA" get "$KEY2"

summary
