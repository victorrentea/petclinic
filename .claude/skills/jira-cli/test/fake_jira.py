#!/usr/bin/env python3
"""A tiny in-memory stand-in for the JIRA REST v2 API.

It exists so the e2e suite can exercise jira.sh over real HTTP - real curl, real
status codes, real JSON - without a licence key or a 4-minute container boot.
It is deliberately strict about auth and about rejecting unknown issue keys, so
the tests fail the same way the real server would.

Only the endpoints jira.sh actually calls are implemented. Anything else 404s
loudly rather than pretending to work.
"""
import json
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "test-pat-12345"

# maxResults is capped low on purpose: it forces jira.sh to paginate, which is
# the part of the client most likely to silently truncate results.
PAGE_CAP = 2

STATUSES = ["To Do", "In Progress", "Done"]
TRANSITIONS = {
    "To Do": [("11", "Start Progress", "In Progress")],
    "In Progress": [("21", "Done", "Done"), ("31", "Stop Progress", "To Do")],
    "Done": [("41", "Reopen", "To Do")],
}


class Store:
    def __init__(self):
        self.lock = threading.Lock()
        self.issues = {}
        self.counters = {}
        self.comment_seq = 0
        self.links = []
        self.reset()

    def reset(self):
        with self.lock:
            self.issues.clear()
            self.counters.clear()
            self.comment_seq = 0
            self.links.clear()

    def next_key(self, project):
        self.counters[project] = self.counters.get(project, 0) + 1
        return f"{project}-{self.counters[project]}"


STORE = Store()

PROJECTS = [
    {"id": "10000", "key": "PET", "name": "PetClinic"},
    {"id": "10001", "key": "SAND", "name": "Sandbox"},
]

FIELDS = [
    {"id": "summary", "name": "Summary", "schema": {"type": "string"}},
    {"id": "labels", "name": "Labels", "schema": {"type": "array"}},
    {"id": "customfield_10010", "name": "Story Points", "schema": {"type": "number"}},
    {"id": "customfield_10020", "name": "Sprint", "schema": {"type": "array"}},
]

LINK_TYPES = [
    {"id": "10000", "name": "Blocks", "inward": "is blocked by", "outward": "blocks"},
    {"id": "10001", "name": "Relates", "inward": "relates to", "outward": "relates to"},
]

USER = {"name": "victor", "key": "victor", "accountId": "acc-victor",
        "displayName": "Victor Rentea", "emailAddress": "victor@example.com"}


def user_of(ref):
    """Accept either the Server/DC {name:..} or the Cloud {accountId:..} shape."""
    if not ref:
        return None
    name = ref.get("name") or ref.get("accountId")
    if not name:
        return None
    return {"name": name, "accountId": name, "displayName": name.title()}


def new_issue(key, fields):
    return {
        "id": str(10000 + len(STORE.issues)),
        "key": key,
        "fields": {
            "summary": fields.get("summary", ""),
            "description": fields.get("description"),
            "issuetype": {"name": (fields.get("issuetype") or {}).get("name", "Task")},
            "project": {"key": (fields.get("project") or {}).get("key")},
            "status": {"name": "To Do"},
            "labels": list(fields.get("labels") or []),
            "priority": fields.get("priority") or {"name": "Medium"},
            "assignee": user_of(fields.get("assignee")),
            "reporter": USER,
            "parent": fields.get("parent"),
            "attachment": [],
        },
        "_comments": [],
        "_worklogs": [],
        "_watchers": [],
        "_extra": {k: v for k, v in fields.items()
                    if k.startswith("customfield_") or k == "components"},
    }


def apply_label_ops(issue, ops):
    labels = issue["fields"]["labels"]
    for op in ops:
        if "add" in op and op["add"] not in labels:
            labels.append(op["add"])
        if "remove" in op and op["remove"] in labels:
            labels.remove(op["remove"])


# A deliberately small JQL subset: `field OP value` clauses joined by AND,
# with an optional trailing ORDER BY that we ignore.
CLAUSE = re.compile(r'(\w+)\s*(=|~|!=)\s*("[^"]*"|\'[^\']*\'|\S+)')


def jql_match(issue, jql):
    body = re.split(r"\border\s+by\b", jql, flags=re.I)[0]
    for field, op, raw in CLAUSE.findall(body):
        val = raw.strip("\"'")
        f = issue["fields"]
        if field.lower() == "project":
            actual = [f["project"]["key"]]
        elif field.lower() == "key":
            actual = [issue["key"]]
        elif field.lower() == "labels":
            actual = f["labels"]
        elif field.lower() == "status":
            actual = [f["status"]["name"]]
        elif field.lower() == "summary":
            actual = [f["summary"]]
        else:
            actual = []
        if op == "~":
            if not any(val.lower() in str(a).lower() for a in actual):
                return False
        elif op == "=":
            if val not in actual:
                return False
        elif op == "!=":
            if val in actual:
                return False
    return True


