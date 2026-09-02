#!/usr/bin/env python3
"""A tiny in-memory stand-in for the Confluence REST API - both v1 and v2.

It exists so the e2e suite can exercise confluence.sh over real HTTP - real curl,
real status codes, real JSON - without a licence key or a Cloud site.

Serving BOTH APIs from one process is the point: confluence.sh talks v1 to Data
Center and v2 to Cloud, and the same scenario is run twice against this server,
once per flavor. Anything the v1 path proves, the v2 path has to prove too.

It is deliberately strict about the things that actually break clients:
  - auth (401 on a bad token)
  - the version dance on update (409 on a stale or skipped version number)
  - unknown page ids (404)
  - a tiny search page size, so a client that forgot to paginate fails

Only the endpoints confluence.sh actually calls are implemented. Anything else
404s loudly rather than pretending to work.
"""
import json
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

TOKEN = "test-pat-12345"

# Capped low on purpose: it forces confluence.sh to paginate, which is the part
# of the client most likely to silently truncate results.
PAGE_CAP = 2

SPACES = [
    {"id": "1001", "key": "DOCS", "name": "Documentation"},
    {"id": "1002", "key": "SAND", "name": "Sandbox"},
]

USER = {"type": "known", "username": "victor", "userKey": "victor-key",
        "accountId": "acc-victor", "displayName": "Victor Rentea",
        "email": "victor@example.com"}


class Store:
    def __init__(self):
        self.lock = threading.Lock()
        self.pages = {}
        self.seq = 100000
        self.comment_seq = 0

    def reset(self):
        with self.lock:
            self.pages.clear()
            self.seq = 100000
            self.comment_seq = 0

    def next_id(self):
        self.seq += 1
        return str(self.seq)


STORE = Store()


def space_by_key(key):
    return next((s for s in SPACES if s["key"] == key), None)


def space_by_id(sid):
    return next((s for s in SPACES if s["id"] == str(sid)), None)


def wiki_to_storage(text):
    """A caricature of Confluence's wiki-markup conversion.

    Real Confluence converts wiki markup to storage XHTML server-side. The fake
    only needs to convert enough that a test can tell the difference between a
    body that arrived as `wiki` and one that arrived as `storage` - if the client
    forgets to set the representation field, the assertion fails.
    """
    out = []
    for line in text.split("\n"):
        m = re.match(r"^h([1-6])\.\s*(.*)$", line)
        if m:
            out.append(f"<h{m.group(1)}>{m.group(2)}</h{m.group(1)}>")
        elif line.startswith("* "):
            out.append(f"<ul><li>{line[2:]}</li></ul>")
        elif line.strip():
            out.append(f"<p>{line}</p>")
    return "\n".join(out)


def body_in(body, api):
    """Normalise an incoming body to storage XHTML, whichever API shape it used."""
    if not body:
        return None
    if api == "v2":
        rep = body.get("representation") or "storage"
        val = body.get("value") or ""
    else:
        # v1 nests by representation: {"storage": {...}} or {"wiki": {...}}
        rep = next((k for k in ("storage", "wiki", "editor") if k in body), None)
        if rep is None:
            return None
        val = (body.get(rep) or {}).get("value") or ""
    return wiki_to_storage(val) if rep == "wiki" else val


def new_page(pid, title, space, parent_id, body):
    return {
        "id": pid,
        "title": title,
        "spaceKey": space["key"],
        "spaceId": space["id"],
        "parentId": parent_id,
        "status": "current",
        "body": body or "",
        "version": 1,
        "versions": [{"number": 1, "message": "", "when": "2026-08-12T10:00:00.000Z"}],
        "labels": [],
        "comments": [],
        "attachments": [],
    }


# ------------------------------------------------------------------- views --

