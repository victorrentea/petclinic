#!/usr/bin/env python3
"""Hermetic e2e: boots the fake Confluence on a random port and drives
confluence.py against it over real HTTP. No licence, no container, no network, no
curl, no jq - runs the same on Windows, macOS and Linux.

The scenario runs TWICE against the same server:
    - as Data Center  (PAT auth, REST v1 page CRUD)
    - as Cloud        (Basic auth, /wiki prefix, REST v2 page CRUD)
because those are two genuinely different code paths, and a green v1 run says
nothing about v2.

    python3 e2e_fake.py
"""
import os
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fake_confluence  # noqa: E402
import scenario  # noqa: E402
from harness import Cli, Report, section  # noqa: E402

CLI = os.path.join(os.path.dirname(HERE), "confluence.py")


def write(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), fake_confluence.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_address[1]
    print("fake Confluence listening on %s" % base)

    with tempfile.TemporaryDirectory(prefix="conflcli-e2e") as work:
        dc = os.path.join(work, "dc.env")
        cloud = os.path.join(work, "cloud.env")
        write(dc, "CONFLUENCE_URL=%s\nCONFLUENCE_PAT=%s\n" % (base, fake_confluence.TOKEN))
        write(
            cloud,
            "CONFLUENCE_URL=%s\nCONFLUENCE_USER=you@example.com\n"
            "CONFLUENCE_API_TOKEN=test-cloud-token\n" % base,
        )
        # HOME and USERPROFILE point at the scratch dir, so a developer's real
        # ~/.claude/confluence.env can never be picked up by accident.
        home = {"HOME": work, "USERPROFILE": work}
        c = Cli(CLI, "CONFLUENCE_", env=dict(home, CONFLUENCE_ENV_FILE=dc), cwd=work)
        r = Report()

        # ------------------------------------------ things only the fake proves --
        section("Configuration and auth")
        r.contains(
            "--help works without any credentials",
            c("--help", env={"CONFLUENCE_ENV_FILE": None}).all,
            "Confluence from the shell",
        )
        out = c("config").all
        r.contains("config reports which env file was loaded", out, dc)
        r.contains("config recommends the shared home location", out, "~/.claude/confluence.env")
        r.contains("config reports the DC flavor", out, "Flavor: server")
        r.contains("config reports v1 page CRUD on DC", out, "page API: v1")
        r.not_contains("config never prints the token itself", out, fake_confluence.TOKEN)

        out = c("config", env={"CONFLUENCE_ENV_FILE": cloud}).all
        r.contains("config reports the Cloud flavor", out, "Flavor: cloud")
        r.contains("config reports v2 page CRUD on Cloud", out, "page API: v2")
        r.contains("Cloud puts the API under /wiki", out, "/wiki/api/v2")

        empty = os.path.join(work, "empty.env")
        write(empty, "CONFLUENCE_URL=http://127.0.0.1:1\n")
        r.fails(
            "missing credentials are reported clearly",
            "no credentials",
            c("whoami", env={"CONFLUENCE_ENV_FILE": empty}),
        )

        bad = os.path.join(work, "bad.env")
        write(bad, "CONFLUENCE_URL=%s\nCONFLUENCE_PAT=wrong-token\n" % base)
        r.fails(
            "a rejected PAT surfaces as HTTP 401",
            "HTTP 401",
            c("whoami", env={"CONFLUENCE_ENV_FILE": bad}),
        )

        # v2 does not exist on Data Center; asking for it should say so rather
        # than 404 mysteriously three calls later.
        v2dc = os.path.join(work, "v2onserver.env")
        write(
            v2dc,
            "CONFLUENCE_URL=%s\nCONFLUENCE_PAT=%s\nCONFLUENCE_PAGE_API=v2\n"
            % (base, fake_confluence.TOKEN),
        )
        r.fails(
            "asking for v2 against a DC instance fails fast",
            "Cloud-only",
            c("whoami", env={"CONFLUENCE_ENV_FILE": v2dc}),
        )

        quoted = os.path.join(work, "quoted.env")
        write(
            quoted,
            '﻿# written by Notepad\r\nexport CONFLUENCE_URL="%s"\r\n'
            "CONFLUENCE_PAT='%s'\r\n" % (base, fake_confluence.TOKEN),
        )
        res = c("whoami", env={"CONFLUENCE_ENV_FILE": quoted})
        r.check("an env file with BOM, CRLF, quotes and 'export' still loads", res.rc == 0, res.all)

        # A project-local .confluence.env must win over the one in the home folder.
        proj = os.path.join(work, "proj")
        os.mkdir(proj)
        write(
            os.path.join(proj, ".confluence.env"),
            "CONFLUENCE_URL=%s\nCONFLUENCE_PAT=%s\nCONFLUENCE_DEFAULT_SPACE=SAND\n"
            % (base, fake_confluence.TOKEN),
        )
        out = c(
            "create",
            "-t",
            "picked up from ./.confluence.env",
            "--text",
            "hi",
            env={"CONFLUENCE_ENV_FILE": None},
            cwd=proj,
        ).all
        r.contains(
            "./.confluence.env overrides the home folder and supplies the default space",
            out,
            "created ",
        )

        # Read as bytes: text mode would silently fold \r\n back into \n.
        created = c("create", "-s", "DOCS", "-t", "ș ț", "--text", "x").out.split()
        raw = c.raw_bytes("get", created[1]) if len(created) > 1 else b""
        r.check(
            "output is UTF-8 with bare \\n, even on Windows pipes",
            "ș ț".encode("utf-8") in raw and b"\r" not in raw,
            repr(raw),
        )

        local = r.summary()

        # ------------------------------------ the shared lifecycle, per API path --
        results = []
        for name, env_file in (("Data Center (REST v1)", dc), ("Cloud (REST v2)", cloud)):
            print("\n### scenario as %s ###" % name)
            fake_confluence.STORE.reset()
            results.append(
                scenario.run(
                    Cli(CLI, "CONFLUENCE_", env=dict(home, CONFLUENCE_ENV_FILE=env_file), cwd=work),
                    "DOCS",
                )
            )

    server.shutdown()
    print()
    if local or any(results):
        print("e2e (fake Confluence): RED")
        return 1
    print("e2e (fake Confluence): green - both v1 and v2 paths")
    return 0


if __name__ == "__main__":
    sys.exit(main())
