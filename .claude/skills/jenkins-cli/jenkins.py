#!/usr/bin/env python3
"""jenkins.py - talk to Jenkins from the shell, on any OS.

A stdlib-only replacement for `jenkins-cli.jar`: same command names, but over the
REST API, so it needs no Java, no downloaded jar and no SSH key. Python 3.8+.

    jenkins.py [-s URL] [--auth user:token] [--json] <command> [args]

Run `jenkins.py help` for the command list.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

PROG = "jenkins.py"
ENV_FILES = ("./.jenkins.env", "~/.claude/jenkins.env", "~/.jenkins.env")


class JenkinsError(Exception):
    pass


# ---------------------------------------------------------------- configuration


def _env_value(raw):
    """A value the way `source` reads it: verbatim inside quotes, otherwise up to an
    inline ` # comment`. $VAR references are NOT expanded."""
    raw = raw.strip()
    if raw[:1] in ("'", '"'):
        end = raw.find(raw[0], 1)
        if end > 0:
            return raw[1:end]
    return re.split(r"\s+#", raw, 1)[0].strip()


def _in_every_home(path):
    """On Windows Python reads ~ from USERPROFILE, while Git Bash's ~ is $HOME - and
    corporate setups often point HOME at a network drive. Look in both."""
    if not path.startswith("~"):
        return [path]
    paths = [os.path.expanduser(path)]
    if os.environ.get("HOME"):
        paths.append(os.path.join(os.environ["HOME"], path[2:]))
    return paths


def load_env_file():
    """First env file that exists wins; values never override non-empty env vars."""
    candidates = []
    if os.environ.get("JENKINS_ENV_FILE"):
        candidates.append(os.environ["JENKINS_ENV_FILE"])
    candidates.extend(ENV_FILES)
    for candidate in candidates:
        for path in _in_every_home(candidate):
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
                    if not os.environ.get(key.strip()):
                        os.environ[key.strip()] = _env_value(value)
            return path
    return None


class Jenkins:
    def __init__(self, url=None, auth=None, insecure=None):
        self.env_file = load_env_file()
        url = url or os.environ.get("JENKINS_URL")
        if not url:
            raise JenkinsError(
                "no Jenkins URL - set JENKINS_URL in %s or pass -s URL"
                % " / ".join(ENV_FILES)
            )
        self.url = url.rstrip("/")
        auth = auth or os.environ.get("JENKINS_AUTH")
        if auth and auth.startswith("@"):
            with open(os.path.expanduser(auth[1:]), encoding="utf-8") as fh:
                auth = fh.read().strip()
        if auth:
            self.user, _, self.token = auth.partition(":")
        else:
            self.user = os.environ.get("JENKINS_USER_ID", "")
            self.token = os.environ.get("JENKINS_API_TOKEN", "")
        if insecure is None:
            insecure = os.environ.get("JENKINS_INSECURE", "") in ("1", "true", "yes")
        context = ssl._create_unverified_context() if insecure else None
        handlers = [urllib.request.HTTPCookieProcessor(CookieJar())]
        if context:
            handlers.append(urllib.request.HTTPSHandler(context=context))
        self.opener = urllib.request.build_opener(*handlers)
        self._crumb = None

    # -------------------------------------------------------------- HTTP plumbing

    def _full(self, path):
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return self.url + "/" + path.lstrip("/")

    def request(self, method, path, data=None, headers=None, crumb=True):
        """Returns (status, headers, body_bytes). Raises JenkinsError on >=400."""
        url = self._full(path)
        head = {"Accept": "application/json"}
        if self.user:
            raw = ("%s:%s" % (self.user, self.token)).encode("utf-8")
            head["Authorization"] = "Basic " + base64.b64encode(raw).decode("ascii")
        if crumb and method != "GET":
            field, value = self.crumb()
            if field:
                head[field] = value
        head.update(headers or {})
        req = urllib.request.Request(url, data=data, headers=head, method=method)
        try:
            with self.opener.open(req) as resp:
                return resp.status, dict(resp.headers), resp.read()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace").strip()
            if exc.code in (301, 302, 303, 307) and "Location" in exc.headers:
                return exc.code, dict(exc.headers), b""
            raise JenkinsError(
                "HTTP %s on %s %s%s"
                % (exc.code, method, url, " - " + _short(body) if body else "")
            ) from None
        except urllib.error.URLError as exc:
            raise JenkinsError("cannot reach %s - %s" % (url, exc.reason)) from None

    def crumb(self):
        """Jenkins CSRF crumb; absent when the protection is disabled."""
        if self._crumb is None:
            try:
                _, _, body = self.request("GET", "/crumbIssuer/api/json", crumb=False)
                data = json.loads(body)
                self._crumb = (data["crumbRequestField"], data["crumb"])
            except (JenkinsError, ValueError, KeyError):
                self._crumb = ("", "")
        return self._crumb

    def get_json(self, path, tree=None, depth=None):
        query = {}
        if tree:
            query["tree"] = tree
        if depth is not None:
            query["depth"] = str(depth)
        if query:
            path += ("&" if "?" in path else "?") + urllib.parse.urlencode(query)
        _, _, body = self.request("GET", path)
        return json.loads(body)

    def post(self, path, fields=None, data=None, headers=None):
        if fields is not None:
            data = urllib.parse.urlencode(fields).encode("utf-8")
            headers = dict(headers or {})
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        return self.request("POST", path, data=data, headers=headers)

    # ----------------------------------------------------------------- job paths

    @staticmethod
    def job_path(name):
        """'folder/job' and 'folder/job/job/job' both become a /job/.../job/... path."""
        parts = [p for p in name.replace("\\", "/").split("/") if p and p != "job"]
        return "".join("/job/" + urllib.parse.quote(p) for p in parts)

    def build_path(self, job, number):
        return "%s/%s" % (self.job_path(job), self.resolve_build(job, number))

    def resolve_build(self, job, number):
        aliases = {
            "last": "lastBuild",
            "lastBuild": "lastBuild",
            "success": "lastSuccessfulBuild",
            "lastSuccessful": "lastSuccessfulBuild",
            "failed": "lastFailedBuild",
            "lastFailed": "lastFailedBuild",
            "stable": "lastStableBuild",
            "completed": "lastCompletedBuild",
        }
        if number is None:
            number = "last"
        number = str(number)
        if number.isdigit():
            return number
        alias = aliases.get(number)
        if not alias:
            raise JenkinsError(
                "unknown build '%s' (use a number or: %s)"
                % (number, ", ".join(sorted(aliases)))
            )
        data = self.get_json(self.job_path(job) + "/api/json", tree=alias + "[number]")
        info = data.get(alias)
        if not info:
            raise JenkinsError("job '%s' has no %s" % (job, alias))
        return str(info["number"])


def _short(text, limit=300):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit] + "..."


# ------------------------------------------------------------------- formatting


def emit(args, payload, text):
    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    elif text is not None:
        print(text)


def table(rows, headers):
    rows = [[("" if c is None else str(c)) for c in row] for row in rows]
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))
    lines = ["  ".join(h.ljust(widths[i]) for i, h in enumerate(headers)).rstrip()]
    lines.append("  ".join("-" * w for w in widths).rstrip())
    for row in rows:
        lines.append("  ".join(c.ljust(widths[i]) for i, c in enumerate(row)).rstrip())
    return "\n".join(lines)


def ago(millis):
    if not millis:
        return "-"
    seconds = max(0, int(time.time() - millis / 1000))
    for unit, size in (("d", 86400), ("h", 3600), ("m", 60)):
        if seconds >= size:
            return "%d%s ago" % (seconds // size, unit)
    return "%ds ago" % seconds


def read_body(source):
    if source == "-":
        return sys.stdin.read().encode("utf-8")
    with open(source, "rb") as fh:
        return fh.read()


# --------------------------------------------------------------------- commands


def cmd_config(j, args):
    emit(
        args,
        {
            "url": j.url,
            "user": j.user or None,
            "env_file": j.env_file,
            "token": "set" if j.token else "missing",
        },
        "url:      %s\nuser:     %s\ntoken:    %s\nenv file: %s"
        % (
            j.url,
            j.user or "(anonymous)",
            "set" if j.token else "MISSING",
            j.env_file or "(none - using environment)",
        ),
    )


def cmd_version(j, args):
    _, headers, _ = j.request("GET", "/api/json?tree=mode")
    version = headers.get("X-Jenkins", "unknown")
    emit(args, {"version": version}, version)


def cmd_who_am_i(j, args):
    data = j.get_json("/whoAmI/api/json")
    emit(
        args,
        data,
        "Authenticated as: %s\nAuthorities:\n%s"
        % (
            data.get("name", "?"),
            "\n".join("  " + a for a in data.get("authorities") or ["(none)"]),
        ),
    )


def _walk_jobs(j, base, recursive, prefix=""):
    tree = "jobs[name,color,_class,url]"
    data = j.get_json((base or "") + "/api/json", tree=tree)
    out = []
    for job in data.get("jobs") or []:
        name = prefix + job["name"]
        is_folder = "color" not in job
        out.append((name, "folder" if is_folder else job.get("color", "?")))
        if recursive and is_folder:
            out.extend(_walk_jobs(j, Jenkins.job_path(name), True, name + "/"))
    return out


def cmd_list_jobs(j, args):
    base = Jenkins.job_path(args.folder) if args.folder else ""
    jobs = _walk_jobs(j, base, args.recursive)
    emit(
        args,
        [{"name": n, "status": s} for n, s in jobs],
        table(jobs, ["NAME", "STATUS"]) if jobs else "(no jobs)",
    )


def cmd_job(j, args):
    tree = (
        "name,description,buildable,inQueue,url,"
        "lastBuild[number,result,building,timestamp,duration],"
        "lastSuccessfulBuild[number],lastFailedBuild[number]"
    )
    data = j.get_json(Jenkins.job_path(args.job) + "/api/json", tree=tree)
    last = data.get("lastBuild") or {}
    text = "\n".join(
        [
            "job:         %s" % data.get("name"),
            "url:         %s" % data.get("url"),
            "buildable:   %s" % data.get("buildable"),
            "in queue:    %s" % data.get("inQueue"),
            "last build:  #%s %s (%s)"
            % (
                last.get("number", "-"),
                "BUILDING" if last.get("building") else last.get("result", "-"),
                ago(last.get("timestamp")),
            ),
            "description: %s" % (data.get("description") or "-"),
        ]
    )
    emit(args, data, text)


def cmd_builds(j, args):
    tree = "builds[number,result,building,timestamp,duration]{0,%d}" % args.count
    data = j.get_json(Jenkins.job_path(args.job) + "/api/json", tree=tree)
    builds = data.get("builds") or []
    rows = [
        [
            "#%s" % b["number"],
            "BUILDING" if b.get("building") else (b.get("result") or "-"),
            "%ds" % (b.get("duration", 0) // 1000),
            ago(b.get("timestamp")),
        ]
        for b in builds
    ]
    emit(
        args,
        builds,
        table(rows, ["BUILD", "RESULT", "TOOK", "WHEN"]) if rows else "(no builds)",
    )


def _queue_id(location):
    return location.rstrip("/").rsplit("/", 1)[-1] if location else None


def cmd_build(j, args):
    params = {}
    for pair in args.param or []:
        key, _, value = pair.partition("=")
        params[key] = value
    path = Jenkins.job_path(args.job)
    if args.check_scm:
        j.post(path + "/polling")
    endpoint = "/buildWithParameters" if params else "/build"
    _, headers, _ = j.post(path + endpoint, fields=params or {"delay": "0sec"})
    queue_id = _queue_id(headers.get("Location", ""))
    if not (args.wait or args.follow):
        emit(args, {"queued": queue_id}, "queued %s (item %s)" % (args.job, queue_id))
        return 0
    number = _await_build_number(j, queue_id, args)
    if args.follow:
        _tail(j, "%s/%s" % (path, number), follow=True)
    result = _await_result(j, path, number, quiet=args.follow)
    emit(args, {"number": int(number), "result": result}, "#%s %s" % (number, result))
    return 0 if result == "SUCCESS" else 1


def _await_build_number(j, queue_id, args, timeout=600):
    deadline = time.time() + timeout
    while time.time() < deadline:
        item = j.get_json("/queue/item/%s/api/json" % queue_id)
        if item.get("cancelled"):
            raise JenkinsError("queue item %s was cancelled" % queue_id)
        executable = item.get("executable")
        if executable:
            return str(executable["number"])
        time.sleep(1)
    raise JenkinsError("build did not start within %ds" % timeout)


def _await_result(j, job_path, number, quiet=False, timeout=3600):
    deadline = time.time() + timeout
    while time.time() < deadline:
        data = j.get_json("%s/%s/api/json" % (job_path, number), tree="result,building")
        if not data.get("building") and data.get("result"):
            return data["result"]
        time.sleep(2)
    raise JenkinsError("build #%s did not finish within %ds" % (number, timeout))


def _tail(j, build_path, follow, tail_lines=None):
    """Streams console output; progressiveText is Jenkins' own follow endpoint."""
    start = 0
    while True:
        _, headers, body = j.request(
            "GET", "%s/logText/progressiveText?start=%d" % (build_path, start)
        )
        chunk = body.decode("utf-8", "replace")
        if chunk:
            if tail_lines is not None and start == 0:
                chunk = "\n".join(chunk.splitlines()[-tail_lines:]) + "\n"
            sys.stdout.write(chunk)
            sys.stdout.flush()
        start = int(headers.get("X-Text-Size", start))
        if not follow or headers.get("X-More-Data", "").lower() != "true":
            return
        time.sleep(1)