def v1_page(p, expand=""):
    out = {
        "id": p["id"], "type": "page", "status": p["status"], "title": p["title"],
        "space": {"id": p["spaceId"], "key": p["spaceKey"]},
        "version": {"number": p["version"]},
        "ancestors": ([{"id": p["parentId"]}] if p["parentId"] else []),
        "_links": {"webui": f"/spaces/{p['spaceKey']}/pages/{p['id']}"},
    }
    if "body" in expand or not expand:
        out["body"] = {"storage": {"value": p["body"], "representation": "storage"}}
    if "metadata.labels" in expand:
        out["metadata"] = {"labels": {"results": [
            {"prefix": "global", "name": n} for n in p["labels"]]}}
    return out


def v2_page(p, body_format=None, include_labels=False):
    out = {
        "id": p["id"], "status": p["status"], "title": p["title"],
        "spaceId": p["spaceId"], "parentId": p["parentId"],
        "version": {"number": p["version"], "createdAt": "2026-08-12T10:00:00.000Z",
                    "message": p["versions"][-1]["message"]},
        "_links": {"webui": f"/spaces/{p['spaceKey']}/pages/{p['id']}"},
    }
    if body_format:
        out["body"] = {"storage": {"value": p["body"], "representation": "storage"}}
    if include_labels:
        out["labels"] = {"results": [{"id": str(i), "name": n, "prefix": "global"}
                                      for i, n in enumerate(p["labels"])]}
    return out


# --------------------------------------------------------------------- CQL --

CLAUSE = re.compile(r'(\w+)\s*(=|~|!=)\s*("[^"]*"|\'[^\']*\'|\S+)')


