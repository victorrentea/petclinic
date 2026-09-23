#!/usr/bin/env python3
"""Enforces this rule, which used to live in AGENTS.md under "Java Code Style" —
copied here verbatim so a grep for it lands on its implementation:

    - Keep line length < 120 chars

A rule an agent has to *remember* is a rule it forgets under pressure. This one is
mechanical, so it belongs in a hook, not in a prompt: `.githooks/pre-push` runs it over
the pushed range, and `ci.yml` re-runs it so `--no-verify` cannot walk past it.

TypeScript gets the same treatment. Two reasons this is a script and not ESLint's
`max-len`: `petclinic-test/` is a second npm project with no ESLint at all, and one
implementation keeps the two languages from drifting to different limits.

Python, not bash: the limit is in *characters*, and macOS's awk counts bytes. A
box-drawing comment (`// ── … ──`) is 84 chars but 126 bytes, so an awk version reported
it as a violation. Anything that measures this rule has to be Unicode-aware.

Scope: only the lines the push ADDS or CHANGES, never whole files. The repo carries ~30
pre-existing long lines (chatbot prompts, guardrail-test literals); gating on whole files
would block every unrelated push that happens to touch one of them, and a guardrail that
cries wolf gets `--no-verify`'d into irrelevance.

Usage:
    check-line-length.py <base-rev> <tip-rev>   # lines added in base..tip (hooks + CI)
    check-line-length.py --files <file>...      # whole files (manual / ad-hoc)
"""
import re
import subprocess
import sys

MAX = 119  # "< 120 chars" — 120 is already one too many

SUFFIXES = ("*.java", "*.ts")

# api-types.ts is written by `npm run generate:api`; we do not hand-wrap a generator's
# output, and nobody could fix a violation there anyway.
EXCLUDES = (":(exclude)petclinic-frontend/src/app/generated/*",)

HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)")


def violations_in_diff(diff):
    """Yield (file, lineno, text) for every ADDED line over the limit.

    `---`/`+++` are only read as headers when they arrive as a pair, so an added line
    that itself begins with "+++ " cannot be mistaken for one.
    """
    path, lineno, pending = None, 0, False
    for line in diff.splitlines():
        if line.startswith("--- "):
            pending = True
            continue
        if pending and line.startswith("+++ "):
            pending = False
            path = None if line == "+++ /dev/null" else line[6:]
            continue
        pending = False

        hunk = HUNK.match(line)
        if hunk:
            lineno = int(hunk.group(1))
        elif line.startswith("+"):
            body = line[1:]
            if len(body) > MAX:
                yield path, lineno, body
            lineno += 1
        elif line.startswith(" "):
            lineno += 1


def main(argv):
    if argv[:1] == ["--files"]:
        files = argv[1:]
        if not files:
            return usage()
        found = []
        for path in files:
            try:
                with open(path, encoding="utf-8") as f:
                    for n, body in enumerate(f, start=1):
                        body = body.rstrip("\n")
                        if len(body) > MAX:
                            found.append((path, n, body))
            except (OSError, UnicodeDecodeError):
                continue
    elif len(argv) == 2:
        diff = subprocess.run(
            ["git", "diff", "-U0", argv[0], argv[1], "--", *SUFFIXES, *EXCLUDES],
            capture_output=True, text=True, check=True,
        ).stdout
        found = list(violations_in_diff(diff))
    else:
        return usage()

    if found:
        print(f"❌ Lines over {MAX} chars (AGENTS.md rule: keep line length < 120 chars):")
        for path, n, body in found:
            print(f"  {path}:{n}: {len(body)} chars — {body.strip()[:90]}")
        print("\n   Wrap them and try again.")
        return 1

    return 0   # silent on success — a guardrail that passes has nothing to say


def usage():
    print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