def cmd_console(j, args):
    path = j.build_path(args.job, args.build)
    _tail(j, path, follow=args.follow, tail_lines=args.lines)


def cmd_stop(j, args):
    path = j.build_path(args.job, args.build)
    j.post(path + "/stop")
    print("stopped %s %s" % (args.job, path.rsplit("/", 1)[-1]))


def cmd_enable(j, args):
    j.post(Jenkins.job_path(args.job) + "/enable")
    print("enabled %s" % args.job)


def cmd_disable(j, args):
    j.post(Jenkins.job_path(args.job) + "/disable")
    print("disabled %s" % args.job)


def cmd_get_job(j, args):
    _, _, body = j.request("GET", Jenkins.job_path(args.job) + "/config.xml")
    sys.stdout.write(body.decode("utf-8", "replace"))


def cmd_create_job(j, args):
    parent, _, name = args.name.rpartition("/")
    base = Jenkins.job_path(parent) if parent else ""
    j.post(
        "%s/createItem?name=%s" % (base, urllib.parse.quote(name)),
        data=read_body(args.config),
        headers={"Content-Type": "application/xml"},
    )
    print("created %s" % args.name)


def cmd_update_job(j, args):
    j.request(
        "POST",
        Jenkins.job_path(args.job) + "/config.xml",
        data=read_body(args.config),
        headers={"Content-Type": "application/xml"},
    )
    print("updated %s" % args.job)


