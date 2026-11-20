#!/usr/bin/env python3
"""Reads the stream-json logs written by run.py and prints the comparison as markdown.

    report.py DIR [--html report.html]
"""
import contextlib, io, json, re, statistics, sys
from html import escape
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
TASKS = {t["id"]: t for t in json.loads((HERE / "tasks.json").read_text())}

ROUTES = [  # first match wins; how the agent reached (or avoided) the database
    ("db-cli.py", r"db-cli\.py"),
    ("npx dbhub", r"dbhub"),
    ("docker psql", r"docker[^\n]*(psql|postgres)"),
    ("psql", r"\bpsql\b"),
    ("python driver", r"psycopg|pg8000|asyncpg"),
    ("java/jdbc", r"jdbc|jshell|mvn "),
    ("node pg", r"require\(['\"]pg['\"]\)|from ['\"]pg['\"]|npm i\w* pg\b|npx[^\n]*\bpg\b"),
    ("backend REST", r"localhost:8080"),
]


def parse(log: Path):
    events = []
    for line in log.read_text().splitlines():
        try:
            events.append(json.loads(line))
        except ValueError:
            pass
    result = next((e for e in events if e.get("type") == "result"), None)
    if not result:
        return None
    bash, skill_tool, tools, read_seed = [], False, 0, False
    for e in events:
        if e.get("type") != "assistant":
            continue
        for c in e["message"].get("content", []):
            if c.get("type") != "tool_use":
                continue
            tools += 1
            inp = c.get("input", {})
            if c["name"] == "Skill" and "db-cli" in str(inp.get("skill", "")):
                skill_tool = True
            if c["name"] == "Bash":
                bash.append(inp.get("command", ""))
            if "R__seed" in json.dumps(inp):
                read_seed = True
    cmds = "\n".join(bash)
    no_route = "seed file only" if read_seed else "none"
    route = next((name for name, rx in ROUTES if re.search(rx, cmds)), no_route)
    u = result.get("usage", {})
    in_tok = (
        u.get("input_tokens", 0)
        + u.get("cache_creation_input_tokens", 0)
        + u.get("cache_read_input_tokens", 0)
    )
    return {
        "answer": result.get("result") or "",
        "error": result.get("is_error") or result.get("subtype") != "success",
        "secs": result["duration_ms"] / 1000,
        "turns": result.get("num_turns", 0),
        "tools": tools,
        "cost": result.get("total_cost_usd", 0.0),
        "out_tok": u.get("output_tokens", 0),
        "in_tok": in_tok,
        "skill_tool": skill_tool,
        "used_cli": "db-cli.py" in cmds,
        "route": route,
    }


def grade(task, answer):
    trap = bool(task["trap"] and re.search(task["trap"]["regex"], answer, re.I))
    ok = not trap and all(re.search(rx, answer, re.I) for rx in task["expect_all"])
    return ok, trap


def med(xs):
    return statistics.median(xs) if xs else float("nan")


CSS = """
:root{--bg:#fff;--fg:#1b1f24;--mut:#667085;--line:#e3e6ea;--ok:#1a7f37;--bad:#c62828;
--head:#f5f6f8}
@media(prefers-color-scheme:dark){:root{--bg:#15181c;--fg:#e6e8eb;--mut:#98a2b3;
--line:#2c3138;--ok:#4cc26a;--bad:#ff6b6b;--head:#1d2126}}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,system-ui,sans-serif;
margin:32px auto;max-width:1500px;padding:0 16px}
h1{font-size:22px}h2{font-size:16px;margin-top:32px}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--head);font-weight:600;white-space:nowrap}
td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}.mut{color:var(--mut)}
td.ans{max-width:700px}
"""


def html_table(head, body, td="<td class=num>"):
    header = "".join(f"<th>{c}</th>" for c in head)
    rows = "".join("<tr>" + "".join(f"{td}{c}</td>" for c in r) + "</tr>" for r in body)
    return f"<div class=wrap><table><tr>{header}</tr>{rows}</table></div>"


def md_tables_to_html(md):
    html, rows = [], []

    def flush():
        if rows:
            html.append(html_table(rows[0], rows[2:]))
            rows.clear()

    for line in md.splitlines():
        if line.startswith("|"):
            rows.append([escape(c.strip()) for c in line.strip("|").split("|")])
        else:
            flush()
    flush()
    return html


def verdict(r):
    if r["ok"]:
        return "<span class=ok>correct</span>"
    return "<span class=bad>trap</span>" if r["trap"] else "<span class=bad>wrong</span>"


def run_row(task_id, arm, i, r):
    cells = [
        f"<td>{task_id}</td>",
        f"<td>{arm}</td>",
        f"<td class=num>{i}</td>",
        f"<td>{verdict(r)}</td>",
        f"<td>{r['route']}</td>",
        f"<td class=num>{r['secs']:.0f}</td>",
        f"<td class=num>{r['cost']:.3f}</td>",
        f"<td class=num>{r['tools']}</td>",
        f"<td class=ans>{escape(r['answer'])}</td>",
    ]
    return "<tr>" + "".join(cells) + "</tr>"


