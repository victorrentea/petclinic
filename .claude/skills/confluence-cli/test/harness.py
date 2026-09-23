"""Minimal assertion helpers and a CLI runner shared by the e2e suites.

The CLI is always run as a real subprocess (`python confluence.py ...`), so argument
parsing, exit codes, stdout/stderr and the env-file lookup are all part of what is
asserted. Stdlib only, so the suites run unchanged on Windows, macOS and Linux.
"""

import os
import subprocess
import sys

_COLOR = sys.stdout.isatty() and os.name != "nt"


def _paint(code, text):
    return "\033[%sm%s\033[0m" % (code, text) if _COLOR else text


class Report:
    def __init__(self):
        self.passed = 0
        self.failures = []

    def ok(self, desc):
        self.passed += 1
        print("  %s %s" % (_paint("32", "PASS"), desc))

    def fail(self, desc, detail=""):
        self.failures.append(desc)
        print("  %s %s" % (_paint("31", "FAIL"), desc))
        if detail:
            print("       %s" % detail)

    def check(self, desc, condition, detail=""):
        self.ok(desc) if condition else self.fail(desc, detail)

    def contains(self, desc, haystack, needle):
        self.check(
            desc, needle in haystack, "expected to contain %r, got: %s" % (needle, haystack[:400])
        )

    def not_contains(self, desc, haystack, needle):
        self.check(
            desc,
            needle not in haystack,
            "expected NOT to contain %r, got: %s" % (needle, haystack[:400]),
        )

    def eq(self, desc, actual, expected):
        self.check(desc, actual == expected, "expected %r, got %r" % (expected, actual))

    def fails(self, desc, needle, result):
        """`result` is a Result: it must have failed and mention `needle`."""
        if result.rc == 0:
            self.fail(desc, "expected failure, but command succeeded: %s" % result.out[:200])
        elif needle not in result.all:
            self.fail(desc, "expected output to mention %r, got: %s" % (needle, result.all[:300]))
        else:
            self.ok(desc)

    def summary(self):
        print()
        if not self.failures:
            print("%s  %d passed" % (_paint("32", "ALL GREEN"), self.passed))
            return 0
        print(
            "%s  %d passed, %d failed" % (_paint("31", "FAILURES"), self.passed, len(self.failures))
        )
        for f in self.failures:
            print("  - %s" % f)
        return 1


def section(title):
    print("\n" + _paint("1", title))


class Result:
    def __init__(self, proc):
        self.rc = proc.returncode
        self.out = proc.stdout
        self.err = proc.stderr
        self.all = proc.stdout + proc.stderr

    def __str__(self):
        return self.all


class Cli:
    """Runs the CLI script with a controlled environment: every variable with the
    given prefix is stripped from the inherited environment first, because real env
    vars win over the env file - a developer's own CONFLUENCE_PAT must not leak in."""

    def __init__(self, script, prefix, env=None, cwd=None):
        self.script = script
        self.prefix = prefix
        self.env = dict(env or {})
        self.cwd = cwd

    def _env(self, env):
        full = {k: v for k, v in os.environ.items() if not k.startswith(self.prefix)}
        full.update(self.env)
        full.update(env or {})
        return {k: v for k, v in full.items() if v is not None}

    def __call__(self, *args, stdin=None, env=None, cwd=None):
        proc = subprocess.run(
            [sys.executable, self.script] + [str(a) for a in args],
            input=stdin,
            capture_output=True,
            encoding="utf-8",
            env=self._env(env),
            cwd=cwd or self.cwd,
        )
        return Result(proc)

    def raw_bytes(self, *args):
        """stdout as bytes, untouched by text-mode newline translation."""
        return subprocess.run(
            [sys.executable, self.script] + [str(a) for a in args],
            capture_output=True,
            env=self._env(None),
            cwd=self.cwd,
        ).stdout


def read_env_value(path, key):
    """Reads one KEY=value from an env file, for display only."""
    with open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            line = line.strip()
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return ""
