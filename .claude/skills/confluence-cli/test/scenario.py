"""The full confluence.py lifecycle, written once and run against EVERY backend:
    - the hermetic fake speaking v1   (e2e_fake.py, DC/Server flavor)
    - the hermetic fake speaking v2   (e2e_fake.py, Cloud flavor)
    - a real Confluence               (e2e_live.py)
Whatever the fake proves, the live run re-proves for real, and neither API path
gets to rot quietly behind the other.
"""

import json
import os
import tempfile

from harness import Report, section


def run(c, space):
    """`c` is a harness.Cli already pointed at the backend. Returns 0 when green."""
    r = Report()
    tag = "conflcli-e2e-%d" % os.getpid()
    created = []

    def new_page(title, *extra):
        res = c("create", "-s", space, "-t", title, *extra)
        parts = res.out.split()
        pid = parts[1] if len(parts) > 1 and parts[0] == "created" else ""
        if pid:
            created.append(pid)
        return pid

    def as_json(*args):
        try:
            return json.loads(c("--json", *args).out)
        except ValueError:
            return {}

    try:
        # -------------------------------------------------------------- read --
        section("Connectivity and read")
        out = c("whoami").all
        r.not_contains("whoami authenticates", out, "HTTP 401")
        r.check("whoami returns a user", out.strip() != "", out)
        r.contains("spaces lists the test space", c("spaces").all, space)

        # ------------------------------------------------------------ create --
        section("Create and read back")
        title = "e2e page " + tag
        pid = new_page(title, "--text", "hello from the e2e suite")
        r.check("create returns a numeric page id", pid.isdigit(), "got %r" % pid)
        got = c("get", pid).all
        r.contains("get shows the title", got, title)
        r.contains("get reports version 1", got, "v1")
        r.contains(
            "the plain-text body was stored as escaped XHTML",
            c("body", pid).all,
            "<p>hello from the e2e suite</p>",
        )
        # A page can be addressed by SPACE:Title, not just by the id nobody memorises.
        r.contains(
            "SPACE:Title resolves to the same page", c("get", "%s:%s" % (space, title)).all, pid
        )
        r.eq("--json emits parseable JSON with the id", as_json("get", pid).get("id"), pid)

        # ------------------------------------------------------------ update --
        section("Update and the version dance")
        c("update", pid, "-t", "renamed " + tag)
        got = c("get", pid).all
        r.contains("update rewrites the title", got, "renamed " + tag)
        r.contains("update bumps the version to 2", got, "v2")
        r.contains(
            "update without a body keeps the old body",
            c("body", pid).all,
            "hello from the e2e suite",
        )
        c("update", pid, "--text", "second revision")
        r.contains("update rewrites the body", c("body", pid).all, "second revision")
        r.contains("update bumps the version to 3", c("get", pid).all, "v3")
        # Sending a stale version is the single most common way to corrupt a write.
        r.fails(
            "a stale version number is rejected with HTTP 409",
            "HTTP 409",
            c("update", pid, "--version", "2", "--text", "should not land"),
        )
        r.contains(
            "the rejected update left the body untouched", c("body", pid).all, "second revision"
        )

        # ------------------------------------------------------------ append --
        section("Append")
        c("append", pid, "appended line")
        body = c("body", pid).all
        r.contains("append adds the new text", body, "appended line")
        r.contains("append preserves what was already there", body, "second revision")
        c("append", pid, "-", stdin="piped ș ț ü\n")
        r.contains(
            "append reads non-ASCII text from stdin", c("body", pid).all, "<p>piped ș ț ü</p>"
        )

        # ------------------------------------------------------ body formats --
        section("Body formats")
        wid = new_page("e2e wiki " + tag, "--wiki", "h1. Heading\n* bullet")
        r.contains(
            "wiki markup is converted to storage XHTML server-side",
            c("body", wid).all,
            "<h1>Heading</h1>",
        )
        rid = new_page("e2e raw storage " + tag, "-b", "<p>raw <strong>storage</strong></p>")
        r.contains(
            "raw storage XHTML passes through untouched",
            c("body", rid).all,
            "<strong>storage</strong>",
        )
        txid = new_page("e2e escaping " + tag, "--text", "a < b & c > d")
        r.contains(
            "--text escapes XML metacharacters", c("body", txid).all, "a &lt; b &amp; c &gt; d"
        )

        # ------------------------------------------------------------- label --
        section("Label (tagging)")
        c("label", "add", pid, tag, "alpha", "beta")
        labels = c("labels", pid).all
        r.contains("label add adds alpha", labels, "alpha")
        r.contains("label add adds beta", labels, "beta")
        c("label", "rm", pid, "alpha")
        labels = c("labels", pid).all
        r.not_contains("label rm drops alpha", labels, "alpha")
        r.contains("label rm leaves beta", labels, "beta")
        c("label", "set", pid, tag, "only-this")
        labels = c("labels", pid).all
        r.contains("label set installs the new label", labels, "only-this")
        r.not_contains("label set replaces the whole list", labels, "beta")
        # Labels are read through the page API too, which on v2 is a different endpoint.
        r.contains("get surfaces the labels", c("get", pid).all, "only-this")

        # ----------------------------------------------------------- comment --
        section("Comment")
        c("comment", pid, "first comment from e2e")
        c("comment", pid, "-", stdin="comment piped over stdin\n")
        comments = c("comments", pid).all
        r.contains("comment body is stored", comments, "first comment from e2e")
        r.contains("comment reads the body from stdin", comments, "comment piped over stdin")
        c("comment", pid, 'he said "done" & $PATH is 100% fine')
        r.contains(
            "quotes, $ and % survive argv on every OS",
            c("comments", pid).all,
            'he said "done" &amp; $PATH is 100% fine',
        )

        # ------------------------------------------- versions, attachments --
        section("Versions and attachments")
        # Only v1 is asserted: DC's v1 endpoint lists historical versions while Cloud's
        # v2 endpoint includes the current one, so the current one is not portable.
        r.contains("versions lists the first version", c("versions", pid).all, "v1")
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "conflcli-%s.txt" % tag)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write("hello from the e2e suite\n")
            name = os.path.basename(path)
            r.contains("attach uploads the file", c("attach", pid, path).all, name)
            r.contains("attachments lists the upload", c("attachments", pid).all, name)

        # ------------------------------------------------ hierarchy and move --
        section("Hierarchy")
        kid = new_page("e2e child " + tag, "--text", "a child page", "-p", pid)
        r.contains("a child page is created under its parent", c("children", pid).all, kid)
        other = new_page("e2e new parent " + tag, "--text", "another parent")
        c("move", kid, "--parent", other)
        r.contains("move re-parents the page", c("children", other).all, kid)
        r.not_contains("move detaches it from the old parent", c("children", pid).all, kid)

        # ------------------------------------------------------------ search --
        section("Search and pagination")
        for n in (1, 2, 3):
            page = new_page("e2e paging %d %s" % (n, tag), "--text", "page %d" % n)
            c("label", "add", page, tag)
        # 4 pages now carry the tag. The fake caps a search page at 2, so anything
        # less than 4 here means confluence.py stopped after the first page.
        cql = 'space = %s and label = "%s"' % (space, tag)
        r.eq(
            "search paginates past the server page cap",
            len(as_json("search", cql, "-n", "50").get("results") or []),
            4,
        )
        r.eq(
            "search honours -n as a hard limit",
            len(as_json("search", cql, "-n", "3").get("results") or []),
            3,
        )
        r.eq(
            "search with no matches returns an empty list",
            as_json("search", 'label = "no-such-label-%s"' % tag).get("results"),
            [],
        )

        # ------------------------------------------------------------- error --
        section("Error handling")
        r.fails("unknown page id reports the HTTP status", "HTTP 404", c("get", "99999999"))
        r.fails("unknown subcommand is rejected", "unknown command", c("frobnicate"))
        r.fails(
            "create without a title is rejected before the request",
            "title",
            c("create", "-s", space),
        )
        r.fails(
            "an unresolvable SPACE:Title is reported clearly",
            "no page titled",
            c("get", "%s:definitely not a page %s" % (space, tag)),
        )
        r.fails(
            "update with nothing to change is rejected", "title and/or a body", c("update", pid)
        )

        # ------------------------------------------------------------ delete --
        section("Delete")
        c("delete", rid)
        r.fails("deleted page is gone", "HTTP 404", c("get", rid))
    finally:
        # Children before parents, so a parent is never deleted out from under a child.
        for page in reversed(created):
            c("delete", page)

    return r.summary()
