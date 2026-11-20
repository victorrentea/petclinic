#!/usr/bin/env python3
"""Renders the db-cli eval as a self-contained HTML page with charts (inline SVG, no deps).

    evals/db-cli/pretty_report.py LOG_DIR [--commit SHA] [--out docs/eval/db-cli-skill.html]
    evals/db-cli/pretty_report.py docs/eval/db-cli-runs.json

LOG_DIR is the --out folder of run.py (one stream-json log per run); --commit names the HEAD
the arms were archived from. From a LOG_DIR it also writes db-cli-runs.json next to the page:
the parsed metrics of every run plus how they ran, small enough to commit, so the page can be
rebuilt later without the 31 MB of raw logs.
"""

import json, math, statistics, sys
from collections import Counter, defaultdict
from datetime import datetime
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import TASKS, grade, parse  # noqa: E402

ARMS = ("without", "with")
COL = {"with": "var(--with)", "without": "var(--without)"}
LABEL = {"with": "with the skill", "without": "without the skill"}
METRICS = [  # key, axis label, number format
    ("secs", "wall time (s)", "{:.0f}"),
    ("cost", "cost ($)", "{:.3f}"),
    ("in_tok", "context tokens (k)", "{:.0f}"),
]


def init_event(log: Path):
    for line in log.read_text().splitlines():
        if '"subtype":"init"' in line.replace(" ", ""):
            return json.loads(line)
    return {}


def load(src: Path, commit):
    if src.is_file():
        data = json.loads(src.read_text())
        return data["meta"], data["runs"]
    logs = sorted(src.glob("*.jsonl"))
    init = init_event(logs[0])
    stamps = [log.stat().st_mtime for log in logs]
    meta = {
        "model": init.get("model"),
        "claude_code": init.get("claude_code_version"),
        "commit": commit,
        "finished": datetime.fromtimestamp(max(stamps)).strftime("%Y-%m-%d %H:%M"),
        "wall_min": round((max(stamps) - min(stamps)) / 60 + max_secs(logs) / 60, 1),
    }
    runs = []
    for log in logs:
        task_id, arm, i = log.name.split(".")[:3]
        r = parse(log)
        if r is None:
            continue
        r["ok"], r["trap"] = grade(TASKS[task_id], r["answer"])
        runs.append({"task": task_id, "arm": arm, "i": int(i), **r})
    return meta, runs


def max_secs(logs):  # mtime marks a run's end; add the first run's length to get its start
    first = min(logs, key=lambda log: log.stat().st_mtime)
    r = parse(first)
    return r["secs"] if r else 0


def val(r, key):
    return r[key] / 1000 if key == "in_tok" else r[key]


def robust_fit(xs):
    """Median and MAD-sigma: one 107 s straggler must not flatten the whole curve."""
    mu = statistics.median(xs)
    mad = statistics.median(abs(x - mu) for x in xs)
    sigma = 1.4826 * mad or statistics.pstdev(xs)
    return mu, max(sigma, abs(mu) * 0.04) or 1  # floor: 7 identical runs are not a spike


def pdf(x, mu, s):
    return math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * math.sqrt(2 * math.pi))


