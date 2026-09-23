#!/usr/bin/env python3
"""jira.py - talk to a JIRA Server / Data Center (or Cloud) instance from the shell.

Built for environments where MCP servers are disabled by corporate policy.
Python 3.8+, standard library only: no curl, no jq, no pip install, so it runs the
same on Windows (no WSL), macOS and Linux.

    jira.py [--json] <command> [args]

Run `jira.py --help` for the command list.
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

PROG = "jira.py"
ENV_FILES = ("./.jira.env", "~/.claude/jira.env", "~/.jira.env")

USAGE = """\
%(p)s - JIRA from the shell (Server/DC via PAT, or Cloud via API token).

Read:
    whoami                              who the token belongs to
    get <KEY> [--fields a,b]            one issue
    search <JQL> [-n MAX] [--fields ..] JQL search, auto-paginated
    comments <KEY>                      all comments
    transitions <KEY>                   transitions available right now
    attachments <KEY>                   attachment list
    watchers <KEY>                      watcher list
    projects                            all projects
    issuetypes <PROJECT>                issue types creatable in a project
    fields [substring]                  field ids (find customfield_XXXXX)

Write:
    create -p PROJ -t Task -s "..." [-d "..."] [-l label]... [-a user] [--parent K] [-f k=v]
    update <KEY> [-s "..."] [-d "..."] [-f k=v]...
    assign <KEY> <user|->               '-' unassigns
    comment <KEY> <text|->              '-' reads the body from stdin
    label <add|rm|set> <KEY> <label...>
    transition <KEY> <name>             by transition name or target status name
    link <FROM> <type> <TO>             see 'linktypes'
    attach <KEY> <file>
    worklog <KEY> <timeSpent> [comment] e.g. worklog PET-1 2h "pairing"
    watch <KEY> [user] | delete <KEY> [--subtasks]

Escape hatch:
    raw <METHOD> <path> [json|-]        path relative to /rest/api/N, or absolute /rest/...

Global:
    --json      print the raw JSON response instead of the text summary
    config      show where credentials are read from
    -h|--help

Values for -f/--field: 'key=text' for a string, 'key:=<json>' for raw JSON
    e.g. -f customfield_10010=ACME  -f components:='[{"name":"api"}]'
""" % {
    "p": PROG
}


class Die(Exception):
    """A user-facing error: printed as '<prog>: <message>', exit code 1."""


# ---------------------------------------------------------------- config ----


def load_env_file():
    """Loads the first env file that exists. Keeping it in the home folder (not in
    the repo) is what makes the same PAT reusable across projects. Real environment
    variables win over the file, so a one-off `JIRA_PAT=... jira.py` still works."""
    candidates = []
    if os.environ.get("JIRA_ENV_FILE"):
        candidates.append(os.environ["JIRA_ENV_FILE"])
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
        self.url = (env.get("JIRA_URL") or "").rstrip("/")
        self.pat = env.get("JIRA_PAT", "")
        self.user = env.get("JIRA_USER", "")
        self.api_token = env.get("JIRA_API_TOKEN", "")
        if self.pat:
            self.deployment = env.get("JIRA_DEPLOYMENT") or "server"
        elif self.user and self.api_token:
            self.deployment = env.get("JIRA_DEPLOYMENT") or "cloud"
        else:
            self.deployment = env.get("JIRA_DEPLOYMENT") or ""
        # Server/DC speaks REST v2 with plain-text descriptions; Cloud v3 wants ADF,
        # so we deliberately stay on v2 there too unless the caller overrides it.
        self.api_version = env.get("JIRA_API_VERSION") or "2"
        self.api = "%s/rest/api/%s" % (self.url, self.api_version) if self.url else ""
        self.ssl_verify = env.get("JIRA_SSL_VERIFY", "1") != "0"
        self.default_project = env.get("JIRA_DEFAULT_PROJECT", "")

    def require(self):
        if not self.url:
            raise Die("JIRA_URL is not set. See '%s config' for where to put it." % PROG)
        if not self.pat and not (self.user and self.api_token):
            raise Die(
                "no credentials: set JIRA_PAT (Server/DC) or " "JIRA_USER + JIRA_API_TOKEN (Cloud)."
            )


# ------------------------------------------------------------- http core ----


class Client:
    def __init__(self, cfg):
        self.cfg = cfg
        handlers = []
        if not cfg.ssl_verify:
            handlers.append(urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
        self.opener = urllib.request.build_opener(*handlers)

    def url_for(self, path):
        if path.startswith("http://") or path.startswith("https://"):
            return path
        if path.startswith("/rest/"):
            return self.cfg.url + path
        return "%s/%s" % (self.cfg.api, path.lstrip("/"))

    def auth_header(self):
        if self.cfg.pat:
            return "Bearer " + self.cfg.pat
        raw = ("%s:%s" % (self.cfg.user, self.cfg.api_token)).encode("utf-8")
        return "Basic " + base64.b64encode(raw).decode("ascii")

    def call(self, method, path, body=None, data=None, headers=None):
        """body: a JSON-able value (sent as JSON), or data: raw bytes.
        Returns the parsed JSON response, the raw text if it is not JSON, or None."""
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
    try:
        data = json.loads(payload)
        parts = list(data.get("errorMessages") or [])
        parts += ["%s: %s" % (k, v) for k, v in (data.get("errors") or {}).items()]
        if parts:
            return "; ".join(str(p) for p in parts)
    except (ValueError, AttributeError):
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
    """A text argument, or stdin when it is exactly '-'. Trailing newlines are
    dropped, so `git log -1 --format=%B | jira.py comment K -` stores no blank tail."""
    if value == "-":
        value = sys.stdin.read()
    return (value or "").rstrip("\n")


def deep_merge(a, b):
    merged = dict(a)
    for key, value in b.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def parse_field(spec):
    """--field summary=hello -> ('summary', 'hello'); --field labels:='["a"]' -> raw JSON."""
    if ":=" in spec:
        key, raw = spec.split(":=", 1)
        try:
            return key, json.loads(raw)
        except ValueError:
            raise Die("--field %s:= expects valid JSON, got '%s'" % (key, raw)) from None
    if "=" not in spec:
        raise Die("--field expects key=value or key:=json, got '%s'" % spec)
    return tuple(spec.split("=", 1))


class Argv:
    """Walks a command's arguments the way the old bash `while case shift` loop did."""

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

    def rest(self):
        rest, self.args = self.args, []
        return rest


