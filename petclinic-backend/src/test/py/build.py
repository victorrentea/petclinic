#!/usr/bin/env python3
"""Generate a 2D code-city treemap of the backend Java sources.

Size per file = LOC (non-blank lines).
Color per file = cyclomatic-approx (decision points: if/for/while/case/catch/&&/||/?).
Idea from *Building Evolutionary Architectures*.

Run from anywhere:
    python3 petclinic-backend/src/test/py/build.py

Writes to petclinic-backend/docs/CodeCity.html.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# src/test/py/build.py -> parents[3] = petclinic-backend/
ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "src" / "main" / "java"
OUT = ROOT / "docs" / "CodeCity.html"

BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
LINE_COMMENT = re.compile(r"//[^\n]*")
STRING_LIT = re.compile(r'"(?:\\.|[^"\\])*"')
CHAR_LIT = re.compile(r"'(?:\\.|[^'\\])*'")
KEYWORDS = re.compile(r"\b(?:if|for|while|case|catch)\b")
BOOLOPS = re.compile(r"&&|\|\|")
TERNARY = re.compile(r"\?(?![\s,>])")  # skip generic wildcards like List<?>


def strip_noise(code: str) -> str:
    code = BLOCK_COMMENT.sub("", code)
    code = LINE_COMMENT.sub("", code)
    code = STRING_LIT.sub('""', code)
    code = CHAR_LIT.sub("''", code)
    return code


def measure(path: Path) -> tuple[int, int]:
    """Return (loc, cyclomatic_approx) for a Java file."""
    text = path.read_text(encoding="utf-8", errors="replace")
    loc = sum(1 for line in text.splitlines() if line.strip())
    code = strip_noise(text)
    cc = (
        len(KEYWORDS.findall(code))
        + len(BOOLOPS.findall(code))
        + len(TERNARY.findall(code))
    )
    return loc, cc


def build_tree() -> dict:
    """Build nested {name, children|value, complexity} dict rooted at SRC."""
    root: dict = {"name": "src", "children": {}}

    for java in sorted(SRC.rglob("*.java")):
        rel = java.relative_to(SRC)
        parts = rel.parts
        node = root
        for pkg in parts[:-1]:
            kids = node["children"]
            if pkg not in kids:
                kids[pkg] = {"name": pkg, "children": {}}
            node = kids[pkg]
        loc, cc = measure(java)
        node["children"][parts[-1]] = {
            "name": parts[-1],
            "loc": loc,
            "complexity": cc,
            "path": str(java),
        }

    def finalize(n: dict) -> dict:
        if "children" in n:
            return {
                "name": n["name"],
                "children": [finalize(c) for c in n["children"].values()],
            }
        return n

    # Collapse single-child package chains (e.g. victor/training/petclinic/...)
    def collapse(n: dict) -> dict:
        if "children" not in n:
            return n
        n["children"] = [collapse(c) for c in n["children"]]
        if len(n["children"]) == 1 and "children" in n["children"][0]:
            child = n["children"][0]
            return {"name": f"{n['name']}/{child['name']}", "children": child["children"]}
        return n

    return collapse(finalize(root))


HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PetClinic Code City</title>
<style>
  body { margin: 0; font: 13px/1.4 -apple-system, system-ui, sans-serif; background: #1a1a1a; color: #eee; }
  header { padding: 10px 16px; border-bottom: 1px solid #333; display: flex; align-items: baseline; gap: 16px; }
  header h1 { font-size: 14px; margin: 0; font-weight: 600; }
  header .legend { font-size: 11px; color: #aaa; display: flex; align-items: center; gap: 8px; }
  header .modes { margin-left: auto; font-size: 11px; color: #ccc; }
  header .modes label { margin-left: 10px; cursor: pointer; }
  .legend .bar { width: 160px; height: 10px; background: linear-gradient(to right, #ffffff, #ff2020); border: 1px solid #444; }
  #city { width: 100vw; height: calc(100vh - 42px); }
  .leaf { stroke: none; }
  .leaf-label.hot { text-decoration: underline; }
  .pkg { fill: none; stroke: #000; stroke-width: 1; shape-rendering: crispEdges; }
  .pkg-label { fill: #1a1a1a; font-weight: 700; pointer-events: none; }
  .leaf-label { fill: #000; font-size: 10px; pointer-events: none; }
  .tooltip { position: absolute; pointer-events: none; background: #000; color: #fff; padding: 6px 8px; border: 1px solid #555; font-size: 11px; border-radius: 3px; opacity: 0; transition: opacity .1s; max-width: 320px; }
</style>
</head>
<body>
<header>
  <h1>PetClinic Code City — cyclomatic≈ complexity</h1>
  <div class="legend">size = lines &nbsp; · &nbsp; color = decision points (if/for/while/case/catch/&amp;&amp;/||/?)
    <span style="margin-left:10px">low</span>
    <span class="bar"></span>
    <span>high</span>
  </div>
  <div class="modes">
    <label><input type="radio" name="mode" value="treemap" checked> Treemap (size = LOC)</label>
    <label><input type="radio" name="mode" value="uniform"> Squares (area = LOC)</label>
  </div>
</header>
<svg id="city"></svg>
<div class="tooltip" id="tip"></div>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script>window.__data__ = __DATA__;</script>
<script src="../src/test/py/codecity.js"></script>
</body>
</html>
"""


def main() -> None:
    tree = build_tree()
    html = HTML.replace("__DATA__", json.dumps(tree))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    leaves = []

    def walk(n):
        if "children" in n:
            for c in n["children"]:
                walk(c)
        else:
            leaves.append(n)
    walk(tree)
    leaves.sort(key=lambda x: x["complexity"], reverse=True)
    print(f"wrote {OUT} ({len(leaves)} classes)")
    print("top 5 by complexity:")
    for l in leaves[:5]:
        print(f"  {l['complexity']:>6}  loc={l['loc']:>4}  {l['name']}")


if __name__ == "__main__":
    main()
