#!/usr/bin/env python3
"""Render codemap.tsv to a Three.js CodeCity."""
import csv
import json
import os
import sys
import urllib.parse
from pathlib import Path


_here = Path(__file__).resolve().parent
SCRIPTS_DIR = _here  # the codemap generators live here; baked into the in-page "build it yourself" recipe
OUT_DIR = Path(os.environ.get("HEATMAP_OUT") or os.environ.get("HEATMAP_REPO") or _here).resolve()
TSV = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else OUT_DIR / "codemap.tsv"
OUT = OUT_DIR / "codecity.html"
TITLE = os.environ.get("HEATMAP_TITLE", "Code City")
REPO_ABS = Path(os.environ.get("HEATMAP_REPO_ABS") or os.environ.get("HEATMAP_REPO") or Path.cwd()).resolve()


def _number(row, key, cast=float):
    value = row.get(key, "0") or "0"
    return cast(value)


def _district(path):
    parts = path.split("/")
    if "java" in parts:
        java_index = parts.index("java")
        package_parts = parts[java_index + 1:-1]
        if package_parts:
            return ".".join(package_parts)
    if len(parts) > 1:
        return parts[-2]
    return "root"


rows = []
with TSV.open() as f:
    reader = csv.DictReader(f, delimiter="\t")
    for row in reader:
        path = row["path"].lstrip("./")
        # package-info.java carries only package annotations/Javadoc, no real
        # code — keep it out of the diagram entirely.
        if path.rsplit("/", 1)[-1] == "package-info.java":
            continue
        fan_in = _number(row, "fan_in", int)    # afferent coupling Ca (references coming in)
        fan_out = _number(row, "fan_out", int)  # efferent coupling Ce (references going out)
        rows.append({
            "path": path,
            "name": path.rsplit("/", 1)[-1].replace(".java", ""),
            "district": _district(path),
            "bytes": _number(row, "bytes", int),
            "lines": _number(row, "lines", int),
            "commits": _number(row, "commits", int),
            "bug_commits": _number(row, "bug_commits", int),
            "commits_per_kloc": _number(row, "commits_per_kloc"),
            "bugs_per_kloc": _number(row, "bugs_per_kloc"),
            "bugs_per_commit": _number(row, "bugs_per_commit"),
            "cognitive_complexity": _number(row, "cognitive_complexity", int),
            "complexity_per_kloc": _number(row, "complexity_per_kloc"),
            "fan_in": fan_in,
            "fan_out": fan_out,
            "committers": _number(row, "committers", int),
            # Instability I = Ce / (Ce + Ca) = fan_out / (fan_out + fan_in), in [0,1]
            # (Robert C. Martin's package metric): 0 = maximally stable (only
            # depended upon), 1 = maximally unstable (only depends on others).
            "instability": (fan_out / (fan_in + fan_out)) if (fan_in + fan_out) else 0.0,
        })

# ── Per-package rows for "package mode" ──────────────────────────────────────
# A package is shaped exactly like a file row (same field names) so the existing
# treemap/floor/building machinery renders it as a building nested under its
# PARENT package (its `district`). Aggregated metrics come from
# codemap-packages.tsv (emitted by build_heatmap.py); if it's absent, package
# mode is simply empty and the toggle falls back to the class view.
pkg_rows = []
PKG_TSV = TSV.with_name("codemap-packages.tsv")
if PKG_TSV.exists():
    with PKG_TSV.open() as f:
        for row in csv.DictReader(f, delimiter="\t"):
            pkg = row["package"]
            parent = pkg.rsplit(".", 1)[0] if "." in pkg else ""
            fan_in = _number(row, "fan_in", int)
            fan_out = _number(row, "fan_out", int)
            pkg_rows.append({
                "path": pkg,
                "name": pkg.rsplit(".", 1)[-1],   # last segment is the building label
                "district": parent,               # parent package = the floor it stands on
                "files": _number(row, "files", int),
                "bytes": _number(row, "bytes", int),
                "lines": _number(row, "lines", int),
                "commits": _number(row, "commits", int),
                "bug_commits": _number(row, "bug_commits", int),
                "commits_per_kloc": _number(row, "commits_per_kloc"),
                "bugs_per_kloc": _number(row, "bugs_per_kloc"),
                "bugs_per_commit": _number(row, "bugs_per_commit"),
                "cognitive_complexity": _number(row, "cognitive_complexity", int),
                "complexity_per_kloc": _number(row, "complexity_per_kloc"),
                "fan_in": fan_in,
                "fan_out": fan_out,
                "committers": _number(row, "committers", int),
                "instability": (fan_out / (fan_in + fan_out)) if (fan_in + fan_out) else 0.0,
            })

# ── Per-module rows for "module mode" (Maven/Gradle) ─────────────────────────
# Same shape as a file/package row, so the same treemap machinery renders each
# Maven/Gradle module as a building on its parent-module floor. Aggregates come
# from codemap-modules.tsv (emitted by build_heatmap.py); if it's absent, module
# mode is empty and the dropdown option greys out.
mod_rows = []
MOD_TSV = TSV.with_name("codemap-modules.tsv")
if MOD_TSV.exists():
    repo_name = REPO_ABS.name or "root"
    with MOD_TSV.open() as f:
        for row in csv.DictReader(f, delimiter="\t"):
            mod = row["module"]                       # repo-relative dir; "" = the repo-root module
            segs = mod.split("/") if mod else []
            fan_in = _number(row, "fan_in", int)
            fan_out = _number(row, "fan_out", int)
            mod_rows.append({
                "path": mod or ".",
                "name": segs[-1] if segs else repo_name,   # building label
                "district": ".".join(segs[:-1]),           # parent dir (dotted) = the floor it stands on
                "files": _number(row, "files", int),
                "bytes": _number(row, "bytes", int),
                "lines": _number(row, "lines", int),
                "commits": _number(row, "commits", int),
                "bug_commits": _number(row, "bug_commits", int),
                "commits_per_kloc": _number(row, "commits_per_kloc"),
                "bugs_per_kloc": _number(row, "bugs_per_kloc"),
                "bugs_per_commit": _number(row, "bugs_per_commit"),
                "cognitive_complexity": _number(row, "cognitive_complexity", int),
                "complexity_per_kloc": _number(row, "complexity_per_kloc"),
                "fan_in": fan_in,
                "fan_out": fan_out,
                "committers": _number(row, "committers", int),
                "instability": (fan_out / (fan_in + fan_out)) if (fan_in + fan_out) else 0.0,
            })

OUT_DIR.mkdir(parents=True, exist_ok=True)

html = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<link rel="icon" href="__FAVICON__">
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/"
  }
}
</script>
<style>
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: #f4f5f7;
    color: #1f2933;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  #scene {
    position: fixed;
    inset: 0;
  }
  .panel {
    position: fixed;
    left: 16px;
    top: 16px;
    z-index: 2;
    width: min(430px, calc(100vw - 32px));
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid rgba(140, 148, 160, 0.45);
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14);
    backdrop-filter: blur(10px);
    padding: 12px 14px;
  }
  h1 {
    margin: 0 0 3px;
    font-size: 17px;
    font-weight: 650;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h1 .logo {
    flex: none;
    width: 22px;
    height: 22px;
  }
  .sub {
    margin: 0 0 11px;
    color: #52606d;
    font-size: 12px;
    line-height: 1.35;
  }
  .controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  /* View switch (Classes / Packages / Modules) sits inline in the title row. */
  h1 .titleView {
    flex: none;
    font-size: 13px; font-weight: 650; padding: 3px 8px;
    color: #1e3a8a; border: 1px solid #b9c4d6; border-radius: 6px;
    background: #fff; text-transform: none;
  }
  h1 .titleView option:disabled { color: #aab4c8; }
  /* Inline label+select rows (e.g. "Package labels:") under the title. */
  .viewOf {
    display: flex; align-items: center; gap: 8px; margin: 5px 0 10px;
    font-size: 13px; font-weight: 600; color: #1f2933;
    text-transform: none; letter-spacing: 0;
  }
  .viewOf select {
    font-size: 13px; font-weight: 650; padding: 4px 8px;
    color: #1e3a8a; border-color: #b9c4d6;
  }
  .viewOf option:disabled { color: #aab4c8; }
  .pkgRow { margin: 10px 0 0; }
  /* Package-pattern filter: AspectJ-style globs (victor..*Service, ..repo.., *Service). */
  .filterRow { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; }
  .filterRow input {
    flex: 1 1 auto; min-width: 0;
    border: 1px solid #c8d0da; border-radius: 6px; background: #fff;
    color: #1f2933; font-size: 12.5px; padding: 6px 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .filterRow input.bad { border-color: #d14343; background: #fff5f5; }
  .filterRow button {
    flex: none; border: 1px solid #c8d0da; border-radius: 6px; background: #fff;
    color: #52606d; font-size: 14px; line-height: 1; cursor: pointer; padding: 4px 8px;
  }
  .filterRow button:hover { background: #eef1f5; color: #1f2933; }
  .filterCount { flex: none; font-size: 11px; color: #667085; min-width: 46px; text-align: right; }
  /* Shortcuts help, pinned bottom-right, clear of the metrics tooltip (top-right). */
  #shortcuts {
    position: fixed; bottom: 16px; right: 16px; z-index: 2;
    max-width: 340px; text-align: right;
    font-size: 11.5px; line-height: 1.5; color: #52606d;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(140, 148, 160, 0.4);
    border-radius: 8px; padding: 9px 12px;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(10px);
    pointer-events: none;
  }
  @media (max-width: 720px) { #shortcuts { display: none; } }
  label {
    display: grid;
    gap: 3px;
    color: #52606d;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  select {
    min-width: 0;
    border: 1px solid #c8d0da;
    border-radius: 6px;
    background: #fff;
    color: #1f2933;
    font-size: 13px;
    padding: 6px 8px;
  }
  /* Class-metrics tooltip: pinned to the top-right corner (was cursor-following).
     An identity header (class name / folder / package) sits above the metrics list;
     max-width bounds the panel so a long package wraps instead of widening it. */
  #hover {
    position: fixed;
    top: 16px;
    right: 16px;
    left: auto;
    bottom: auto;
    z-index: 2;
    max-width: min(320px, calc(100vw - 32px));
    pointer-events: none;
    background: rgba(17, 24, 39, 0.84);
    color: #fff;
    border-radius: 8px;
    padding: 9px 11px;
    font-size: 12px;
    line-height: 1.45;
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity 120ms ease, transform 120ms ease;
  }
  #hover.visible {
    opacity: 1;
    transform: translateY(0);
  }
  /* Identity header above the metrics: class name (bold) / folder / package.
     The class + package used to live in a top-center #classTitle banner; that
     banner is gone and its info now lives here, inside the metrics panel. */
  #hover .idhdr {
    margin: 0 0 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  }
  #hover .idhdr .cls {
    display: block;
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 3px;
  }
  /* Module + source-root prefix (dir minus the Java package): dimmer, smaller. */
  #hover .idhdr .folder {
    color: #8b98ad;
    font-size: 10.5px;
    line-height: 1.3;
    margin: 0 0 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }
  /* Dotted package: MUST wrap within the fixed panel width, never widen #hover. */
  #hover .idhdr .pkg {
    color: #aab4c8;
    font-size: 11px;
    line-height: 1.3;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }
  #hover b {
    display: block;
    font-size: 13px;
    margin-bottom: 3px;
  }
  #hover .fqn {
    display: block;
    margin-bottom: 4px;
    color: #aab4c8;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  /* Hover body: every metric on its own bullet. The three metrics currently
     driving the city (area / height / colour) carry a trailing marker so the
     encoding reads straight off the list. */
  #hover .props {
    list-style: none;
    margin: 5px 0 0;
    padding: 5px 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.16);
  }
  #hover .props li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 0;
    color: #cbd5e1;
    font-size: 11.5px;
  }
  /* Values are inline here — override the block/large styling #hover b gives the name. */
  #hover .props b { display: inline; font-size: inherit; margin: 0; font-weight: 700; }
  #hover .props li::before {
    content: "\\2022";
    color: #64748b;
    flex: none;
    width: 8px;
    text-align: center;
  }
  #hover .props li.on { color: #f1f5f9; font-weight: 600; }
  #hover .props .marks {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    padding-left: 12px;
  }
  #hover .props .mk-area, #hover .props .mk-height { font-size: 12.5px; line-height: 1; }
  /* Colour metric marker: a mini light->red scale with a tick at this building's spot. */
  #hover .cbar {
    position: relative;
    display: inline-block;
    width: 56px;
    height: 11px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    background: linear-gradient(to right, #e8eefc, #800020);
  }
  #hover .cbar-mark {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 3px;
    transform: translateX(-50%);
    background: #fff;
    border: 1px solid #0f172a;
    border-radius: 1px;
  }
  .city-label {
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(17, 24, 39, 0.86);
    color: #fff;
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
    text-align: center;
    line-height: 1.25;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.28);
  }
  /* Floating package tag — deliberately a different look from the dark class pills:
     a deep-blue rounded capsule so a package name never reads as a class name. */
  .district-label {
    padding: 2px 9px;
    border-radius: 999px;
    background: rgba(30, 58, 138, 0.92);
    color: #eaf1ff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
    pointer-events: none;
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  /* Drill-down breadcrumb: the path from the whole repo to the package now in view. */
  .breadcrumb {
    position: fixed;
    left: 16px;
    top: calc(16px + var(--panel-h, 132px));
    z-index: 3;
    max-width: min(430px, calc(100vw - 32px));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(140, 148, 160, 0.45);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(10px);
    padding: 6px 8px;
  }
  .breadcrumb[hidden] { display: none; }
  .crumb {
    border: none;
    background: transparent;
    color: #1e3a8a;
    font-size: 12px;
    font-weight: 650;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 2px 5px;
    border-radius: 5px;
    cursor: pointer;
    white-space: nowrap;
  }
  .crumb:hover { background: #e6edfb; }
  .crumb-current { color: #1f2933; cursor: default; }
  .crumb-current:hover { background: transparent; }
  .crumb-sep { color: #9aa5b5; font-size: 12px; }
  .howto-toggle {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 3;
    border: 1px solid #c2cad6;
    border-radius: 8px;
    background: #ffffff;
    color: #1e3a8a;
    font-size: 12px;
    font-weight: 650;
    padding: 7px 11px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
    transition: background 120ms ease, color 120ms ease;
  }
  .howto-toggle:hover { background: #1e3a8a; color: #fff; }
  /* First-run intro overlay: an annotated building wired to the metric selectors. */
  #intro {
    position: fixed;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    opacity: 0;
    transition: opacity 300ms ease;
  }
  #intro.visible { opacity: 1; }
  #intro.hide { opacity: 0; }
  #intro svg { position: absolute; inset: 0; }
  #intro text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .intro-head {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(17, 24, 39, 0.9);
    color: #fff;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 650;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
  }
  .intro-dismiss {
    position: absolute;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: auto;
    cursor: pointer;
    background: #1e3a8a;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 9px 18px;
    font-size: 13px;
    font-weight: 650;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
  }
  .intro-dismiss:hover { background: #16306e; }
  .howto {
    position: fixed;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.42);
    backdrop-filter: blur(2px);
  }
  .howto[hidden] { display: none; }
  .howto-card {
    position: relative;
    width: min(740px, calc(100vw - 40px));
    max-height: calc(100vh - 60px);
    overflow: auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.4);
    padding: 22px 24px 24px;
  }
  .howto-card h2 { margin: 0 0 4px; font-size: 18px; }
  .howto-card h3 { margin: 18px 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #475467; }
  .howto-card p, .howto-card li { font-size: 13.5px; line-height: 1.5; color: #344054; }
  .howto-card p { margin: 0 0 12px; }
  .howto-card ol { margin: 0 0 12px; padding-left: 20px; }
  .howto-card li { margin: 0 0 5px; }
  .howto-close {
    position: absolute;
    top: 12px;
    right: 14px;
    border: none;
    background: transparent;
    font-size: 24px;
    line-height: 1;
    color: #98a2b3;
    cursor: pointer;
  }
  .howto-close:hover { color: #1f2933; }
  .howto-cmd { position: relative; margin: 0 0 8px; }
  .howto-cmd pre {
    margin: 0;
    padding: 14px 44px 14px 16px;
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    line-height: 1.55;
    overflow-x: auto;
    white-space: pre;
  }
  .howto-copy {
    position: absolute;
    top: 10px;
    right: 10px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #e2e8f0;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    padding: 5px 10px;
    cursor: pointer;
  }
  .howto-copy:hover { background: #334155; }
  .howto-note { font-size: 12px !important; color: #667085 !important; }
  .howto code {
    background: #eef1f5;
    border-radius: 4px;
    padding: 1px 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92em;
  }
</style>
</head>
<body>
<div id="scene"></div>
<aside id="shortcuts" aria-label="controls help">
  Drag to pan<br>
  Cmd/Ctrl-drag to rotate<br>
  Scroll to zoom<br>
  Shift-click a floor/building to zoom in<br>
  Shift-click the ground (or Esc / breadcrumb) to step out<br>
  Cmd/Ctrl-double-click opens a file in VS Code
</aside>
<section class="panel">
  <h1>__LOGO_SVG__<span>__TITLE__</span><select id="viewMode" class="titleView"
      aria-label="what a building represents">
      <option value="classes" selected>Classes</option>
      <option value="packages" id="packageOpt">Packages</option>
      <option value="modules" id="moduleOpt">Modules (Maven/Gradle)</option>
    </select></h1>
  <div class="controls">
    <label>
      Color
      <select id="colorMetric">
        <option value="complexity_per_kloc">cognitive complexity / KLOC</option>
        <option value="bugs_per_kloc">bugfix commits / KLOC</option>
        <option value="commits_per_kloc" selected>total commits / KLOC</option>
        <option value="committers">committers</option>
        <option value="instability">instability Ce/(Ce+Ca)</option>
        <option value="fan_in">incoming coupling (fan in)</option>
        <option value="fan_out">outgoing coupling (fan out)</option>
      </select>
    </label>
    <label>
      Height
      <select id="heightMetric">
        <option value="lines">lines of code (LOC)</option>
        <option value="cognitive_complexity" selected>cognitive complexity</option>
        <option value="bug_commits">bugfix commits</option>
        <option value="commits">total commits</option>
        <option value="committers">committers</option>
        <option value="fan_in">incoming coupling (fan in)</option>
        <option value="fan_out">outgoing coupling (fan out)</option>
        <option value="instability">instability Ce/(Ce+Ca)</option>
      </select>
    </label>
    <label>
      Area
      <select id="areaMetric">
        <option value="bytes" selected>file size</option>
        <option value="lines">lines of code (LOC)</option>
        <option value="cognitive_complexity">cognitive complexity</option>
        <option value="commits">total commits</option>
        <option value="committers">committers</option>
        <option value="fan_out">outgoing coupling (fan out)</option>
      </select>
    </label>
  </div>
  <div class="filterRow">
    <input id="pkgFilter" type="text" spellcheck="false" autocomplete="off"
           placeholder="filter e.g. victor..*Service &middot; ..repo.. &middot; *Service">
    <button id="pkgFilterClear" type="button" title="clear filter" hidden>&times;</button>
    <span id="pkgFilterCount" class="filterCount"></span>
  </div>
  <div class="viewOf pkgRow">
    <span>Package labels:</span>
    <select id="pkgLabelMode" aria-label="package label style">
      <option value="floating" selected>floating tags</option>
      <option value="floor">on the floor (edges)</option>
      <option value="off">off</option>
    </select>
  </div>
</section>
<nav id="breadcrumb" class="breadcrumb" hidden aria-label="package scope"></nav>
<button id="howtoToggle" class="howto-toggle" type="button" aria-expanded="false" aria-controls="howto">
  &#9874; Build for your repo
</button>
<section class="howto" id="howto" hidden>
  <div class="howto-card" role="dialog" aria-modal="true" aria-labelledby="howtoTitle">
    <button class="howto-close" id="howtoClose" type="button" aria-label="Close">&times;</button>
    <h2 id="howtoTitle">Build a Code City for any source folder</h2>
    <p>This page is a self-contained snapshot of one repository. The same generators
      turn <em>any</em> folder of Java sources into this 3-D city &mdash; a building per
      file, grouped into districts by package. Point the pipeline at another repo and
      open the result:</p>
    <div class="howto-cmd">
      <button class="howto-copy" id="howtoCopy" type="button">Copy</button>
      <pre id="howtoPre"></pre>
    </div>
    <h3>What it does</h3>
    <ol>
      <li><code>compute_complexity.py</code> / <code>compute_fanio.py</code> &mdash; per-file
        cognitive complexity (Sonar-style) and internal fan-in/out (tree-sitter).</li>
      <li><code>build_heatmap.py</code> &mdash; joins git history (commits, <code>fix:</code>
        commits) and file size into <code>codemap.tsv</code>.</li>
      <li><code>render_codecity.py</code> &mdash; extrudes each file into a building and
        writes this self-contained <code>codecity.html</code> (Three.js, all data inline).</li>
    </ol>
    <p class="howto-note">Java sources only. Re-run anytime to refresh. <code>open</code> is
      macOS &mdash; use <code>xdg-open</code> on Linux or <code>start</code> on Windows.
      &#8984;/Ctrl-double-click a building in the city to jump to its file in VS Code.</p>
  </div>
</section>
<div id="hover"></div>

<script>
const FILES = __FILES_JSON__;
const PACKAGES = __PACKAGES_JSON__;   // per-package rows (same shape) for package mode
const MODULES = __MODULES_JSON__;     // per-Maven/Gradle-module rows (same shape) for module mode
const REPO_ABS = __REPO_ABS__;
const BUILD_CMD = __BUILD_CMD__;

// The active COLOR metric's p95 scale max, mirrored out of rebuildCity so the
// hover tooltip's colour-scale marker can place this building on the ramp.
let activeColorMax = 1;

// "Build this for your own repo" overlay: reveal the copy-pasteable recipe and let the
// reader run the very pipeline that produced this page against any other source folder.
(function wireHowto() {
  const howto = document.getElementById("howto");
  const toggle = document.getElementById("howtoToggle");
  const close = document.getElementById("howtoClose");
  const copy = document.getElementById("howtoCopy");
  document.getElementById("howtoPre").textContent = BUILD_CMD;

  const open = () => { howto.hidden = false; toggle.setAttribute("aria-expanded", "true"); };
  const dismiss = () => { howto.hidden = true; toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", open);
  close.addEventListener("click", dismiss);
  howto.addEventListener("click", (e) => { if (e.target === howto) dismiss(); });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !howto.hidden) dismiss(); });

  copy.addEventListener("click", () => {
    const done = () => { copy.textContent = "Copied!"; setTimeout(() => { copy.textContent = "Copy"; }, 1400); };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = BUILD_CMD;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (_) { /* ignore */ }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(BUILD_CMD).then(done).catch(fallback);
    } else {
      fallback();
    }
  });
})();
</script>
<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const mount = document.getElementById("scene");
const hover = document.getElementById("hover");
const areaSelect = document.getElementById("areaMetric");
const heightSelect = document.getElementById("heightMetric");
const colorSelect = document.getElementById("colorMetric");
const viewSelect = document.getElementById("viewMode");   // the title-row view switch
const packageOpt = document.getElementById("packageOpt");
const moduleOpt = document.getElementById("moduleOpt");
const pkgLabelSelect = document.getElementById("pkgLabelMode");
const filterInput = document.getElementById("pkgFilter");
const filterClearBtn = document.getElementById("pkgFilterClear");
const filterCountEl = document.getElementById("pkgFilterCount");
if (packageOpt && !PACKAGES.length) packageOpt.disabled = true;   // no package data → option greyed
if (moduleOpt && MODULES.length < 2) moduleOpt.disabled = true;   // <2 modules → nothing to compare
// The dropdown swaps which rows the treemap/floor/building machinery renders:
// class rows, package rows (a building per package on its parent-package floor),
// or module rows (a building per Maven/Gradle module). Falls back to classes.
function activeDataset() {
  const v = viewSelect ? viewSelect.value : "classes";
  if (v === "packages" && PACKAGES.length) return PACKAGES;
  if (v === "modules" && MODULES.length) return MODULES;
  return FILES;
}

// ── Package-pattern filter ───────────────────────────────────────────────────
// AspectJ-ish globs over the row's fully-qualified name: '..' and '*' are
// wildcards (any run of chars), '.' is a literal dot; whole-string, case-insensitive.
// e.g. victor..*Service · ..repo.. · *Service
let filterRe = null;
function rowFqn(file) {
  const d = file.district && file.district !== "root" ? file.district : "";
  return d ? d + "." + file.name : file.name;
}
function patternToRegExp(pat) {
  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const ch = pat[i];
    if (ch === "." && pat[i + 1] === ".") { re += ".*"; i++; }    // '..' → any packages, incl. dots
    else if (ch === ".") { re += "\\."; }                        // literal dot between segments
    else if (ch === "*") { re += ".*"; }                          // '*' → any chars
    else if (ch === "$") { re += "\\$"; }                        // literal $ (nested-class separator)
    else re += ch;
  }
  return new RegExp("^" + re + "$", "i");
}
function filteredDataset() {
  const data = activeDataset();
  return filterRe ? data.filter(f => filterRe.test(rowFqn(f))) : data;
}
const citySize = 900;
const districtGap = 14;
const fileGap = 3;
const districtStep = 6;
const maxHeight = 190;
const minHeight = 5;
let buildings = [];
let districts = [];
let cityLabels = [];
let districtLabels = [];   // floating package tags (CSS2DObjects), when pkgLabelMode = "floating"

// ── Cross-view link with the 2D codemap (when embedded side by side) ──────────
// The parent "combined" page bridges hover selection between this city and the
// Plotly codemap: hovering a file in one highlights the SAME file in the other.
// We speak only to window.parent (a hub) and stay silent/inert when opened alone.
const EMBEDDED = window.parent && window.parent !== window;
let externalHighlightPath = null;   // file the codemap is currently pointing at
let lastPostedPath = undefined;     // dedupe: only announce hover changes, not every mousemove

function postCityHover(path) {
  if (!EMBEDDED || path === lastPostedPath) return;
  lastPostedPath = path;
  window.parent.postMessage({ codemapLink: true, from: "city", path: path || null }, "*");
}

// Paint the externally-selected building with a distinct gold emissive so it
// stands apart from the burgundy local-hover glow. No-op if it isn't on screen.
function applyExternalHighlight() {
  if (!externalHighlightPath) return;
  for (const entry of buildings) {
    if (entry.file.path === externalHighlightPath) entry.mesh.material.emissive.setHex(0xd4a017);
  }
}

if (EMBEDDED) {
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.codemapLink !== true || d.from === "city") return;   // ignore our own echoes
    externalHighlightPath = d.path || null;
    for (const entry of buildings) entry.mesh.material.emissive.setHex(0x000000);
    applyExternalHighlight();
  });
}

