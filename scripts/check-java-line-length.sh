#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 2
if ! LC_ALL=C.UTF-8 locale charmap >/dev/null 2>&1; then
  echo "[java-line-length] C.UTF-8 locale is required to count characters." >&2
  exit 2
fi
export LC_ALL=C.UTF-8

SOURCE_REF=""
if [ "${1:-}" = "--source-ref" ]; then
  [ "$#" -ge 3 ] || exit 2
  SOURCE_REF="$2"
  shift 2
fi

CHANGED_FILES="$(mktemp)"
FILE_CONTENT="$(mktemp)"
trap 'rm -f "$CHANGED_FILES" "$FILE_CONTENT"' EXIT
if ! git diff --name-only --diff-filter=ACMR -z "$@" -- '*.java' > "$CHANGED_FILES"; then
  exit 2
fi

fail=0
while IFS= read -r -d '' file; do
  source_file="$file"
  if [ -n "$SOURCE_REF" ]; then
    git show "$SOURCE_REF:$file" > "$FILE_CONTENT" || exit 2
    source_file="$FILE_CONTENT"
  fi

  line_number=0
  while IFS= read -r line || [ -n "$line" ]; do
    line_number=$((line_number + 1))
    if [ "${#line}" -ge 120 ]; then
      printf '%s:%s:%s\n' "$file" "$line_number" "${#line}"
      fail=1
    fi
  done < "$source_file"
done < "$CHANGED_FILES"

if [ "$fail" -ne 0 ]; then
  echo "[java-line-length] ❌ Changed Java files must have no line of 120 or more characters." >&2
fi
exit "$fail"
