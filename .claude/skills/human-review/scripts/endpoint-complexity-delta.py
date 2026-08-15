#!/usr/bin/env python3
"""What the change cost in entry-point complexity, ranked against the whole app.

`EndpointComplexityExtractorTest` answers "how complex is each entry point's whole flow
right now" — REST endpoints, MCP tools, message listeners and jobs alike. A reviewer needs
the derivative of that: which entry points this branch made heavier, by how much, and
whether that lands on an already-expensive one or turns a cheap one into a hot spot. So
this diffs two of its JSON snapshots and renders the full ranked list, grouped by kind —
touched rows called out, untouched rows kept for scale, because "+3" only means something
next to the numbers it is standing among.

Colour reads as authorship, not as judgement: green is what the branch ADDED, red is what
it REMOVED.

Get the two snapshots by running that test at the merge-base and at HEAD:
    git show <merge-base>:petclinic-backend/docs/generated/endpoint-complexity.json > before.json
    mvn -q test -Dtest=EndpointComplexityExtractorTest   # writes the "after" in place

Usage:
    endpoint-complexity-delta.py before.json after.json [--out fragment.html] [--json]
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path


# Snapshots taken before entry points other than HTTP were extracted carry no 'kind' at all.
DEFAULT_KIND = "http"
KIND_TITLES = [
    ("http", "HTTP / REST APIs"),
    ("mcp", "MCP tools"),
    ("listener", "Message listeners"),
    ("job", "Jobs"),
]


@lru_cache(maxsize=1)
def repo_root() -> Path:
    return Path(
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
        ).stdout.strip()
    )


@lru_cache(maxsize=None)
def _source_of(fqcn: str):
    """`victor.training.petclinic.mcp.PetClinicMcp` -> the .java file that declares it."""
    rel = Path(*fqcn.split(".")).with_suffix(".java")
    for src in sorted(repo_root().glob("*/src/main/java")):
        candidate = src / rel
        if candidate.is_file():
            return candidate
    return None


@lru_cache(maxsize=None)
def entry_source(flow_method: str):
    """Where a flow starts, as (absolute path, 1-based line) — or None if not resolvable.

    The JSON names the handler as `pkg.Class#method`. The line comes from the declaration in
    the file rather than from bytecode, so it stays right for any project layout and needs no
    debug symbols; an overload resolves to its first declaration, which is the file and method
    a reviewer wanted anyway.
    """
    if "#" not in flow_method:
        return None
    fqcn, method = flow_method.split("#", 1)
    path = _source_of(fqcn)
    if path is None:
        return None
    decl = re.compile(r"\b" + re.escape(method) + r"\s*\(")
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith(("//", "*", "/*")) or "=" in stripped.split("(")[0]:
            continue
        if decl.search(line):
            return path, n
    return path, 1


def load(path: Path):
    return {
        (e.get("kind", DEFAULT_KIND), e["httpMethod"], e["path"]): e
        for e in json.loads(path.read_text(encoding="utf-8"))
    }


def compare(before, after):
    rows = []
    for key, cur in after.items():
        old = before.get(key)
        was = old["flowCc"] if old else None
        rows.append(
            {
                "kind": key[0],
                "method": key[1],
                "path": key[2],
                "now": cur["flowCc"],
                "was": was,
                "delta": cur["flowCc"] - was if was is not None else None,
                "handler": cur.get("handler", ""),
                "entry": (cur.get("flow") or [{}])[0].get("method", ""),
                "methods": cur.get("methods"),
            }
        )
    rows.sort(key=lambda r: (-r["now"], r["path"]))
    return rows


def _path_cell(r) -> str:
    """The label, linked to the method the flow starts at, so a reviewer lands on the
    controller / tool / listener that owns it instead of going hunting."""
    label = f'<code class="cx-path">{html.escape(r["path"])}</code>'
    found = entry_source(r.get("entry", ""))
    if not found:
        return label
    path, line = found
    return (
        f'<a class="cx-link" href="vscode://file/{path}:{line}:1" '
        f'title="{html.escape(r.get("handler") or "")} — open in VS Code">{label}</a>'
    )


def render_row(r, peak) -> str:
    if r["delta"] is None:
        badge, cls = "new", "cx-up"
    elif r["delta"] > 0:
        badge, cls = f'+{r["delta"]}', "cx-up"
    elif r["delta"] < 0:
        badge, cls = str(r["delta"]), "cx-down"
    else:
        badge, cls = "", "cx-same"
    # The delta rides on the *end* of the bar, so the eye reads "this much of this bar the
    # branch added" (green) or "this much it removed" (red), instead of subtracting two numbers.
    # A growth splits the current bar; a shrink hangs the lost part off its end; a brand-new
    # entry point is added whole.
    delta = r["delta"] or 0
    now_pct = 100.0 * r["now"] / peak
    if r["delta"] is None:
        kept_pct, delta_pct = 0, now_pct
    else:
        delta_pct = 100.0 * abs(delta) / peak
        kept_pct = now_pct - (delta_pct if delta > 0 else 0)
    return (
        f'<div class="cx-row {cls}">'
        f'<span class="cx-verb cx-{r["method"].lower()}">{html.escape(r["method"])}</span>'
        f"{_path_cell(r)}"
        f'<span class="cx-bar"><i style="width:{kept_pct:.1f}%"></i>'
        f'<u style="width:{delta_pct:.1f}%"></u></span>'
        f'<span class="cx-badge">{badge}</span>'
        f'<span class="cx-n">{r["now"]}</span>'
        f"</div>"
    )


def render(rows) -> str:
    # A shrunk bar still draws what was removed past its current end, so the scale must fit
    # the taller of the two snapshots.
    peak = max((max(r["now"], r["was"] or 0) for r in rows), default=1) or 1
    touched = [r for r in rows if r["delta"] != 0]
    out = [
        '<p class="cx-lede">Cyclomatic complexity of the <em>whole flow</em> behind each entry '
        "point — REST endpoint, MCP tool, message listener, job (bytecode-derived: every decision "
        "point in every method reachable from the handler, plus one). "
        f"<b>{len(touched)}</b> of {len(rows)} entry points moved; "
        '<span class="cx-up cx-key">green</span> is what this branch added, '
        '<span class="cx-down cx-key">red</span> what it removed.</p>',
    ]
    known = {kind for kind, _ in KIND_TITLES}
    groups = KIND_TITLES + [
        (k, k) for k in dict.fromkeys(r["kind"] for r in rows) if k not in known
    ]
    for kind, title in groups:
        of_kind = [r for r in rows if r["kind"] == kind]
        if not of_kind:
            continue
        out.append('<div class="cx-group">')
        out.append(
            f'<div class="cx-kind">{html.escape(title)} <span class="cx-count">'
            f"{len(of_kind)}</span></div>"
        )
        out.append('<div class="cx-list">')
        out.extend(render_row(r, peak) for r in of_kind)
        out.append("</div></div>")
    return "\n".join(out)


CSS = """
/* Green = complexity this branch ADDED, red = complexity it REMOVED: the colour names the
    author of the change, it is not a verdict on whether growing is bad. */
