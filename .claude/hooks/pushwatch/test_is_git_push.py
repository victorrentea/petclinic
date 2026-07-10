#!/usr/bin/env python3
"""Tests for is_git_push._decide — run: python3 test_is_git_push.py

Covers the RTK regression (the PreToolUse proxy rewrites `git push` ->
`rtk git push`, which used to read as NOPUSH and silently skip the CI watch),
plus the original detection cases so the wrapper-peeling doesn't regress them.
"""
import is_git_push as m

# (command, expected_push, expected_workdir)
CASES = [
    # --- RTK-wrapped forms (the bug this fix addresses) ---
    ("rtk git push origin main", True, ""),
    ("rtk git push", True, ""),
    ("rtk git commit -m x && rtk git push origin main", True, ""),
    ("rtk git -C /some/dir push", True, "/some/dir"),
    ("cd /some/dir && rtk git push", True, "/some/dir"),
    ("rtk proxy git push", True, ""),
    ("rtk git status", False, ""),          # wrapped non-push stays NOPUSH

    # --- bare (unwrapped) forms still work ---
    ("git push origin main", True, ""),
    ("git commit -m x && git push origin main", True, ""),
    ("git -C /some/dir push", True, "/some/dir"),
    ("cd /repo && git push", True, "/repo"),
    ("git push --dry-run", True, ""),

    # --- must NOT be treated as a push ---
    ("git status", False, ""),
    ("git commit -m 'mention git push in message'", False, ""),
    ("echo git push", False, ""),
    ("rtkother git push", False, ""),       # only exact `rtk` is a wrapper
]


def main():
    failures = []
    for command, want_push, want_dir in CASES:
        got_push, got_dir = m._decide(command)
        if (got_push, got_dir) != (want_push, want_dir):
            failures.append(
                f"  {command!r}\n    want ({want_push}, {want_dir!r})"
                f"  got ({got_push}, {got_dir!r})"
            )
    if failures:
        print(f"FAIL: {len(failures)}/{len(CASES)} case(s):")
        print("\n".join(failures))
        raise SystemExit(1)
    print(f"OK: all {len(CASES)} cases passed")


if __name__ == "__main__":
    main()
