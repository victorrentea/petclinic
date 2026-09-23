#!/usr/bin/env python3
"""Hermetic e2e: boots the fake JIRA on a random port and drives jira.py against
it over real HTTP. No licence, no container, no network, no curl, no jq - runs the
same on Windows, macOS and Linux in a couple of seconds.

    python3 e2e_fake.py
"""
import os
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fake_jira  # noqa: E402
import scenario  # noqa: E402
from harness import Cli, Report, hostile_server, section  # noqa: E402

CLI = os.path.join(os.path.dirname(HERE), "jira.py")


def write(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), fake_jira.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_address[1]
    print("fake JIRA listening on %s" % base)

    with tempfile.TemporaryDirectory(prefix="jiracli-e2e") as work:
        env_file = os.path.join(work, "jira.env")
        # Credentials exactly as a user would write them.
        write(env_file, "JIRA_URL=%s\nJIRA_PAT=%s\n" % (base, fake_jira.TOKEN))
        # HOME and USERPROFILE point at the scratch dir, so a developer's real
        # ~/.claude/jira.env can never be picked up by accident.
        home = {"HOME": work, "USERPROFILE": work}
        jira = Cli(CLI, "JIRA_", env=dict(home, JIRA_ENV_FILE=env_file), cwd=work)
        r = Report()

        # ------------------------------------------ things only the fake proves --
        section("Configuration and auth")
        r.contains(
            "--help works without any credentials",
            jira("--help", env={"JIRA_ENV_FILE": None}).all,
            "JIRA from the shell",
        )
        out = jira("config").all
        r.contains("config reports which env file was loaded", out, env_file)
        r.contains("config recommends the shared home location", out, "~/.claude/jira.env")
        r.not_contains("config never prints the token itself", out, fake_jira.TOKEN)

        empty = os.path.join(work, "empty.env")
        write(empty, "JIRA_URL=http://127.0.0.1:1\n")
        r.fails(
            "missing credentials are reported clearly",
            "no credentials",
            jira("whoami", env={"JIRA_ENV_FILE": empty}),
        )

        bad = os.path.join(work, "bad.env")
        write(bad, "JIRA_URL=%s\nJIRA_PAT=wrong-token\n" % base)
        r.fails(
            "a rejected PAT surfaces as HTTP 401",
            "HTTP 401",
            jira("whoami", env={"JIRA_ENV_FILE": bad}),
        )

        r.check(
            "a real env var wins over the env file",
            jira("whoami", env={"JIRA_ENV_FILE": bad, "JIRA_PAT": fake_jira.TOKEN}).rc == 0,
        )

        quoted = os.path.join(work, "quoted.env")
        write(
            quoted,
            "﻿# written by Notepad\r\nexport JIRA_URL=\"%s\"\r\nJIRA_PAT='%s'\r\n"
            % (base, fake_jira.TOKEN),
        )
        r.check(
            "an env file with BOM, CRLF, quotes and 'export' still loads",
            jira("whoami", env={"JIRA_ENV_FILE": quoted}).rc == 0,
            jira("whoami", env={"JIRA_ENV_FILE": quoted}).all,
        )

        # A project-local .jira.env must win over the one in the home folder.
        # The shared file in the home folder carries a token the fake rejects, so
        # only a project-local file that really wins over it can make this pass.
        os.makedirs(os.path.join(work, ".claude"))
        write(
            os.path.join(work, ".claude", "jira.env"),
            "JIRA_URL=%s\nJIRA_PAT=wrong-token\n" % base,
        )
        proj = os.path.join(work, "proj")
        os.mkdir(proj)
        write(
            os.path.join(proj, ".jira.env"),
            "JIRA_URL=%s\nJIRA_PAT=%s\nJIRA_DEFAULT_PROJECT=SAND\n" % (base, fake_jira.TOKEN),
        )
        out = jira(
            "create", "-s", "picked up from ./.jira.env", env={"JIRA_ENV_FILE": None}, cwd=proj
        ).all
        r.contains(
            "./.jira.env overrides the home folder and supplies JIRA_DEFAULT_PROJECT",
            out,
            "created SAND-",
        )

        ok_env = os.path.join(work, "ok.env")
        write(ok_env, "JIRA_URL=%s\nJIRA_PAT=%s\n" % (base, fake_jira.TOKEN))
        commented = os.path.join(work, "commented.env")
        write(
            commented,
            'JIRA_URL=%s   # the fake\nJIRA_PAT="%s" # its token\n' % (base, fake_jira.TOKEN),
        )
        res = jira("whoami", env={"JIRA_ENV_FILE": commented})
        r.check(
            "inline # comments in the env file are ignored, as by `source`", res.rc == 0, res.all
        )
        res = jira("whoami", env={"JIRA_ENV_FILE": ok_env, "JIRA_PAT": ""})
        r.check(
            "an empty environment variable does not hide the file's value", res.rc == 0, res.all
        )
        out = jira("config", env={"JIRA_ENV_FILE": ok_env, "JIRA_URL": base}).all
        r.contains("config names what the environment overrode", out, "environment: JIRA_URL")

        # Git Bash's ~ is $HOME, python.exe's is USERPROFILE; the file may be in either.
        split_home = os.path.join(work, "split")
        os.makedirs(os.path.join(split_home, "bash-home", ".claude"))
        os.makedirs(os.path.join(split_home, "profile"))
        write(os.path.join(split_home, "bash-home", ".claude", "jira.env"), open(ok_env).read())
        res = jira(
            "whoami",
            env={
                "JIRA_ENV_FILE": None,
                "HOME": os.path.join(split_home, "bash-home"),
                "USERPROFILE": os.path.join(split_home, "profile"),
            },
            cwd=split_home,
        )
        r.check(
            "~/.claude/jira.env is found under $HOME even when USERPROFILE differs",
            res.rc == 0,
            res.all,
        )

        # Git Bash turns /rest/... into C:/Program Files/Git/rest/... before Python sees it.
        res = jira(
            "raw", "GET", "C:/Program Files/Git/rest/api/2/myself", env={"JIRA_ENV_FILE": ok_env}
        )
        r.contains("a raw path mangled by Git Bash still reaches the API", res.all, "Victor Rentea")

        hostile = hostile_server(base + "/rest/api/2/myself")
        for kind, needle in (
            ("html", "expected JSON"),
            ("redirect", "redirect from"),
            ("drop", "failed"),
        ):
            res = jira(
                "whoami",
                env={
                    "JIRA_ENV_FILE": None,
                    "JIRA_URL": hostile + "/" + kind,
                    "JIRA_PAT": fake_jira.TOKEN,
                },
            )
            r.check(
                "a %s response is a one-line error, not a traceback" % kind,
                res.rc == 1 and needle in res.err and "Traceback" not in res.err,
                res.all,
            )

        # Read as bytes: text mode would silently fold \r\n back into \n.
        created = jira("create", "-p", "PET", "-s", "ș ț").out.split()
        raw = jira.raw_bytes("get", created[-1]) if created else b""
        r.check(
            "output is UTF-8 with bare \\n, even on Windows pipes",
            "ș ț".encode("utf-8") in raw and b"\r" not in raw,
            repr(raw),
        )
        fake_jira.STORE.reset()

        local = r.summary()

        # ------------------------------------------------- the shared lifecycle --
        shared = scenario.run(jira, "PET")

    server.shutdown()
    print()
    if local or shared:
        print("e2e (fake JIRA): RED")
        return 1
    print("e2e (fake JIRA): green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
