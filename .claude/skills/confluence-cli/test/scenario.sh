#!/usr/bin/env bash
# The full confluence.sh lifecycle, written once and run against EVERY backend:
#   - the hermetic fake speaking v1   (test/e2e-fake.sh, DC/Server flavor)
#   - the hermetic fake speaking v2   (test/e2e-fake.sh, Cloud flavor)
#   - a real Confluence               (test/e2e-live.sh)
# That is the whole point: whatever the fake proves, the live run re-proves for
# real, and neither API path gets to rot quietly behind the other.
#
# Required env: CONFLUENCE (path to confluence.sh), CONFLUENCE_ENV_FILE, TEST_SPACE.
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$HERE/lib.sh"

: "${CONFLUENCE:?scenario.sh needs \$CONFLUENCE pointing at confluence.sh}"
: "${CONFLUENCE_ENV_FILE:?scenario.sh needs \$CONFLUENCE_ENV_FILE}"
: "${TEST_SPACE:?scenario.sh needs \$TEST_SPACE}"
export CONFLUENCE_ENV_FILE

C=$CONFLUENCE
TAG="conflcli-e2e-$$"
CREATED=()

cleanup() {
  local id
  # Children before parents, so a parent is never deleted out from under a child.
  for (( i=${#CREATED[@]}-1; i>=0; i-- )); do
    id=${CREATED[$i]}
    "$C" delete "$id" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

new_page() {
  local title=$1; shift
  local id
  id=$("$C" create -s "$TEST_SPACE" -t "$title" "$@" | awk '{print $2}')
  [[ -n $id ]] && CREATED+=("$id")
  printf '%s' "$id"
}

# ------------------------------------------------------------------ read ----
section "Connectivity and read"

out=$("$C" whoami 2>&1)
assert_not_contains "whoami authenticates" "$out" "HTTP 401"
[[ -n ${out// /} ]] && pass "whoami returns a user" || fail "whoami returns a user" "$out"

assert_contains "spaces lists the test space" "$("$C" spaces 2>&1)" "$TEST_SPACE"

# ---------------------------------------------------------------- create ----
section "Create and read back"

TITLE="e2e page $TAG"
ID=$(new_page "$TITLE" --text "hello from the e2e suite")
[[ $ID =~ ^[0-9]+$ ]] && pass "create returns a numeric page id" \
  || fail "create returns a numeric page id" "got '$ID'"

got=$("$C" get "$ID" 2>&1)
assert_contains "get shows the title" "$got" "$TITLE"
assert_contains "get reports version 1" "$got" "v1"

assert_contains "the plain-text body was stored as escaped XHTML" \
  "$("$C" body "$ID" 2>&1)" "<p>hello from the e2e suite</p>"

# A page can be addressed by SPACE:Title, not just by the id nobody memorises.
assert_contains "SPACE:Title resolves to the same page" \
  "$("$C" get "$TEST_SPACE:$TITLE" 2>&1)" "$ID"

json=$("$C" --json get "$ID" 2>&1)
assert_eq "--json emits parseable JSON with the id" \
  "$(printf '%s' "$json" | jq -r '.id' 2>/dev/null)" "$ID"

# ---------------------------------------------------------------- update ----
section "Update and the version dance"

"$C" update "$ID" -t "renamed $TAG" >/dev/null 2>&1
got=$("$C" get "$ID" 2>&1)
assert_contains "update rewrites the title" "$got" "renamed $TAG"
assert_contains "update bumps the version to 2" "$got" "v2"
assert_contains "update without a body keeps the old body" \
  "$("$C" body "$ID" 2>&1)" "hello from the e2e suite"

"$C" update "$ID" --text "second revision" >/dev/null 2>&1
assert_contains "update rewrites the body" "$("$C" body "$ID" 2>&1)" "second revision"
assert_contains "update bumps the version to 3" "$("$C" get "$ID" 2>&1)" "v3"

# The whole reason update auto-reads the current version: sending a stale one is
# the single most common way to corrupt a Confluence write.
assert_fails "a stale version number is rejected with HTTP 409" "HTTP 409" \
  "$C" update "$ID" --version 2 --text "should not land"
assert_contains "the rejected update left the body untouched" \
  "$("$C" body "$ID" 2>&1)" "second revision"

# ---------------------------------------------------------------- append ----
section "Append"

"$C" append "$ID" "appended line" >/dev/null 2>&1
body=$("$C" body "$ID" 2>&1)
assert_contains "append adds the new text" "$body" "appended line"
assert_contains "append preserves what was already there" "$body" "second revision"

# ------------------------------------------------------------ wiki markup ----
section "Body formats"

WID=$(new_page "e2e wiki $TAG" --wiki "h1. Heading
* bullet")
assert_contains "wiki markup is converted to storage XHTML server-side" \
  "$("$C" body "$WID" 2>&1)" "<h1>Heading</h1>"

RID=$(new_page "e2e raw storage $TAG" -b '<p>raw <strong>storage</strong></p>')
assert_contains "raw storage XHTML passes through untouched" \
  "$("$C" body "$RID" 2>&1)" "<strong>storage</strong>"

TXID=$(new_page "e2e escaping $TAG" --text 'a < b & c > d')
assert_contains "--text escapes XML metacharacters" \
  "$("$C" body "$TXID" 2>&1)" "a &lt; b &amp; c &gt; d"

# ----------------------------------------------------------------- label ----
section "Label (tagging)"

"$C" label add "$ID" "$TAG" alpha beta >/dev/null 2>&1
labels=$("$C" labels "$ID" 2>&1)
assert_contains "label add adds alpha" "$labels" "alpha"
assert_contains "label add adds beta" "$labels" "beta"

"$C" label rm "$ID" alpha >/dev/null 2>&1
labels=$("$C" labels "$ID" 2>&1)
assert_not_contains "label rm drops alpha" "$labels" "alpha"
assert_contains "label rm leaves beta" "$labels" "beta"

"$C" label set "$ID" "$TAG" only-this >/dev/null 2>&1
labels=$("$C" labels "$ID" 2>&1)
assert_contains "label set installs the new label" "$labels" "only-this"
assert_not_contains "label set replaces the whole list" "$labels" "beta"

# Labels are read through the page API too, which on v2 is a different endpoint.
assert_contains "get surfaces the labels" "$("$C" get "$ID" 2>&1)" "only-this"

# --------------------------------------------------------------- comment ----
section "Comment"

"$C" comment "$ID" "first comment from e2e" >/dev/null 2>&1
printf 'comment piped over stdin\n' | "$C" comment "$ID" - >/dev/null 2>&1
comments=$("$C" comments "$ID" 2>&1)
assert_contains "comment body is stored" "$comments" "first comment from e2e"
assert_contains "comment reads the body from stdin" "$comments" "comment piped over stdin"

"$C" comment "$ID" 'he said "done" & $PATH is 100% fine' >/dev/null 2>&1
assert_contains "a comment with quotes and \$ survives shell quoting" \
  "$("$C" comments "$ID" 2>&1)" 'he said "done" &amp; $PATH is 100% fine'

# --------------------------------------------------- versions, attachments ----
section "Versions and attachments"

# Only v1 is asserted: DC's v1 endpoint lists historical versions while Cloud's v2
# endpoint includes the current one, so the current version is not portable here.
versions=$("$C" versions "$ID" 2>&1)
assert_contains "versions lists the first version" "$versions" "v1"

tmpfile=$(mktemp -t conflcli); printf 'hello from the e2e suite\n' > "$tmpfile"
mv "$tmpfile" "$tmpfile.txt"
out=$("$C" attach "$ID" "$tmpfile.txt" 2>&1)
assert_contains "attach uploads the file" "$out" "$(basename "$tmpfile.txt")"
assert_contains "attachments lists the upload" "$("$C" attachments "$ID" 2>&1)" \
  "$(basename "$tmpfile.txt")"
rm -f "$tmpfile.txt"

# ------------------------------------------------------ hierarchy and move ----
section "Hierarchy"

KID=$(new_page "e2e child $TAG" --text "a child page" -p "$ID")
assert_contains "a child page is created under its parent" "$("$C" children "$ID" 2>&1)" "$KID"

OTHER=$(new_page "e2e new parent $TAG" --text "another parent")
"$C" move "$KID" --parent "$OTHER" >/dev/null 2>&1
assert_contains "move re-parents the page" "$("$C" children "$OTHER" 2>&1)" "$KID"
assert_not_contains "move detaches it from the old parent" "$("$C" children "$ID" 2>&1)" "$KID"

# ---------------------------------------------------------------- search ----
section "Search and pagination"

for n in 1 2 3; do
  PID=$(new_page "e2e paging $n $TAG" --text "page $n")
  "$C" label add "$PID" "$TAG" >/dev/null 2>&1
done
# 4 pages now carry $TAG (the original plus 3). The fake caps a search page at 2,
# so anything less than 4 here means confluence.sh stopped after the first page.
out=$("$C" --json search "space = $TEST_SPACE and label = \"$TAG\"" -n 50 2>&1)
count=$(printf '%s' "$out" | jq -r '.results | length' 2>/dev/null)
assert_eq "search paginates past the server page cap" "$count" "4"

out=$("$C" --json search "space = $TEST_SPACE and label = \"$TAG\"" -n 3 2>&1)
count=$(printf '%s' "$out" | jq -r '.results | length' 2>/dev/null)
assert_eq "search honours -n as a hard limit" "$count" "3"

out=$("$C" --json search "label = \"no-such-label-$TAG\"" 2>&1)
assert_eq "search with no matches returns an empty list" \
  "$(printf '%s' "$out" | jq -r '.results | length')" "0"

# ----------------------------------------------------------------- error ----
section "Error handling"

assert_fails "unknown page id reports the HTTP status" "HTTP 404" "$C" get 99999999
assert_fails "unknown subcommand is rejected" "unknown command" "$C" frobnicate
assert_fails "create without a title is rejected before the request" "title" \
  "$C" create -s "$TEST_SPACE"
assert_fails "an unresolvable SPACE:Title is reported clearly" "no page titled" \
  "$C" get "$TEST_SPACE:definitely not a page $TAG"
assert_fails "update with nothing to change is rejected" "title and/or a body" \
  "$C" update "$ID"

# ---------------------------------------------------------------- delete ----
section "Delete"

"$C" delete "$RID" >/dev/null 2>&1
assert_fails "deleted page is gone" "HTTP 404" "$C" get "$RID"

summary
