#!/usr/bin/env python3
"""Hermetic end-to-end tests: the real jenkins.py CLI against fake_jenkins.py.

No Docker, no network, no Java - runs the same on macOS, Linux and Windows.

    python3 e2e_fake.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CLI = os.path.join(os.path.dirname(HERE), "jenkins.py")
sys.path.insert(0, HERE)

import fake_jenkins  # noqa: E402

PASSED, FAILED = [], []


def run(*args, expect_rc=0, stdin=None):
    proc = subprocess.run(
        [sys.executable, CLI] + list(args),
        capture_output=True,
        text=True,
        input=stdin,
        env=ENV,
    )
    if proc.returncode != expect_rc:
        raise AssertionError(
            "rc=%d (wanted %d) for %s\nstdout: %s\nstderr: %s"
            % (proc.returncode, expect_rc, " ".join(args), proc.stdout, proc.stderr)
        )
    return proc.stdout + proc.stderr


def check(name, fn):
    try:
        fn()
    except Exception as exc:  # noqa: BLE001 - a test report, not a crash
        FAILED.append(name)
        print("FAIL %s\n     %s" % (name, str(exc).replace("\n", "\n     ")))
    else:
        PASSED.append(name)
        print("ok   %s" % name)


def contains(haystack, *needles):
    for needle in needles:
        assert needle in haystack, "expected %r in:\n%s" % (needle, haystack)


URL, SERVER, STATE = fake_jenkins.start()
ENV = dict(
    os.environ,
    JENKINS_URL=URL,
    JENKINS_USER_ID=fake_jenkins.USER,
    JENKINS_API_TOKEN=fake_jenkins.TOKEN,
    JENKINS_ENV_FILE=os.path.join(HERE, "empty.env"),
)
open(ENV["JENKINS_ENV_FILE"], "w").close()


def test_config_hides_the_token():
    out = run("config")
    contains(out, URL, "token:    set")
    assert fake_jenkins.TOKEN not in out, "the token leaked into the output"


def test_version_and_identity():
    contains(run("version"), fake_jenkins.VERSION)
    contains(run("who-am-i"), "Authenticated as: admin", "authenticated")


def test_bad_credentials_fail_loudly():
    out = run("--auth", "admin:wrong", "who-am-i", expect_rc=1)
    contains(out, "HTTP 401")


def test_list_jobs_flat_and_recursive():
    contains(run("list-jobs"), "petclinic-build", "release", "ops")
    contains(run("list-jobs", "-r"), "ops/nightly")


def test_job_and_builds():
    contains(run("job", "petclinic-build"), "builds the backend", "last build:  #")
    contains(run("builds", "petclinic-build"), "#7", "SUCCESS", "#6", "FAILURE")


def test_console_by_alias_and_number():
    contains(run("console", "petclinic-build", "7"), "BUILD SUCCESS")
    contains(run("console", "petclinic-build"), "Finished: SUCCESS")  # last
    contains(run("console", "petclinic-build", "success"), "Finished: SUCCESS")


def test_console_is_utf8_with_bare_newlines_on_every_os():
    # Bytes, not text: text mode would fold a Windows \r\n back into \n, and a
    # cp1252 pipe would have crashed on the check mark before printing anything.
    raw = subprocess.run(
        [sys.executable, CLI, "console", "petclinic-build", "7"], capture_output=True, env=ENV
    ).stdout
    contains(repr(raw), repr("Deploy ș ț ü ✓\n".encode("utf-8"))[2:-1])
    assert b"\r" not in raw, "CRLF leaked into the output: %r" % raw


def test_build_waits_and_streams():
    out = run("build", "petclinic-build", "-p", "BRANCH=main", "-f")
    contains(out, "BRANCH=main", "#8 SUCCESS")


def test_build_without_wait_only_queues():
    contains(run("build", "release"), "queued release")
    contains(run("queue"), "release")


def test_cancel_queue_item():
    item_id = str(STATE.queue[0]["id"])
    contains(run("cancel-queue", item_id), "cancelled queue item")
    assert not STATE.queue, "queue should be empty, still: %s" % STATE.queue


def test_crumb_is_sent_on_writes():
    """Writes 403 without the crumb - reaching this far proves we fetch one."""
    assert ("GET", "/crumbIssuer/api/json") in STATE.calls


def test_enable_disable():
    contains(run("enable-job", "release"), "enabled")
    assert STATE.jobs["release"]["disabled"] is False
    run("disable-job", "release")
    assert STATE.jobs["release"]["disabled"] is True


def test_job_config_roundtrip():
    contains(run("get-job", "petclinic-build"), "<project>")
    run("update-job", "petclinic-build", "-c", "-", stdin="<project>v2</project>")
    assert STATE.jobs["petclinic-build"]["config"] == "<project>v2</project>"


def test_create_copy_delete_job():
    run("create-job", "scratch", "-c", "-", stdin="<project>new</project>")
    assert "scratch" in STATE.jobs
    run("copy-job", "scratch", "scratch-copy")
    assert STATE.jobs["scratch-copy"]["config"] == "<project>new</project>"
    contains(
        run("create-job", "scratch", "-c", "-", stdin="<x/>", expect_rc=1), "HTTP 400"
    )
    run("delete-job", "scratch")
    run("delete-job", "scratch-copy")
    assert "scratch" not in STATE.jobs


def test_folder_job_is_addressable():
    contains(run("job", "ops/nightly"), "nightly")


def test_nodes_offline_online():
    contains(run("nodes"), "agent-1", "online")
    run("offline-node", "agent-1", "-m", "maintenance")
    contains(run("nodes"), "offline")
    run("online-node", "agent-1")
    assert "agent-1" not in STATE.offline


def test_plugins():
    contains(run("plugins"), "git", "5.2.1")
    out = run("plugins", "--updates")
    contains(out, "workflow-aggregator")
    assert "git " not in out, "git has no update, should be filtered out"


def test_groovy_script():
    contains(run("groovy", "-", stdin="println 42"), "Result: println 42")


def test_lifecycle_and_raw():
    contains(run("quiet-down"), "quiet-down requested")
    contains(run("cancel-quiet-down"), "cancel-quiet-down requested")
    contains(run("raw", "GET", "/whoAmI/api/json"), '"name": "admin"')


def test_json_output_is_machine_readable():
    import json

    payload = json.loads(run("--json", "builds", "petclinic-build"))
    assert payload[0]["number"] >= 7, payload


def test_env_file_under_home_with_inline_comments():
    # Git Bash's ~ is $HOME while python.exe's is USERPROFILE; the file may be in either.
    home = os.path.join(HERE, "split-home")
    os.makedirs(os.path.join(home, ".claude"), exist_ok=True)
    try:
        with open(os.path.join(home, ".claude", "jenkins.env"), "w") as fh:
            fh.write(
                'JENKINS_URL=%s   # the fake\nJENKINS_USER_ID="%s" # me\nJENKINS_API_TOKEN=%s\n'
                % (URL, fake_jenkins.USER, fake_jenkins.TOKEN)
            )
        env = {k: v for k, v in ENV.items() if not k.startswith("JENKINS_")}
        env.update(HOME=home, USERPROFILE=os.path.join(home, "elsewhere"))
        proc = subprocess.run(
            [sys.executable, CLI, "who-am-i"], capture_output=True, text=True, env=env, cwd=home
        )
        contains(proc.stdout + proc.stderr, "Authenticated as: admin")
    finally:
        shutil.rmtree(home)


def test_missing_url_is_a_clear_error():
    env_without_url = {k: v for k, v in ENV.items() if k != "JENKINS_URL"}
    proc = subprocess.run(
        [sys.executable, CLI, "version"],
        capture_output=True,
        text=True,
        env=env_without_url,
    )
    assert proc.returncode == 1
    contains(proc.stderr, "no Jenkins URL")


def main():
    tests = [
        (n, f)
        for n, f in sorted(globals().items())
        if n.startswith("test_") and callable(f)
    ]
    print("fake Jenkins on %s - %d tests\n" % (URL, len(tests)))
    for name, fn in tests:
        check(name[5:].replace("_", " "), fn)
    SERVER.shutdown()
    os.remove(ENV["JENKINS_ENV_FILE"])
    print("\n%d passed, %d failed" % (len(PASSED), len(FAILED)))
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
