#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 2

CHANGED_FILES="$(mktemp)"
trap 'rm -f "$CHANGED_FILES"' EXIT
if ! git diff --name-only --diff-filter=ACMR -z "$@" -- '*.java' > "$CHANGED_FILES"; then
  exit 2
fi

fail=0
while IFS= read -r -d '' file; do
  if ! awk '
    length($0) >= 120 {
      print FILENAME ":" FNR ":" length($0)
      found = 1
    }
    END { exit found }
  ' "$file"; then
    fail=1
  fi
done < "$CHANGED_FILES"

if [ "$fail" -ne 0 ]; then
  echo "[java-line-length] ❌ Changed Java files must have no line of 120 or more characters." >&2
fi
exit "$fail"