def user_ref(state, user):
    """Server/DC identifies users by name, Cloud by accountId."""
    return {"accountId": user} if state.cfg.deployment == "cloud" else {"name": user}


def _person(p):
    return alt(dig(p, "displayName"), dig(p, "name"))


# ------------------------------------------------------------- commands -----


def issue_summary(issue):
    f = issue.get("fields") or {}
    labels = ",".join(f.get("labels") or []) or "-"
    lines = [
        "%s  [%s]  %s"
        % (issue.get("key"), alt(dig(f, "status", "name"), "?"), alt(f.get("summary"), "")),
        "  type=%s  assignee=%s  reporter=%s"
        % (
            alt(dig(f, "issuetype", "name"), "?"),
            alt(_person(f.get("assignee")), "-"),
            alt(_person(f.get("reporter")), "-"),
        ),
        "  labels=%s  priority=%s" % (labels, alt(dig(f, "priority", "name"), "-")),
    ]
    if alt(f.get("description"), ""):
        lines.append("\n%s" % f["description"])
    return lines


def cmd_whoami(state, args):
    data = state.api.call("GET", "myself")
    emit(
        state,
        data,
        lambda d: [
            "%s  <%s>  key=%s"
            % (
                alt(d.get("displayName"), d.get("name")),
                alt(d.get("emailAddress"), "-"),
                alt(d.get("key"), d.get("accountId"), "-"),
            )
        ],
    )


def cmd_get(state, args):
    a = Argv(args, "get <ISSUE-KEY> [--fields a,b]")
    key, query = a.positional(), ""
    while a.args:
        opt = a.args.pop(0)
        if opt == "--fields":
            query = "?fields=" + a.value(opt)
        else:
            raise Die("unknown option for get: %s" % opt)
    emit(state, state.api.call("GET", "issue/%s%s" % (key, query)), issue_summary)


