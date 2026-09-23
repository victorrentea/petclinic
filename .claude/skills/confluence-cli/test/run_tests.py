#!/usr/bin/env python3
"""Entry point for the confluence-cli suites.

run_tests.py           hermetic only (fake Confluence, ~5s, no network, no licence)
run_tests.py --live    live only     (real Confluence, needs creds + sandbox space)
run_tests.py --all     both; a missing live config counts as skipped
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def run(script, title):
    print("\n=== %s ===" % title, flush=True)
    return subprocess.run([sys.executable, os.path.join(HERE, script)]).returncode


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--fake"
    if mode in ("-h", "--help"):
        print(__doc__)
        return 0
    if mode == "--fake":
        return run("e2e_fake.py", "hermetic e2e (fake Confluence)")
    if mode == "--live":
        return run("e2e_live.py", "live e2e (real Confluence)")
    if mode == "--all":
        fake = run("e2e_fake.py", "hermetic e2e (fake Confluence)")
        live = run("e2e_live.py", "live e2e (real Confluence)")
        if live == 2:
            print("(live suite skipped - no credentials configured)")
            live = 0
        return fake or live
    print("unknown option %r (try --fake, --live, --all)" % mode, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
