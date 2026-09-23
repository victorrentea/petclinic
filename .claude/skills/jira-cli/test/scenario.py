"""The full jira.py lifecycle, written once and run against BOTH backends:
    - the hermetic fake JIRA (e2e_fake.py)
    - a real JIRA on your network or in the cloud (e2e_live.py)
That is the whole point: whatever the fake proves, the live run re-proves for real.
"""

import json
import os
import tempfile

from harness import Report, section


def run(jira, project):
    """`jira` is a harness.Cli already pointed at the backend. Returns 0 when green."""
    r = Report()
    tag = "jiracli-e2e-%d" % os.getpid()
    created = []

    def new_issue(summary, *extra):
        res = jira("create", "-p", project, "-t", "Task", "-s", summary, "-l", tag, *extra)
        parts = res.out.split()
        key = parts[1] if len(parts) > 1 and parts[0] == "created" else ""
        if key:
            created.append(key)
        return key

    def as_json(*args):
        try:
            return json.loads(jira("--json", *args).out)
        except ValueError:
            return {}

    def labels_of(key):
        return ",".join(sorted((as_json("get", key).get("fields") or {}).get("labels") or []))

    try:
        # -------------------------------------------------------------- read --
        section("Connectivity and read")
        out = jira("whoami").all
        r.not_contains("whoami authenticates", out, "HTTP 401")
        r.check("whoami returns a user", out.strip() != "", out)
        r.contains("projects lists the test project", jira("projects").all, project)
        r.contains("issuetypes lists Task", jira("issuetypes", project).all, "Task")
        r.contains("fields finds the summary field", jira("fields", "summary").all, "summary")

        # ------------------------------------------------------------ create --
        section("Create and read back")
        key = new_issue("e2e smoke issue " + tag, "-d", "created by scenario.py")
        r.contains("create returns a key in the project", key, project + "-")
        got = jira("get", key).all
        r.contains("get shows the summary", got, "e2e smoke issue " + tag)
        r.contains("get shows the description", got, "created by scenario.py")
        r.contains("get shows the seed label", got, tag)
        r.eq("--json emits parseable JSON with the key", as_json("get", key).get("key"), key)

        # ------------------------------------------------------------ update --
        section("Update")
        jira("update", key, "-s", "renamed by e2e " + tag)
        r.contains("update rewrites the summary", jira("get", key).all, "renamed by e2e " + tag)
        jira("update", key, "-d", "second description")
        r.contains("update rewrites the description", jira("get", key).all, "second description")

        # ----------------------------------------------------------- comment --
        section("Comment")
        jira("comment", key, "first comment from e2e")
        jira("comment", key, "-", stdin="comment piped over stdin\n")
        comments = jira("comments", key).all
        r.contains("comment body is stored", comments, "first comment from e2e")
        r.contains("comment reads the body from stdin", comments, "comment piped over stdin")
        r.not_contains(
            "stdin's trailing newline is dropped", comments, "comment piped over stdin\n\n\n"
        )
        tricky = 'he said "done" & $PATH is 100% fine; ș ț ü'
        jira("comment", key, tricky)
        r.contains(
            "quotes, $, % and non-ASCII survive argv on every OS", jira("comments", key).all, tricky
        )

        # ------------------------------------------------------------- label --
        section("Label (tagging)")
        jira("label", "add", key, "alpha", "beta")
        labels = labels_of(key)
        r.contains("label add adds alpha", labels, "alpha")
        r.contains("label add adds beta", labels, "beta")
        r.contains("label add keeps the existing label", labels, tag)
        jira("label", "rm", key, "alpha")
        labels = labels_of(key)
        r.not_contains("label rm drops alpha", labels, "alpha")
        r.contains("label rm leaves beta", labels, "beta")
        jira("label", "set", key, tag, "only-this")
        labels = labels_of(key)
        r.contains("label set installs the new label", labels, "only-this")
        r.not_contains("label set replaces the whole list", labels, "beta")

        # ------------------------------------------------------------ assign --
        section("Assign")
        me = as_json("whoami")
        me = (
            me.get("accountId")
            if me.get("accountId") and not me.get("name")
            else (me.get("name") or me.get("key"))
        )
        if me:
            jira("assign", key, me)
            assignee = (as_json("get", key).get("fields") or {}).get("assignee") or {}
            r.contains(
                "assign sets the assignee",
                str(assignee.get("name") or assignee.get("accountId") or ""),
                me,
            )
            jira("assign", key, "-")
            r.eq(
                "assign - unassigns",
                (as_json("get", key).get("fields") or {}).get("assignee"),
                None,
            )
        else:
            r.fail("assign", "could not resolve the current user from whoami")

        # -------------------------------------------------------- transition --
        section("Transition")
        tr = jira("transitions", key).out
        r.check("transitions lists at least one option", tr.strip() != "", tr)
        first = tr.splitlines()[0] if tr.strip() else ""
        if "\t" in first and " -> " in first:
            tr_name, tr_target = first.split("\t", 1)[1].split(" -> ", 1)
            jira("transition", key, tr_name)
            status = ((as_json("get", key).get("fields") or {}).get("status") or {}).get("name")
            r.eq(
                "transition '%s' moves the issue to '%s'" % (tr_name, tr_target), status, tr_target
            )
        r.fails(
            "an unknown transition name is rejected with the available list",
            "Available:",
            jira("transition", key, "No Such Transition"),
        )

        # ---------------------------------------------------------- worklog --
        section("Worklog, watchers, attachments")
        r.contains(
            "worklog is accepted", jira("worklog", key, "30m", "e2e pairing").all, "logged 30m"
        )
        jira("watch", key)
        r.contains("watch registers a watcher", jira("--json", "watchers", key).all, "watchers")
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "jiracli-%s.txt" % tag)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write("hello from the e2e suite\n")
            name = os.path.basename(path)
            r.contains("attach uploads the file", jira("attach", key, path).all, name)
            r.contains("attachments lists the upload", jira("attachments", key).all, name)

        # -------------------------------------------------------------- link --
        section("Link")
        key2 = new_issue("e2e link target " + tag)
        lines = jira("linktypes").out.splitlines()
        ltype = lines[0].split("\t")[0] if lines else ""
        if ltype:
            r.contains(
                "link connects two issues", jira("link", key, ltype, key2).all, "linked " + key
            )
        else:
            r.fail("link", "linktypes returned nothing")

        # ------------------------------------------------------------ search --
        section("Search and pagination")
        r.contains("search by key finds the issue", jira("search", "key = " + key).all, key)
        for n in (1, 2, 3):
            new_issue("e2e paging %d %s" % (n, tag))
        # 5 issues now carry the tag. The fake caps a page at 2, so anything less
        # than 5 here means jira.py stopped after the first page.
        r.eq(
            "search paginates past the server page cap",
            len(as_json("search", "labels = " + tag, "-n", "50").get("issues") or []),
            5,
        )
        r.eq(
            "search honours -n as a hard limit",
            len(as_json("search", "labels = " + tag, "-n", "3").get("issues") or []),
            3,
        )
        r.eq(
            "search with no matches returns an empty list",
            as_json("search", "labels = no-such-label-" + tag).get("issues"),
            [],
        )

        # ------------------------------------------------------------- error --
        section("Error handling")
        r.fails(
            "unknown issue key reports the HTTP status",
            "HTTP 404",
            jira("get", project + "-999999"),
        )
        r.fails("unknown subcommand is rejected", "unknown command", jira("frobnicate"))
        r.fails("create without a summary is rejected", "summary", jira("create", "-p", project))
        r.fails(
            "malformed --field is rejected before the request",
            "key=value",
            jira("update", key, "-f", "not-a-pair"),
        )

        # ------------------------------------------------------------ delete --
        section("Delete")
        jira("delete", key2)
        r.fails("deleted issue is gone", "HTTP 404", jira("get", key2))
    finally:
        for k in created:
            jira("delete", k)

    return r.summary()