def task_item(t):
    trap = f" <span class=mut>Trap: {escape(t['trap']['name'])}.</span>" if t["trap"] else ""
    kind = f"<span class=mut>({escape(t['kind'])})</span>"
    return f"<li><b>{t['id']}</b> {kind}: {escape(t['prompt'])}{trap}</li>"


def write_html(path, md, cells):
    summary, gains = md_tables_to_html(md)
    head = ["task", "arm", "#", "verdict", "route",
            "time s", "cost $", "tool calls", "final answer"]
    header = "".join(f"<th>{c}</th>" for c in head)
    rows = "".join(
        run_row(task_id, arm, i, r)
        for (task_id, arm), rs in sorted(cells.items())
        for i, r in enumerate(rs, 1)
    )
    runs = f"<div class=wrap><table><tr>{header}</tr>{rows}</table></div>"
    tasks = "".join(task_item(t) for t in TASKS.values())
    Path(path).write_text(
        f"<!doctype html><meta charset=utf-8><title>db-cli skill eval</title>"
        f"<style>{CSS}</style><h1>db-cli skill eval</h1>"
        f"<p class=mut>Each task run by fresh headless agents, "
        f"with the skill present and with it removed. Medians per cell.</p>"
        f"<h2>Tasks</h2><ul>{tasks}</ul>"
        f"<h2>With vs without</h2>{summary}"
        f"<h2>Savings with the skill (median, without → with)</h2>{gains}"
        f"<h2>Every run</h2>{runs}"
    )


def main():
    html_path = sys.argv[sys.argv.index("--html") + 1] if "--html" in sys.argv else None
    if html_path:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            cells = report(Path(sys.argv[1]))
        print(buf.getvalue(), end="")
        write_html(html_path, buf.getvalue(), cells)
    else:
        report(Path(sys.argv[1]))


SUMMARY_HEAD = [
    "task", "arm", "n", "skill loaded", "ran db-cli.py", "correct", "trap",
    "time s (med, min–max)", "time vs without", "context tok (med)", "output tok (med)",
    "cost $ (med)", "cost vs without", "tool calls (med)", "routes",
]


def md_row(cells):
    return "| " + " | ".join(str(c) for c in cells) + " |"


def report(out):
    cells = defaultdict(list)
    for log in sorted(out.glob("*.jsonl")):
        task_id, arm, _ = log.name.split(".")[:3]
        r = parse(log)
        if r is None:
            print(f"⚠️ no result event in {log.name}", file=sys.stderr)
            continue
        r["ok"], r["trap"] = grade(TASKS[task_id], r["answer"])
        cells[task_id, arm].append(r)

    print(md_row(SUMMARY_HEAD))
    print("|" + "---|" * len(SUMMARY_HEAD))
    for (task_id, arm), rs in sorted(cells.items()):
        n = len(rs)
        routes = defaultdict(int)
        for r in rs:
            routes[r["route"]] += 1
        secs = [r["secs"] for r in rs]
        base = cells.get((task_id, "without"))

        def vs(key):
            if arm != "with" or not base:
                return "–"
            b = med([r[key] for r in base])
            return f"{(med([r[key] for r in rs]) - b) / b:+.0%}"

        def count(key):
            return f"{sum(r[key] for r in rs)}/{n}"

        def median_of(key, fmt):
            return format(med([r[key] for r in rs]), fmt)

        by_freq = sorted(routes.items(), key=lambda kv: -kv[1])
        print(md_row([
            task_id, arm, n,
            count("skill_tool"), count("used_cli"), count("ok"), count("trap"),
            f"{med(secs):.0f} ({min(secs):.0f}–{max(secs):.0f})", vs("secs"),
            median_of("in_tok", ",.0f"), median_of("out_tok", ",.0f"),
            median_of("cost", ".3f"), vs("cost"), median_of("tools", ".0f"),
            ", ".join(f"{k}×{v}" for k, v in by_freq),
        ]))

    print("\n| task | time saved | cost saved | context tok saved | output tok saved |")
    print("|---|---|---|---|---|")
    for task_id in TASKS:
        w, wo = cells.get((task_id, "with")), cells.get((task_id, "without"))
        if not w or not wo:
            continue

        def gain(key):
            a, b = med([r[key] for r in w]), med([r[key] for r in wo])
            return f"{(b - a) / b:+.0%} ({b:,.3g} → {a:,.3g})"

        gains = [gain("secs"), gain("cost"), gain("in_tok"), gain("out_tok")]
        print(md_row([task_id, *gains]))
    return cells


if __name__ == "__main__":
    main()
