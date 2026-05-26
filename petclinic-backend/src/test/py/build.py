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
  .leaf { stroke: #1a1a1a; stroke-width: 1; }
  .leaf:hover { stroke: #fff; stroke-width: 2; }
  .pkg { fill: none; stroke: #f0c674; }
  .pkg-title { fill: #f0c674; }
  .pkg-label { fill: #1a1a1a; font-weight: 700; pointer-events: none; }
  .leaf-label { fill: #000; font-size: 10px; pointer-events: none; }
  .tooltip { position: absolute; pointer-events: none; background: #000; color: #fff; padding: 6px 8px; border: 1px solid #555; font-size: 11px; border-radius: 3px; opacity: 0; transition: opacity .1s; max-width: 320px; }
</style>
</head>
<body>
<header>
  <h1>PetClinic Code City — cyclomatic≈ complexity</h1>
  <div class="legend">size = LOC &nbsp; · &nbsp; color = decision points (if/for/while/case/catch/&amp;&amp;/||/?)
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
<script>
const data = __DATA__;

const svg = d3.select("#city");
const tip = d3.select("#tip");
let mode = "treemap";

document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener("change", e => { mode = e.target.value; render(); });
});

const titleH = d => Math.max(14, 22 - d.depth * 2);

function shelfPack(items, w, h) {
  const sorted = items.slice().sort((a, b) => b.side - a.side);
  const positions = new Array(items.length);
  let x = 0, y = 0, rowH = 0;
  for (const it of sorted) {
    if (x > 0 && x + it.side > w) { x = 0; y += rowH; rowH = 0; }
    positions[it.idx] = { x, y, side: it.side };
    x += it.side;
    rowH = Math.max(rowH, it.side);
  }
  return { positions, fits: y + rowH <= h };
}

function applyUniformLayout(root) {
  root.eachAfter(node => {
    if (!node.children) return;
    if (!node.children.every(c => !c.children)) return;
    const x0 = node.x0;
    const y0 = node.y0 + (node.depth > 0 ? titleH(node) : 0) + 3;
    const x1 = node.x1;
    const y1 = node.y1 - 3;
    const w = x1 - x0 - 6, h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    const totalLoc = d3.sum(node.children, c => Math.max(1, c.data.loc || 1));
    let unit = Math.sqrt((w * h * 0.85) / totalLoc);
    let result;
    for (let i = 0; i < 40; i++) {
      const items = node.children.map((c, idx) => ({
        idx,
        side: Math.max(6, unit * Math.sqrt(Math.max(1, c.data.loc || 1))),
      }));
      result = shelfPack(items, w, h);
      if (result.fits) break;
      unit *= 0.94;
    }

    node.children.forEach((leaf, i) => {
      const p = result.positions[i];
      leaf.x0 = x0 + 3 + p.x;
      leaf.y0 = y0 + p.y;
      leaf.x1 = leaf.x0 + p.side - 1;
      leaf.y1 = leaf.y0 + p.side - 1;
    });
  });
}

function render() {
  const node = svg.node();
  const W = node.clientWidth, H = node.clientHeight;
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${W} ${H}`);

  const root = d3.hierarchy(data)
    .sum(d => mode === "uniform" ? (d.loc !== undefined ? 1 : 0) : (d.loc || 0))
    .sort((a, b) => b.value - a.value);

  d3.treemap()
    .tile(d3.treemapSquarify)
    .size([W, H])
    .paddingOuter(d => Math.max(4, 10 - d.depth * 2))
    .paddingTop(d => Math.max(14, 22 - d.depth * 2))
    .paddingInner(d => d.depth === 0 ? 14 : (d.depth === 1 ? 4 : 0))
    .round(true)(root);

  if (mode === "uniform") applyUniformLayout(root);

  const maxC = d3.max(root.leaves(), d => d.data.complexity) || 1;
  const color = d3.scaleSequential(t => d3.interpolateRgb("#ffffff", "#ff2020")(t)).domain([0, maxC]);

  const internals = root.descendants().filter(d => d.depth > 0 && d.children);
  const pkgColor = depth => d3.interpolateRgb("#f0c674", "#7aa2f7")(Math.min(1, (depth - 1) / 4));

  svg.selectAll("rect.pkg").data(internals).join("rect")
    .attr("class", "pkg")
    .attr("x", d => d.x0 - 0.5).attr("y", d => d.y0 - 0.5)
    .attr("width", d => d.x1 - d.x0 + 1).attr("height", d => d.y1 - d.y0 + 1)
    .attr("stroke", d => pkgColor(d.depth))
    .attr("stroke-width", d => Math.max(1, 4 - d.depth));

  svg.selectAll("rect.pkg-title").data(internals).join("rect")
    .attr("class", "pkg-title")
    .attr("x", d => d.x0).attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0).attr("height", d => Math.min(titleH(d) - 2, d.y1 - d.y0))
    .attr("fill", d => pkgColor(d.depth));

  svg.selectAll("text.pkg-label").data(internals).join("text")
    .attr("class", "pkg-label")
    .attr("x", d => d.x0 + 5)
    .attr("y", d => d.y0 + Math.max(10, 16 - d.depth * 2))
    .attr("font-size", d => Math.max(9, 13 - d.depth))
    .text(d => {
      const w = d.x1 - d.x0;
      if (w <= 50) return "";
      if (w < 180) return d.data.name;
      const loc = d3.sum(d.leaves(), n => n.data.loc || 0);
      const cc = d3.sum(d.leaves(), n => n.data.complexity || 0);
      return `${d.data.name}  ·  ${loc} loc  ·  cc ${cc}`;
    });

  svg.selectAll("rect.leaf").data(root.leaves()).join("rect")
    .attr("class", "leaf")
    .attr("x", d => d.x0).attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
    .attr("fill", d => color(d.data.complexity || 0))
    .style("cursor", "pointer")
    .on("mousemove", (ev, d) => {
      const path = d.ancestors().reverse().slice(1).map(n => n.data.name).join("/");
      tip.style("left", (ev.pageX + 12) + "px").style("top", (ev.pageY + 12) + "px").style("opacity", 1)
         .html(`<b>${path}</b><br>LOC: ${d.data.loc}<br>cyclomatic ≈ ${d.data.complexity} (${(d.data.complexity / Math.max(1, d.data.loc)).toFixed(2)}/line)<br><i>click to open in IntelliJ</i>`);
    })
    .on("mouseleave", () => tip.style("opacity", 0))
    .on("click", (ev, d) => {
      if (!d.data.path) return;
      const url = "http://localhost:63342/api/file/" + encodeURI(d.data.path);
      fetch(url, { mode: "no-cors" }).catch(() => {});
      window.location.href = "idea://open?file=" + encodeURIComponent(d.data.path) + "&line=1";
    });

  svg.selectAll("text.leaf-label").data(root.leaves()).join("text")
    .attr("class", "leaf-label")
    .attr("x", d => d.x0 + 3).attr("y", d => d.y0 + 11)
    .text(d => {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 36 || h < 14) return "";
      const name = d.data.name.replace(/\\.java$/, "");
      return name.length * 6 > w - 6 ? name.slice(0, Math.max(1, Math.floor((w - 6) / 6))) + "…" : name;
    });
}

render();
window.addEventListener("resize", render);
</script>
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