// Testability hook: the emissive hex of a building by file path (gold "d4a017"
// when the codemap is spotlighting it). Mirrors the existing __CODEMAP_3D_READY__.
window.__cityEmissiveOf = (path) => {
  for (const entry of buildings) {
    if (entry.file.path === path) return entry.mesh.material.emissive.getHexString();
  }
  return null;
};

// Drill-down scope: the dotted package the city is currently restricted to ("" = whole repo).
// Clicking a floor/building re-roots the treemap here so the chosen package fills the full plot.
const breadcrumbEl = document.getElementById("breadcrumb");
let scopePath = "";
let pointerDownAt = null;   // screen coords of the last pointerdown, to tell a click from a drag
let lastScopeAt = -1e9;     // timestamp of the last drill, to swallow the 2nd click of a double-click
let districtByName = new Map();   // full package path -> its platform mesh (for hover glow)
let glowingDistrict = null;       // the platform currently lit while Shift previews a drill target
const NAV_KEY = "shiftKey";       // hold Shift + click to enter/leave a package

function inScope(file) {
  return scopePath === "" || file.district === scopePath || file.district.startsWith(scopePath + ".");
}

// Package segments of `file` *below* the current scope (so nesting depth resets when drilled in).
function scopedParts(file) {
  const d = file.district;
  if (scopePath === "") return d ? d.split(".") : [];
  if (d === scopePath) return [];
  return d.slice(scopePath.length + 1).split(".");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f5f7);