def gauss_panel(cell, key, fmt, w=300, h=150):
    def bell(x, mu, s):
        return pdf(x, mu, s) / pdf(mu, mu, s)

    pad_l, pad_r, pad_t, pad_b = 10, 10, 14, 30
    fits = {arm: robust_fit([val(r, key) for r in cell[arm]]) for arm in ARMS}
    lo = min(min(mu - 3.2 * s for mu, s in fits.values()), 0)
    hi = max(mu + 3.2 * s for mu, s in fits.values())
    ymax = 1.08  # every curve scaled to the same peak: the width is the story, not the height

    def sx(x):
        return pad_l + (min(max(x, lo), hi) - lo) / (hi - lo) * (w - pad_l - pad_r)

    def sy(y):
        return h - pad_b - y / ymax * (h - pad_b - pad_t)

    out = [f'<svg viewBox="0 0 {w} {h}" class=chart role=img>']
    base = h - pad_b
    out.append(f"<line x1={pad_l} x2={w - pad_r} y1={base} y2={base} class=axis />")
    for t in nice_ticks(lo, hi):
        out.append(f"<text x={sx(t):.1f} y={base + 14} class=tick>{fmt.format(t)}</text>")
    for arm in ARMS:
        mu, s = fits[arm]
        xs = [lo + (hi - lo) * k / 120 for k in range(121)]
        pts = " ".join(f"{sx(x):.1f},{sy(bell(x, mu, s)):.1f}" for x in xs)
        out.append(
            f'<polygon points="{sx(lo):.1f},{base} {pts} {sx(hi):.1f},{base}" '
            f'fill="{COL[arm]}" fill-opacity=.18 />'
        )
        out.append(f'<polyline points="{pts}" fill=none stroke="{COL[arm]}" stroke-width=2 />')
        out.append(
            f"<line x1={sx(mu):.1f} x2={sx(mu):.1f} y1={base} y2={sy(1):.1f} "
            f'stroke="{COL[arm]}" stroke-dasharray="3 3" />'
        )
        y0 = base - (6 if arm == "with" else 12)
        far = []
        for r in cell[arm]:
            x = val(r, key)
            if x > hi:
                far.append(fmt.format(x))
                continue
            title = f"{LABEL[arm]} #{r['i']}: {fmt.format(x)}"
            out.append(
                f"<line x1={sx(x):.1f} x2={sx(x):.1f} y1={y0 - 4} y2={y0 + 4} "
                f'stroke="{COL[arm]}" stroke-width=2><title>{title}</title></line>'
            )
        if far:
            out.append(
                f'<text x={w - pad_r} y={y0 - 6} class=out fill="{COL[arm]}">'
                f'{", ".join(far)} ▶</text>'
            )
    out.append("</svg>")
    return "".join(out)


def nice_ticks(lo, hi, n=4):
    span = hi - lo
    step = 10 ** math.floor(math.log10(span / n))
    for m in (1, 2, 2.5, 5, 10):
        if span / (step * m) <= n + 1:
            step *= m
            break
    t = math.ceil(max(lo, 0) / step) * step
    ticks = []
    while t <= hi:
        ticks.append(t)
        t += step
    return ticks


def hbar_chart(rows, w=640, label_w=150, unit="", maxv=None):
    """rows: [(label, value, color, text)] — one horizontal bar each."""
    bh, gap = 20, 8
    h = len(rows) * (bh + gap) + 6
    maxv = maxv or max(v for _, v, _, _ in rows) or 1
    out = [f'<svg viewBox="0 0 {w} {h}" class=chart role=img>']
    for k, (label, v, color, text) in enumerate(rows):
        y = k * (bh + gap) + 3
        bw = max(v, 0) / maxv * (w - label_w - 90)
        out.append(f"<text x={label_w - 8} y={y + 14} class=lbl text-anchor=end>{label}</text>")
        out.append(f'<rect x={label_w} y={y} width={bw:.1f} height={bh} rx=4 fill="{color}" />')
        out.append(f"<text x={label_w + bw + 6:.1f} y={y + 14} class=val>{text}</text>")
    out.append("</svg>")
    return "".join(out)


def stacked_chart(rows, legend, w=640, label_w=150):
    """rows: [(label, [(count, color, name)], total)] — one stacked bar each."""
    bh, gap = 22, 10
    h = len(rows) * (bh + gap) + 6
    out = [f'<svg viewBox="0 0 {w} {h}" class=chart role=img>']
    for k, (label, parts, total) in enumerate(rows):
        y = k * (bh + gap) + 3
        x = label_w
        out.append(f"<text x={label_w - 8} y={y + 15} class=lbl text-anchor=end>{label}</text>")
        for count, color, name in parts:
            if not count:
                continue
            bw = count / total * (w - label_w - 10)
            out.append(
                f'<rect x={x:.1f} y={y} width={bw:.1f} height={bh} fill="{color}">'
                f"<title>{name}: {count}/{total}</title></rect>"
            )
            if bw > 34:
                out.append(
                    f"<text x={x + bw / 2:.1f} y={y + 15} class=inbar>"
                    f"{escape(name)} {count}</text>"
                )
            x += bw
    out.append("</svg>")
    keys = "".join(f'<span><i style="background:{c}"></i>{escape(n)}</span>' for n, c in legend)
    return "".join(out) + f"<div class=legend>{keys}</div>"


ROUTE_COL = {
    "db-cli.py": "var(--with)",
    "psql": "#8e7cc3",
    "docker psql": "#5b8def",
    "none": "var(--mut)",
    "seed file only": "var(--bad)",
}


