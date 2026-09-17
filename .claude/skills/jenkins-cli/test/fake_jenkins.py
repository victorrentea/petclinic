#!/usr/bin/env python3
"""A tiny in-process Jenkins impersonator for the hermetic jenkins-cli tests.

It speaks just enough of the real REST API - crumb, basic auth, jobs, queue,
progressive console log, nodes, plugins, scriptText - for jenkins.py to be
exercised end to end without Docker, Java or a network.

    python3 fake_jenkins.py [port]     # run it standalone for manual poking
"""
from __future__ import annotations

import base64
import json
import re
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

USER = "admin"
TOKEN = "s3cr3t"
CRUMB = "0123456789abcdef"
VERSION = "2.462.3"

CONFIG_XML = "<project><description>fake</description></project>"


def _now():
    return int(time.time() * 1000)


class State:
    """Mutable world the handler mutates; one instance per server."""

    def __init__(self):
        self.jobs = {
            "petclinic-build": {
                "builds": [
                    {
                        "number": 7,
                        "result": "SUCCESS",
                        "building": False,
                        "timestamp": _now() - 600_000,
                        "duration": 42_000,
                    },
                    {
                        "number": 6,
                        "result": "FAILURE",
                        "building": False,
                        "timestamp": _now() - 7_200_000,
                        "duration": 31_000,
                    },
                ],
                "disabled": False,
                "config": CONFIG_XML,
                "description": "builds the backend",
                "log": {7: "Started by user admin\nBUILD SUCCESS\nFinished: SUCCESS\n"},
            },
            "release": {
                "builds": [],
                "disabled": True,
                "config": CONFIG_XML,
                "description": "",
                "log": {},
            },
        }
        self.folders = {"ops": ["nightly"]}
        self.jobs["ops/nightly"] = {
            "builds": [],
            "disabled": False,
            "config": CONFIG_XML,
            "description": "",
            "log": {},
        }
        self.queue = []  # [{id, job, polls}]
        self.next_queue_id = 100
        self.offline = set()
        self.calls = []  # audit trail the tests assert on