scene.fog = new THREE.Fog(0xf4f5f7, 900, 2200);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
camera.position.set(720, 620, 760);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
mount.appendChild(renderer.domElement);
renderer.domElement.style.cursor = "move";

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "fixed";
labelRenderer.domElement.style.inset = "0";
labelRenderer.domElement.style.pointerEvents = "none";
mount.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = true;
controls.zoomToCursor = true;
controls.minDistance = 140;
controls.maxDistance = 1900;
controls.target.set(0, 0, 0);
controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.update();

// OrbitControls inverts the LEFT action when a modifier is held: with LEFT=PAN,
// Cmd/Ctrl-drag automatically becomes an orbit. We only re-center the pivot so the
// orbit spins around the point in the middle of the viewport.
function setRotationPivotToViewportCenter() {
  centerRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
  if (centerRaycaster.ray.intersectPlane(groundPlane, rotationPivot)) {
    controls.target.copy(rotationPivot);
    controls.update();
  }
}

function onPointerDown(event) {
  pointerDownAt = { x: event.clientX, y: event.clientY };
  if (event.metaKey || event.ctrlKey) {
    setRotationPivotToViewportCenter();
  }
}

// Move cursor by default (you can pan); a circular-arrow cursor while Cmd/Ctrl is
// held to hint that dragging now orbits the camera.
const ROTATE_CURSOR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>" +
  "<g fill='none' stroke-linecap='round' stroke-linejoin='round'>" +
  "<path d='M21 8 A9 9 0 1 0 22.7 14' stroke='#ffffff' stroke-width='5'/>" +
  "<path d='M21.4 2.6 21 8 15.8 7.4' stroke='#ffffff' stroke-width='5'/>" +
  "<path d='M21 8 A9 9 0 1 0 22.7 14' stroke='#111827' stroke-width='2.4'/>" +
  "<path d='M21.4 2.6 21 8 15.8 7.4' stroke='#111827' stroke-width='2.4'/>" +
  "</g></svg>";
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ROTATE_CURSOR_SVG)}") 14 14, grab`;

function updateCursor(event) {
  renderer.domElement.style.cursor = (event.metaKey || event.ctrlKey) ? ROTATE_CURSOR : "move";
}

function updatePointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function pickBuilding(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(buildings.map(b => b.mesh), false)[0] || null;
}

function openInEditor(rel) {
  const abs = REPO_ABS + "/" + rel;
  window.location.href = "vscode://file" + encodeURI(abs);
}

scene.add(new THREE.HemisphereLight(0xffffff, 0x8592a3, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-420, 780, 520);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -650;
sun.shadow.camera.right = 650;
sun.shadow.camera.top = 650;
sun.shadow.camera.bottom = -650;
scene.add(sun);

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0xb8bdc3,
  roughness: 0.74,
  metalness: 0.02,
});
const ground = new THREE.Mesh(new THREE.BoxGeometry(citySize + 36, 8, citySize + 36), groundMaterial);
ground.position.y = -5;
ground.receiveShadow = true;
scene.add(ground);

const raycaster = new THREE.Raycaster();
const centerRaycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const rotationPivot = new THREE.Vector3();

function percentile(values, p) {
  const sorted = values.filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function metricMax(key) {
  return percentile(filteredDataset().map(f => Number(f[key]) || 0), 0.95);
}

function colorFor(value, max) {
  const t = Math.max(0, Math.min(1, value / (max || 1)));
  // Light blue (0) -> burgundy red (max): the city reads light with hot spots in red.
  return new THREE.Color(0xe8eefc).lerp(new THREE.Color(0x800020), t);
}

// A hatch pattern for a terrace top: parallel lines in the terrace edge colour,
// their direction rotating with the nesting level so each floor is distinguishable.
function hatchTexture(edgeColor, level) {
  const size = 64;
  const gap = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e8eefc";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#" + edgeColor.getHexString();
  ctx.lineWidth = 3;
  ctx.beginPath();
  const dir = level % 4;
  if (dir === 0) {
    for (let y = gap / 2; y < size; y += gap) { ctx.moveTo(0, y); ctx.lineTo(size, y); }
  } else if (dir === 2) {
    for (let x = gap / 2; x < size; x += gap) { ctx.moveTo(x, 0); ctx.lineTo(x, size); }
  } else if (dir === 1) {
    for (let k = -size; k < size * 2; k += gap) { ctx.moveTo(k, size); ctx.lineTo(k + size, 0); }
  } else {
    for (let k = -size; k < size * 2; k += gap) { ctx.moveTo(k, 0); ctx.lineTo(k + size, size); }
  }
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function insertPackage(parent, parts, file, areaMetric) {
  if (parts.length === 0) {
    parent.children.push({ name: file.name, value: Math.max(1, Number(file[areaMetric]) || 0), file });
    return;
  }
  const name = parts[0];
  let child = parent.children.find(c => c.name === name && !c.file);
  if (!child) {
    child = {
      name,
      packageName: parent.packageName ? `${parent.packageName}.${name}` : name,
      children: [],
    };
    parent.children.push(child);
  }
  insertPackage(child, parts.slice(1), file, areaMetric);
}

function buildHierarchy(areaMetric) {
  // Seed the root's packageName with the scope so every district still carries its
  // absolute dotted path (needed for further drill-in and hover labels), while the
  // *layout* depth restarts at the scope so a drilled-in package fills the plot.
  const root = { name: "root", packageName: scopePath, children: [] };
  for (const file of filteredDataset()) {
    if (!inScope(file)) continue;
    insertPackage(root, scopedParts(file), file, areaMetric);
  }
  return d3.hierarchy(root)
    .sum(d => d.value || 0)
    .sort((a, b) => b.value - a.value);
}

function clearCity() {
  for (const label of cityLabels) {
    label.obj.removeFromParent();
    label.el.remove();
  }
  cityLabels = [];
  for (const label of districtLabels) {
    label.removeFromParent();
    if (label.element) label.element.remove();
  }
  districtLabels = [];
  for (const entry of buildings) {
    scene.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    entry.mesh.material.dispose();
  }
  buildings = [];
  districts = [];
  districtByName = new Map();
  glowingDistrict = null;
  for (const object of [...scene.children]) {
    if (object.userData.kind === "package") {
      scene.remove(object);
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      } else {
        object.material.dispose();
      }
    }
  }
}

function rebuildCity() {
  clearCity();
  const areaMetric = areaSelect.value;
  const heightMetric = heightSelect.value;
  const colorMetric = colorSelect.value;
  const maxMetric = metricMax(heightMetric);
  const maxColor = metricMax(colorMetric);
  activeColorMax = maxColor;   // remembered for the hover tooltip's colour-scale marker

  const layout = d3.treemap()
    .size([citySize, citySize])
    .paddingOuter(districtGap)
    .paddingInner(fileGap)
    .round(true);
  const root = layout(buildHierarchy(areaMetric));

  // Each package becomes a terraced platform: the deeper it is nested, the higher
  // it rises, so a parent package (e.g. victor) visibly contains its children
  // (rest, mapper, ...). A thin outline delimits every package from its siblings.
  _floorLabelBudget = 240;   // cap flat floor-text planes per rebuild (perf on big cities)
  _floorLabelBoxes = [];     // fresh overlap map for this rebuild's floor labels
  for (const node of root.descendants()) {
    if (node === root || !node.children) {
      continue;
    }
    const level = Math.max(0, node.depth - 1);
    const width = Math.max(2, node.x1 - node.x0);
    const depth = Math.max(2, node.y1 - node.y0);
    const slab = districtStep + 2;
    const topY = node.depth * districtStep;
    const cx = node.x0 + width / 2 - citySize / 2;
    const cz = node.y0 + depth / 2 - citySize / 2;
    // Heat-colour the riser (vertical "height" faces) with the same scale as the
    // buildings; hatch the light top surface with lines in that same edge colour,
    // rotating the hatch direction per nesting level so each floor stands apart.
    const leaves = node.leaves();
    const avgColor = leaves.reduce((sum, l) => sum + (Number(l.data.file[colorMetric]) || 0), 0) / leaves.length;
    const edgeColor = colorFor(avgColor, maxColor);
    const sideMaterial = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: 0.85 });
    const topTexture = hatchTexture(edgeColor, level);
    topTexture.repeat.set(width / 50, depth / 50);
    const topMaterial = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.9 });
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(width, slab, depth),
      [sideMaterial, sideMaterial, topMaterial, topMaterial, sideMaterial, sideMaterial]
    );
    block.position.set(cx, topY - slab / 2, cz);
    block.receiveShadow = true;
    block.userData.kind = "package";
    block.userData.name = node.data.packageName || node.data.name;
    block.userData.fileCount = node.leaves().length;
    scene.add(block);
    districts.push(block);
    districtByName.set(block.userData.name, block);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(block.geometry),
      new THREE.LineBasicMaterial({ color: 0xcdd6e4, transparent: true, opacity: 0.45 })
    );
    outline.position.copy(block.position);
    outline.userData.kind = "package";
    scene.add(outline);

    addPackageLabel(node, cx, cz, topY, width, depth);
  }

  for (const leaf of root.leaves()) {
    const file = leaf.data.file;
    const width = Math.max(4, leaf.x1 - leaf.x0 - 1);
    const depth = Math.max(4, leaf.y1 - leaf.y0 - 1);
    const metricValue = Number(file[heightMetric]) || 0;
    const colorValue = Number(file[colorMetric]) || 0;
    const height = minHeight + Math.pow(metricValue / (maxMetric || 1), 0.62) * maxHeight;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: colorFor(colorValue, maxColor),
      roughness: 0.58,
      metalness: 0.06,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const baseY = leaf.parent.depth * districtStep;
    mesh.position.set(
      leaf.x0 + (leaf.x1 - leaf.x0) / 2 - citySize / 2,
      baseY + height / 2,
      leaf.y0 + (leaf.y1 - leaf.y0) / 2 - citySize / 2
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.file = file;
    mesh.userData.baseColor = material.color.clone();
    scene.add(mesh);
    buildings.push({ mesh, file, height });
  }
  setupLabels(areaMetric, heightMetric, colorMetric);
  if (filterCountEl) filterCountEl.textContent = filterRe ? buildings.length + " shown" : "";
  window.__CODEMAP_3D_READY__ = {
    buildings: buildings.length,
    areaMetric,
    heightMetric,
    colorMetric,
  };
}