.cx-lede { color:var(--muted); font-size:.92rem; --cx-added:#2e9e5b; --cx-removed:#c62828; }
.cx-group { --cx-added:#2e9e5b; --cx-removed:#c62828; }
.cx-group + .cx-group { margin-top:1.1rem; }
.cx-kind { font:600 11px/1 system-ui,sans-serif; text-transform:uppercase; letter-spacing:.07em;
            color:var(--muted); margin:0 0 .35rem .15rem; }
.cx-count { opacity:.65; font-weight:400; }
.cx-key { font-weight:700; }
.cx-list { border:1px solid var(--line); border-radius:8px; overflow:hidden; background:var(--card); }
.cx-row { display:grid; grid-template-columns:3.6rem minmax(9rem,17rem) 1fr 2.6rem 2.2rem;
          align-items:center; gap:.55rem; padding:.3rem .8rem; border-bottom:1px solid var(--line);
          font-size:.84rem; }
.cx-row:last-child { border-bottom:0; }
.cx-same { opacity:.5; }
.cx-verb { font:700 10.5px/1 ui-monospace,Menlo,monospace; letter-spacing:.03em; }
.cx-get{color:#2e7d32}.cx-post{color:#1565c0}.cx-put{color:#e08a00}.cx-delete{color:#c62828}.cx-any{color:var(--muted)}
.cx-patch{color:#8e44ad}.cx-mcp{color:#7c4dff}.cx-job{color:#e08a00}
.cx-kafka,.cx-rabbit,.cx-jms{color:#00838f}
a.cx-link { text-decoration:none; display:block; overflow:hidden; }
a.cx-link:hover .cx-path { text-decoration:underline; }
.cx-path { font:12px/1.4 ui-monospace,Menlo,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cx-bar { display:flex; height:9px; border-radius:5px; overflow:hidden; background:transparent; }
.cx-bar i { background:#c9c9d4; border-radius:5px 0 0 5px; }
.cx-bar u { border-radius:0 5px 5px 0; }
.cx-up .cx-bar u { background:var(--cx-added); }
.cx-down .cx-bar u { background:var(--cx-removed); }
.cx-same .cx-bar i { border-radius:5px; }
.cx-badge { font:700 11px/1 ui-monospace,Menlo,monospace; text-align:right; color:var(--muted); }
.cx-up .cx-badge, .cx-up.cx-key { color:var(--cx-added); }
.cx-down .cx-badge, .cx-down.cx-key { color:var(--cx-removed); }
.cx-n { font:600 12px/1 ui-monospace,Menlo,monospace; text-align:right; }
@media (prefers-color-scheme: dark) {
  .cx-lede, .cx-group { --cx-added:#4ec27f; --cx-removed:#ef6a6a; }
  .cx-bar i { background:#3d3d4a; }
}
"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("before")
    ap.add_argument("after")
    ap.add_argument("--out")
    ap.add_argument("--json", action="store_true", help="emit the rows as JSON instead of HTML")
    ap.add_argument("--css", action="store_true", help="print the stylesheet this fragment needs")
    args = ap.parse_args(argv)

    if args.css:
        print(CSS)
        return 0

    rows = compare(load(Path(args.before)), load(Path(args.after)))
    body = json.dumps(rows, indent=1) if args.json else render(rows)
    if args.out:
        Path(args.out).write_text(body, encoding="utf-8")
        print(f"[complexity-delta] wrote {args.out}", file=sys.stderr)
    else:
        print(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