def cmd_search(state, args):
    a = Argv(args, "search <JQL> [-n MAX] [--fields a,b]")
    jql, limit = a.positional(), 50
    fields = "summary,status,assignee,issuetype,labels,priority"
    while a.args:
        opt = a.args.pop(0)
        if opt in ("-n", "--max"):
            limit = int(a.value(opt))
        elif opt == "--fields":
            fields = a.value(opt)
        else:
            raise Die("unknown option for search: %s" % opt)

    # Page until we have `limit` issues or JIRA runs out, so callers never silently
    # get truncated at the server's default page size.
    issues, total = [], 0
    while len(issues) < limit:
        want = min(limit - len(issues), 100)
        page = (
            state.api.call(
                "POST",
                "search",
                body={
                    "jql": jql,
                    "startAt": len(issues),
                    "maxResults": want,
                    "fields": fields.split(","),
                },
            )
            or {}
        )
        got = page.get("issues") or []
        total = page.get("total") or 0
        issues.extend(got)
        if not got or len(issues) >= total:
            break

    def render(d):
        yield "%s issue(s) matched, showing %d" % (d["total"], len(d["issues"]))
        for i in d["issues"]:
            f = i.get("fields") or {}
            yield "%s  [%s]  %s  (%s)" % (
                i.get("key"),
                alt(dig(f, "status", "name"), "?"),
                alt(f.get("summary"), ""),
                alt(_person(f.get("assignee")), "unassigned"),
            )

    emit(state, {"total": total, "issues": issues[:limit]}, render)


def cmd_create(state, args):
    a = Argv(args, "create -p PROJ -t Task -s ...")
    project, itype = state.cfg.default_project, "Task"
    summary = description = assignee = parent = ""
    labels, extra = [], {}
    while a.args:
        opt = a.args.pop(0)
        if opt in ("-p", "--project"):
            project = a.value(opt)
        elif opt in ("-t", "--type"):
            itype = a.value(opt)
        elif opt in ("-s", "--summary"):
            summary = text_arg(a.value(opt))
        elif opt in ("-d", "--description"):
            description = text_arg(a.value(opt))
        elif opt in ("-a", "--assignee"):
            assignee = a.value(opt)
        elif opt in ("-l", "--label"):
            labels.append(a.value(opt))
        elif opt == "--parent":
            parent = a.value(opt)
        elif opt in ("-f", "--field"):
            key, value = parse_field(a.value(opt))
            extra[key] = value
        else:
            raise Die("unknown option for create: %s" % opt)
    if not project:
        raise Die("create needs --project (or JIRA_DEFAULT_PROJECT)")
    if not summary:
        raise Die("create needs --summary")

    fields = {"project": {"key": project}, "issuetype": {"name": itype}, "summary": summary}
    if labels:
        fields["labels"] = labels
    if description:
        fields["description"] = description
    if assignee:
        fields["assignee"] = user_ref(state, assignee)
    if parent:
        fields["parent"] = {"key": parent}
    fields = deep_merge(fields, extra)
    data = state.api.call("POST", "issue", body={"fields": fields})
    emit(state, data, lambda d: ["created %s" % d.get("key")])


def cmd_update(state, args):
    a = Argv(args, "update <ISSUE-KEY> [--summary S] [--description D] [--field k=v]")
    key, fields = a.positional(), {}
    summary = description = ""
    while a.args:
        opt = a.args.pop(0)
        if opt in ("-s", "--summary"):
            summary = text_arg(a.value(opt))
        elif opt in ("-d", "--description"):
            description = text_arg(a.value(opt))
        elif opt in ("-f", "--field"):
            name, value = parse_field(a.value(opt))
            fields[name] = value
        else:
            raise Die("unknown option for update: %s" % opt)
    if summary:
        fields["summary"] = summary
    if description:
        fields["description"] = description
    if not fields:
        raise Die("update needs at least one field to change")
    state.api.call("PUT", "issue/" + key, body={"fields": fields})
    out("updated %s" % key)


def cmd_assign(state, args):
    a = Argv(args, "assign <ISSUE-KEY> <user|->")
    key, who = a.positional(), a.positional()
    ref = {"name": None, "accountId": None} if who == "-" else user_ref(state, who)
    state.api.call("PUT", "issue/%s/assignee" % key, body=ref)
    out("assigned %s to %s" % (key, who))


def cmd_comment(state, args):
    a = Argv(args, "comment <ISSUE-KEY> <text|->")
    key = a.positional()
    text = text_arg(a.optional(""))
    if not text:
        raise Die("comment body is empty")
    data = state.api.call("POST", "issue/%s/comment" % key, body={"body": text})
    emit(state, data, lambda d: ["commented on %s (comment %s)" % (key, d.get("id"))])