def view(issue, fields=None):
    out = dict(issue["fields"])
    out.update(issue["_extra"])
    if fields:
        wanted = [f.strip() for f in fields if f.strip() and f.strip() != "*all"]
        if wanted:
            out = {k: v for k, v in out.items() if k in wanted}
    return {"id": issue["id"], "key": issue["key"], "self": f"/rest/api/2/issue/{issue['key']}",
            "fields": out}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        pass  # silence; the test harness owns stdout

    # ------------------------------------------------------------ plumbing --
    def send_json(self, code, payload):
        body = b"" if payload is None else json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def fail(self, code, *messages):
        self.send_json(code, {"errorMessages": list(messages), "errors": {}})

    def authed(self):
        auth = self.headers.get("Authorization", "")
        if auth == f"Bearer {TOKEN}":
            return True
        if auth.startswith("Basic "):
            return True
        self.fail(401, "Client must be authenticated to access this resource.")
        return False

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    def path_parts(self):
        path = self.path.split("?", 1)[0]
        query = {}
        if "?" in self.path:
            for pair in self.path.split("?", 1)[1].split("&"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    query[k] = v.replace("%20", " ").replace("+", " ")
        prefix = "/rest/api/2/"
        if not path.startswith(prefix):
            return None, query
        return path[len(prefix):].strip("/").split("/"), query

    def issue_or_404(self, key):
        issue = STORE.issues.get(key)
        if issue is None:
            self.fail(404, f"Issue does not exist or you do not have permission to see it: {key}")
        return issue

    # ------------------------------------------------------------- routing --
    def do_GET(self):
        if self.path == "/__health":
            return self.send_json(200, {"ok": True})
        if not self.authed():
            return
        parts, query = self.path_parts()
        if parts is None:
            return self.fail(404, f"unsupported path {self.path}")

        if parts == ["myself"]:
            return self.send_json(200, USER)
        if parts == ["project"]:
            return self.send_json(200, PROJECTS)
        if parts == ["field"]:
            return self.send_json(200, FIELDS)
        if parts == ["issueLinkType"]:
            return self.send_json(200, {"issueLinkTypes": LINK_TYPES})
        if parts == ["issue", "createmeta"]:
            return self.send_json(200, {"projects": [{
                "key": query.get("projectKeys", "PET"),
                "issuetypes": [{"name": "Task", "subtask": False},
                                {"name": "Bug", "subtask": False},
                                {"name": "Sub-task", "subtask": True}],
            }]})

        if parts[0] == "issue" and len(parts) >= 2:
            issue = self.issue_or_404(parts[1])
            if issue is None:
                return
            if len(parts) == 2:
                fields = query.get("fields", "").split(",") if query.get("fields") else None
                return self.send_json(200, view(issue, fields))
            if parts[2] == "comment":
                return self.send_json(200, {"comments": issue["_comments"],
                                            "total": len(issue["_comments"])})
            if parts[2] == "transitions":
                avail = TRANSITIONS[issue["fields"]["status"]["name"]]
                return self.send_json(200, {"transitions": [
                    {"id": i, "name": n, "to": {"name": t}} for i, n, t in avail]})
            if parts[2] == "watchers":
                return self.send_json(200, {"watchCount": len(issue["_watchers"]),
                                            "watchers": issue["_watchers"]})
            if parts[2] == "worklog":
                return self.send_json(200, {"worklogs": issue["_worklogs"]})
        return self.fail(404, f"unsupported path {self.path}")

    def do_POST(self):
        if self.path == "/__reset":
            STORE.reset()
            return self.send_json(200, {"ok": True})
        if not self.authed():
            return
        parts, _ = self.path_parts()
        if parts is None:
            return self.fail(404, f"unsupported path {self.path}")

        # Attachments carry a multipart body, so they must claim the socket
        # before read_json() drains it.
        if len(parts) == 3 and parts[0] == "issue" and parts[2] == "attachments":
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b""  # always drain, even on 404
            issue = self.issue_or_404(parts[1])
            return self.do_attach(issue, raw) if issue is not None else None

        body = self.read_json()

        if parts == ["search"]:
            return self.do_search(body or {})
        if parts == ["issue"]:
            return self.do_create(body or {})
        if parts == ["issueLink"]:
            for side in ("inwardIssue", "outwardIssue"):
                key = (body or {}).get(side, {}).get("key")
                if self.issue_or_404(key) is None:
                    return
            STORE.links.append(body)
            return self.send_json(201, None)

        if parts[0] == "issue" and len(parts) == 3:
            issue = self.issue_or_404(parts[1])
            if issue is None:
                return
            if parts[2] == "comment":
                text = (body or {}).get("body")
                if not text:
                    return self.fail(400, "comment body is required")
                STORE.comment_seq += 1
                comment = {"id": str(STORE.comment_seq), "body": text, "author": USER,
                            "created": "2026-08-11T10:00:00.000+0000"}
                issue["_comments"].append(comment)
                return self.send_json(201, comment)
            if parts[2] == "transitions":
                return self.do_transition(issue, body or {})
            if parts[2] == "worklog":
                issue["_worklogs"].append({"id": str(len(issue["_worklogs"]) + 1),
                                            "timeSpent": (body or {}).get("timeSpent"),
                                            "comment": (body or {}).get("comment")})
                return self.send_json(201, issue["_worklogs"][-1])
            if parts[2] == "watchers":
                name = body if isinstance(body, str) else USER["name"]
                issue["_watchers"].append({"name": name, "displayName": name.title()})
                return self.send_json(204, None)
        return self.fail(404, f"unsupported path {self.path}")

    def do_PUT(self):
        if not self.authed():
            return
        parts, _ = self.path_parts()
        if parts is None or parts[0] != "issue":
            return self.fail(404, f"unsupported path {self.path}")
        issue = self.issue_or_404(parts[1])
        if issue is None:
            return
        body = self.read_json() or {}

        if len(parts) == 2:
            for key, val in (body.get("fields") or {}).items():
                if key == "assignee":
                    issue["fields"]["assignee"] = user_of(val)
                elif key in issue["fields"]:
                    issue["fields"][key] = val
                else:
                    issue["_extra"][key] = val
            if "labels" in (body.get("update") or {}):
                apply_label_ops(issue, body["update"]["labels"])
            return self.send_json(204, None)

        if len(parts) == 3 and parts[2] == "assignee":
            issue["fields"]["assignee"] = user_of(body)
            return self.send_json(204, None)
        return self.fail(404, f"unsupported path {self.path}")

    def do_DELETE(self):
        if not self.authed():
            return
        parts, _ = self.path_parts()
        if parts is None or parts[0] != "issue" or len(parts) != 2:
            return self.fail(404, f"unsupported path {self.path}")
        if self.issue_or_404(parts[1]) is None:
            return
        del STORE.issues[parts[1]]
        return self.send_json(204, None)

    # ----------------------------------------------------------- handlers ---
    def do_create(self, body):
        fields = body.get("fields") or {}
        project = (fields.get("project") or {}).get("key")
        if not project:
            return self.fail(400, "project is required")
        if project not in [p["key"] for p in PROJECTS]:
            return self.fail(400, f"project: Unknown project '{project}'")
        if not fields.get("summary"):
            return self.fail(400, "summary: You must specify a summary of the issue.")
        with STORE.lock:
            key = STORE.next_key(project)
            STORE.issues[key] = new_issue(key, fields)
        return self.send_json(201, {"id": STORE.issues[key]["id"], "key": key})

    def do_search(self, body):
        jql = body.get("jql", "")
        start = int(body.get("startAt") or 0)
        want = min(int(body.get("maxResults") or 50), PAGE_CAP)
        matched = [i for i in STORE.issues.values() if jql_match(i, jql)]
        matched.sort(key=lambda i: int(i["id"]))
        page = matched[start:start + want]
        fields = body.get("fields")
        return self.send_json(200, {
            "startAt": start, "maxResults": want, "total": len(matched),
            "issues": [view(i, fields) for i in page],
        })

    def do_transition(self, issue, body):
        tid = str(((body.get("transition") or {}).get("id")) or "")
        for i, _name, target in TRANSITIONS[issue["fields"]["status"]["name"]]:
            if i == tid:
                issue["fields"]["status"] = {"name": target}
                return self.send_json(204, None)
        return self.fail(400, f"Transition id '{tid}' is not valid for the current status")

    def do_attach(self, issue, raw):
        if self.headers.get("X-Atlassian-Token") != "no-check":
            return self.fail(403, "XSRF check failed - X-Atlassian-Token header missing")
        match = re.search(rb'filename="([^"]*)"', raw)
        filename = match.group(1).decode() if match else "unknown"
        att = {"id": str(len(issue["fields"]["attachment"]) + 1), "filename": filename,
                "size": len(raw), "content": f"/attachment/{filename}"}
        issue["fields"]["attachment"].append(att)
        return self.send_json(200, [att])


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(server.server_address[1], flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
