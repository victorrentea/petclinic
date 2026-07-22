// Treemap visualization for PetClinic Code City. Data injected as `window.__data__`.
const data = window.__data__;
const svg = d3.select("#city");
const tip = d3.select("#tip");
let mode = "treemap";
const collapsed = new Set();

// Color scales must stay stable when packages collapse, so derive their domains
// once from the full raw tree instead of re-deriving from the visible nodes.
function scanRawTree(n) {
  if (!n.children) return { loc: n.loc || 0, cc: n.complexity || 0, maxLeafCC: n.complexity || 0, maxDensity: 0 };
  let loc = 0, cc = 0, maxLeafCC = 0, maxDensity = 0;
  for (const c of n.children) {
    const s = scanRawTree(c);
    loc += s.loc; cc += s.cc;
    if (s.maxLeafCC > maxLeafCC) maxLeafCC = s.maxLeafCC;
    if (s.maxDensity > maxDensity) maxDensity = s.maxDensity;
  }
  const density = loc > 0 ? cc / loc : 0;
  if (density > maxDensity) maxDensity = density;
  return { loc, cc, maxLeafCC, maxDensity };
}
const scan = scanRawTree(data);
const leafColor = d3.scaleSequential(t => d3.interpolateRgb("#ffffff", "#ff2020")(t)).domain([0, scan.maxLeafCC || 1]);
const densityColor = d3.scaleSequential(t => d3.interpolateRgb("#ffffff", "#ff2020")(t)).domain([0, scan.maxDensity || 1]);

document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener("change", e => { mode = e.target.value; render(); });
});

const titleH = d => Math.max(14, 22 - d.depth * 2);

function pathOf(d) {
  return d.ancestors().reverse().slice(1).map(a => a.data.name).join("/");
}

function togglePkg(d) {
  const p = pathOf(d);
  if (collapsed.has(p)) collapsed.delete(p); else collapsed.add(p);
  render();
}

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

  // Aggregate loc / cc on each node BEFORE collapsing.
  root.eachAfter(n => {
    n._cc = (n.children || []).reduce((s, c) => s + c._cc, n.data.complexity || 0);
    n._loc = (n.children || []).reduce((s, c) => s + c._loc, n.data.loc || 0);
  });

  // Collapse: stash children into _children for nodes the user toggled off.
  root.descendants().forEach(n => {
    n.pkgPath = pathOf(n);
    if (collapsed.has(n.pkgPath) && n.children) {
      n._children = n.children;
      n.children = null;
    }
  });

  d3.treemap()
    .tile(d3.treemapSquarify)
    .size([W, H])
    .paddingOuter(d => d.depth === 0 ? 5 : 0)
    .paddingTop(d => d.depth === 0 ? 5 : titleH(d))
    .paddingInner(d => d.children && d.children.some(c => c.children || c._children) ? 5 : 0)
    .round(true)(root);

  if (mode === "uniform") applyUniformLayout(root);

  const openPkgs = root.descendants().filter(d => d.depth > 0 && d.children);
  const closedPkgs = root.descendants().filter(d => d.depth > 0 && d._children);
  const allPkgs = openPkgs.concat(closedPkgs);
  const realLeaves = root.descendants().filter(d => d.depth > 0 && !d.children && !d._children);

  const pkgFill = d => densityColor(d._loc > 0 ? d._cc / d._loc : 0);

  svg.selectAll("rect.pkg").data(allPkgs).join("rect")
    .attr("class", "pkg")
    .attr("x", d => d.x0).attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
    .attr("fill", pkgFill);

  svg.selectAll("rect.pkg-title").data(allPkgs).join("rect")
    .attr("class", "pkg-title")
    .attr("x", d => d.x0).attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => Math.min(titleH(d), d.y1 - d.y0))
    .attr("fill", pkgFill)
    .style("cursor", "pointer")
    .on("click", (ev, d) => togglePkg(d));

  svg.selectAll("text.pkg-label").data(allPkgs).join("text")
    .attr("class", "pkg-label")
    .attr("x", d => d.x0 + 5)
    .attr("y", d => d.y0 + Math.max(10, 16 - d.depth * 2))
    .attr("font-size", d => Math.max(9, 13 - d.depth))
    .text(d => {
      const w = d.x1 - d.x0;
      if (w <= 50) return "";
      const marker = d._children ? "▶ " : "▼ ";
      if (w < 120) return marker + d.data.name;
      return `${marker}${d.data.name}  ·  ${d._loc} lines  ·  cc ${d._cc}`;
    });

  svg.selectAll("rect.leaf").data(realLeaves).join("rect")
    .attr("class", "leaf")
    .attr("x", d => d.x0).attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
    .attr("fill", d => leafColor(d.data.complexity || 0))
    .style("cursor", "pointer")
    .on("mouseenter", function (ev, d) {
      svg.selectAll("text.leaf-label").filter(t => t === d).classed("hot", true);
    })
    .on("mousemove", (ev, d) => {
      const path = d.ancestors().reverse().slice(1).map(n => n.data.name).join("/");
      tip.style("opacity", 1)
         .html(`<b>${path}</b><br>Lines: ${d.data.loc}<br>cyclomatic ≈ ${d.data.complexity} (${(d.data.complexity / Math.max(1, d.data.loc)).toFixed(2)}/line)<br><i>click to open in IntelliJ</i>`);
      const tipNode = tip.node();
      const tw = tipNode.offsetWidth, th = tipNode.offsetHeight;
      const pad = 8;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = ev.pageX + 12;
      let top = ev.pageY + 12;
      if (left + tw + pad > vw) left = ev.pageX - tw - 12;
      if (top + th + pad > vh) top = ev.pageY - th - 12;
      tip.style("left", Math.max(pad, left) + "px").style("top", Math.max(pad, top) + "px");
    })
    .on("mouseleave", function (ev, d) {
      svg.selectAll("text.leaf-label").filter(t => t === d).classed("hot", false);
      tip.style("opacity", 0);
    })
    .on("click", (ev, d) => {
      if (!d.data.path) return;
      const url = "http://localhost:63342/api/file/" + encodeURI(d.data.path);
      fetch(url, { mode: "no-cors" }).catch(() => {});
      window.location.href = "idea://open?file=" + encodeURIComponent(d.data.path) + "&line=1";
    });

  svg.selectAll("text.leaf-label").data(realLeaves).join("text")
    .attr("class", "leaf-label")
    .attr("x", d => d.x0 + 3).attr("y", d => d.y0 + 11)
    .attr("font-size", d => (d.x1 - d.x0) < 30 || (d.y1 - d.y0) < 12 ? 8 : 10)
    .text(d => {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (h < 6) return "";
      const name = d.data.name.replace(/\.java$/, "");
      if (w < 14) return name.charAt(0);
      const maxChars = Math.max(1, Math.floor((w - 4) / 6));
      return name.length > maxChars ? name.slice(0, Math.max(1, maxChars - 1)) + "…" : name;
    });
}

render();
window.addEventListener("resize", render);
