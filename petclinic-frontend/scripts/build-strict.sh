#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
npm run build:raw 2>&1 | tee "$TMP"
if grep -qE '(^|[[:space:]])Warning:' "$TMP"; then
    echo
    echo "[build-strict] FAIL: ng build produced warnings (see above)." >&2
    exit 1
fi