def page(runs, meta):
    cells = defaultdict(lambda: defaultdict(list))
    for r in runs:
        cells[r["task"]][r["arm"]].append(r)
    tasks = [t for t in TASKS if t in cells]
    med = statistics.median

    def m(t, arm, key):
        return med(val(r, key) for r in cells[t][arm])

    def saved(t, key):
        a, b = m(t, "with", key), m(t, "without", key)
        return (b - a) / b

    # KPI cards
    cards = []
    for t in tasks:
        ok = {arm: sum(r["ok"] for r in cells[t][arm]) for arm in ARMS}
        n = len(cells[t]["with"])
        warn = " flag" if ok["with"] < ok["without"] else ""
        spec = TASKS[t]
        trap = f'<div class=trap>Trap: {escape(spec["trap"]["name"])}</div>' if spec["trap"] else ""
        cards.append(
            f'<div class="card{warn}"><div class=head><h3>{t}</h3>'
            f'<div class=kind>{escape(spec["kind"])}</div>'
            f'<div class=prompt title="the exact prompt given to claude -p">'
            f'{escape(spec["prompt"])}</div></div>'
            f'<div><div class=big>{saved(t, "secs"):.0%}<small> faster</small></div>'
            f'<div class=big>{saved(t, "cost"):.0%}<small> cheaper</small></div></div>'
            f'<div><div class=acc>correct: <b>{ok["with"]}/{n}</b> with · '
            f'<b>{ok["without"]}/{n}</b> without</div>{trap}</div></div>'
        )

    # Gauss grid
    grid = ["<div class=grid3>"]
    for key, label, fmt in METRICS:
        for t in tasks:
            fits = {a: robust_fit([val(r, key) for r in cells[t][a]]) for a in ARMS}
            sub = " · ".join(
                f'<span style="color:{COL[a]}">μ {fmt.format(fits[a][0])}, '
                f"σ {fmt.format(fits[a][1])}</span>"
                for a in ARMS
            )
            grid.append(
                f"<figure><figcaption><b>{t}</b> — {label}<br>"
                f"<small>{sub}</small></figcaption>"
                f"{gauss_panel(cells[t], key, fmt)}</figure>"
            )
    grid.append("</div>")

    # correctness
    corr = []
    for t in tasks:
        for arm in ARMS:
            rs = cells[t][arm]
            ok = sum(r["ok"] for r in rs)
            trap = sum(r["trap"] for r in rs)
            parts = [
                (ok, "var(--ok)", "correct"),
                (trap, "var(--bad)", "fell in trap"),
                (len(rs) - ok - trap, "var(--warn)", "wrong"),
            ]
            corr.append((f"{t} · {arm}", parts, len(rs)))
    corr_svg = stacked_chart(
        corr,
        [
            ("correct", "var(--ok)"),
            ("fell in the trap", "var(--bad)"),
            ("wrong / incomplete", "var(--warn)"),
        ],
    )

    # savings
    sav = []
    for key, label in (
        ("secs", "time"),
        ("cost", "cost"),
        ("in_tok", "context tokens"),
        ("out_tok", "output tokens"),
    ):
        for t in tasks:
            s = saved(t, key)
            sav.append((f"{label} · {t}", s * 100, "var(--with)", f"−{s:.0%}"))
    sav_svg = hbar_chart(sav, w=1100, label_w=190, maxv=100)

    # routes
    route_rows, seen = [], {}
    for t in tasks:
        for arm in ARMS:
            c = Counter(r["route"] for r in cells[t][arm])
            for k in c:
                seen[k] = ROUTE_COL.get(k, "var(--mut)")
            parts = [(v, ROUTE_COL.get(k, "var(--mut)"), k) for k, v in c.most_common()]
            route_rows.append((f"{t} · {arm}", parts, len(cells[t][arm])))
    route_svg = stacked_chart(route_rows, list(seen.items()))

    # tables
    head = [
        "task",
        "arm",
        "n",
        "skill loaded",
        "correct",
        "trap",
        "time s (med)",
        "context tok (med)",
        "output tok (med)",
        "cost $ (med)",
        "tool calls (med)",
    ]
    body = []
    for t in tasks:
        for arm in ARMS:
            rs = cells[t][arm]
            n = len(rs)
            body.append(
                [
                    t,
                    f'<span class=dot style="background:{COL[arm]}"></span>{arm}',
                    n,
                    f'{sum(r["skill_tool"] for r in rs)}/{n}',
                    f'{sum(r["ok"] for r in rs)}/{n}',
                    f'{sum(r["trap"] for r in rs)}/{n}',
                    f'{m(t, arm, "secs"):.0f}',
                    f'{med(r["in_tok"] for r in rs):,.0f}',
                    f'{med(r["out_tok"] for r in rs):,.0f}',
                    f'{m(t, arm, "cost"):.3f}',
                    f'{med(r["tools"] for r in rs):.0f}',
                ]
            )
    summary = table(head, body)
    every = table(
        ["task", "arm", "#", "verdict", "route", "s", "$", "tools", "final answer"],
        [
            [
                r["task"],
                r["arm"],
                r["i"],
                verdict(r),
                r["route"],
                f'{r["secs"]:.0f}',
                f'{r["cost"]:.3f}',
                r["tools"],
                f'<div class=ans>{escape(r["answer"])}</div>',
            ]
            for r in sorted(runs, key=lambda r: (r["task"], r["arm"], r["i"]))
        ],
    )
    tpl = (Path(__file__).resolve().parent / "pretty_report.html").read_text()
    findings = []
    for t in tasks:
        w, wo = cells[t]["with"], cells[t]["without"]
        ok_w, ok_wo = sum(r["ok"] for r in w), sum(r["ok"] for r in wo)
        if ok_w >= ok_wo:
            continue
        trapped = [r for r in w if r["trap"]]
        why = f' — {len(trapped)} fell in the trap: <i>{escape(TASKS[t]["trap"]["name"])}</i>'
        sample = f'<blockquote>{escape(trapped[0]["answer"])}</blockquote>' if trapped else ""
        findings.append(
            f"<div class=callout><b>⚠ {t}: faster, but wrong.</b> With the skill "
            f"{ok_w}/{len(w)} correct vs {ok_wo}/{len(wo)} without"
            f'{why if trapped else ""}.{sample}</div>'
        )
    tasks_n, arms_n = len(tasks), len(ARMS)
    meta_html = (
        f"<b>{len(runs)}</b> headless runs = <b>{tasks_n}</b> tasks (the cards below) × "
        f"<b>{arms_n}</b> arms (with / without the skill) × "
        f"<b>{len(runs) // (tasks_n * arms_n)}</b> runs each, to average out the noise; "
        f'model <code>{meta.get("model")}</code>, '
        f'Claude Code {meta.get("claude_code")}, repo at <code>{meta.get("commit")}</code>, '
        f'finished {meta.get("finished")} after ~{meta.get("wall_min")} min'
    )
    cost_total = sum(r["cost"] for r in runs)
    tok_total = sum(r["in_tok"] + r["out_tok"] for r in runs)
    cost_html = (
        f"<b>${cost_total:.2f}</b> at API prices for this one pass "
        f"({tok_total / 1e6:.1f}M tokens, ~${cost_total / len(runs):.2f} per run)"
    )
    return (
        tpl.replace("{{META}}", meta_html)
        .replace("{{COST}}", cost_html)
        .replace("{{FINDINGS}}", "".join(findings))
        .replace("{{CARDS}}", "".join(cards))
        .replace("{{GAUSS}}", "".join(grid))
        .replace("{{CORRECT}}", corr_svg)
        .replace("{{SAVINGS}}", sav_svg)
        .replace("{{ROUTES}}", route_svg)
        .replace("{{SUMMARY}}", summary)
        .replace("{{EVERY}}", every)
        .replace("{{N}}", str(len(runs)))
    )


def verdict(r):
    if r["ok"]:
        return "<span class=ok>correct</span>"
    return "<span class=bad>trap</span>" if r["trap"] else "<span class=warn>wrong</span>"


def table(head, rows):
    th = "".join(f"<th>{h}</th>" for h in head)
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f"<div class=wrap><table><tr>{th}</tr>{trs}</table></div>"


def main():
    src = Path(sys.argv[1])
    out = Path(
        sys.argv[sys.argv.index("--out") + 1]
        if "--out" in sys.argv
        else "docs/eval/db-cli-skill.html"
    )
    commit = sys.argv[sys.argv.index("--commit") + 1] if "--commit" in sys.argv else "HEAD"
    meta, runs = load(src, commit)
    out.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        data = json.dumps({"meta": meta, "runs": runs}, indent=2, ensure_ascii=False)
        (out.parent / "db-cli-runs.json").write_text(data + "\n")
    out.write_text(page(runs, meta))
    print(f"{len(runs)} runs → {out}")


if __name__ == "__main__":
    main()
