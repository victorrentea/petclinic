#!/usr/bin/env python3
"""Live e2e: runs the SAME scenario as the fake suite, but against a real Confluence -
a free Cloud site, or any DC/Server instance you can reach.

It creates and then deletes a handful of throwaway pages, so point it at a
sandbox space, never at a real one.

    CONFLUENCE_TEST_ENV_FILE=~/.claude/confluence-test.env \\
    CONFLUENCE_TEST_SPACE=SAND python3 e2e_live.py

Exit code 2 means "skipped": no credentials or no sandbox space configured.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import scenario  # noqa: E402
from harness import Cli, read_env_value  # noqa: E402

CLI = os.path.join(os.path.dirname(HERE), "confluence.py")

HELP = """No credentials for the live run.

Expected an env file at: %s
Set CONFLUENCE_TEST_ENV_FILE to point elsewhere, or create it with:

For Confluence Cloud (free for 10 users - the cheapest real backend there is):
    CONFLUENCE_URL=https://<you>.atlassian.net
    CONFLUENCE_USER=you@example.com
    CONFLUENCE_API_TOKEN=<id.atlassian.com/manage-profile/security/api-tokens>

The very same API token also authenticates Jira Cloud on that site, so one free
site and one token cover both this suite and jira-cli's live suite.

For Confluence Data Center / Server:
    CONFLUENCE_URL=https://confluence.your-company.com
    CONFLUENCE_PAT=<Settings -> Personal Access Tokens -> Create token>

Then tell the suite which sandbox space to scribble in:
    CONFLUENCE_TEST_SPACE=SAND"""


def main():
    env_file = os.path.expanduser(
        os.environ.get("CONFLUENCE_TEST_ENV_FILE")
        or os.environ.get("CONFLUENCE_ENV_FILE")
        or "~/.claude/confluence-test.env"
    )
    space = os.environ.get("CONFLUENCE_TEST_SPACE", "")
    if not os.path.isfile(env_file):
        print(HELP % env_file, file=sys.stderr)
        return 2
    if not space:
        print(
            "Set CONFLUENCE_TEST_SPACE to a throwaway space key "
            "(the suite creates and deletes pages in it).",
            file=sys.stderr,
        )
        return 2

    c = Cli(CLI, "CONFLUENCE_", env={"CONFLUENCE_ENV_FILE": env_file})
    url = read_env_value(env_file, "CONFLUENCE_URL")
    print("live Confluence: %s   space: %s\n" % (url, space))
    who = c("whoami")
    if who.rc:
        print(
            "Cannot authenticate against %s - check the credentials in %s.\n%s"
            % (url, env_file, who.all),
            file=sys.stderr,
        )
        return 2

    status = scenario.run(c, space)
    print("\ne2e (live Confluence): %s" % ("green" if status == 0 else "RED"))
    return status


if __name__ == "__main__":
    sys.exit(main())