def cmd_copy_job(j, args):
    parent, _, name = args.destination.rpartition("/")
    base = Jenkins.job_path(parent) if parent else ""
    query = urllib.parse.urlencode({"name": name, "mode": "copy", "from": args.source})
    j.post("%s/createItem?%s" % (base, query))
    print("copied %s -> %s" % (args.source, args.destination))


def cmd_delete_job(j, args):
    j.post(Jenkins.job_path(args.job) + "/doDelete")
    print("deleted %s" % args.job)


def cmd_queue(j, args):
    data = j.get_json(
        "/queue/api/json", tree="items[id,why,stuck,task[name],inQueueSince]"
    )
    items = data.get("items") or []
    rows = [
        [
            i["id"],
            (i.get("task") or {}).get("name", "?"),
            ago(i.get("inQueueSince")),
            _short(i.get("why") or "-", 60),
        ]
        for i in items
    ]
    emit(
        args,
        items,
        table(rows, ["ID", "JOB", "WAITING", "WHY"]) if rows else "(queue empty)",
    )


def cmd_cancel_queue(j, args):
    j.post("/queue/cancelItem?id=%s" % args.id)
    print("cancelled queue item %s" % args.id)


def cmd_nodes(j, args):
    data = j.get_json(
        "/computer/api/json",
        tree="computer[displayName,offline,temporarilyOffline,"
        "numExecutors,offlineCauseReason]",
    )
    nodes = data.get("computer") or []
    rows = [
        [
            n["displayName"],
            "offline" if n.get("offline") else "online",
            n.get("numExecutors", "-"),
            _short(n.get("offlineCauseReason") or "-", 40),
        ]
        for n in nodes
    ]
    emit(args, nodes, table(rows, ["NODE", "STATE", "EXECUTORS", "REASON"]))