def cmd_comments(state, args):
    key = Argv(args, "comments <ISSUE-KEY>").positional()
    data = state.api.call("GET", "issue/%s/comment" % key)
    emit(
        state,
        data,
        lambda d: [
            "[%s] %s  %s\n%s\n"
            % (
                c.get("id"),
                alt(_person(c.get("author")), "?"),
                alt(c.get("created"), ""),
                c.get("body"),
            )
            for c in d.get("comments") or []
        ],
    )


def cmd_label(state, args):
    usage = "label <add|rm|set> <ISSUE-KEY> <label...>"
    a = Argv(args, usage)
    action, key = a.positional(), a.positional()
    labels = a.rest()
    if not labels:
        raise Die("label needs at least one label")
    if action in ("add", "rm", "remove"):
        op = "add" if action == "add" else "remove"
        body = {"update": {"labels": [{op: label} for label in labels]}}
    elif action == "set":
        body = {"fields": {"labels": labels}}
    else:
        raise Die("label action must be add, rm or set (got '%s')" % action)
    state.api.call("PUT", "issue/" + key, body=body)
    out("labels %s on %s: %s" % (action, key, " ".join(labels)))


def cmd_transitions(state, args):
    key = Argv(args, "transitions <ISSUE-KEY>").positional()
    data = state.api.call("GET", "issue/%s/transitions" % key)
    emit(
        state,
        data,
        lambda d: [
            "%s\t%s -> %s" % (t.get("id"), t.get("name"), alt(dig(t, "to", "name"), "?"))
            for t in d.get("transitions") or []
        ],
    )


def cmd_transition(state, args):
    a = Argv(args, "transition <ISSUE-KEY> <transition-or-status name>")
    key, name = a.positional(), a.positional()
    transitions = (state.api.call("GET", "issue/%s/transitions" % key) or {}).get(
        "transitions"
    ) or []
    wanted = name.lower()
    # Match the transition name first, then fall back to the destination status.
    match = [t for t in transitions if (t.get("name") or "").lower() == wanted]
    match += [t for t in transitions if (dig(t, "to", "name") or "").lower() == wanted]
    if not match:
        available = ", ".join(t.get("name") or "" for t in transitions) or "none"
        raise Die("no transition '%s' on %s. Available: %s" % (name, key, available))
    state.api.call(
        "POST", "issue/%s/transitions" % key, body={"transition": {"id": match[0]["id"]}}
    )
    out("transitioned %s via '%s'" % (key, name))


def cmd_link(state, args):
    a = Argv(args, "link <FROM-KEY> <link-type> <TO-KEY>")
    src, ltype, dst = a.positional(), a.positional(), a.positional()
    state.api.call(
        "POST",
        "issueLink",
        body={"type": {"name": ltype}, "inwardIssue": {"key": src}, "outwardIssue": {"key": dst}},
    )
    out("linked %s -[%s]-> %s" % (src, ltype, dst))


def cmd_linktypes(state, args):
    data = state.api.call("GET", "issueLinkType")
    emit(
        state,
        data,
        lambda d: [
            "%s\t(inward: %s, outward: %s)" % (t.get("name"), t.get("inward"), t.get("outward"))
            for t in d.get("issueLinkTypes") or []
        ],
    )


def multipart(path):
    boundary = "----jirapy" + uuid.uuid4().hex
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
    a = Argv(args, "attach <ISSUE-KEY> <file>")
    key, path = a.positional(), a.positional()
    if not os.path.isfile(path):
        raise Die("no such file: %s" % path)
    data, ctype = multipart(path)
    result = state.api.call(
        "POST",
        "issue/%s/attachments" % key,
        data=data,
        headers={"Content-Type": ctype, "X-Atlassian-Token": "no-check"},
    )
    emit(
        state,
        result,
        lambda d: ["attached %s (id %s)" % (x.get("filename"), x.get("id")) for x in d or []],
    )


def cmd_attachments(state, args):
    key = Argv(args, "attachments <ISSUE-KEY>").positional()
    data = state.api.call("GET", "issue/%s?fields=attachment" % key)
    emit(
        state,
        data,
        lambda d: [
            "%s\t%s\t%s bytes\t%s"
            % (x.get("id"), x.get("filename"), x.get("size"), alt(x.get("content"), ""))
            for x in dig(d, "fields", "attachment") or []
        ],
    )


def cmd_worklog(state, args):
    a = Argv(args, "worklog <ISSUE-KEY> <timeSpent> [comment]")
    key, spent, note = a.positional(), a.positional(), a.optional("")
    body = {"timeSpent": spent}
    if note:
        body["comment"] = note
    state.api.call("POST", "issue/%s/worklog" % key, body=body)
    out("logged %s on %s" % (spent, key))