const LABEL_GAP = 4;          // px breathing room required between two labels
// Measure label width without touching the DOM (matches the .city-label font).
const _labelMeasure = document.createElement("canvas").getContext("2d");
_labelMeasure.font = "700 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Persistent labels show ONLY the class name — every metric lives in the hover now.
function makeLabel(entry, priority) {
  const div = document.createElement("div");
  div.className = "city-label";
  div.textContent = entry.file.name;
  const obj = new CSS2DObject(div);
  obj.position.set(entry.mesh.position.x, entry.mesh.position.y + entry.height / 2 + 16, entry.mesh.position.z);
  obj.center.set(0.5, 1);
  obj.visible = false;        // shown later, only if it survives de-overlap
  scene.add(obj);
  cityLabels.push({
    obj, el: div, priority,
    w: _labelMeasure.measureText(entry.file.name).width + 16,   // + .city-label horizontal padding
    h: 22,                    // single line
  });
}

// Candidate labels: the per-metric standouts (always) plus the tallest buildings, up to a
// generous cap. Visibility is resolved per-frame in updateLabelVisibility, so the more the
// camera zooms into an area (buildings spread apart on screen), the more names surface.
function setupLabels(areaMetric, heightMetric, colorMetric) {
  const chosen = new Set();
  for (const metric of [areaMetric, heightMetric, colorMetric]) {
    let best = null, bestValue = -Infinity;
    for (const entry of buildings) {
      const value = Number(entry.file[metric]) || 0;
      if (value > bestValue) { bestValue = value; best = entry; }
    }
    if (best) chosen.add(best);
  }
  const cap = Math.min(buildings.length, 400);   // many candidates → de-overlap reveals more on zoom
  for (const entry of [...buildings].sort((a, b) => b.height - a.height)) {
    if (chosen.size >= cap) break;
    chosen.add(entry);
  }
  let priority = 0;
  for (const entry of chosen) makeLabel(entry, priority++);   // standouts first = highest priority
}

// Greedy screen-space de-overlap: walk candidates by priority, show one only if its
// box clears every higher-priority box already shown; hide the rest. Runs each frame.
const _labelNdc = new THREE.Vector3();
function updateLabelVisibility() {
  if (introEl) {                                  // keep the intro screen clean
    for (const L of cityLabels) L.obj.visible = false;
    return;
  }
  const W = window.innerWidth, H = window.innerHeight;
  const placed = [];
  for (const L of cityLabels) {
    _labelNdc.copy(L.obj.position).project(camera);
    if (_labelNdc.z < -1 || _labelNdc.z > 1) { L.obj.visible = false; continue; }
    const x = (_labelNdc.x * 0.5 + 0.5) * W;
    const y = (-_labelNdc.y * 0.5 + 0.5) * H;
    const box = { left: x - L.w / 2, right: x + L.w / 2, top: y - L.h, bottom: y };
    let clash = false;
    for (const p of placed) {
      if (box.left < p.right + LABEL_GAP && box.right > p.left - LABEL_GAP &&
          box.top < p.bottom + LABEL_GAP && box.bottom > p.top - LABEL_GAP) { clash = true; break; }
    }
    L.obj.visible = !clash;
    if (!clash) placed.push(box);
  }
}

// ── Package-name labels (two switchable styles) ──────────────────────────────
// "floating": a deep-blue capsule (see .district-label) hovering over the floor —
//   deliberately unlike the dark class pills so a package never reads as a class.
// "floor": the name laid FLAT on the platform top, centered along its EDGES (and,
//   when it still fits without colliding, its corners), read along X or Z so it
//   stays legible from any orbit angle. A global overlap check keeps labels apart.
const _floorTexCache = new Map();   // "name|hex" -> {tex,w,h}; kept across rebuilds
let _floorLabelBudget = 0;          // reset per rebuild in rebuildCity (perf cap)
let _floorLabelBoxes = [];          // XZ AABBs of placed floor labels this rebuild — prevents overlap