def _node_path(name):
    return "/computer/" + (
        "(master)" if name in ("master", "built-in", "") else urllib.parse.quote(name)
    )


def cmd_online_node(j, args):
    j.post(_node_path(args.node) + "/toggleOffline", fields={"offlineMessage": ""})
    print("toggled %s online" % args.node)


def cmd_offline_node(j, args):
    j.post(
        _node_path(args.node) + "/toggleOffline",
        fields={"offlineMessage": args.message or ""},
    )
    print("toggled %s offline" % args.node)


def cmd_plugins(j, args):
    data = j.get_json(
        "/pluginManager/api/json",
        depth=1,
        tree="plugins[shortName,version,enabled,hasUpdate]",
    )
    plugins = sorted(data.get("plugins") or [], key=lambda p: p["shortName"])
    if args.updates:
        plugins = [p for p in plugins if p.get("hasUpdate")]
    rows = [
        [
            p["shortName"],
            p.get("version"),
            "enabled" if p.get("enabled") else "disabled",
            "update" if p.get("hasUpdate") else "",
        ]
        for p in plugins
    ]
    emit(args, plugins, table(rows, ["PLUGIN", "VERSION", "STATE", ""]))


def cmd_install_plugin(j, args):
    name, _, version = args.plugin.partition("@")
    payload = "<jenkins><install plugin='%s@%s' /></jenkins>" % (
        name,
        version or "latest",
    )
    j.post(
        "/pluginManager/installNecessaryPlugins",
        data=payload.encode("utf-8"),
        headers={"Content-Type": "text/xml"},
    )
    print("install requested: %s" % args.plugin)
    if args.restart:
        j.post("/safeRestart")
        print("safe restart requested")


