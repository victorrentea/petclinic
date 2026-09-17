#!/usr/bin/env python3
"""Entry point for the jenkins-cli suites.

run_tests.py           hermetic only (fake Jenkins, no network)
run_tests.py --live    live only (needs a configured Jenkins)
run_tests.py --all     both; a missing live config counts as skipped
"""
from __future__ import annotations

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def run(script, title):
    print("\n=== %s ===" % title)
    return subprocess.run([sys.executable, os.path.join(HERE, script)]).returncode


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--fake"
    if mode in ("-h", "--help"):
        print(__doc__)
        return 0
    if mode == "--fake":
        return run("e2e_fake.py", "hermetic e2e (fake Jenkins)")
    if mode == "--live":
        return run("e2e_live.py", "live e2e (real Jenkins)")
    if mode == "--all":
        fake = run("e2e_fake.py", "hermetic e2e (fake Jenkins)")
        live = run("e2e_live.py", "live e2e (real Jenkins)")
        if live == 2:
            print("(live suite skipped - no Jenkins configured)")
            live = 0
        return fake or live
    print("unknown option %r (try --fake, --live, --all)" % mode, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
