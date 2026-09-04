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

printf '%119s\n' '' | tr ' ' x > src/Changed.java
"$CHECK" HEAD >/dev/null || fail "rejected a 119-character line"

printf '%120s\n' '' | tr ' ' x > src/Changed.java
if "$CHECK" HEAD >out 2>&1; then
  fail "accepted a 120-character line"
fi
grep -q 'src/Changed.java:1:120' out || fail "did not identify the overlong line"

if "$CHECK" missing-ref >/dev/null 2>&1; then
  fail "accepted an invalid diff base"
fi

echo "[java-line-length-test] ok"