def cmd_groovy(j, args):
    script = read_body(args.script).decode("utf-8")
    _, _, body = j.post("/scriptText", fields={"script": script})
    sys.stdout.write(body.decode("utf-8", "replace"))


def cmd_set_description(j, args):
    path = j.build_path(args.job, args.build)
    j.post(path + "/submitDescription", fields={"description": args.text})
    print("description set on %s" % path)


def cmd_lifecycle(j, args):
    endpoints = {
        "quiet-down": "/quietDown",
        "cancel-quiet-down": "/cancelQuietDown",
        "safe-restart": "/safeRestart",
        "restart": "/restart",
        "safe-shutdown": "/safeExit",
        "shutdown": "/exit",
    }
    j.post(endpoints[args.command])
    print("%s requested" % args.command)


def cmd_raw(j, args):
    data = args.body.encode("utf-8") if args.body else None
    headers = {"Content-Type": "application/json"} if data else None
    _, _, body = j.request(args.method.upper(), args.path, data=data, headers=headers)
    text = body.decode("utf-8", "replace")
    try:
        print(json.dumps(json.loads(text), indent=2, sort_keys=True))
    except ValueError:
        sys.stdout.write(text)


# ----------------------------------------------------------------------- parser


def build_parser():
    parser = argparse.ArgumentParser(
        prog=PROG, description="Jenkins from the shell, without the jar."
    )
    parser.add_argument("-s", "--url", help="Jenkins base URL")
    parser.add_argument("--auth", help="user:api_token, or @file")
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="skip TLS verification (self-signed certs)",
    )
    parser.add_argument("--json", action="store_true", help="raw JSON output")
    sub = parser.add_subparsers(dest="command", metavar="<command>")

    def add(name, func, help_text):
        p = sub.add_parser(name, help=help_text)
        p.set_defaults(func=func)
        return p

    add("config", cmd_config, "show the resolved connection (never the token)")
    add("version", cmd_version, "Jenkins version")
    add("who-am-i", cmd_who_am_i, "current user and authorities")

    p = add("list-jobs", cmd_list_jobs, "list jobs, optionally inside a folder")
    p.add_argument("folder", nargs="?")
    p.add_argument("-r", "--recursive", action="store_true")

    p = add("job", cmd_job, "job summary")
    p.add_argument("job")

    p = add("builds", cmd_builds, "recent builds of a job")
    p.add_argument("job")
    p.add_argument("-n", "--count", type=int, default=10)

    p = add("build", cmd_build, "trigger a build")
    p.add_argument("job")
    p.add_argument("-p", "--param", action="append", metavar="KEY=VALUE")
    p.add_argument(
        "-w",
        "--wait",
        action="store_true",
        help="wait for completion, exit non-zero unless SUCCESS",
    )
    p.add_argument(
        "-f", "--follow", action="store_true", help="wait and stream the console output"
    )
    p.add_argument(
        "-c",
        "--check-scm",
        action="store_true",
        help="poll SCM first, build only if there are changes",
    )

    p = add("console", cmd_console, "print a build's console output")
    p.add_argument("job")
    p.add_argument("build", nargs="?", default="last")
    p.add_argument("-f", "--follow", action="store_true")
    p.add_argument("-n", "--lines", type=int, help="only the last N lines")

    p = add("stop", cmd_stop, "abort a running build")
    p.add_argument("job")
    p.add_argument("build", nargs="?", default="last")

    p = add("enable-job", cmd_enable, "enable a job")
    p.add_argument("job")
    p = add("disable-job", cmd_disable, "disable a job")
    p.add_argument("job")

    p = add("get-job", cmd_get_job, "dump config.xml to stdout")
    p.add_argument("job")
    p = add("create-job", cmd_create_job, "create a job from a config.xml")
    p.add_argument("name")
    p.add_argument("-c", "--config", default="-", help="file, or '-' for stdin")
    p = add("update-job", cmd_update_job, "replace a job's config.xml")
    p.add_argument("job")
    p.add_argument("-c", "--config", default="-")
    p = add("copy-job", cmd_copy_job, "copy a job")
    p.add_argument("source")
    p.add_argument("destination")
    p = add("delete-job", cmd_delete_job, "delete a job")
    p.add_argument("job")

    add("queue", cmd_queue, "show the build queue")
    p = add("cancel-queue", cmd_cancel_queue, "cancel a queued item")
    p.add_argument("id")

    add("nodes", cmd_nodes, "list agents")
    p = add("online-node", cmd_online_node, "bring an agent online")
    p.add_argument("node")
    p = add("offline-node", cmd_offline_node, "take an agent offline")
    p.add_argument("node")
    p.add_argument("-m", "--message")

    p = add("plugins", cmd_plugins, "list installed plugins")
    p.add_argument("--updates", action="store_true", help="only outdated ones")
    p = add("install-plugin", cmd_install_plugin, "install a plugin")
    p.add_argument("plugin", help="shortName or shortName@version")
    p.add_argument("--restart", action="store_true")

    p = add("groovy", cmd_groovy, "run a Groovy script on the controller")
    p.add_argument("script", help="file, or '-' for stdin")

    p = add("set-description", cmd_set_description, "set a build's description")
    p.add_argument("job")
    p.add_argument("build")
    p.add_argument("text")

    for name, help_text in (
        ("quiet-down", "stop accepting new builds"),
        ("cancel-quiet-down", "resume accepting builds"),
        ("safe-restart", "restart once builds finish"),
        ("restart", "restart immediately"),
        ("safe-shutdown", "shut down once builds finish"),
        ("shutdown", "shut down immediately"),
    ):
        add(name, cmd_lifecycle, help_text)

    p = add("raw", cmd_raw, "escape hatch: any REST call, auth handled")
    p.add_argument("method")
    p.add_argument("path")
    p.add_argument("body", nargs="?")
    return parser


def utf8_stdio():
    """Windows pipes default to the ANSI code page (cp1252) and CRLF: a console log
    with a check mark would crash the print, and every `$(jenkins.py ...)` would end
    in \\r. Pin UTF-8 and bare \\n on every OS so output is byte-identical everywhere."""
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
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        return 2
    try:
        jenkins = Jenkins(args.url, args.auth, args.insecure or None)
        return args.func(jenkins, args) or 0
    except JenkinsError as exc:
        print("%s: %s" % (PROG, exc), file=sys.stderr)
        return 1
    except BrokenPipeError:
        return 0
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