function floorTextTexture(text) {
  const hit = _floorTexCache.get(text);
  if (hit) return hit;
  const font = 44, pad = 10;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  measure.font = `700 ${font}px ui-monospace, Menlo, monospace`;
  const w = Math.ceil(measure.measureText(text).width) + pad * 2;
  const h = font + pad * 2;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.font = `700 ${font}px ui-monospace, Menlo, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  // Dark ink + thick white halo: reads on the light floor whatever the package's metric colour.
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = "#1f2937";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const entry = { tex, w, h };
  _floorTexCache.set(text, entry);
  return entry;
}

function addFloorName(text, cx, cz, topY, width, depth) {
  if (width < 46 || depth < 46) return;              // too small to hold the text — skip
  const { tex, w, h } = floorTextTexture(text);
  const worldH = Math.min(16, depth * 0.16, width * 0.16);
  const worldW = worldH * (w / h);
  const fitsX = worldW <= width * 0.92;              // fits when read along X (yaw 0)
  const fitsZ = worldW <= depth * 0.92;              // fits when read along Z (yaw 90°)
  if (!fitsX && !fitsZ) return;                      // wouldn't fit along any edge
  const halfW = width / 2, halfD = depth / 2, inset = 2;
  const offX = halfW - worldH / 2 - inset;           // center-to-edge offset, perpendicular to the label
  const offZ = halfD - worldH / 2 - inset;
  // Preferred: one label centered on each edge that can hold it, running parallel to it.
  const candidates = [];
  if (fitsX) {
    candidates.push({ x: cx, z: cz - offZ, yaw: 0 });               // bottom edge, reads along X
    candidates.push({ x: cx, z: cz + offZ, yaw: 0 });               // top edge, reads along X
  }
  if (fitsZ) {
    candidates.push({ x: cx - offX, z: cz, yaw: Math.PI / 2 });     // left edge, reads along Z
    candidates.push({ x: cx + offX, z: cz, yaw: Math.PI / 2 });     // right edge, reads along Z
  }
  // Corners are a bonus: only taken when the label still fits there without colliding.
  const cyaw = fitsX ? 0 : Math.PI / 2;
  const cmX = cyaw === 0 ? worldW / 2 : worldH / 2;
  const cmZ = cyaw === 0 ? worldH / 2 : worldW / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    candidates.push({ x: cx + sx * (halfW - cmX - inset), z: cz + sz * (halfD - cmZ - inset), yaw: cyaw });
  }
  let placed = 0;
  for (const c of candidates) {
    if (placed >= 4 || _floorLabelBudget <= 0) return;
    if (placeFloorLabelMesh(tex, worldW, worldH, c.x, c.z, c.yaw, topY)) placed++;
  }
}

// Lay one flat label plane only if its footprint clears every floor label already placed
// this rebuild — the global overlap guard that keeps package names from crowding.
function placeFloorLabelMesh(tex, worldW, worldH, x, z, yaw, topY) {
  const alongX = yaw === 0;
  const spanX = alongX ? worldW : worldH;
  const spanZ = alongX ? worldH : worldW;
  const box = { minX: x - spanX / 2, maxX: x + spanX / 2, minZ: z - spanZ / 2, maxZ: z + spanZ / 2 };
  for (const b of _floorLabelBoxes) {
    if (box.minX < b.maxX && box.maxX > b.minX && box.minZ < b.maxZ && box.maxZ > b.minZ) return false;
  }
  _floorLabelBudget--;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;                    // lay flat on the platform top
  mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), yaw);   // run along X (0) or Z (90°)
  mesh.position.set(x, topY + 0.6, z);
  mesh.renderOrder = 3;
  mesh.userData.kind = "package";                    // disposed by clearCity's package sweep
  scene.add(mesh);
  _floorLabelBoxes.push(box);
  return true;
}

function addPackageLabel(node, cx, cz, topY, width, depth) {
  const mode = pkgLabelSelect ? pkgLabelSelect.value : "floating";
  if (mode === "off") return;
  const full = node.data.packageName || node.data.name || "";
  const shortName = full.split(".").pop();
  if (!shortName) return;
  if (mode === "floor") {
    addFloorName(shortName, cx, cz, topY, width, depth);
    return;
  }
  const div = document.createElement("div");     // "floating"
  div.className = "district-label";
  div.textContent = shortName;
  const obj = new CSS2DObject(div);
  obj.position.set(cx, topY + 12, cz);
  obj.center.set(0.5, 1);
  scene.add(obj);
  districtLabels.push(obj);
}

// The dotted Java package of a class row lives in `district` ("root" means none).
function packageOf(file) {
  return file.district && file.district !== "root" ? file.district : "";
}

// Folder = the file's repo-relative directory MINUS the trailing segments that
// spell out its Java package, i.e. the module + source root that precedes the
// package. e.g. path ".../ModulabGoldServerWeb/src/main/java/com/systelab/.../request"
// with package "com.systelab...request" → "ModulabGoldServerWeb/src/main/java".
// No package (or no dir) → fall back to the whole directory.
function folderPrefix(path, pkg) {
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash) : "";
  if (!dir) return "";
  if (!pkg) return dir;
  const dirSegs = dir.split("/");
  const keep = dirSegs.length - pkg.split(".").length;
  return keep > 0 ? dirSegs.slice(0, keep).join("/") : dir;
}

// The 3-line identity header shown above the metrics: class name (bold), the
// module/source-root folder (dimmer), and the dotted package (wraps in-panel).
// Folder/package lines only render when non-empty.
function identityHeader(name, folder, pkg) {
  let html = `<b class="cls">${escapeXml(name)}</b>`;
  if (folder) html += `<div class="folder">${escapeXml(folder)}</div>`;
  if (pkg) html += `<div class="pkg">${escapeXml(pkg)}</div>`;
  return `<div class="idhdr">${html}</div>`;
}

// Header for a building. In Classes view the building is a file: name is the
// simple class name, folder is its module+source root, package is the dotted
// package. In Packages/Modules view the building IS a package/module: show its
// name as the title and its full dotted/dir path as the package line, no folder.
function hoverHeaderForFile(file) {
  const view = viewSelect ? viewSelect.value : "classes";
  if (view === "classes") {
    const pkg = packageOf(file);
    return identityHeader(file.name, folderPrefix(file.path, pkg), pkg);
  }
  const fullPath = file.path && file.path !== "." ? file.path : "";
  return identityHeader(file.name, "", fullPath);
}

// Integers plain; ratios to 2 decimals.
function fmtMetric(v) {
  return Number.isInteger(v)
    ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function humanBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

// Every metric on its own bullet in the hover. `opt` rows only render for package/
// module rows (which carry a `files` count); class rows skip them.
const HOVER_PROPS = [
  { key: "files", label: "files", opt: true },
  { key: "bytes", label: "size", fmt: humanBytes },
  { key: "lines", label: "lines of code" },
  { key: "cognitive_complexity", label: "cognitive complexity" },
  { key: "complexity_per_kloc", label: "cognitive complexity / KLOC" },
  { key: "commits", label: "commits" },
  { key: "commits_per_kloc", label: "commits / KLOC" },
  { key: "bug_commits", label: "bugfix commits" },
  { key: "bugs_per_kloc", label: "bugfix commits / KLOC" },
  { key: "committers", label: "committers" },
  { key: "fan_in", label: "incoming coupling (fan in)" },
  { key: "fan_out", label: "outgoing coupling (fan out)" },
  { key: "instability", label: "instability Ce/(Ce+Ca)" },
];

// Trailing marker(s) for whichever of area / height / colour this metric drives:
//   AREA → left/right arrow · HEIGHT → up/down arrow · COLOUR → a light→red scale bar
//   with a tick at this building's spot (value / 95th-percentile, clamped 0..1).
function marksFor(file, key) {
  const marks = [];
  if (key === areaSelect.value) marks.push('<span class="mk-area" title="area / footprint">&#x2194;&#xFE0F;</span>');
  if (key === heightSelect.value) marks.push('<span class="mk-height" title="height">&#x2195;&#xFE0F;</span>');
  if (key === colorSelect.value) {
    const t = Math.max(0, Math.min(1, (Number(file[key]) || 0) / (activeColorMax || 1)));
    marks.push('<span class="cbar" title="colour scale (light-&gt;red, capped at 95th pct)">' +
      `<span class="cbar-mark" style="left:${(t * 100).toFixed(1)}%"></span></span>`);
  }
  return marks.length ? `<span class="marks">${marks.join("")}</span>` : "";
}

function formatHover(file) {
  const active = new Set([areaSelect.value, heightSelect.value, colorSelect.value]);
  const items = [];
  for (const p of HOVER_PROPS) {
    if (p.opt && (file[p.key] === undefined || file[p.key] === null)) continue;
    const val = p.fmt ? p.fmt(file[p.key]) : fmtMetric(Number(file[p.key]) || 0);
    const on = active.has(p.key);
    items.push(`<li class="${on ? "on" : ""}"><span>${p.label}: <b>${val}</b></span>${marksFor(file, p.key)}</li>`);
  }
  // Identity header (class / folder / package) on top, metrics list below.
  return hoverHeaderForFile(file) + `<ul class="props">${items.join("")}</ul>`;
}

function formatDistrictHover(district) {
  // A package platform (floor): its userData.name is the full dotted package.
  const pkg = district.userData.name || "";
  const shortName = pkg.includes(".") ? pkg.slice(pkg.lastIndexOf(".") + 1) : pkg;
  const count = district.userData.fileCount.toLocaleString();
  return identityHeader(shortName, "", pkg) +
    `<ul class="props"><li><span>Java files: <b>${count}</b></span></li></ul>`;
}

function onPointerMove(event) {
  updateCursor(event);
  if (introEl) {                      // keep the intro uncluttered: no hover tooltips while it is up
    hover.classList.remove("visible");
    return;
  }
  const navKey = event[NAV_KEY] && !event.metaKey && !event.ctrlKey && !event.altKey;
  const hit = pickBuilding(event);
  for (const entry of buildings) {
    entry.mesh.material.emissive.setHex(0x000000);
  }
  applyExternalHighlight();   // keep the codemap-linked building lit even while moving over the city
  postCityHover(hit && hit.object.userData.file ? hit.object.userData.file.path : null);
  let tooltipObj = null;
  let tooltipIsDistrict = false;
  let glowFloor = null;       // platform to light as the would-be drill target
  let cursor = "move";

  if (hit) {
    hit.object.material.emissive.setHex(0x5a0f1e);
    tooltipObj = hit.object;
    if (navKey) { glowFloor = districtByName.get(hit.object.userData.file.district) || null; cursor = "zoom-in"; }
  } else {
    const districtHit = raycaster.intersectObjects(districts, false)[0];
    if (districtHit) {
      tooltipObj = districtHit.object;
      tooltipIsDistrict = true;
      if (navKey) { glowFloor = districtHit.object; cursor = "zoom-in"; }
    } else if (navKey && scopePath !== "" && raycaster.intersectObject(ground, false).length) {
      cursor = "zoom-out";    // hovering the surrounding floor while zoomed in: a click steps out
    }
  }

  if (tooltipObj) {
    if (tooltipIsDistrict) {
      hover.innerHTML = formatDistrictHover(tooltipObj);
    } else {
      hover.innerHTML = formatHover(tooltipObj.userData.file);
    }
    hover.classList.add("visible");
  } else {
    hover.classList.remove("visible");
  }
  setFloorGlow(glowFloor);
  if (!event.metaKey && !event.ctrlKey) {        // leave the orbit cursor alone while Cmd/Ctrl is held
    renderer.domElement.style.cursor = cursor;
  }
}

// Light a single package platform blue to preview the drill target; clears the previous one.
// Swap the base colour (not just emissive) so the highlight reads clearly against the light slabs.
function applyGlow(floor, on) {
  if (!floor) return;
  const mats = Array.isArray(floor.material) ? floor.material : [floor.material];
  const seen = new Set();
  for (const m of mats) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    if (on) {
      if (!m.userData.glowSaved) { m.userData.glowSaved = m.color.clone(); }
      m.color.setHex(0x2f6df0);
      if (m.emissive) { m.emissive.setHex(0x1e40af); m.emissiveIntensity = 0.55; }
    } else {
      if (m.userData.glowSaved) { m.color.copy(m.userData.glowSaved); m.userData.glowSaved = null; }
      if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 1; }
    }
  }
}

function setFloorGlow(floor) {
  if (glowingDistrict === floor) return;
  applyGlow(glowingDistrict, false);
  applyGlow(floor, true);
  glowingDistrict = floor;
}

// ── Drill-down: Shift-click a floor/building to enter it; the surrounding floor to step out ──
function targetAtPointer(event) {
  const building = pickBuilding(event);            // also leaves `raycaster` aimed at this pointer
  if (building) return { kind: "enter", pkg: building.object.userData.file.district };
  const districtHit = raycaster.intersectObjects(districts, false)[0];
  if (districtHit) return { kind: "enter", pkg: districtHit.object.userData.name };
  if (scopePath !== "" && raycaster.intersectObject(ground, false).length) return { kind: "out" };
  return null;
}

function scopeTo(pkg) {
  if (pkg === scopePath) return;
  scopePath = pkg;
  lastScopeAt = performance.now();
  rebuildCity();
  frameCity();
  updateBreadcrumb();
}

function scopeUp() {
  if (scopePath === "") return;
  const cut = scopePath.lastIndexOf(".");
  scopeTo(cut < 0 ? "" : scopePath.slice(0, cut));
}

// Snap the camera back to a clean overview of whatever city is now laid out.
function frameCity() {
  camera.position.set(720, 620, 760);
  controls.target.set(0, 0, 0);
  controls.update();
}

function updateBreadcrumb() {
  if (scopePath === "") {
    breadcrumbEl.hidden = true;
    breadcrumbEl.innerHTML = "";
    return;
  }
  const segs = scopePath.split(".");
  const parts = ['<button class="crumb" data-scope="">&#127961; all</button>'];
  let acc = "";
  segs.forEach((seg, i) => {
    acc = acc ? `${acc}.${seg}` : seg;
    const current = i === segs.length - 1;
    parts.push('<span class="crumb-sep">&rsaquo;</span>');
    parts.push(
      `<button class="crumb${current ? " crumb-current" : ""}" data-scope="${acc}">${escapeXml(seg)}</button>`
    );
  });
  breadcrumbEl.innerHTML = parts.join("");
  breadcrumbEl.hidden = false;
}

function onSceneClick(event) {
  if (introEl || event.target !== renderer.domElement) return;   // ignore UI / overlay clicks
  if (!event[NAV_KEY] || event.metaKey || event.ctrlKey || event.altKey) return;   // navigation is Shift-gated
  if (performance.now() - lastScopeAt < 350) return;             // swallow the 2nd click of a double-click
  if (pointerDownAt) {
    const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    if (moved > 6) return;                                        // it was a drag (pan/orbit), not a click
  }
  const target = targetAtPointer(event);
  if (!target) return;
  if (target.kind === "out") scopeUp();
  else scopeTo(target.pkg);
}

function onDoubleClick(event) {
  if (!event.metaKey && !event.ctrlKey) {
    return;
  }
  const hit = pickBuilding(event);
  if (!hit) {
    return;
  }
  event.preventDefault();
  openInEditor(hit.object.userData.file.path);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

// ── First-run intro ────────────────────────────────────────────────────────
// Annotate one real building so the three abstract selectors become concrete:
// its FOOTPRINT = area metric, its HEIGHT = height metric, its COLOR = color metric.
// Each annotation draws a leader to the building feature and a connector to the
// <select> that drives it. It is a static, dismiss-on-first-interaction overlay.
let introEl = null;
let introDone = false;
const INTRO_CHANNELS = [
  { key: "area", color: "#b45309", title: "AREA", select: () => areaSelect },
  { key: "height", color: "#0f766e", title: "HEIGHT", select: () => heightSelect },
  { key: "color", color: "#9d174d", title: "COLOR", select: () => colorSelect },
];

function escapeXml(value) {
  return String(value).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function metricLabel(select) {
  return select.options[select.selectedIndex].textContent.trim();
}

function dismissIntro() {
  if (!introEl) return;
  const el = introEl;
  introEl = null;
  el.classList.add("hide");
  setTimeout(() => el.remove(), 320);
  for (const select of [colorSelect, heightSelect, areaSelect]) {
    select.style.boxShadow = "";
    select.style.borderColor = "";
  }
}

function buildIntro() {
  if (introDone || buildings.length === 0) return;
  introDone = true;
  hover.classList.remove("visible");   // drop any tooltip shown before the intro mounted
  const W = window.innerWidth;
  const H = window.innerHeight;
  camera.updateMatrixWorld();
  const project = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z };
  };

  // Hero = the tallest building whose top projects into a clear right-of-panel area.
  let hero = null;
  let bestHeight = -Infinity;
  for (const b of buildings) {
    const top = project(b.mesh.position.x, b.mesh.position.y + b.height / 2, b.mesh.position.z);
    const clear = top.z < 1 && top.x > W * 0.34 && top.x < W * 0.78 && top.y > H * 0.24 && top.y < H * 0.7;
    if (clear && b.height > bestHeight) { bestHeight = b.height; hero = b; }
  }
  if (!hero) hero = buildings.reduce((a, b) => (b.height > a.height ? b : a));

  const params = hero.mesh.geometry.parameters;
  const px = hero.mesh.position.x;
  const pz = hero.mesh.position.z;
  const yBottom = hero.mesh.position.y - hero.height / 2;
  const yTop = hero.mesh.position.y + hero.height / 2;
  const hw = params.width / 2;
  const hd = params.depth / 2;
  const cornersXZ = [[px - hw, pz - hd], [px + hw, pz - hd], [px + hw, pz + hd], [px - hw, pz + hd]];
  const base = cornersXZ.map(([x, z]) => project(x, yBottom, z));
  const roof = cornersXZ.map(([x, z]) => project(x, yTop, z));         // top face = footprint, drawn on the roof
  const roofCentroid = {
    x: roof.reduce((s, p) => s + p.x, 0) / 4,
    y: roof.reduce((s, p) => s + p.y, 0) / 4,
  };
  let ri = 0;
  for (let i = 1; i < 4; i++) if (base[i].x > base[ri].x) ri = i;        // right-most vertical edge
  const edgeBottom = base[ri];
  const edgeTop = roof[ri];
  const bodyMid = project(px, (yBottom + yTop) / 2, pz);
  const heroRight = Math.max(...roof.map(p => p.x), ...base.map(p => p.x));
  const swatch = "#" + hero.mesh.material.color.getHexString();

  // Anchor each channel to the building feature it explains.
  const anchors = {
    height: { x: (edgeTop.x + edgeBottom.x) / 2, y: (edgeTop.y + edgeBottom.y) / 2 },
    color: bodyMid,
    area: roofCentroid,
  };

  // Stack the three label cards just right of the hero.
  const LW = 200;
  const LH = 50;
  const lx = Math.min(heroRight + 46, W - LW - 18);
  let ly = Math.max(70, Math.min(edgeTop.y - 12, H - 3 * (LH + 18) - 40));
  const rows = INTRO_CHANNELS.map(ch => {
    const select = ch.select();
    const row = {
      ...ch, select, sub: metricLabel(select), anchor: anchors[ch.key],
      rect: select.getBoundingClientRect(), box: { x: lx, y: ly, w: LW, h: LH },
    };
    ly += LH + 18;
    return row;
  });

  const parts = [];
  parts.push(
    '<defs><pattern id="introHatch" width="7" height="7" patternTransform="rotate(45)" ' +
    'patternUnits="userSpaceOnUse">' +
    '<line x1="0" y1="0" x2="0" y2="7" stroke="#b45309" stroke-width="1.4" opacity="0.85"/></pattern></defs>'
  );
  // AREA: hatched top face (the building's footprint, shown on the roof).
  parts.push(
    `<polygon points="${roof.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" ` +
    'fill="url(#introHatch)" stroke="#b45309" stroke-width="2" opacity="0.92"/>'
  );
  // HEIGHT: a dimension line with caps along the right vertical edge.
  const ex = edgeTop.x - edgeBottom.x;
  const ey = edgeTop.y - edgeBottom.y;
  const elen = Math.hypot(ex, ey) || 1;
  const capx = (-ey / elen) * 7;
  const capy = (ex / elen) * 7;
  const cap = p =>
    `<line x1="${(p.x - capx).toFixed(1)}" y1="${(p.y - capy).toFixed(1)}" ` +
    `x2="${(p.x + capx).toFixed(1)}" y2="${(p.y + capy).toFixed(1)}" stroke="#0f766e" stroke-width="2.5"/>`;
  parts.push(
    `<line x1="${edgeBottom.x.toFixed(1)}" y1="${edgeBottom.y.toFixed(1)}" ` +
    `x2="${edgeTop.x.toFixed(1)}" y2="${edgeTop.y.toFixed(1)}" stroke="#0f766e" stroke-width="2.5"/>`,
    cap(edgeBottom), cap(edgeTop)
  );
  // COLOR: a swatch dot in the building's own colour.
  parts.push(
    `<circle cx="${bodyMid.x.toFixed(1)}" cy="${bodyMid.y.toFixed(1)}" r="9" ` +
    `fill="${swatch}" stroke="#fff" stroke-width="2.5"/>`
  );

  for (const row of rows) {
    const box = row.box;
    const rect = row.rect;
    const boxLeft = { x: box.x, y: box.y + box.h / 2 };
    const selBottom = { x: rect.left + rect.width / 2, y: rect.bottom };
    // Connector: selector → label (dashed, channel colour).
    parts.push(
      `<path d="M ${selBottom.x} ${selBottom.y} ` +
      `C ${selBottom.x} ${selBottom.y + 60}, ${box.x - 30} ${box.y - 20}, ${box.x + 22} ${box.y}" ` +
      `fill="none" stroke="${row.color}" stroke-width="2" stroke-dasharray="5 5" opacity="0.65"/>`,
      `<circle cx="${selBottom.x}" cy="${selBottom.y}" r="3.5" fill="${row.color}"/>`,
      // Selector highlight.
      `<rect x="${rect.left - 4}" y="${rect.top - 4}" width="${rect.width + 8}" height="${rect.height + 8}" ` +
      `rx="8" fill="none" stroke="${row.color}" stroke-width="2.5"/>`
    );
    // Leader: label → building feature (solid, channel colour).
    parts.push(
      `<line x1="${boxLeft.x}" y1="${boxLeft.y}" x2="${row.anchor.x.toFixed(1)}" y2="${row.anchor.y.toFixed(1)}" ` +
      `stroke="${row.color}" stroke-width="2.5"/>`,
      `<circle cx="${row.anchor.x.toFixed(1)}" cy="${row.anchor.y.toFixed(1)}" r="4" fill="${row.color}"/>`
    );
    // Label card.
    parts.push(
      '<g>' +
      `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="9" ` +
      `fill="#ffffff" stroke="${row.color}" stroke-width="2"/>` +
      `<rect x="${box.x}" y="${box.y}" width="6" height="${box.h}" rx="3" fill="${row.color}"/>` +
      `<text x="${box.x + 16}" y="${box.y + 21}" font-size="13" font-weight="700" fill="${row.color}">${row.title}</text>` +
      `<text x="${box.x + 16}" y="${box.y + 39}" font-size="12.5" fill="#344054">${escapeXml(row.sub)}</text>` +
      '</g>'
    );
  }

  introEl = document.createElement("div");
  introEl.id = "intro";
  introEl.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join("")}</svg>` +
    '<div class="intro-head">What each building tells you</div>' +
    '<button class="intro-dismiss" type="button">Got it &#10005;</button>';
  document.body.appendChild(introEl);
  requestAnimationFrame(() => { if (introEl) introEl.classList.add("visible"); });
  introEl.querySelector(".intro-dismiss").addEventListener("click", dismissIntro);
  for (const row of rows) {
    row.select.style.boxShadow = `0 0 0 3px ${row.color}55`;
    row.select.style.borderColor = row.color;
  }
}

function onMetricChange() {
  dismissIntro();
  rebuildCity();
}

areaSelect.addEventListener("change", onMetricChange);
heightSelect.addEventListener("change", onMetricChange);
colorSelect.addEventListener("change", onMetricChange);
viewSelect.addEventListener("change", () => {
  dismissIntro();
  scopePath = "";              // class / package / module hierarchies differ — reset the drill scope
  updateBreadcrumb();
  rebuildCity();
  frameCity();                 // recenter: the whole city changed
});
// Package-label style only swaps the floor/floating labels — re-render in place.
pkgLabelSelect.addEventListener("change", () => { dismissIntro(); rebuildCity(); });

// Package-pattern filter: recompile on every keystroke, flag invalid patterns,
// reset the drill scope (the visible set changed) and reframe.
function applyFilter() {
  const raw = filterInput.value.trim();
  filterClearBtn.hidden = raw === "";
  if (!raw) {
    filterRe = null;
    filterInput.classList.remove("bad");
  } else {
    try { filterRe = patternToRegExp(raw); filterInput.classList.remove("bad"); }
    catch (_) { filterRe = null; filterInput.classList.add("bad"); }
  }
  dismissIntro();
  scopePath = "";
  updateBreadcrumb();
  rebuildCity();
  frameCity();
}
filterInput.addEventListener("input", applyFilter);
filterClearBtn.addEventListener("click", () => { filterInput.value = ""; applyFilter(); filterInput.focus(); });
window.addEventListener("resize", onResize);
window.addEventListener("resize", dismissIntro);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerdown", onPointerDown, true);
window.addEventListener("keydown", updateCursor);
window.addEventListener("keyup", updateCursor);
window.addEventListener("blur", () => { renderer.domElement.style.cursor = "move"; });
window.addEventListener("dblclick", onDoubleClick);
window.addEventListener("click", onSceneClick);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !introEl && document.getElementById("howto").hidden) scopeUp();
});
breadcrumbEl.addEventListener("click", (e) => {
  const crumb = e.target.closest(".crumb");
  if (crumb) scopeTo(crumb.getAttribute("data-scope"));
});
renderer.domElement.addEventListener("pointerdown", dismissIntro);
window.addEventListener("wheel", dismissIntro, { passive: true });

// Park the breadcrumb just under the control panel, tracking its real height.
function positionBreadcrumb() {
  const panel = document.querySelector(".panel");
  if (panel) document.documentElement.style.setProperty("--panel-h", `${panel.offsetHeight + 14}px`);
}
positionBreadcrumb();
window.addEventListener("resize", positionBreadcrumb);

rebuildCity();

function animate() {
  controls.update();
  renderer.render(scene, camera);
  updateLabelVisibility();        // resolve which class labels are non-overlapping from this angle
  labelRenderer.render(scene, camera);
  if (!introDone) buildIntro();
  requestAnimationFrame(animate);
}
animate();
</script>
</body>
</html>
"""

_LOGO_SHAPES = (
    '<rect x="2.5" y="9" width="5.5" height="12.5" rx="1" fill="#5b8def"/>'
    '<rect x="9" y="3.5" width="6" height="18" rx="1" fill="#1e3a8a"/>'
    '<rect x="16" y="11.5" width="5.5" height="10" rx="1" fill="#3a86ff"/>'
)
LOGO_SVG = f'<svg class="logo" viewBox="0 0 24 24" aria-hidden="true">{_LOGO_SHAPES}</svg>'
FAVICON = "data:image/svg+xml," + urllib.parse.quote(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">{_LOGO_SHAPES}</svg>'
)

# The recipe the in-page "Build this for your own repo" button reveals. SCRIPTS_DIR is
# baked in so the command is runnable as-is; generate.sh honours the HEATMAP_*/CODECITY_*
# overrides, so the only thing the reader edits is REPO.
BUILD_CMD = f"""# 1. The folder you want to visualise (a git repo of Java sources):
REPO="$HOME/workspace/your-repo"

# 2. PetClinic's codemap generators do all the analysis & rendering:
SCRIPTS="{SCRIPTS_DIR}"

# 3. One-time: vendor the tree-sitter parsers used to measure complexity.
[ -d "$SCRIPTS/.pylibs" ] || pip install -r "$SCRIPTS/requirements.txt" --target "$SCRIPTS/.pylibs"

# 4. Run the pipeline on REPO, writing the report into REPO/.codecity/ .
HEATMAP_REPO="$REPO" HEATMAP_OUT="$REPO/.codecity" \\
  CODECITY_TITLE="Code City: $(basename "$REPO")" "$SCRIPTS/generate.sh"

# 5. Open the city in your browser (macOS `open`; Linux `xdg-open`; Windows `start`).
open "$REPO/.codecity/codecity.html"
"""

html = (html
        .replace("__TITLE__", TITLE)
        .replace("__LOGO_SVG__", LOGO_SVG)
        .replace("__FAVICON__", FAVICON)
        .replace("__FILES_JSON__", json.dumps(rows))
        .replace("__PACKAGES_JSON__", json.dumps(pkg_rows))
        .replace("__MODULES_JSON__", json.dumps(mod_rows))
        .replace("__REPO_ABS__", json.dumps(str(REPO_ABS)))
        .replace("__BUILD_CMD__", json.dumps(BUILD_CMD)))
OUT.write_text(html)
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")
