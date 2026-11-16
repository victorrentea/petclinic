#!/usr/bin/env python3
"""The petclinic Postgres MCP server (@bytebase/dbhub), exposed as a plain CLI.

The database has exactly one entry point — the dbhub MCP server declared in
.mcp.json. This script starts that same server and speaks MCP to it over stdio:
same tools, same params, same answers, only the transport differs. For agent
harnesses where MCP servers are disabled by org policy but the shell is available.
Answers print as TOON (fewer tokens than JSON); --json gives the raw JSON back.

    .claude/skills/db-cli/db-cli.py tools
    .claude/skills/db-cli/db-cli.py call execute_sql --params '{"sql":"select 1"}'
    .claude/skills/db-cli/db-cli.py call execute_sql --json --params '{"sql":"select 1"}'

Needs only python3 and npx. Connection: $DATABASE_URL, defaulting to db-cli.env next to this script.
"""
import argparse
import glob
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading


def load_env_file():
    """Defaults live in db-cli.env next to this script; a variable already set in the shell wins."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db-cli.env")
    with open(path) as file:
        for line in file:
            key, separator, value = line.strip().partition("=")
            if separator and not key.startswith("#"):
                os.environ.setdefault(key.strip(), value.strip())


load_env_file()
DSN = os.environ["DATABASE_URL"]
# pinned: a mid-workshop release must not break the demo
DBHUB_VERSION = os.environ.get("DBHUB_VERSION", "1.2.0")
# Generous on purpose: on a laptop that never ran this version, npx first downloads the package.
TIMEOUT_SECONDS = float(os.environ.get("DB_CLI_TIMEOUT", "120"))


def find_npx():
    """Agent shells never source ~/.zshrc, so an nvm-managed npx is not on PATH."""
    found = shutil.which("npx")
    if found:
        return found
    nvm_bins = glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin"))
    nvm_bins.sort(key=node_version, reverse=True)
    for directory in nvm_bins + ["/opt/homebrew/bin", "/usr/local/bin"]:
        candidate = os.path.join(directory, "npx")
        if os.access(candidate, os.X_OK):
            return candidate
    sys.exit("npx not found — cannot start the dbhub server without it.\n"
        + "Install Node.js, or put npx on PATH (nvm users: 'nvm use' in this shell).")


def node_version(bin_dir):
    name = os.path.basename(os.path.dirname(bin_dir)).lstrip("v")
    return tuple(int(part) if part.isdigit() else 0 for part in name.split("."))


class McpServer:
    def __init__(self, npx):
        # npx resolves `node` from PATH, so the directory it lives in must be on it too.
        path = os.path.dirname(npx) + os.pathsep + os.environ.get("PATH", "")
        command = [npx, "-y", f"@bytebase/dbhub@{DBHUB_VERSION}",
            "--transport", "stdio", "--dsn", DSN]
        self.process = subprocess.Popen(command, text=True, env=dict(os.environ, PATH=path),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.lines = queue.Queue()
        self.stderr = []
        threading.Thread(target=self._pump_stdout, daemon=True).start()
        keep_stderr = lambda: self.stderr.extend(self.process.stderr)
        threading.Thread(target=keep_stderr, daemon=True).start()
        self.next_id = 0

    def _pump_stdout(self):
        for line in self.process.stdout:
            self.lines.put(line)
        self.lines.put(None)  # end of stream: the server exited

    def request(self, method, params):
        self.next_id += 1
        self._send({"jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params})
        while True:
            message = self._read()
            if message.get("id") != self.next_id:
                continue  # a server notification or log line, not our answer
            if "error" in message:
                self.fail(f"{method} failed: {message['error'].get('message', message['error'])}")
            return message["result"]

    def notify(self, method):
        self._send({"jsonrpc": "2.0", "method": method})

    def _send(self, message):
        self.process.stdin.write(json.dumps(message) + "\n")
        self.process.stdin.flush()

    def _read(self):
        while True:
            try:
                line = self.lines.get(timeout=TIMEOUT_SECONDS)
            except queue.Empty:
                self.fail(f"no answer from dbhub within {TIMEOUT_SECONDS:.0f}s")
            if line is None:
                self.fail("dbhub exited")
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue  # stray non-protocol output on stdout

    def fail(self, reason):
        self.close()
        sys.exit(f"{reason}\n{''.join(self.stderr[-20:])}".rstrip())

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()


def connect():
    server = McpServer(find_npx())
    server.request("initialize", {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "petclinic-db-cli", "version": "1"}})
    server.notify("notifications/initialized")
    return server


def print_tools(server):
    for tool in server.request("tools/list", {})["tools"]:
        schema = tool.get("inputSchema", {})
        required = set(schema.get("required", []))
        params = []
        for name, spec in schema.get("properties", {}).items():
            param = f"{name}:{spec.get('type', '?')[:3]}"
            params.append(param if name in required else f"[{param}]")
        print(f"{tool['name']}({', '.join(params)})\n     {tool.get('description', '')}\n")


def print_call(server, tool, params, as_json):
    result = server.request("tools/call", {"name": tool, "arguments": params})
    for item in result.get("content", []):
        if item.get("type") == "text":
            print(render(item["text"], as_json))
    return 1 if result.get("isError") else 0


def render(text, as_json):
    """dbhub answers with JSON text; TOON drops the repeated keys of every row."""
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return text  # a plain-text error, not an answer
    if as_json:
        return json.dumps(value, indent=2, ensure_ascii=False)
    return "\n".join(toon(value))


# ---- TOON (Token-Oriented Object Notation, toonformat.dev): JSON's data model. A uniform
# array of objects is written once as a header `key[N]{col,col}:` plus one CSV-like row each.
def toon(value, key=None, depth=0) -> list:
    pad = "  " * depth
    head = f"{pad}{toon_key(key)}" if key is not None else pad
    if isinstance(value, dict):
        lines = [f"{head}:"] if key is not None else []
        for k, v in value.items():
            lines += toon(v, k, depth + (key is not None))
        return lines
    if isinstance(value, list):
        if is_table(value):
            columns = ",".join(toon_key(k) for k in value[0])
            return [f"{head}[{len(value)}]{{{columns}}}:"] + [
                f"{pad}  " + ",".join(toon_scalar(v) for v in row.values()) for row in value]
        if all(map(is_scalar, value)):
            items = " " + ",".join(map(toon_scalar, value)) if value else ""
            return [f"{head}[{len(value)}]:{items}"]
        lines = [f"{head}[{len(value)}]:"]
        for item in value:
            body = toon(item, None, depth + 2) if isinstance(item, dict) else [
                "  " * (depth + 2) + toon_scalar(item)]
            lines += [f"{pad}  - " + body[0].lstrip()] + body[1:]
        return lines
    return [f"{head}: {toon_scalar(value)}"]


def is_scalar(value) -> bool:
    return not isinstance(value, (dict, list))


def is_table(rows) -> bool:
    return bool(rows) and all(
        isinstance(row, dict) and list(row) == list(rows[0]) and all(map(is_scalar, row.values()))
        for row in rows)


def toon_key(key: str) -> str:
    return key if re.fullmatch(r"[A-Za-z_][\w.]*", key) else json.dumps(key, ensure_ascii=False)


def toon_scalar(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, (int, float)):
        return json.dumps(value)
    needs_quotes = (
        value == "" or value != value.strip() or value in ("true", "false", "null")
        or re.fullmatch(r"-?\d+(\.\d+)?([eE][+-]?\d+)?", value) or value.startswith("-")
        or re.search(r'[:,"\\\[\]{}\x00-\x1f]', value))
    return json.dumps(value, ensure_ascii=False) if needs_quotes else value


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("tools", help="list the tools the server offers")
    call = commands.add_parser("call", help="call one tool")
    call.add_argument("tool")
    call.add_argument("--params", default="{}", help="the tool's arguments, as a JSON object")
    call.add_argument("--json", action="store_true", help="print the raw JSON instead of TOON")
    args = parser.parse_args()

    params = json.loads(args.params) if args.command == "call" else None
    server = connect()
    try:
        if args.command == "tools":
            print_tools(server)
            return 0
        return print_call(server, args.tool, params, args.json)
    finally:
        server.close()


if __name__ == "__main__":
    sys.exit(main())