class Handler(BaseHTTPRequestHandler):
    state: State = None

    # ------------------------------------------------------------- utilities

    def log_message(self, *_args):
        pass

    def _send(self, code, body=b"", headers=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("X-Jenkins", VERSION)
        self.send_header("Content-Length", str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _json(self, payload, code=200):
        self._send(code, json.dumps(payload), {"Content-Type": "application/json"})

    def _authorized(self):
        header = self.headers.get("Authorization", "")
        if not header.startswith("Basic "):
            return False
        raw = base64.b64decode(header[6:]).decode("utf-8")
        return raw == "%s:%s" % (USER, TOKEN)

    def _job_name(self, path):
        """/job/ops/job/nightly/... -> ('ops/nightly', rest)"""
        parts = path.strip("/").split("/")
        name, rest = [], []
        i = 0
        while i + 1 < len(parts) and parts[i] == "job":
            name.append(urllib.parse.unquote(parts[i + 1]))
            i += 2
        rest = parts[i:]
        return "/".join(name), "/".join(rest)

    # --------------------------------------------------------------- routing

    def do_GET(self):
        if not self._authorized():
            return self._send(401, "no valid crumb/credentials")
        path, _, query = self.path.partition("?")
        params = urllib.parse.parse_qs(query)
        st = self.state
        st.calls.append(("GET", path))

        if path == "/crumbIssuer/api/json":
            return self._json({"crumbRequestField": "Jenkins-Crumb", "crumb": CRUMB})
        if path == "/whoAmI/api/json":
            return self._json(
                {
                    "name": USER,
                    "authenticated": True,
                    "authorities": ["authenticated", "admin"],
                }
            )
        if path == "/api/json":
            return self._json({"mode": "NORMAL", "jobs": self._job_list("")})
        if path == "/queue/api/json":
            return self._json(
                {
                    "items": [
                        {
                            "id": item["id"],
                            "why": "Waiting for next executor",
                            "stuck": False,
                            "inQueueSince": _now() - 5000,
                            "task": {"name": item["job"]},
                        }
                        for item in st.queue
                    ]
                }
            )
        if re.fullmatch(r"/queue/item/\d+/api/json", path):
            return self._queue_item(int(path.split("/")[3]))
        if path == "/computer/api/json":
            return self._json(
                {
                    "computer": [
                        {
                            "displayName": name,
                            "offline": name in st.offline,
                            "temporarilyOffline": name in st.offline,
                            "numExecutors": 2,
                            "offlineCauseReason": (
                                "maintenance" if name in st.offline else ""
                            ),
                        }
                        for name in ("Built-In Node", "agent-1")
                    ]
                }
            )
        if path == "/pluginManager/api/json":
            return self._json(
                {
                    "plugins": [
                        {
                            "shortName": "git",
                            "version": "5.2.1",
                            "enabled": True,
                            "hasUpdate": False,
                        },
                        {
                            "shortName": "workflow-aggregator",
                            "version": "596",
                            "enabled": True,
                            "hasUpdate": True,
                        },
                    ]
                }
            )

        name, rest = self._job_name(path)
        if name:
            return self._job_get(name, rest, params)
        return self._send(404, "no such page: " + path)

    def do_POST(self):
        if not self._authorized():
            return self._send(401, "no valid crumb/credentials")
        if self.headers.get("Jenkins-Crumb") != CRUMB:
            return self._send(403, "No valid crumb was included in the request")
        path, _, query = self.path.partition("?")
        params = urllib.parse.parse_qs(query)
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8") if length else ""
        form = {k: v[0] for k, v in urllib.parse.parse_qs(body).items()}
        st = self.state
        st.calls.append(("POST", path))

        if path == "/scriptText":
            return self._send(200, "Result: %s\n" % form.get("script", "").strip())
        if path in (
            "/quietDown",
            "/cancelQuietDown",
            "/safeRestart",
            "/restart",
            "/safeExit",
            "/exit",
        ):
            return self._send(200)
        if path == "/pluginManager/installNecessaryPlugins":
            return self._send(200)
        if path == "/queue/cancelItem":
            st.queue = [i for i in st.queue if str(i["id"]) != params["id"][0]]
            return self._send(200)
        if path == "/createItem":
            name = params["name"][0]
            source = params.get("from", [None])[0]
            if name in st.jobs:
                return self._send(400, "A job already exists with the name " + name)
            st.jobs[name] = {
                "builds": [],
                "disabled": False,
                "log": {},
                "description": "",
                "config": st.jobs[source]["config"] if source else body,
            }
            return self._send(200)
        if re.fullmatch(r"/computer/[^/]+/toggleOffline", path):
            node = urllib.parse.unquote(path.split("/")[2])
            node = "Built-In Node" if node == "(master)" else node
            st.offline.symmetric_difference_update({node})
            return self._send(200)

        name, rest = self._job_name(path)
        if name:
            return self._job_post(name, rest, body, form)
        return self._send(404, "no such page: " + path)

    # ------------------------------------------------------------------ jobs

    def _job_list(self, prefix):
        st = self.state
        out = []
        for folder in st.folders:
            out.append(
                {
                    "name": folder,
                    "_class": "com.cloudbees...Folder",
                    "url": "/job/%s/" % folder,
                }
            )
        for name, job in st.jobs.items():
            if "/" in name:
                continue
            out.append(
                {
                    "name": name,
                    "color": "disabled" if job["disabled"] else "blue",
                    "_class": "hudson.model.FreeStyleProject",
                    "url": "/job/%s/" % name,
                }
            )
        return out

    def _job_get(self, name, rest, params):
        st = self.state
        if name in st.folders and rest == "api/json":
            return self._json(
                {
                    "jobs": [
                        {
                            "name": child,
                            "color": "blue",
                            "url": "/job/%s/job/%s/" % (name, child),
                        }
                        for child in st.folders[name]
                    ]
                }
            )
        job = st.jobs.get(name)
        if job is None:
            return self._send(404, "no such job " + name)
        if rest == "api/json":
            return self._json(self._job_json(name, job))
        if rest == "config.xml":
            return self._send(200, job["config"], {"Content-Type": "application/xml"})
        match = re.fullmatch(r"(\d+)/api/json", rest)
        if match:
            build = self._find_build(job, int(match.group(1)))
            return self._json(build) if build else self._send(404, "no such build")
        match = re.fullmatch(r"(\d+)/logText/progressiveText", rest)
        if match:
            number = int(match.group(1))
            text = job["log"].get(number, "")
            start = int(params.get("start", ["0"])[0])
            chunk = text[start:]
            building = any(
                b["number"] == number and b["building"] for b in job["builds"]
            )
            return self._send(
                200,
                chunk,
                {
                    "X-Text-Size": str(len(text)),
                    "X-More-Data": "true" if building else "false",
                },
            )
        return self._send(404, "no such job page: " + rest)

    def _job_json(self, name, job):
        builds = job["builds"]
        done = [b for b in builds if not b["building"]]
        payload = {
            "name": name.rsplit("/", 1)[-1],
            "url": "/job/%s/" % name,
            "description": job["description"],
            "buildable": not job["disabled"],
            "inQueue": any(i["job"] == name for i in self.state.queue),
            "builds": builds,
            "lastBuild": builds[0] if builds else None,
            "lastCompletedBuild": done[0] if done else None,
            "lastSuccessfulBuild": next(
                (b for b in done if b["result"] == "SUCCESS"), None
            ),
            "lastFailedBuild": next(
                (b for b in done if b["result"] == "FAILURE"), None
            ),
        }
        payload["lastStableBuild"] = payload["lastSuccessfulBuild"]
        return payload

    @staticmethod
    def _find_build(job, number):
        return next((b for b in job["builds"] if b["number"] == number), None)

    def _job_post(self, name, rest, body, form):
        st = self.state
        job = st.jobs.get(name)
        if job is None and rest != "createItem":
            return self._send(404, "no such job " + name)
        if rest in ("build", "buildWithParameters"):
            item_id = st.next_queue_id
            st.next_queue_id += 1
            st.queue.append({"id": item_id, "job": name, "polls": 0, "params": form})
            return self._send(201, b"", {"Location": "/queue/item/%d/" % item_id})
        if rest == "polling":
            return self._send(200)
        if rest == "config.xml":
            job["config"] = body
            return self._send(200)
        if rest == "doDelete":
            del st.jobs[name]
            return self._send(200)
        if rest in ("enable", "disable"):
            job["disabled"] = rest == "disable"
            return self._send(200)
        if rest == "createItem":
            return self._send(200)
        match = re.fullmatch(r"(\d+)/(stop|submitDescription)", rest)
        if match:
            build = self._find_build(job, int(match.group(1)))
            if not build:
                return self._send(404, "no such build")
            if match.group(2) == "stop":
                build.update(building=False, result="ABORTED")
            else:
                build["description"] = form.get("description", "")
            return self._send(200)
        return self._send(404, "no such job action: " + rest)

    # ----------------------------------------------------------------- queue

    def _queue_item(self, item_id):
        """First poll: still waiting. Second: it started and instantly finished."""
        st = self.state
        item = next((i for i in st.queue if i["id"] == item_id), None)
        if item is None:
            return self._json(
                {
                    "id": item_id,
                    "cancelled": False,
                    "executable": {"number": st.jobs and 0},
                }
            )
        item["polls"] += 1
        if item["polls"] < 2:
            return self._json(
                {"id": item_id, "why": "In the quiet-down period", "cancelled": False}
            )
        job = st.jobs[item["job"]]
        number = (job["builds"][0]["number"] + 1) if job["builds"] else 1
        job["builds"].insert(
            0,
            {
                "number": number,
                "result": "SUCCESS",
                "building": False,
                "timestamp": _now(),
                "duration": 1000,
            },
        )
        job["log"][number] = "Started by user admin\n%s\nFinished: SUCCESS\n" % (
            " ".join("%s=%s" % kv for kv in sorted(item["params"].items()))
            or "no params"
        )
        st.queue.remove(item)
        return self._json(
            {"id": item_id, "cancelled": False, "executable": {"number": number}}
        )


def start(port=0):
    """Returns (url, server, state); caller shuts the server down."""
    state = State()
    handler = type("BoundHandler", (Handler,), {"state": state})
    server = HTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return "http://127.0.0.1:%d" % server.server_port, server, state


if __name__ == "__main__":
    url, server, _ = start(int(sys.argv[1]) if len(sys.argv) > 1 else 8080)
    print("fake Jenkins on %s (user %s / token %s)" % (url, USER, TOKEN))
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        server.shutdown()
