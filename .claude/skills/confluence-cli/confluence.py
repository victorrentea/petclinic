#!/usr/bin/env python3
"""confluence.py - talk to a Confluence Data Center / Server (or Cloud) instance
from the shell. Sibling of jira-cli/jira.py: same env-file mechanism, same --json
convention, same escape hatch, built for environments where MCP servers are
disabled by policy.

Python 3.8+, standard library only: no curl, no jq, no pip install, so it runs the
same on Windows (no WSL), macOS and Linux.

    confluence.py [--json] <command> [args]
"""
import base64
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

PROG = "confluence.py"
ENV_FILES = ("./.confluence.env", "~/.claude/confluence.env", "~/.confluence.env")

USAGE = """\
%(p)s - Confluence from the shell (DC/Server via PAT, or Cloud via API token).

Pages are addressed by numeric id or by SPACE:Title, e.g. 'get "DOCS:Release Notes"'.

Read:
    whoami                              who the token belongs to
    spaces                              all spaces (key, name, id)
    get <PAGE> [--body]                 title, version, space, parent, labels
    body <PAGE>                         just the storage-format body
    children <PAGE>                     direct child pages
    search <CQL> [-n MAX]               CQL search, auto-paginated
    comments <PAGE>                     footer comments
    labels <PAGE>                       labels (tags) on a page
    attachments <PAGE>                  attachment list
    versions <PAGE>                     version history

Write:
    create -s SPACE -t "Title" [--text "..."|-b <storage>|--wiki "..."] [-p PARENT]
    update <PAGE> [-t "Title"] [--text "..."|-b <storage>|--wiki "..."] [-m "why"]
    append <PAGE> <text|-> [--storage]  read-modify-write, version handled for you
    comment <PAGE> <text|->             '-' reads the body from stdin
    label <add|rm|set> <PAGE> <label...>
    attach <PAGE> <file>
    move <PAGE> --parent <PAGE>
    delete <PAGE> [--purge]             trashes; --purge also empties it from trash

Escape hatch:
    raw <METHOD> <path> [json|-]        'content/123' (v1) or 'v2:pages/123' (v2)

Global:
    --json      print the raw JSON response instead of the text summary
    config      show where credentials are read from, and which API is in play
    -h|--help

Body formats: Confluence stores XHTML ("storage"), not markdown.
    --text  plain text, escaped into <p> paragraphs for you  <- use this by default
    --wiki  legacy wiki markup (h1. Heading, * bullet), converted server-side
    -b      raw storage XHTML, passed through untouched
""" % {
    "p": PROG
}


class Die(Exception):
    """A user-facing error: printed as '<prog>: <message>', exit code 1."""


# ---------------------------------------------------------------- config ----


def load_env_file():
    """Loads the first env file that exists. Keeping it in the home folder (not in
    the repo) is what makes the same PAT reusable across projects. Real environment
    variables win over the file."""
    candidates = []
    if os.environ.get("CONFLUENCE_ENV_FILE"):
        candidates.append(os.environ["CONFLUENCE_ENV_FILE"])
    candidates.extend(ENV_FILES)
    for path in candidates:
        path = os.path.abspath(os.path.expanduser(path))
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8-sig") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("export "):
                    line = line[len("export ") :].lstrip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
                    value = value[1:-1]
                os.environ.setdefault(key.strip(), value)
        return path
    return None


