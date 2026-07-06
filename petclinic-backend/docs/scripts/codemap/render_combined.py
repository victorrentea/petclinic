#!/usr/bin/env python3
"""Render a side-by-side page linking the 2D Plotly codemap and the 3D Code City.

Both children (codemap.html, codecity.html) are rendered from the SAME codemap.tsv
by their own generators and already carry their data inline + load their libraries
from CDNs. This page is a thin self-contained shell that:

  * hosts codemap.html (left) and codecity.html (right) in two iframes, and
  * acts as a postMessage HUB so hovering a file in one view highlights the SAME
    file in the other (bi-directional shared selection).

Each child talks only to window.parent (this page); the hub forwards every hover
message to the OTHER child, so neither child needs to know about the other.
"""
import os

_here = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.abspath(os.environ.get("HEATMAP_OUT") or os.environ.get("HEATMAP_REPO") or _here)
OUT = os.path.join(OUT_DIR, "combined.html")
TITLE = os.environ.get("CODECITY_TITLE") or os.environ.get("HEATMAP_TITLE", "Code City + Codemap")
CODEMAP_SRC = "codemap.html"   # left pane  (Plotly 2D treemap + scatter)
CITY_SRC = "codecity.html"     # right pane (Three.js 3D city)

FAVICON = ("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%3E"
           "%3Crect%20x='2.5'%20y='9'%20width='5.5'%20height='12.5'%20rx='1'%20fill='%235b8def'/%3E"
           "%3Crect%20x='9'%20y='3.5'%20width='6'%20height='18'%20rx='1'%20fill='%231e3a8a'/%3E"
           "%3Crect%20x='16'%20y='11.5'%20width='5.5'%20height='10'%20rx='1'%20fill='%233a86ff'/%3E%3C/svg%3E")

html = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<link rel="icon" href="__FAVICON__">
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f1420; color: #e7edf6;
  }
  header {
    flex: 0 0 auto; display: flex; align-items: baseline; gap: 14px;
    padding: 8px 16px; border-bottom: 1px solid #26304a; background: #131a2a;
  }
  header h1 { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: .2px; }
  header .hint { font-size: 12px; color: #8b98ad; }
  header #linked { font-size: 12px; color: #6fd1e6; margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    max-width: 46vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .split { flex: 1 1 auto; display: flex; min-height: 0; }
  .pane { flex: 1 1 50%; min-width: 0; display: flex; flex-direction: column; }
  .pane + .pane { border-left: 3px solid #26304a; }
  .pane .cap {
    flex: 0 0 auto; padding: 4px 12px; font-size: 11px; text-transform: uppercase;
    letter-spacing: .6px; color: #8b98ad; background: #101725; border-bottom: 1px solid #202a40;
  }
  .pane iframe { flex: 1 1 auto; width: 100%; height: 100%; border: 0; background: #fff; }
  @media (max-width: 900px) { .split { flex-direction: column; }
    .pane + .pane { border-left: 0; border-top: 3px solid #26304a; } }
</style>
</head>
<body>
<header>
  <h1>__TITLE__</h1>
  <span class="hint">2D codemap &harr; 3D Code City &middot; hover a file in either view to spotlight it in the other</span>
  <span id="linked"></span>
</header>
<div class="split">
  <div class="pane">
    <div class="cap">2D Codemap &middot; treemap + scatter (Plotly)</div>
    <iframe id="mapFrame" src="__CODEMAP_SRC__" title="2D codemap"></iframe>
  </div>
  <div class="pane">
    <div class="cap">3D Code City (Three.js)</div>
    <iframe id="cityFrame" src="__CITY_SRC__" title="3D code city"></iframe>
  </div>
</div>
<script>
  // postMessage hub: relay each child's hover to the OTHER child, and echo the
  // linked path into the header so you can see the shared selection.
  const mapFrame = document.getElementById('mapFrame');
  const cityFrame = document.getElementById('cityFrame');
  const linkedEl = document.getElementById('linked');
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.codemapLink !== true) return;
    const target = (d.from === 'city') ? mapFrame : cityFrame;   // forward to the opposite view
    if (target && target.contentWindow) target.contentWindow.postMessage(d, '*');
    linkedEl.textContent = d.path ? ('• ' + d.path) : '';
  });
</script>
</body>
</html>
"""

html = (html
        .replace("__TITLE__", TITLE)
        .replace("__FAVICON__", FAVICON)
        .replace("__CODEMAP_SRC__", CODEMAP_SRC)
        .replace("__CITY_SRC__", CITY_SRC))

with open(OUT, "w") as f:
    f.write(html)

print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.1f} KB)")