def cql_match(page, cql):
    """A deliberately small CQL subset: `field OP value` clauses joined by AND."""
    body = re.split(r"\border\s+by\b", cql, flags=re.I)[0]
    for field, op, raw in CLAUSE.findall(body):
        val = raw.strip("\"'")
        f = field.lower()
        if f == "space":
            actual = [page["spaceKey"]]
        elif f == "title":
            actual = [page["title"]]
        elif f == "label":
            actual = page["labels"]
        elif f == "id":
            actual = [page["id"]]
        elif f == "type":
            actual = ["page"]
        elif f == "text":
            actual = [page["title"], page["body"]]
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

    def fail(self, code, message):
        # v1 shape and v2 shape at once, so the client's error parser is exercised
        # whichever branch it takes.
        self.send_json(code, {"statusCode": code, "message": message,
                              "errors": [{"status": code, "title": message, "detail": message}]})

    def authed(self):
        auth = self.headers.get("Authorization", "")
        if auth == f"Bearer {TOKEN}" or auth.startswith("Basic "):
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

    def route(self):
        """-> (api, parts, query). api is 'v1', 'v2' or None."""
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
        # Cloud serves everything under /wiki; DC serves it at the root. Accept both
        # so one server can answer a server-flavored and a cloud-flavored client.
        if path.startswith("/wiki/"):
            path = path[len("/wiki"):]
        if path.startswith("/rest/api/"):
            return "v1", path[len("/rest/api/"):].strip("/").split("/"), query
        if path.startswith("/api/v2/"):
            return "v2", path[len("/api/v2/"):].strip("/").split("/"), query
        return None, [], query

    def page_or_404(self, pid, allow_trashed=False):
        """Trashed pages 404 on read, the way Confluence hides them unless you ask
        for `status=trashed` explicitly. Deletes still have to reach them, though,
        because purging is a second DELETE against an already-trashed page."""
        page = STORE.pages.get(str(pid))
        if page is None or (page["status"] != "current" and not allow_trashed):
            self.fail(404, f"No content found with id: {pid}")
            return None
        return page

    # ------------------------------------------------------------- routing --
    def do_GET(self):
        if self.path == "/__health":
            return self.send_json(200, {"ok": True})
        if not self.authed():
            return
        api, parts, q = self.route()
        if api == "v1":
            return self.get_v1(parts, q)
        if api == "v2":
            return self.get_v2(parts, q)
        return self.fail(404, f"unsupported path {self.path}")

    def do_POST(self):
        if self.path == "/__reset":
            STORE.reset()
            return self.send_json(200, {"ok": True})
        if not self.authed():
            return
        api, parts, q = self.route()

        # Attachments carry a multipart body, so they must claim the socket before
        # read_json() drains it.
        if api == "v1" and len(parts) == 4 and parts[0] == "content" and parts[2:] == ["child", "attachment"]:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b""  # always drain, even on 404
            page = self.page_or_404(parts[1])
            return self.do_attach(page, raw) if page is not None else None

        body = self.read_json()
        if api == "v1":
            return self.post_v1(parts, body or {})
        if api == "v2":
            return self.post_v2(parts, body or {})
        return self.fail(404, f"unsupported path {self.path}")

    def do_PUT(self):
        if not self.authed():
            return
        api, parts, _ = self.route()
        body = self.read_json() or {}
        if api == "v1" and len(parts) == 2 and parts[0] == "content":
            page = self.page_or_404(parts[1])
            return self.update_page(page, body, "v1") if page is not None else None
        if api == "v2" and len(parts) == 2 and parts[0] == "pages":
            page = self.page_or_404(parts[1])
            return self.update_page(page, body, "v2") if page is not None else None
        return self.fail(404, f"unsupported path {self.path}")

    def do_DELETE(self):
        if not self.authed():
            return
        api, parts, q = self.route()
        if api == "v1" and parts[0] == "content":
            if len(parts) == 2:
                page = self.page_or_404(parts[1], allow_trashed=True)
                if page is None:
                    return
                if q.get("status") == "trashed":
                    del STORE.pages[page["id"]]
                else:
                    page["status"] = "trashed"
                return self.send_json(204, None)
            if len(parts) == 4 and parts[2] == "label":
                page = self.page_or_404(parts[1])
                if page is None:
                    return
                if parts[3] in page["labels"]:
                    page["labels"].remove(parts[3])
                return self.send_json(204, None)
        if api == "v2" and len(parts) == 2 and parts[0] == "pages":
            page = self.page_or_404(parts[1], allow_trashed=True)
            if page is None:
                return
            if q.get("purge") == "true":
                del STORE.pages[page["id"]]
            else:
                page["status"] = "trashed"
            return self.send_json(204, None)
        return self.fail(404, f"unsupported path {self.path}")

    # ----------------------------------------------------------------- v1 ---
    def get_v1(self, parts, q):
        if parts == ["user", "current"]:
            return self.send_json(200, USER)
        if parts == ["space"]:
            return self.send_json(200, {"results": SPACES, "size": len(SPACES)})
        if parts == ["search"]:
            return self.do_search(q)
        if parts == ["content"]:
            key, title = q.get("spaceKey"), q.get("title")
            hits = [p for p in STORE.pages.values()
                    if p["status"] == "current"
                    and (key is None or p["spaceKey"] == key)
                    and (title is None or p["title"] == title)]
            return self.send_json(200, {"results": [v1_page(p) for p in hits],
                                        "size": len(hits)})
        if parts and parts[0] == "content" and len(parts) >= 2:
            page = self.page_or_404(parts[1])
            if page is None:
                return
            if len(parts) == 2:
                return self.send_json(200, v1_page(page, q.get("expand", "")))
            if parts[2] == "label":
                return self.send_json(200, {"results": [
                    {"prefix": "global", "name": n, "id": str(i)}
                    for i, n in enumerate(page["labels"])]})
            if parts[2] == "version":
                return self.send_json(200, {"results": [
                    {"number": v["number"], "message": v["message"], "when": v["when"],
                      "by": {"displayName": USER["displayName"]}}
                    for v in page["versions"]]})
            if parts[2] == "child" and len(parts) == 4:
                if parts[3] == "page":
                    kids = [p for p in STORE.pages.values()
                            if p["parentId"] == page["id"] and p["status"] == "current"]
                    return self.send_json(200, {"results": [v1_page(k) for k in kids]})
                if parts[3] == "comment":
                    return self.send_json(200, {"results": [
                        {"id": c["id"],
                          "body": {"storage": {"value": c["body"], "representation": "storage"}},
                          "version": {"number": 1},
                          "history": {"createdBy": {"displayName": USER["displayName"]},
                                      "createdDate": "2026-08-12T10:00:00.000Z"}}
                        for c in page["comments"]]})
                if parts[3] == "attachment":
                    return self.send_json(200, {"results": page["attachments"]})
        return self.fail(404, f"unsupported path {self.path}")

    def post_v1(self, parts, body):
        if parts == ["content"]:
            if body.get("type") == "comment":
                container = (body.get("container") or {}).get("id")
                page = self.page_or_404(container)
                if page is None:
                    return
                STORE.comment_seq += 1
                comment = {"id": f"c{STORE.comment_seq}", "body": body_in(body.get("body"), "v1") or ""}
                page["comments"].append(comment)
                return self.send_json(200, {"id": comment["id"], "type": "comment"})
            return self.create_page(
                space_key=(body.get("space") or {}).get("key"),
                title=body.get("title"),
                parent_id=((body.get("ancestors") or [{}])[-1] or {}).get("id"),
                body=body_in(body.get("body"), "v1"),
                api="v1")
        if len(parts) == 3 and parts[0] == "content" and parts[2] == "label":
            page = self.page_or_404(parts[1])
            if page is None:
                return
            for lab in (body if isinstance(body, list) else [body]):
                name = (lab or {}).get("name")
                if name and name not in page["labels"]:
                    page["labels"].append(name)
            return self.send_json(200, {"results": [
                {"prefix": "global", "name": n} for n in page["labels"]]})
        return self.fail(404, f"unsupported path {self.path}")

    # ----------------------------------------------------------------- v2 ---
    def get_v2(self, parts, q):
        if parts == ["spaces"]:
            keys = q.get("keys")
            hits = [s for s in SPACES if keys is None or s["key"] in keys.split(",")]
            return self.send_json(200, {"results": hits, "_links": {}})
        if len(parts) == 3 and parts[0] == "spaces" and parts[2] == "pages":
            space = space_by_id(parts[1])
            if space is None:
                return self.fail(404, f"No space with id {parts[1]}")
            title = q.get("title")
            hits = [p for p in STORE.pages.values()
                    if p["spaceId"] == space["id"] and p["status"] == "current"
                    and (title is None or p["title"] == title)]
            return self.send_json(200, {"results": [v2_page(p) for p in hits], "_links": {}})
        if parts and parts[0] == "pages" and len(parts) >= 2:
            page = self.page_or_404(parts[1])
            if page is None:
                return
            if len(parts) == 2:
                return self.send_json(200, v2_page(
                    page, q.get("body-format"), q.get("include-labels") == "true"))
            if parts[2] == "children":
                kids = [p for p in STORE.pages.values()
                        if p["parentId"] == page["id"] and p["status"] == "current"]
                return self.send_json(200, {"results": [
                    {"id": k["id"], "title": k["title"], "status": k["status"],
                      "spaceId": k["spaceId"]} for k in kids], "_links": {}})
            if parts[2] == "versions":
                return self.send_json(200, {"results": [
                    {"number": v["number"], "message": v["message"],
                      "createdAt": v["when"], "authorId": USER["accountId"]}
                    for v in page["versions"]], "_links": {}})
            if parts[2] == "footer-comments":
                return self.send_json(200, {"results": [
                    {"id": c["id"], "pageId": page["id"], "version": {"number": 1},
                      "body": {"storage": {"value": c["body"], "representation": "storage"}}}
                    for c in page["comments"]], "_links": {}})
        return self.fail(404, f"unsupported path {self.path}")

    def post_v2(self, parts, body):
        if parts == ["pages"]:
            space = space_by_id(body.get("spaceId"))
            if space is None:
                return self.fail(404, f"No space with id {body.get('spaceId')}")
            return self.create_page(
                space_key=space["key"], title=body.get("title"),
                parent_id=body.get("parentId"),
                body=body_in(body.get("body"), "v2"), api="v2")
        if parts == ["footer-comments"]:
            page = self.page_or_404(body.get("pageId"))
            if page is None:
                return
            STORE.comment_seq += 1
            comment = {"id": f"c{STORE.comment_seq}", "body": body_in(body.get("body"), "v2") or ""}
            page["comments"].append(comment)
            return self.send_json(201, {"id": comment["id"], "pageId": page["id"]})
        return self.fail(404, f"unsupported path {self.path}")

    # ----------------------------------------------------------- handlers ---
    def create_page(self, space_key, title, parent_id, body, api):
        space = space_by_key(space_key)
        if space is None:
            return self.fail(404, f"No space with key '{space_key}'")
        if not title:
            return self.fail(400, "title is required for a published page")
        if any(p["spaceKey"] == space["key"] and p["title"] == title
                and p["status"] == "current" for p in STORE.pages.values()):
            return self.fail(400, f"A page with title '{title}' already exists in space {space['key']}")
        if parent_id is not None and str(parent_id) not in STORE.pages:
            return self.fail(404, f"No parent content with id {parent_id}")
        with STORE.lock:
            pid = STORE.next_id()
            STORE.pages[pid] = new_page(pid, title, space,
                                        str(parent_id) if parent_id else None, body)
        page = STORE.pages[pid]
        return self.send_json(200, v2_page(page, "storage") if api == "v2" else v1_page(page))

    def update_page(self, page, body, api):
        """The version dance, enforced exactly as the real server enforces it."""
        version = (body.get("version") or {}).get("number")
        if version is None:
            return self.fail(400, "version.number is required on update")
        expected = page["version"] + 1
        if int(version) != expected:
            return self.fail(409, (
                f"Version must be incremented on update. Current version is "
                f"{page['version']}, expected {expected} but got {version}."))

        title = body.get("title")
        if not title:
            return self.fail(400, "title is required on update")
        new_body = body_in(body.get("body"), api)

        page["title"] = title
        if new_body is not None:
            page["body"] = new_body
        page["version"] = int(version)
        message = (body.get("version") or {}).get("message", "")
        page["versions"].append({"number": int(version), "message": message,
                                  "when": "2026-08-12T11:00:00.000Z"})
        if api == "v2":
            if "parentId" in body and body["parentId"]:
                page["parentId"] = str(body["parentId"])
        else:
            anc = body.get("ancestors")
            if anc:
                page["parentId"] = str((anc[-1] or {}).get("id"))
        return self.send_json(200, v2_page(page, "storage") if api == "v2" else v1_page(page))

    def do_search(self, q):
        cql = q.get("cql", "")
        start = int(q.get("start") or 0)
        want = min(int(q.get("limit") or 25), PAGE_CAP)
        matched = [p for p in STORE.pages.values()
                    if p["status"] == "current" and cql_match(p, cql)]
        matched.sort(key=lambda p: int(p["id"]))
        page = matched[start:start + want]
        out = {
            "results": [{"content": v1_page(p), "title": p["title"],
                          "resultGlobalContainer": {"title": p["spaceKey"]}}
                        for p in page],
            "start": start, "limit": want, "size": len(page), "totalSize": len(matched),
            "_links": {},
        }
        # Hand back a cursor link when more results exist, the way Cloud does, so
        # the client's next-link following is exercised and not just start/limit.
        if start + want < len(matched):
            out["_links"]["next"] = (f"/rest/api/search?cql={quote(cql)}"
                                      f"&limit={want}&start={start + want}")
        return self.send_json(200, out)

    def do_attach(self, page, raw):
        if self.headers.get("X-Atlassian-Token") != "nocheck":
            return self.fail(403, "XSRF check failed - X-Atlassian-Token header missing")
        match = re.search(rb'filename="([^"]*)"', raw)
        filename = match.group(1).decode() if match else "unknown"
        att = {"id": f"att{len(page['attachments']) + 1}", "type": "attachment",
                "title": filename, "extensions": {"fileSize": len(raw)}}
        page["attachments"].append(att)
        return self.send_json(200, {"results": [att]})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(server.server_address[1], flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
