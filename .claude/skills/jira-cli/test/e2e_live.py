#!/usr/bin/env python3
"""Live e2e: runs the SAME scenario as the fake suite, but against a real JIRA -
your corporate Server/DC instance, or a free Jira Cloud site.

It creates and then deletes a handful of throwaway issues, so point it at a
sandbox project, never at a real one.

    JIRA_TEST_ENV_FILE=~/.claude/jira-test.env JIRA_TEST_PROJECT=SAND python3 e2e_live.py

Exit code 2 means "skipped": no credentials or no sandbox project configured.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import scenario  # noqa: E402
from harness import Cli, read_env_value  # noqa: E402

CLI = os.path.join(os.path.dirname(HERE), "jira.py")

HELP = """No credentials for the live run.

Expected an env file at: %s
Set JIRA_TEST_ENV_FILE to point elsewhere, or create it with:

    JIRA_URL=https://jira.your-company.com
    JIRA_PAT=<paste a Personal Access Token>

For JIRA Cloud (free for 10 users) use Basic auth instead of a PAT:
    JIRA_URL=https://<you>.atlassian.net
    JIRA_USER=you@example.com
    JIRA_API_TOKEN=<id.atlassian.com/manage-profile/security/api-tokens>

Then tell the suite which sandbox project to scribble in:
    JIRA_TEST_PROJECT=SAND

Self-hosted JIRA needs a Data Center licence you already own - Atlassian stopped
issuing self-serve trial licences on 2026-03-30. See TESTING.md for the options."""


def main():
    env_file = os.path.expanduser(
        os.environ.get("JIRA_TEST_ENV_FILE")
        or os.environ.get("JIRA_ENV_FILE")
        or "~/.claude/jira-test.env"
    )
    project = os.environ.get("JIRA_TEST_PROJECT", "")
    if not os.path.isfile(env_file):
        print(HELP % env_file, file=sys.stderr)
        return 2
    if not project:
        print(
            "Set JIRA_TEST_PROJECT to a throwaway project key "
            "(the suite creates and deletes issues in it).",
            file=sys.stderr,
        )
        return 2

    jira = Cli(CLI, "JIRA_", env={"JIRA_ENV_FILE": env_file})
    url = read_env_value(env_file, "JIRA_URL")
    print("live JIRA: %s   project: %s\n" % (url, project))
    who = jira("whoami")
    if who.rc:
        print(
            "Cannot authenticate against %s - check the credentials in %s.\n%s"
            % (url, env_file, who.all),
            file=sys.stderr,
        )
        return 2

    status = scenario.run(jira, project)
    print("\ne2e (live JIRA): %s" % ("green" if status == 0 else "RED"))
    return status


if __name__ == "__main__":
    sys.exit(main())
