#!/usr/bin/env python3
"""Read-only smoke test against a real Jenkins. Exit 2 = skipped, not failed."""
from __future__ import annotations

import os
import subprocess
import sys

CLI = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "jenkins.py"
)
READ_ONLY = [
    ["version"],
    ["who-am-i"],
    ["list-jobs"],
    ["nodes"],
    ["plugins"],
    ["queue"],
]


def main():
    probe = subprocess.run(
        [sys.executable, CLI, "config"], capture_output=True, text=True
    )
    if probe.returncode != 0:
        print("skipped - no Jenkins configured:\n%s" % probe.stderr.strip())
        return 2
    print(probe.stdout)
    failed = 0
    for args in READ_ONLY:
        proc = subprocess.run(
            [sys.executable, CLI] + args, capture_output=True, text=True
        )
        status = "ok  " if proc.returncode == 0 else "FAIL"
        failed += proc.returncode != 0
        print(
            "%s %-12s %s"
            % (status, args[0], (proc.stdout or proc.stderr).splitlines()[:1])
        )
    print(
        "\n%d/%d read-only commands worked" % (len(READ_ONLY) - failed, len(READ_ONLY))
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