class Config:
    def __init__(self):
        self.env_file = load_env_file()
        env = os.environ
        self.url = (env.get("CONFLUENCE_URL") or "").rstrip("/")
        self.pat = env.get("CONFLUENCE_PAT", "")
        self.user = env.get("CONFLUENCE_USER", "")
        self.api_token = env.get("CONFLUENCE_API_TOKEN", "")
        if self.pat:
            self.flavor = env.get("CONFLUENCE_FLAVOR") or "server"
        elif self.user and self.api_token:
            self.flavor = env.get("CONFLUENCE_FLAVOR") or "cloud"
        else:
            self.flavor = env.get("CONFLUENCE_FLAVOR") or ""
        # Cloud serves Confluence under /wiki; DC serves it at the context root.
        # Accept a URL that already ends in /wiki so both spellings work.
        if self.flavor == "cloud" and not self.url.endswith("/wiki"):
            self.wiki = self.url + "/wiki" if self.url else ""
        else:
            self.wiki = self.url
        self.api1 = (
            self.wiki + "/rest/api" if self.wiki else ""
        )  # the only API on DC; CQL lives here
        self.api2 = self.wiki + "/api/v2" if self.wiki else ""  # Cloud only
        # Which API does page CRUD go through? On DC there is no choice. On Cloud v2
        # is the future-proof one, but v2 has no CQL search, no label writes and no
        # attachment upload - those stay on v1.
        default = "v2" if self.flavor == "cloud" else "v1"
        self.page_api = env.get("CONFLUENCE_PAGE_API") or default
        self.ssl_verify = env.get("CONFLUENCE_SSL_VERIFY", "1") != "0"
        self.default_space = env.get("CONFLUENCE_DEFAULT_SPACE", "")

    def require(self):
        if not self.url:
            raise Die("CONFLUENCE_URL is not set. See '%s config' for where to put it." % PROG)
        if not self.pat and not (self.user and self.api_token):
            raise Die(
                "no credentials: set CONFLUENCE_PAT (DC/Server) or "
                "CONFLUENCE_USER + CONFLUENCE_API_TOKEN (Cloud)."
            )
        if self.page_api not in ("v1", "v2"):
            raise Die("CONFLUENCE_PAGE_API must be v1 or v2 (got '%s')" % self.page_api)
        if self.page_api == "v2" and self.flavor == "server":
            raise Die("REST v2 is Cloud-only; Confluence DC/Server has no /api/v2.")


# ------------------------------------------------------------- http core ----


