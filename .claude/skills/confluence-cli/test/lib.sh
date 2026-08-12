#!/usr/bin/env bash
# Minimal assertion helpers shared by the e2e suites.
# Sourced, never executed directly.

PASSED=0
FAILED=0
FAILURES=()

_green() { printf '\033[32m%s\033[0m' "$1"; }
_red() { printf '\033[31m%s\033[0m' "$1"; }

pass() {
  PASSED=$((PASSED + 1))
  printf '  %s %s\n' "$(_green "PASS")" "$1"
}

fail() {
  FAILED=$((FAILED + 1))
  FAILURES+=("$1")
  printf '  %s %s\n' "$(_red "FAIL")" "$1"
  [[ -n ${2:-} ]] && printf '       %s\n' "$2"
  return 0
}

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

assert_contains() {
  local desc=$1 haystack=$2 needle=$3
  if [[ $haystack == *"$needle"* ]]; then
    pass "$desc"
  else
    fail "$desc" "expected to contain '$needle', got: $(printf '%s' "$haystack" | head -c 400)"
  fi
}

assert_not_contains() {
  local desc=$1 haystack=$2 needle=$3
  if [[ $haystack != *"$needle"* ]]; then
    pass "$desc"
  else
    fail "$desc" "expected NOT to contain '$needle', got: $(printf '%s' "$haystack" | head -c 400)"
  fi
}

assert_eq() {
  local desc=$1 actual=$2 expected=$3
  if [[ $actual == "$expected" ]]; then
    pass "$desc"
  else
    fail "$desc" "expected '$expected', got '$actual'"
  fi
}

# Asserts the command exits non-zero and its stderr mentions `needle`.
assert_fails() {
  local desc=$1 needle=$2; shift 2
  local out status=0
  out=$("$@" 2>&1) || status=$?
  if [[ $status -eq 0 ]]; then
    fail "$desc" "expected failure, but command succeeded: $(printf '%s' "$out" | head -c 200)"
  elif [[ $out != *"$needle"* ]]; then
    fail "$desc" "expected stderr to mention '$needle', got: $(printf '%s' "$out" | head -c 300)"
  else
    pass "$desc"
  fi
}

summary() {
  printf '\n'
  if [[ $FAILED -eq 0 ]]; then
    printf '%s  %d passed\n' "$(_green "ALL GREEN")" "$PASSED"
    return 0
  fi
  printf '%s  %d passed, %d failed\n' "$(_red "FAILURES")" "$PASSED" "$FAILED"
  local f
  for f in "${FAILURES[@]}"; do printf '  - %s\n' "$f"; done
  return 1
}