def cmd_watch(state, args):
    a = Argv(args, "watch <ISSUE-KEY> [user]")
    key, who = a.positional(), a.optional("")
    # JIRA wants the bare JSON string "user", or a null body for "me".
    state.api.call(
        "POST",
        "issue/%s/watchers" % key,
        data=json.dumps(who or None).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    out("watching %s%s" % (key, " as " + who if who else ""))


def cmd_watchers(state, args):
    key = Argv(args, "watchers <ISSUE-KEY>").positional()
    data = state.api.call("GET", "issue/%s/watchers" % key)
    emit(state, data, lambda d: [_person(w) for w in d.get("watchers") or []])


def cmd_delete(state, args):
    a = Argv(args, "delete <ISSUE-KEY> [--subtasks]")
    key = a.positional()
    query = "?deleteSubtasks=true" if a.optional("") == "--subtasks" else ""
    state.api.call("DELETE", "issue/%s%s" % (key, query))
    out("deleted %s" % key)


def cmd_projects(state, args):
    data = state.api.call("GET", "project")
    emit(state, data, lambda d: ["%s\t%s" % (p.get("key"), p.get("name")) for p in d or []])


def cmd_issuetypes(state, args):
    project = Argv(args, "issuetypes <PROJECT-KEY>").positional()
    data = state.api.call(
        "GET",
        "issue/createmeta?projectKeys=%s&expand=projects.issuetypes" % urllib.parse.quote(project),
    )
    emit(
        state,
        data,
        lambda d: [
            "%s\tsubtask=%s" % (t.get("name"), json.dumps(t.get("subtask")))
            for p in d.get("projects") or []
            for t in p.get("issuetypes") or []
        ],
    )


def cmd_fields(state, args):
    needle = (args[0] if args else "").lower()
    data = state.api.call("GET", "field")
    emit(
        state,
        data,
        lambda d: [
            "%s\t%s\t%s" % (f.get("id"), f.get("name"), alt(dig(f, "schema", "type"), "?"))
            for f in d or []
            if needle in (f.get("name") or "").lower()
        ],
    )


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
        auth = "PAT (Bearer, Server/DC)"
    elif cfg.user:
        auth = "Basic as %s (Cloud)" % cfg.user
    else:
        auth = "<none>"
    out(
        """Credentials are read from the first file found, in this order:
    1. $JIRA_ENV_FILE            (currently: %s)
    2. ./.jira.env               (project-local override)
    3. ~/.claude/jira.env        <-- recommended: one PAT, reusable across all projects
    4. ~/.jira.env
Real environment variables win over the file.

Currently loaded: %s
JIRA_URL=%s
Auth: %s
API base: %s

Create it with:
    install -m 600 /dev/null ~/.claude/jira.env
    (on Windows: %%USERPROFILE%%\\.claude\\jira.env)
    $EDITOR ~/.claude/jira.env

See jira.env.example next to this script for the full list of variables."""
        % (
            os.environ.get("JIRA_ENV_FILE") or "unset",
            cfg.env_file or "<none>",
            cfg.url or "<unset>",
            auth,
            cfg.api or "<unset>",
        )
    )


COMMANDS = {
    "whoami": cmd_whoami,
    "get": cmd_get,
    "search": cmd_search,
    "create": cmd_create,
    "update": cmd_update,
    "assign": cmd_assign,
    "comment": cmd_comment,
    "comments": cmd_comments,
    "label": cmd_label,
    "transitions": cmd_transitions,
    "transition": cmd_transition,
    "link": cmd_link,
    "linktypes": cmd_linktypes,
    "attach": cmd_attach,
    "attachments": cmd_attachments,
    "worklog": cmd_worklog,
    "watch": cmd_watch,
    "watchers": cmd_watchers,
    "delete": cmd_delete,
    "projects": cmd_projects,
    "issuetypes": cmd_issuetypes,
    "fields": cmd_fields,
    "raw": cmd_raw,
}


class State:
    def __init__(self, cfg, as_json):
        self.cfg = cfg
        self.json = as_json
        self.api = Client(cfg)


def utf8_stdio():
    """Windows pipes default to the ANSI code page (cp1252) and CRLF: a Romanian
    summary would crash the print, and every `$(jira.py ...)` would end in \\r.
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