class Client:
    def __init__(self, cfg):
        self.cfg = cfg
        handlers = []
        if not cfg.ssl_verify:
            handlers.append(urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
        self.opener = urllib.request.build_opener(*handlers)

    def url_for(self, path):
        """http...   -> used as-is
        v2:...    -> resolved against the v2 base
        /wiki/... -> already site-absolute (Cloud)
        /...      -> relative to the Confluence context root (the site on DC, /wiki on Cloud)
        anything else -> relative to the v1 base"""
        if path.startswith("http://") or path.startswith("https://"):
            return path
        if path.startswith("v2:"):
            return "%s/%s" % (self.cfg.api2, path[3:].lstrip("/"))
        if path.startswith("/wiki/"):
            return self.cfg.url + path
        if path.startswith("/"):
            return self.cfg.wiki + path
        return "%s/%s" % (self.cfg.api1, path)

    def auth_header(self):
        if self.cfg.pat:
            return "Bearer " + self.cfg.pat
        raw = ("%s:%s" % (self.cfg.user, self.cfg.api_token)).encode("utf-8")
        return "Basic " + base64.b64encode(raw).decode("ascii")

    def call(self, method, path, body=None, data=None, headers=None):
        url = self.url_for(path)
        head = {"Accept": "application/json", "Authorization": self.auth_header()}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            head["Content-Type"] = "application/json"
        head.update(headers or {})
        req = urllib.request.Request(url, data=data, headers=head, method=method)
        try:
            with self.opener.open(req) as resp:
                text = resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            payload = exc.read().decode("utf-8", "replace")
            msg = _error_text(payload)
            raise Die(
                "HTTP %s on %s %s%s" % (exc.code, method, url, " - " + msg if msg else "")
            ) from None
        except urllib.error.URLError as exc:
            raise Die("cannot reach %s - %s" % (url, exc.reason)) from None
        if not text.strip():
            return None
        try:
            return json.loads(text)
        except ValueError:
            return text


def _error_text(payload):
    """v1 puts the text in .message, v2 in .errors[].title/.detail."""
    try:
        data = json.loads(payload)
        if isinstance(data, dict):
            if data.get("message"):
                return str(data["message"])
            parts = [
                "%s: %s" % (e.get("title") or "", e.get("detail") or "")
                for e in data.get("errors") or []
                if isinstance(e, dict)
            ]
            if parts:
                return "; ".join(parts)
    except ValueError:
        pass
    return payload.strip()[:500]


# ---------------------------------------------------------------- helpers ---


def alt(*values):
    """jq's `a // b // c`: the first value that is neither null nor false."""
    for value in values:
        if value is not None and value is not False:
            return value
    return values[-1]


def dig(obj, *keys):
    for key in keys:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(key)
    return obj


def out(text=""):
    sys.stdout.write(text + "\n")


def emit(state, payload, render):
    if state.json:
        out(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        for line in render(payload):
            out(line)


def text_arg(value):
    """A text argument, or stdin when it is exactly '-'. Trailing newlines dropped."""
    if value == "-":
        value = sys.stdin.read()
    return (value or "").rstrip("\n")


def quote(value):
    return urllib.parse.quote(value, safe="")


def text_to_storage(text):
    """Confluence's native body format is "storage" - XHTML, not markdown. Plain text
    is escaped and turned into one <p> per non-empty line."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return "\n".join("<p>%s</p>" % line for line in text.split("\n") if line.strip())


class Argv:
    def __init__(self, args, usage):
        self.args = list(args)
        self.usage = usage

    def positional(self):
        if not self.args:
            raise Die("usage: %s %s" % (PROG, self.usage))
        return self.args.pop(0)

    def optional(self, default=None):
        return self.args.pop(0) if self.args else default

    def value(self, flag):
        if not self.args:
            raise Die("option %s needs a value" % flag)
        return self.args.pop(0)


def body_option(opt, a):
    """-b / --text / --wiki -> (value, representation), or None if not a body flag."""
    if opt in ("-b", "--body"):
        return text_arg(a.value(opt)), "storage"
    if opt == "--text":
        return text_to_storage(text_arg(a.value(opt))), "storage"
    if opt == "--wiki":
        return text_arg(a.value(opt)), "wiki"
    return None


# ------------------------------------------------------- page resolution ----


def space_id(state, key):
    """v2 addresses spaces by numeric id, v1 by key. Translate once, here."""
    data = state.api.call("GET", "v2:spaces?keys=%s&limit=1" % quote(key)) or {}
    results = data.get("results") or []
    if not results:
        raise Die("no space with key '%s'" % key)
    return str(results[0]["id"])


def resolve_page(state, ref):
    """Pages are addressed by numeric id or by SPACE:Title, because humans know titles
    and ids only show up in URLs. Everything downstream works on the id."""
    if ref.isdigit():
        return ref
    if ":" not in ref:
        raise Die("page reference must be a numeric id or SPACE:Title (got '%s')" % ref)
    space, title = ref.split(":", 1)
    if state.cfg.page_api == "v2":
        data = (
            state.api.call(
                "GET",
                "v2:spaces/%s/pages?title=%s&limit=250" % (space_id(state, space), quote(title)),
            )
            or {}
        )
        hits = [p for p in data.get("results") or [] if p.get("title") == title]
    else:
        data = (
            state.api.call(
                "GET", "content?spaceKey=%s&title=%s&limit=1" % (quote(space), quote(title))
            )
            or {}
        )
        hits = data.get("results") or []
    if not hits:
        raise Die("no page titled '%s' in space '%s'" % (title, space))
    return str(hits[0]["id"])


def v1_body(value, rep):
    return {rep: {"value": value, "representation": rep}}


# ------------------------------------------------------------- commands -----


def cmd_whoami(state, args):
    # v2 has no "current user" endpoint; v1's works on both flavors.
    data = state.api.call("GET", "user/current")
    emit(
        state,
        data,
        lambda d: [
            "%s  <%s>  %s"
            % (
                alt(d.get("displayName"), d.get("username"), d.get("publicName"), "?"),
                alt(d.get("email"), d.get("emailAddress"), "-"),
                alt(d.get("accountId"), d.get("userKey"), d.get("username"), "-"),
            )
        ],
    )


def cmd_spaces(state, args):
    path = "v2:spaces?limit=250" if state.cfg.page_api == "v2" else "space?limit=250"
    emit(
        state,
        state.api.call("GET", path),
        lambda d: [
            "%s\t%s\t(id %s)" % (s.get("key"), s.get("name"), s.get("id"))
            for s in d.get("results") or []
        ],
    )


def page_json(state, pid):
    """A flavor-neutral view of a page: what `get --json` prints."""
    if state.cfg.page_api == "v2":
        d = state.api.call("GET", "v2:pages/%s?body-format=storage&include-labels=true" % pid)
        return {
            "id": d.get("id"),
            "title": d.get("title"),
            "version": dig(d, "version", "number"),
            "spaceId": d.get("spaceId"),
            "parentId": d.get("parentId"),
            "status": d.get("status"),
            "labels": [l.get("name") for l in dig(d, "labels", "results") or []],
            "body": alt(dig(d, "body", "storage", "value"), ""),
        }
    d = state.api.call(
        "GET", "content/%s?expand=body.storage,version,space,ancestors,metadata.labels" % pid
    )
    ancestors = d.get("ancestors") or []
    return {
        "id": d.get("id"),
        "title": d.get("title"),
        "version": dig(d, "version", "number"),
        "spaceKey": dig(d, "space", "key"),
        "parentId": ancestors[-1].get("id") if ancestors else None,
        "status": d.get("status"),
        "labels": [l.get("name") for l in dig(d, "metadata", "labels", "results") or []],
        "body": alt(dig(d, "body", "storage", "value"), ""),
    }


def cmd_get(state, args):
    a = Argv(args, "get <PAGE-ID|SPACE:Title> [--body]")
    ref, want_body = a.positional(), False
    while a.args:
        opt = a.args.pop(0)
        if opt == "--body":
            want_body = True
        else:
            raise Die("unknown option for get: %s" % opt)
    page = page_json(state, resolve_page(state, ref))

    def render(p):
        yield "%s  [id %s  v%s  %s]" % (
            p["title"],
            p["id"],
            p["version"],
            alt(p["status"], "current"),
        )
        yield "  space=%s  parent=%s  labels=%s" % (
            alt(p.get("spaceKey"), p.get("spaceId"), "-"),
            alt(p["parentId"], "-"),
            ",".join(p["labels"]) or "-",
        )
        if want_body:
            yield ""
            yield p["body"]

    emit(state, page, render)


def page_body(state, pid):
    if state.cfg.page_api == "v2":
        d = state.api.call("GET", "v2:pages/%s?body-format=storage" % pid)
    else:
        d = state.api.call("GET", "content/%s?expand=body.storage" % pid)
    return alt(dig(d, "body", "storage", "value"), "")


def cmd_body(state, args):
    ref = Argv(args, "body <PAGE-ID|SPACE:Title>").positional()
    out(page_body(state, resolve_page(state, ref)))


def cmd_create(state, args):
    a = Argv(args, "create -s SPACE -t Title ...")
    space, title, body, rep, parent = state.cfg.default_space, "", "", "storage", ""
    while a.args:
        opt = a.args.pop(0)
        as_body = body_option(opt, a)
        if as_body:
            body, rep = as_body
        elif opt in ("-s", "--space"):
            space = a.value(opt)
        elif opt in ("-t", "--title"):
            title = text_arg(a.value(opt))
        elif opt in ("-p", "--parent"):
            parent = a.value(opt)
        else:
            raise Die("unknown option for create: %s" % opt)
    if not space:
        raise Die("create needs --space (or CONFLUENCE_DEFAULT_SPACE)")
    if not title:
        raise Die("create needs --title")

    if state.cfg.page_api == "v2":
        payload = {
            "spaceId": space_id(state, space),
            "status": "current",
            "title": title,
            "body": {"representation": rep, "value": body},
        }
        if parent:
            payload["parentId"] = resolve_page(state, parent)
        data = state.api.call("POST", "v2:pages", body=payload)
    else:
        payload = {
            "type": "page",
            "title": title,
            "space": {"key": space},
            "body": v1_body(body, rep),
        }
        if parent:
            payload["ancestors"] = [{"id": resolve_page(state, parent)}]
        data = state.api.call("POST", "content", body=payload)
    emit(state, data, lambda d: ["created %s  %s" % (d.get("id"), d.get("title"))])


def update_page(
    state, pid, title=None, body=None, rep="storage", message="", version=None, parent=None
):
    """Update is where Confluence bites: the API demands the *next* version number
    and rejects a stale one with 409. We read the current version and increment it,
    so callers never have to think about it - and a 409 still means someone else
    edited the page between our read and our write, which is exactly what it should."""
    if state.cfg.page_api == "v2":
        current = state.api.call("GET", "v2:pages/%s?body-format=storage" % pid)
    else:
        current = state.api.call("GET", "content/%s?expand=body.storage,version,space" % pid)
    if title is None:
        title = current.get("title")
    if body is None:
        body, rep = alt(dig(current, "body", "storage", "value"), ""), "storage"
    if version is None:
        version = int(dig(current, "version", "number")) + 1
    ver = {"number": int(version)}
    if message:
        ver["message"] = message
    if state.cfg.page_api == "v2":
        payload = {
            "id": pid,
            "status": "current",
            "title": title,
            "body": {"representation": rep, "value": body},
            "version": ver,
        }
        if parent:
            payload["parentId"] = parent
        return state.api.call("PUT", "v2:pages/" + pid, body=payload)
    payload = {
        "id": pid,
        "type": "page",
        "title": title,
        "body": v1_body(body, rep),
        "version": ver,
    }
    if parent:
        payload["ancestors"] = [{"id": parent}]
    return state.api.call("PUT", "content/" + pid, body=payload)


def cmd_update(state, args):
    a = Argv(args, "update <PAGE-ID|SPACE:Title> [-t title] [-b body|--text|--wiki] [-m message]")
    ref = a.positional()
    title, body, rep, message, version = None, None, "storage", "", None
    while a.args:
        opt = a.args.pop(0)
        as_body = body_option(opt, a)
        if as_body:
            body, rep = as_body
        elif opt in ("-t", "--title"):
            title = text_arg(a.value(opt)) or None
        elif opt in ("-m", "--message"):
            message = a.value(opt)
        elif opt == "--version":
            version = int(a.value(opt))
        else:
            raise Die("unknown option for update: %s" % opt)
    if title is None and body is None:
        raise Die("update needs --title and/or a body (-b/--text/--wiki)")
    data = update_page(state, resolve_page(state, ref), title, body, rep, message, version)
    emit(state, data, lambda d: ["updated %s to v%s" % (d.get("id"), dig(d, "version", "number"))])


def cmd_append(state, args):
    """Appending is what agents actually want (a changelog entry, a result table), and
    doing it by hand means read-modify-write with the version dance."""
    a = Argv(args, "append <PAGE-ID|SPACE:Title> <text|-> [--storage]")
    ref, storage, text = a.positional(), False, ""
    while a.args:
        opt = a.args.pop(0)
        if opt == "--storage":
            storage = True
        else:
            text = text_arg(opt)
    if not text:
        raise Die("append needs some text")
    pid = resolve_page(state, ref)
    addition = text if storage else text_to_storage(text)
    body = page_body(state, pid).rstrip("\n") + "\n" + addition
    data = update_page(state, pid, body=body)
    emit(state, data, lambda d: ["updated %s to v%s" % (d.get("id"), dig(d, "version", "number"))])


def cmd_delete(state, args):
    a = Argv(args, "delete <PAGE-ID|SPACE:Title> [--purge]")
    pid = resolve_page(state, a.positional())
    purge = a.optional("")
    if purge and purge != "--purge":
        raise Die("unknown option for delete: %s" % purge)
    if state.cfg.page_api == "v2":
        state.api.call("DELETE", "v2:pages/" + pid)
        if purge:
            state.api.call("DELETE", "v2:pages/%s?purge=true" % pid)
    else:
        state.api.call("DELETE", "content/" + pid)
        if purge:
            state.api.call("DELETE", "content/%s?status=trashed" % pid)
    out("deleted %s%s" % (pid, " (purged)" if purge else ""))


def cmd_children(state, args):
    pid = resolve_page(state, Argv(args, "children <PAGE-ID|SPACE:Title>").positional())
    path = (
        "v2:pages/%s/children?limit=250"
        if state.cfg.page_api == "v2"
        else "content/%s/child/page?limit=250"
    ) % pid
    emit(
        state,
        state.api.call("GET", path),
        lambda d: ["%s\t%s" % (p.get("id"), p.get("title")) for p in d.get("results") or []],
    )


def cmd_search(state, args):
    """CQL search stays on v1 on both flavors: v2 has no CQL endpoint at all."""
    a = Argv(args, "search <CQL> [-n MAX]")
    cql, limit = a.positional(), 25
    while a.args:
        opt = a.args.pop(0)
        if opt in ("-n", "--max"):
            limit = int(a.value(opt))
        else:
            raise Die("unknown option for search: %s" % opt)

    # Page until we have `limit` results or the server runs out, so callers never
    # silently get truncated at the server's default page size.
    results, total, nxt = [], 0, None
    while len(results) < limit:
        want = min(limit - len(results), 100)
        path = nxt or "search?cql=%s&limit=%d&start=%d" % (quote(cql), want, len(results))
        page = state.api.call("GET", path) or {}
        got = page.get("results") or []
        total = alt(page.get("totalSize"), page.get("size"), 0)
        results.extend(got)
        if not got:
            break
        # Cloud hands back a cursor link; DC just wants the next start offset.
        nxt = dig(page, "_links", "next")
        if nxt:
            # Trim a leading /wiki so url_for() does not double it on Cloud.
            if nxt.startswith("/wiki/"):
                nxt = nxt[len("/wiki") :]
            nxt = "/" + nxt.lstrip("/")

    def render(d):
        yield "%s result(s), showing %d" % (d["total"], len(d["results"]))
        for x in d["results"]:
            c = x.get("content") or {}
            yield "%s\t%s\t%s" % (
                alt(c.get("id"), x.get("id"), "-"),
                alt(c.get("title"), x.get("title"), x.get("name"), "-"),
                alt(
                    dig(c, "space", "key"),
                    dig(x, "space", "key"),
                    dig(x, "resultGlobalContainer", "title"),
                    "-",
                ),
            )

    # A cursor link carries the server's own page size, so the last hop can
    # overshoot the caller's -n. Trim, so -n stays a hard limit.
    emit(state, {"total": total, "results": results[:limit]}, render)


def cmd_comments(state, args):
    pid = resolve_page(state, Argv(args, "comments <PAGE-ID|SPACE:Title>").positional())
    if state.cfg.page_api == "v2":
        data = state.api.call(
            "GET", "v2:pages/%s/footer-comments?body-format=storage&limit=100" % pid
        )
        emit(
            state,
            data,
            lambda d: [
                "[%s] v%s\n%s\n"
                % (
                    c.get("id"),
                    alt(dig(c, "version", "number"), 1),
                    alt(dig(c, "body", "storage", "value"), ""),
                )
                for c in d.get("results") or []
            ],
        )
    else:
        data = state.api.call(
            "GET", "content/%s/child/comment?expand=body.storage,version,history&limit=100" % pid
        )
        emit(
            state,
            data,
            lambda d: [
                "[%s] %s  %s\n%s\n"
                % (
                    c.get("id"),
                    alt(dig(c, "history", "createdBy", "displayName"), "?"),
                    alt(dig(c, "history", "createdDate"), ""),
                    alt(dig(c, "body", "storage", "value"), ""),
                )
                for c in d.get("results") or []
            ],
        )


def cmd_comment(state, args):
    a = Argv(args, "comment <PAGE-ID|SPACE:Title> <text|->")
    ref = a.positional()
    text = text_arg(a.optional(""))
    if not text:
        raise Die("comment body is empty")
    pid = resolve_page(state, ref)
    storage = text_to_storage(text)
    if state.cfg.page_api == "v2":
        data = state.api.call(
            "POST",
            "v2:footer-comments",
            body={"pageId": pid, "body": {"representation": "storage", "value": storage}},
        )
    else:
        data = state.api.call(
            "POST",
            "content",
            body={
                "type": "comment",
                "container": {"id": pid, "type": "page"},
                "body": v1_body(storage, "storage"),
            },
        )
    emit(state, data, lambda d: ["commented on %s (comment %s)" % (pid, d.get("id"))])


def cmd_labels(state, args):
    """Labels are Confluence's tags. v2 can read them but not write them, so the
    whole label surface goes through v1 on both flavors."""
    pid = resolve_page(state, Argv(args, "labels <PAGE-ID|SPACE:Title>").positional())
    emit(
        state,
        state.api.call("GET", "content/%s/label" % pid),
        lambda d: [
            "%s\t(prefix %s)" % (l.get("name"), alt(l.get("prefix"), "global"))
            for l in d.get("results") or []
        ],
    )


def cmd_label(state, args):
    a = Argv(args, "label <add|rm|set> <PAGE> <label...>")
    action, ref = a.positional(), a.positional()
    labels = a.args
    if not labels:
        raise Die("label needs at least one label")
    if action not in ("add", "rm", "remove", "set"):
        raise Die("label action must be add, rm or set (got '%s')" % action)
    pid = resolve_page(state, ref)
    if action in ("rm", "remove", "set"):
        doomed = labels
        if action == "set":
            existing = state.api.call("GET", "content/%s/label" % pid) or {}
            doomed = [l.get("name") for l in existing.get("results") or [] if l.get("name")]
        for label in doomed:
            state.api.call("DELETE", "content/%s/label/%s" % (pid, quote(label)))
    if action in ("add", "set"):
        state.api.call(
            "POST", "content/%s/label" % pid, body=[{"prefix": "global", "name": l} for l in labels]
        )
    out("labels %s on %s: %s" % (action, pid, " ".join(labels)))


def multipart(path):
    boundary = "----confluencepy" + uuid.uuid4().hex
    name = os.path.basename(path).replace('"', "_")
    with open(path, "rb") as fh:
        content = fh.read()
    body = (
        (
            '--%s\r\nContent-Disposition: form-data; name="file"; filename="%s"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n" % (boundary, name)
        ).encode("utf-8")
        + content
        + ("\r\n--%s--\r\n" % boundary).encode("ascii")
    )
    return body, "multipart/form-data; boundary=" + boundary


def cmd_attach(state, args):
    """Attachment upload is multipart, and v1-only on both flavors: v2 has no upload."""
    a = Argv(args, "attach <PAGE> <file>")
    ref, path = a.positional(), a.positional()
    if not os.path.isfile(path):
        raise Die("no such file: %s" % path)
    pid = resolve_page(state, ref)
    data, ctype = multipart(path)
    result = state.api.call(
        "POST",
        "content/%s/child/attachment" % pid,
        data=data,
        headers={"Content-Type": ctype, "X-Atlassian-Token": "nocheck"},
    )
    items = result.get("results") if isinstance(result, dict) else result
    emit(
        state,
        result,
        lambda d: [
            "attached %s (id %s)" % (alt(x.get("title"), x.get("filename")), x.get("id"))
            for x in items or []
        ],
    )


def cmd_attachments(state, args):
    pid = resolve_page(state, Argv(args, "attachments <PAGE>").positional())
    data = state.api.call("GET", "content/%s/child/attachment?limit=100" % pid)
    emit(
        state,
        data,
        lambda d: [
            "%s\t%s\t%s bytes"
            % (x.get("id"), x.get("title"), alt(dig(x, "extensions", "fileSize"), "?"))
            for x in d.get("results") or []
        ],
    )


def cmd_versions(state, args):
    pid = resolve_page(state, Argv(args, "versions <PAGE>").positional())
    if state.cfg.page_api == "v2":
        emit(
            state,
            state.api.call("GET", "v2:pages/%s/versions?limit=50" % pid),
            lambda d: [
                "v%s\t%s\t%s"
                % (v.get("number"), alt(v.get("createdAt"), ""), alt(v.get("message"), ""))
                for v in d.get("results") or []
            ],
        )
    else:
        emit(
            state,
            state.api.call("GET", "content/%s/version?limit=50" % pid),
            lambda d: [
                "v%s\t%s\t%s\t%s"
                % (
                    v.get("number"),
                    alt(v.get("when"), ""),
                    alt(v.get("message"), ""),
                    alt(dig(v, "by", "displayName"), ""),
                )
                for v in d.get("results") or []
            ],
        )


def cmd_move(state, args):
    a = Argv(args, "move <PAGE> --parent <PAGE>")
    ref, parent = a.positional(), ""
    while a.args:
        opt = a.args.pop(0)
        if opt in ("-p", "--parent"):
            parent = a.value(opt)
        else:
            raise Die("unknown option for move: %s" % opt)
    if not parent:
        raise Die("move needs --parent")
    pid, new_parent = resolve_page(state, ref), resolve_page(state, parent)
    update_page(state, pid, parent=new_parent)
    out("moved %s under %s" % (pid, new_parent))


def cmd_raw(state, args):
    a = Argv(args, "raw <GET|POST|PUT|DELETE> <path> [json-body|-]")
    method, path = a.positional().upper(), a.positional()
    body = text_arg(a.optional(""))
    data = body.encode("utf-8") if body else None
    headers = {"Content-Type": "application/json"} if data else None
    result = state.api.call(method, path, data=data, headers=headers)
    if isinstance(result, str):
        out(result)
    elif result is not None:
        out(json.dumps(result, indent=2, ensure_ascii=False))


def cmd_config(cfg):
    if cfg.pat:
        auth = "PAT (Bearer, DC/Server)"
    elif cfg.user:
        auth = "Basic as %s (Cloud)" % cfg.user
    else:
        auth = "<none>"
    out(
        """Credentials are read from the first file found, in this order:
    1. $CONFLUENCE_ENV_FILE      (currently: %s)
    2. ./.confluence.env         (project-local override)
    3. ~/.claude/confluence.env  <-- recommended: one PAT, reusable across all projects
    4. ~/.confluence.env
Real environment variables win over the file.

Currently loaded: %s
CONFLUENCE_URL=%s
Auth: %s
Flavor: %s   page API: %s
v1 base: %s
v2 base: %s%s

Create it with:
    install -m 600 /dev/null ~/.claude/confluence.env
    (on Windows: %%USERPROFILE%%\\.claude\\confluence.env)
    $EDITOR ~/.claude/confluence.env

See confluence.env.example next to this script for the full list of variables."""
        % (
            os.environ.get("CONFLUENCE_ENV_FILE") or "unset",
            cfg.env_file or "<none>",
            cfg.url or "<unset>",
            auth,
            cfg.flavor or "<unset>",
            cfg.page_api,
            cfg.api1 or "<unset>",
            cfg.api2 or "<unset>",
            " (unused - DC has no v2)" if cfg.flavor == "server" else "",
        )
    )


COMMANDS = {
    "whoami": cmd_whoami,
    "spaces": cmd_spaces,
    "get": cmd_get,
    "body": cmd_body,
    "children": cmd_children,
    "search": cmd_search,
    "comments": cmd_comments,
    "comment": cmd_comment,
    "labels": cmd_labels,
    "label": cmd_label,
    "attach": cmd_attach,
    "attachments": cmd_attachments,
    "versions": cmd_versions,
    "create": cmd_create,
    "update": cmd_update,
    "append": cmd_append,
    "move": cmd_move,
    "delete": cmd_delete,
    "raw": cmd_raw,
}


class State:
    def __init__(self, cfg, as_json):
        self.cfg = cfg
        self.json = as_json
        self.api = Client(cfg)


def utf8_stdio():
    """Windows pipes default to the ANSI code page (cp1252) and CRLF: a Romanian
    title would crash the print, and every `$(confluence.py ...)` would end in \\r.
    Pin UTF-8 and bare \\n on every OS so output is byte-identical everywhere."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace", newline="\n")
        except (AttributeError, ValueError):
            pass
    try:
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def main(argv=None):
    utf8_stdio()
    argv = list(sys.argv[1:] if argv is None else argv)
    as_json = "--json" in argv
    argv = [a for a in argv if a != "--json"]
    cmd = argv.pop(0) if argv else "help"
    try:
        if cmd in ("-h", "--help", "help"):
            sys.stdout.write(USAGE)
            return 0
        cfg = Config()
        if cmd == "config":
            cmd_config(cfg)
            return 0
        if cmd not in COMMANDS:
            raise Die("unknown command '%s'. Run '%s --help'." % (cmd, PROG))
        cfg.require()
        COMMANDS[cmd](State(cfg, as_json), argv)
        return 0
    except Die as exc:
        sys.stderr.write("%s: %s\n" % (PROG, exc))
        return 1
    except ValueError as exc:
        sys.stderr.write("%s: %s\n" % (PROG, exc))
        return 1
    except BrokenPipeError:
        return 0
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
