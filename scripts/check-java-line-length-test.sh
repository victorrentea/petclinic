#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$ROOT/scripts/check-java-line-length.sh"

fail() {
  echo "[java-line-length-test] $*" >&2
  exit 1
}

[ -x "$CHECK" ] || fail "$CHECK is not executable"

TEST_REPO="$(mktemp -d)"
trap 'rm -rf "$TEST_REPO"' EXIT
cd "$TEST_REPO"
git init -q
git config user.email test@example.com
git config user.name Test

mkdir -p src
printf '%120s\n' '' | tr ' ' x > src/Unchanged.java
printf 'class Short {}\n' > src/Changed.java
git add .
git commit -qm baseline
BASELINE="$(git rev-parse HEAD)"

printf '%119s\n' '' | tr ' ' x > src/Changed.java
"$CHECK" HEAD >/dev/null || fail "rejected a 119-character line"

printf '%120s\n' '' | tr ' ' x > src/Changed.java
if "$CHECK" HEAD >out 2>&1; then
  fail "accepted a 120-character line"
fi
grep -q 'src/Changed.java:1:120' out || fail "did not identify the overlong line"

printf '%119s\n' '' | tr ' ' x > src/Changed.java
git add src/Changed.java
git commit -qm short-java-change
printf '%120s\n' '' | tr ' ' x > src/Changed.java
"$CHECK" --source-ref HEAD HEAD~1...HEAD >/dev/null || fail "ignored the short committed line"

printf '%120s\n' '' | tr ' ' x > src/Changed.java
git add src/Changed.java
git commit -qm long-java-change
printf '%119s\n' '' | tr ' ' x > src/Changed.java
if "$CHECK" --source-ref HEAD HEAD~1...HEAD >/dev/null 2>&1; then
  fail "read the short worktree line instead of the committed 120-character line"
fi

printf '%119s\n' '' | sed 's/ /é/g' > src/Changed.java
LC_ALL=C "$CHECK" HEAD >/dev/null || fail "counted UTF-8 bytes instead of characters"

printf '%120s\n' '' | sed 's/ /é/g' > src/Changed.java
if "$CHECK" HEAD >/dev/null 2>&1; then
  fail "accepted 120 UTF-8 characters"
fi

if "$CHECK" missing-ref >/dev/null 2>&1; then
  fail "accepted an invalid diff base"
fi

git reset --hard -q "$BASELINE"
printf '%120s\n' '' | tr ' ' x > src/Early.java
git add src/Early.java
git commit -qm early-java-change
printf 'not Java\n' > later.txt
git add later.txt
git commit -qm later-non-java-change
if "$CHECK" HEAD~2...HEAD >/dev/null 2>&1; then
  fail "ignored a Java file changed before the tip commit"
fi

echo "[java-line-length-test] ok"
