#!/usr/bin/env python3
"""Render a self-contained HTML review guide from a small JSON content file.

Splits the review into the half a machine should own and the half a human should:

  * this script owns the *mechanics* — page shell, styling, inlining the delta
    SVGs, laying out the diagram gallery, cutting every code snippet out of the
    working tree at build time via extract-snippet.py;
  * the JSON owns the *judgement* — what changed, what is risky, in what order a
    reviewer should look.

No snippet text ever lives in the JSON: only a `path:from-to` reference, so a
guide can never drift from the code it quotes.

Usage:
    build-review-html.py content.json --out .human-review/review.html
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXTRACT = HERE / "extract-snippet.py"

SEVERITIES = {
    "high": ("sev-high", "must look"),
    "medium": ("sev-med", "worth a look"),
    "low": ("sev-low", "nit"),
    "info": ("sev-info", "context"),
}

CSS = """
:root {
  --bg:#fbfbfd; --fg:#1c1c22; --muted:#6b6b78; --line:#e2e2ea; --card:#ffffff;
  --accent:#8a1c1c; --accent-soft:#fdeaea; --code-bg:#f6f6fa; --link:#1a4fa0;
}
@media (prefers-color-scheme: dark) {
  :root { --bg:#15151a; --fg:#e8e8ef; --muted:#9a9aa8; --line:#2c2c36; --card:#1d1d24;
          --accent:#f08a8a; --accent-soft:#3a1f1f; --code-bg:#101015; --link:#8ab4f8; }
}
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
.wrap { max-width:1080px; margin:0 auto; padding:2.5rem 1.25rem 5rem; }
h1 { font-size:1.9rem; margin:0 0 .3rem; letter-spacing:-.02em; }
h2 { font-size:1.3rem; margin:2.8rem 0 .8rem; padding-bottom:.4rem; border-bottom:1px solid var(--line); }
h3 { font-size:1.02rem; margin:1.8rem 0 .5rem; }
p { margin:.6rem 0; }
a { color:var(--link); }
.sub { color:var(--muted); margin:0 0 1.4rem; font-size:.93rem; }
.scopebar { display:flex; flex-wrap:wrap; gap:.5rem; margin:0 0 1.5rem; }
.chip { background:var(--card); border:1px solid var(--line); border-radius:999px;
        padding:.2rem .7rem; font-size:.82rem; color:var(--muted); }
.chip b { color:var(--fg); font-weight:600; }
a.chip-link { text-decoration:none; }
a.chip-link:hover { border-color:var(--link); background:var(--accent-soft); }
.added { color:#2e7d32; } .removed { color:#c62828; }
@media (prefers-color-scheme: dark) { .added{color:#8fd39c} .removed{color:#f08a8a} }
ul.fixlist { margin:.5rem 0 .8rem; padding-left:1.1rem; display:grid; gap:.3rem; }
ul.fixlist li { font-size:.93rem; }
ul.fixlist .srcref { margin-bottom:0; font-size:11.5px; }
.lede { background:var(--card); border:1px solid var(--line); border-left:3px solid var(--accent);
        border-radius:6px; padding:.9rem 1.1rem; }
figure { margin:1rem 0; }
figcaption { color:var(--muted); font-size:.86rem; }
.snippet { background:var(--card); border:1px solid var(--line); border-radius:8px;
            padding:.7rem .9rem; margin:.9rem 0; overflow:hidden; }
.snippet-note { margin:0 0 .45rem; color:var(--fg); font-size:.9rem; }
.srcref { display:inline-block; font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
          color:var(--link); text-decoration:none; border-bottom:1px dotted currentColor; margin-bottom:.5rem; }
.srcref:hover { background:var(--accent-soft); }
pre.code { margin:0; background:var(--code-bg); border-radius:6px; padding:.6rem .2rem .6rem 0;
            overflow-x:auto; font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }
pre.code code { white-space:pre; }
.ln { display:inline-block; width:3.4em; padding-right:.9em; text-align:right; color:var(--muted);
      user-select:none; opacity:.65; }
.diagram { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:1rem; margin:1.1rem 0; }
.diagram .head { display:flex; justify-content:space-between; align-items:baseline; gap:1rem; flex-wrap:wrap; }
.diagram .head b { font-size:1rem; }
.prov { margin:.5rem 0 0; display:flex; gap:.9rem; flex-wrap:wrap; }
.prov .srcref { margin-bottom:0; }
.diagram .head span { color:var(--muted); font-size:.82rem; font-family:ui-monospace,Menlo,monospace; }
.diagram .svgbox { overflow-x:auto; margin-top:.7rem; background:#fff; border-radius:6px; padding:.6rem; }
.diagram .svgbox svg { max-width:100%; height:auto; display:block; margin:0 auto; }
.diagram .svgbox[hidden] { display:none; }
/* How much unchanged context to draw around what changed. DomainModel and DB are big
    enough that the whole diagram is a wall to hunt for red in, and how much context
    makes a given change legible is the reviewer's call, not the generator's. */
.focus { display:flex; align-items:center; gap:.35rem; margin-top:.7rem; flex-wrap:wrap; }
.focus .lbl { color:var(--muted); font-size:.78rem; margin-right:.15rem; }
.focus button { border:1px solid var(--line); background:var(--card); color:var(--muted);
                border-radius:999px; cursor:pointer; font:600 .74rem/1.7 inherit;
                padding:0 .6rem; }
.focus button:hover { border-color:var(--link); color:var(--fg); }
.focus button[aria-pressed="true"] { background:var(--link); border-color:var(--link); color:#fff; }
/* Progressive disclosure: the diagram arrives simplified, and an arrow that has more
    to say is clickable. The hit area is a transparent rect the script lays under each
    such arrow, so the whole band — label, line, marker — answers to one click. */
.genseq-hot { cursor:pointer; }
.genseq-hit { fill:transparent; }
.genseq-hot:hover .genseq-hit { fill:#1a4fa0; fill-opacity:.07; }
.genseq-hot.genseq-open .genseq-hit { fill:#1a4fa0; fill-opacity:.12; }
.genseq-hot.genseq-open a[href^="genseq:"] text { font-weight:700; }
.genseq-hint { margin:.45rem 0 0; color:var(--muted); font-size:.82rem; }
#genseq-panel { position:absolute; z-index:40; max-width:min(38rem,92vw); min-width:16rem;
                background:var(--card); color:var(--fg); border:1px solid var(--line);
                border-left:3px solid var(--link); border-radius:8px;
                box-shadow:0 8px 28px rgba(0,0,0,.22); padding:.55rem .7rem .7rem; }
#genseq-panel[hidden] { display:none; }
#genseq-panel .genseq-head { display:flex; align-items:baseline; gap:.5rem; }
#genseq-panel .genseq-title { font:600 12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
                              flex:1; word-break:break-all; }
#genseq-panel .genseq-head { gap:.6rem; }
#genseq-panel .genseq-step { color:var(--muted); font-size:.76rem; white-space:nowrap; }
#genseq-panel .genseq-close { border:0; background:none; color:var(--muted); cursor:pointer;
                        font-size:1.1rem; line-height:1; padding:0 .1rem; }
#genseq-panel .genseq-close:hover { color:var(--fg); }
#genseq-panel .genseq-label { color:var(--link); font-size:.8rem; margin:.15rem 0 .4rem; }
#genseq-panel .genseq-label[hidden] { display:none; }
#genseq-panel .genseq-toggle { border:1px solid var(--line); background:var(--code-bg);
                        color:var(--muted); cursor:pointer; border-radius:999px;
                        font:600 .7rem/1.6 inherit; padding:0 .55rem; white-space:nowrap; }
#genseq-panel .genseq-toggle:hover { color:var(--fg); border-color:var(--link); }
#genseq-panel .genseq-toggle[hidden] { display:none; }
#genseq-panel pre { margin:0; max-height:24rem; overflow:auto; background:var(--code-bg);
                    border-radius:6px; padding:.5rem .6rem; white-space:pre;
                    font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
.badge { border-radius:4px; padding:.1rem .45rem; font-size:.74rem; font-weight:600; text-transform:uppercase;
          letter-spacing:.04em; background:var(--accent-soft); color:var(--accent); }
.city { display:block; border:1px solid var(--line); border-radius:8px; overflow:hidden; margin:1rem 0; }
.city img { display:block; width:100%; height:auto; }
ol.findings { list-style:none; counter-reset:f; padding:0; margin:1rem 0; }
ol.findings > li { counter-increment:f; background:var(--card); border:1px solid var(--line);
                    border-radius:8px; padding:.9rem 1.1rem; margin:.7rem 0; }
ol.findings > li::before { content:counter(f); float:left; margin:.1rem .7rem 0 0; width:1.6rem; height:1.6rem;
    border-radius:50%; background:var(--accent); color:#fff; font-size:.8rem; font-weight:700;
    display:grid; place-items:center; }
.f-title { font-weight:650; }
.f-why { color:var(--muted); font-size:.9rem; margin:.35rem 0 0; }
.sev-high { background:#fdeaea; color:#8a1c1c; }
.sev-med  { background:#fdf3e2; color:#8a5a12; }
.sev-low  { background:#eef3fb; color:#26518f; }
.sev-info { background:#eef7ef; color:#245c30; }
@media (prefers-color-scheme: dark) {
  .sev-high{background:#3a1f1f;color:#f2a0a0}.sev-med{background:#3a3018;color:#e6c07b}
  .sev-low{background:#1c2738;color:#9dc0f5}.sev-info{background:#1b2c1f;color:#9ad3a5}
}
table.stat { border-collapse:collapse; width:100%; font-size:.88rem; }
table.stat td { border-bottom:1px solid var(--line); padding:.35rem .5rem; }
table.stat td.n { text-align:right; color:var(--muted); font-family:ui-monospace,Menlo,monospace; white-space:nowrap; }
/* Full-bleed band: the verdict is the one thing that should not sit politely inside the
    text column. It breaks out to the viewport edges and pads itself back to the column. */
.verdict { margin:1.6rem 0 2.2rem; margin-left:calc(50% - 50vw); width:100vw;
            padding:1.5rem max(1.25rem, calc(50vw - 540px + 1.25rem));
            display:grid; grid-template-columns:auto 1fr; gap:2rem; align-items:center;
            border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.verdict .score { text-align:center; }
.verdict .score b { display:block; font-size:3.4rem; line-height:1; letter-spacing:-.04em; }
.verdict .score span { font-size:.7rem; text-transform:uppercase; letter-spacing:.09em; opacity:.75; }
.verdict .scale { display:flex; gap:2px; margin:.6rem 0 0; }
.verdict .scale i { width:9px; height:9px; border-radius:2px; background:currentColor; opacity:.18; }
.verdict .scale i.on { opacity:1; }
.verdict ul { margin:0; padding:0; list-style:none; display:grid; gap:.42rem; }
.verdict li { color:var(--fg); font-size:.95rem; padding-left:1rem; position:relative; }
.verdict li::before { content:""; position:absolute; left:0; top:.62em; width:5px; height:5px;
                      border-radius:50%; background:currentColor; }
.v-bad  { color:#c62828; background:linear-gradient(90deg,#fbdcdc 0%,#fdefef 42%,transparent 88%); }
.v-mid  { color:#b56b00; background:linear-gradient(90deg,#fbe8c9 0%,#fdf5e6 42%,transparent 88%); }
.v-good { color:#2e7d32; background:linear-gradient(90deg,#d6ecd8 0%,#eef7ef 42%,transparent 88%); }
@media (prefers-color-scheme: dark) {
  .v-bad {color:#f08a8a;background:linear-gradient(90deg,#4a2020 0%,#2a1818 42%,transparent 88%)}
  .v-mid {color:#e6b566;background:linear-gradient(90deg,#453515 0%,#282010 42%,transparent 88%)}
  .v-good{color:#8fd39c;background:linear-gradient(90deg,#1e3d24 0%,#172318 42%,transparent 88%)}
}
.vidwrap { display:grid; grid-template-columns:minmax(0,1fr) 19rem; gap:.9rem;
            align-items:start; margin:1rem 0; }
.vidwrap video { width:100%; display:block; border:1px solid var(--line);
                  border-radius:8px; background:#000; }
.transcript { margin:0; padding:.3rem; list-style:none; border:1px solid var(--line);
              border-radius:8px; background:var(--card); max-height:26rem; overflow-y:auto; }
.transcript li { display:grid; grid-template-columns:2.9rem 1fr; gap:.5rem; align-items:baseline;
                  padding:.4rem .5rem; border-radius:5px; cursor:pointer; font-size:.88rem; }
.transcript li:hover { background:var(--accent-soft); }
.transcript li.on { background:var(--accent-soft); font-weight:600; }
.transcript .ts { font:600 11.5px/1.5 ui-monospace,Menlo,monospace; color:var(--link); }
@media (max-width:820px) { .vidwrap { grid-template-columns:1fr; } }
video.vid { width:100%; max-width:900px; border:1px solid var(--line); border-radius:8px; display:block; margin:1rem 0; background:#000; }
footer { margin-top:3.5rem; padding-top:1rem; border-top:1px solid var(--line); color:var(--muted); font-size:.85rem; }
"""


CAPTION_JS = """<script>
document.querySelectorAll('.vidwrap').forEach(function (wrap) {
  var video = wrap.querySelector('video');
  var items = Array.prototype.slice.call(wrap.querySelectorAll('.transcript li'));
  if (!items.length) return;
  items.forEach(function (li) {
    li.addEventListener('click', function () {
      video.currentTime = parseFloat(li.dataset.t);
      video.play();
    });
  });
  video.addEventListener('timeupdate', function () {
    var active = null;
    items.forEach(function (li) {
      if (parseFloat(li.dataset.t) <= video.currentTime) active = li;
    });
    items.forEach(function (li) { li.classList.toggle('on', li === active); });
    if (!active) return;
    // Measured against the panel's own box: offsetTop is relative to the nearest
    // positioned ancestor, which is not necessarily the scroller.
    var panel = active.parentNode;
    var a = active.getBoundingClientRect();
    var p = panel.getBoundingClientRect();
    if (a.top < p.top) panel.scrollTop += a.top - p.top - 8;
    else if (a.bottom > p.bottom) panel.scrollTop += a.bottom - p.bottom + 8;
  });
});
</script>"""


FOCUS_JS = """<script>
// The focus chooser: every level is already in the page, so switching is a visibility
// flip, not a fetch — the guide must keep working as a single emailed file.
(function () {
  document.querySelectorAll('.diagram .focus').forEach(function (bar) {
    var diagram = bar.closest('.diagram');
    bar.addEventListener('click', function (ev) {
      var button = ev.target.closest('button[data-level]');
      if (!button) return;
      var level = button.getAttribute('data-level');
      bar.querySelectorAll('button[data-level]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === button));
      });
      diagram.querySelectorAll('.svgbox[data-level]').forEach(function (box) {
        box.hidden = box.getAttribute('data-level') !== level;
      });
    });
  });
})();
</script>"""

EDITOR_JS = """<script>
// Every `vscode://file/...` link is emitted with target="_blank", which is the only
// thing that works inside VS Code's Simple Browser: the guide runs in an iframe there,
// and an iframe drops a navigation to a custom scheme without so much as an error — the
// click simply does nothing.
//
// A real browser tab does not need it and is worse for it: the handoff to the editor
// leaves an about:blank tab behind on every jump. So at top level the link navigates in
// place instead, which hands off to the editor without moving the page.
(function () {
  if (window.self !== window.top) return;
  document.addEventListener('click', function (ev) {
    var link = ev.target.closest && ev.target.closest('a[href^="vscode:"]');
    if (!link || ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    window.location.href = link.getAttribute('href');
  });
})();
</script>"""

GENSEQ_JS = """<script>
// Progressive disclosure over the inlined sequence-diagram SVGs. The generator wrapped
// the label of every arrow that has more to say in a PlantUML link, which PlantUML
// rendered as <a href="genseq://<id>"> — a stable, generation-time handle, so nothing
// here has to match rendered label text. The detail itself rides in the sidecar next to
// each diagram. One click reveals, another closes.
//
// Where a step has a second rendering of the same fact — a statement as sent vs. the
// same statement with its bound values put back — the panel offers it as a toggle. It
// used to be a second click on the arrow, which swapped the text under the reader and
// counted itself "1 / 2": both the affordance and the fact that there *was* one were
// invisible until you had already found them by accident.
(function () {
  var PREFIX = 'genseq://';
  // `?` or the bound values is a way of reading, not a property of one arrow: a reviewer
  // who asked for values once is reading the whole page in values. So the choice is the
  // page's, and every panel opened after it honours it.
  var panel = null, els = null, current = null, step = null, showValues = false;

  function build() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'genseq-panel';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="genseq-head"><span class="genseq-title"></span>' +
      '<button type="button" class="genseq-toggle" hidden></button>' +
      '<span class="genseq-step"></span>' +
      '<button type="button" class="genseq-close" title="close (Esc)" aria-label="close">&times;</button></div>' +
      '<div class="genseq-label"></div><pre></pre>';
    document.body.appendChild(panel);
    els = {
      title: panel.querySelector('.genseq-title'),
      step: panel.querySelector('.genseq-step'),
      label: panel.querySelector('.genseq-label'),
      toggle: panel.querySelector('.genseq-toggle'),
      body: panel.querySelector('pre'),
    };
    panel.querySelector('.genseq-close').addEventListener('click', close);
    els.toggle.addEventListener('click', function () { showValues = !showValues; render(); });
    panel.addEventListener('click', function (ev) { ev.stopPropagation(); });
  }

  function close() {
    if (current) current.reset();
    current = null;
    if (panel) panel.hidden = true;
  }

  // Page coordinates, and anchored to the arrow rather than to the pointer: the panel
  // must stay put while the page scrolls, and still be readable next to what it explains.
  function place(target) {
    var box = target.getBoundingClientRect();
    panel.hidden = false;
    var width = panel.offsetWidth;
    var left = Math.min(box.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - width - 12);
    panel.style.left = Math.max(window.scrollX + 8, left) + 'px';
    panel.style.top = (box.bottom + window.scrollY + 8) + 'px';
  }

  // The button always names the *other* rendering, so it reads as what a click will get
  // you. A step with no alternate — a JSON payload — simply has no button.
  function render() {
    var on = showValues && !!step.alternate;
    var view = on ? step.alternate : step;
    els.label.textContent = view.label || '';
    els.label.hidden = !view.label;
    els.body.textContent = view.text;
    els.toggle.hidden = !step.alternate;
    if (step.alternate) {
      els.toggle.textContent = on ? 'show ?' : 'show values';
      els.toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function show(entry, index, target) {
    build();
    step = entry.steps[index];
    els.title.textContent = entry.title;
    els.step.textContent = entry.steps.length > 1 ? (index + 1) + ' / ' + entry.steps.length : '';
    render();
    place(target);
  }

  // A transparent rect under the arrow, so the click lands anywhere across the band
  // instead of only on the glyph PlantUML made into a link.
  function addHitArea(group) {
    var box;
    try { box = group.getBBox(); } catch (e) { return; }
    if (!box || !box.width) return;
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'genseq-hit');
    rect.setAttribute('x', box.x - 4);
    rect.setAttribute('y', box.y - 1);
    rect.setAttribute('width', box.width + 8);
    rect.setAttribute('height', Math.max(box.height - 2, 6));
    rect.setAttribute('rx', '3');
    group.insertBefore(rect, group.firstChild);
  }

  document.querySelectorAll('.diagram').forEach(function (diagram) {
    var carrier = diagram.querySelector('script.genseq-details');
    if (!carrier) return;
    var details = (JSON.parse(carrier.textContent) || {}).details || {};
    var revealable = 0;

    diagram.querySelectorAll('svg a[href^="' + PREFIX + '"]').forEach(function (link) {
      var entry = details[(link.getAttribute('href') || '').slice(PREFIX.length)];
      var group = link.closest('g.message') || link.parentNode;
      // An arrow this change *removed* is re-inserted from the base diagram, and its
      // detail was never recorded here. Drop the handle rather than offer a dead one —
      // by unwrapping it, since the link is now around the label itself and removing
      // the element would take the arrow's text with it.
      if (!entry || !entry.steps.length) {
        while (link.firstChild) link.parentNode.insertBefore(link.firstChild, link);
        link.remove();
        return;
      }
      revealable++;

      var index = -1;
      var state = {reset: function () { index = -1; group.classList.remove('genseq-open'); }};
      group.classList.add('genseq-hot');
      addHitArea(group);
      group.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (current && current !== state) current.reset();
        index++;
        if (index >= entry.steps.length) { close(); return; }
        current = state;
        group.classList.add('genseq-open');
        show(entry, index, link);
      });
    });

    if (!revealable) return;
    var hint = document.createElement('p');
    hint.className = 'genseq-hint';
    hint.textContent = 'Simplified on purpose — click any arrow marked \u2295 to reveal its SQL '
      + 'or its JSON payload. Switching a statement to its bound values switches them all.';
    diagram.querySelector('.svgbox').insertAdjacentElement('beforebegin', hint);
  });

  // The panel is placed in page coordinates, so a diagram scrolled sideways under it
  // would leave it pointing at the wrong arrow.
  document.querySelectorAll('.diagram .svgbox').forEach(function (box) {
    box.addEventListener('scroll', close);
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
})();
</script>"""


# The caption is prose, and prose about this project says things like `{{ visit | vetName }}`.
# Stopping it at the first `}` cut the directive in half there and spilled the rest onto the
# page as literal text, so the caption now runs to the last `}}` on the line — stopping
# only at a following `{{snippet:`, so two directives in one paragraph stay two
# directives while a caption may still quote a template expression.
SNIPPET_TOKEN = re.compile(
    r"\{\{snippet:(?P<ref>[^|}]+)(?:\|(?P<caption>(?:(?!\{\{snippet:).)*))?\}\}"
)


def expand_snippets(text: str, root: Path) -> str:
    """Let prose interleave with code: `{{snippet:path:12-14|caption}}` inside any body."""
    return SNIPPET_TOKEN.sub(
        lambda m: snippet_html(m["ref"].strip(), (m["caption"] or "").strip() or None, root), text
    )


def snippet_html(ref: str, caption: str | None, root: Path) -> str:
    cmd = [sys.executable, str(EXTRACT), ref]
    if caption:
        cmd += ["--caption", caption]
    out = subprocess.run(cmd, capture_output=True, text=True, cwd=root)
    if out.returncode != 0:
        raise SystemExit(out.stderr.strip() or f"extract-snippet failed for {ref}")
    return out.stdout


# `src://<repo-relative path>[:line]` — the handle the diagram generators leave on a
# class, a field, an endpoint. They cannot emit `vscode://file/<abs>` themselves: their
# .puml is committed, and an absolute path in it is a diff on every machine that
# regenerates the diagram. Resolving it here, against this checkout, is the last moment
# where the absolute path is a fact rather than a guess.
SRC_HANDLE = re.compile(r'href="src://(?P<path>[^"#:]+)(?::(?P<line>\d+))?"')


def resolve_source_links(svg: str, root: Path) -> str:
    def fix(m):
        target = (root / m.group("path")).resolve()
        line = m.group("line") or "1"
        return f'href="vscode://file/{target}:{line}:1"'

    return SRC_HANDLE.sub(fix, svg)


def inline_svg(path: Path, root: Path) -> str:
    """Inline rather than <img src>: the guide must survive being emailed as one file."""
    svg = path.read_text(encoding="utf-8")
    svg = re.sub(r"^<\?xml[^>]*\?>\s*", "", svg)
    svg = re.sub(r"<!DOCTYPE[^>]*>\s*", "", svg)
    return resolve_source_links(svg, root)


def genseq_details(rel: str, root: Path) -> str:
    """The sidecar the generator filed beside the diagram, carried into the page.

    Inlined rather than fetched: review.html is opened from file://, where fetch() of a
    neighbouring file is blocked, and the guide has to survive being mailed as one file."""
    if not rel.endswith(".genseq.puml"):
        return ""
    sidecar = root / (rel[: -len(".puml")] + ".json")
    if not sidecar.is_file():
        return ""
    # `<` is the only character that can end a <script> block early, and a JSON string
    # may legally spell it \\u003c — so the payload stays valid JSON and inert to the
    # HTML parser without any un-escaping step on the other side.
    payload = sidecar.read_text(encoding="utf-8").replace("<", "\\u003c")
    return f'<script type="application/json" class="genseq-details">{payload}</script>'


def read_manifest(path: Path):
    rows = []
    if not path.is_file():
        return rows
    lines = path.read_text(encoding="utf-8").splitlines()
    header = lines[0].split("\t")
    for line in lines[1:]:
        if line.strip():
            rows.append(dict(zip(header, line.split("\t"))))
    return rows


def _provenance(rel: str, root: Path) -> str:
    """Links back to what produced a diagram: the test that generated it, and the .puml.

    A sequence diagram is evidence only if the reviewer can reach the scenario behind it.
    The generator files each diagram as `<test-file>.genseq.puml` next to its test, so the
    source is derivable rather than something the guide has to be told."""
    links = []
    if rel.endswith('.genseq.puml'):
        test = rel[: -len('.genseq.puml')]
        if (root / test).is_file():
            links.append(f'<a class="srcref" href="vscode://file/{(root / test).resolve()}:1:1">'
                          f'generated by {html.escape(Path(test).name)}</a>')
    if (root / rel).is_file():
        links.append(f'<a class="srcref" href="vscode://file/{(root / rel).resolve()}:1:1">'
                      f'{html.escape(Path(rel).name)}</a>')
    return ('<p class="prov">' + " ".join(links) + '</p>') if links else ''


# Which radius a reviewer meets first. Zero is the change with nothing to hang it on;
# the whole diagram is what the focus levels exist to escape. One hop — what changed,
# plus what it is attached to — is the reading that needs no explaining.
DEFAULT_FOCUS = "1"


def _focus_views(row, assets: Path, full_svg: Path, root: Path) -> str:
    """The delta at each focus level, one visible at a time, with the chooser above them.

    All of them are inlined rather than fetched on demand: the guide has to survive being
    emailed as a single file, and a chooser whose other options 404 is worse than none.
    """
    levels = []
    for pair in (row.get("focus") or "").split(","):
        level, sep, name = pair.partition(":")
        svg = assets / name
        if sep and svg.is_file():
            levels.append((level, svg))
    levels.append(("all", full_svg))

    if len(levels) == 1:                       # sequence diagrams, and anything unpruned
        return f'<div class="svgbox">{inline_svg(full_svg, root)}</div>'

    default = DEFAULT_FOCUS if any(l == DEFAULT_FOCUS for l, _ in levels) else "all"
    buttons = "".join(
        f'<button type="button" data-level="{html.escape(level)}" '
        f'aria-pressed="{"true" if level == default else "false"}">{html.escape(level)}</button>'
        for level, _ in levels
    )
    boxes = "".join(
        f'<div class="svgbox" data-level="{html.escape(level)}"'
        f'{"" if level == default else " hidden"}>{inline_svg(svg, root)}</div>'
        for level, svg in levels
    )
    return (
        '<div class="focus"><span class="lbl">unchanged context, in hops:</span>'
        + buttons + "</div>" + boxes
    )


def render_diagrams(spec, root: Path, out_dir: Path) -> str:
    manifest = out_dir / spec.get("manifest", "assets/diagrams/MANIFEST.tsv")
    rows = read_manifest(manifest)
    if not rows:
        return '<p class="sub">No PlantUML diagram changed on this branch.</p>'
    notes = spec.get("notes", {})
    only = spec.get("only")
    if only:
        rows = [r for r in rows if r["name"] in only]
    order = {"structural": 0, "sequence": 1}
    rows.sort(key=lambda r: (order.get(r["kind"], 9), r["name"]))
    parts = []
    for r in rows:
        note = notes.get(r["name"], "")
        svg_rel = manifest.parent / r["svg"] if r.get("svg") else None
        body = (
            _focus_views(r, manifest.parent, svg_rel, root)
            if svg_rel and svg_rel.is_file()
            else f'<p class="sub">not rendered — see <code>{html.escape(r["diff_puml"])}</code></p>'
        )
        parts.append(
            f'<div class="diagram">'
            f'<div class="head"><b>{html.escape(r["name"])}</b>'
            f'<span class="badge {"sev-high" if r["status"] == "added" else "sev-low"}">'
            f'{html.escape(r["status"])} · {html.escape(r["kind"])}</span>'
            f'<span>{html.escape(r["source"])}</span></div>'
            + (f"<p>{note}</p>" if note else "")
            + _provenance(r["source"], root)
            + genseq_details(r["source"], root)
            + body + '</div>'
        )
    return "\n".join(parts)


def render_findings(findings) -> str:
    if not findings:
        return '<p class="sub">Nothing outstanding — the automated passes came back clean.</p>'
    items = []
    for f in findings:
        cls, label = SEVERITIES.get(f.get("severity", "info"), SEVERITIES["info"])
        # A finding that shows a snippet already links the file — with a line RANGE — from
        # the snippet's own header. Repeating a bare file:line link just above it says the
        # same thing twice and worse, so the standalone refs only render when there is no
        # snippet to carry them.
        refs = (
            ""
            if f.get("_snippets")
            else "".join(
                f'<a class="srcref" href="vscode://file/{r["abs"]}">{html.escape(r["label"])}</a> '
                for r in f.get("_refs", [])
            )
        )
        items.append(
            f'<li><span class="badge {cls}">{html.escape(label)}</span> '
            f'<span class="f-title">{f["title"]}</span>'
            f'<p>{f["body"]}</p>'
            + (f'<p class="f-why">{f["why"]}</p>' if f.get("why") else "")
            + (f"<p>{refs}</p>" if refs else "")
            + (f.get("_snippets", "") or "")
            + "</li>"
        )
    return '<ol class="findings">' + "\n".join(items) + "</ol>"


# The guide is one of a dozen tabs the reviewer has open, all of them named after the
# branch. The prefix is what makes it findable at a glance in the tab strip.
TITLE_PREFIX = "\U0001F471\U0001F3FB\u200D\u2642\uFE0F "


def resolve_refs(items, root: Path):
    """Turn `path:from-to` strings into {label, abs} so the renderer can link them.

    A reference to a file that is not there is a build failure, not a link. A snippet
    already fails loudly — `extract-snippet.py` cannot cut lines out of nothing — but a
    bare ref used to render whatever it was given, so a path that went stale (a file
    renamed on the base branch, say) reached the reviewer as a deep link that silently
    did nothing when clicked. Failing here costs one build; failing there costs the
    reviewer's trust in every other link on the page.
    """
    out = []
    missing = []
    for ref in items:
        rel, _, pos = ref.rpartition(":")
        start = pos.split("-")[0]
        target = (root / rel).resolve()
        if not target.is_file():
            missing.append(ref)
        out.append({"label": ref, "abs": f"{target}:{start}:1"})
    if missing:
        raise SystemExit(
            "[review] these references point at files that do not exist:\n  "
            + "\n  ".join(missing)
            + "\nFix the path in the content file (a base-branch rename is the usual cause)."
        )
    return out


ANCHOR = re.compile(r'<a\s+([^>]*?)href="(?P<href>[^"]*)"([^>]*)>', re.I)


def open_links_in_new_tabs(doc: str) -> str:
    """Every outbound link leaves the guide in a new tab — a reviewer reading this page
    should never lose their place in it. In-page anchors keep the current tab (a new tab
    for a jump to a section is nonsense).

    `vscode://` gets the new tab too, for the guide read inside VS Code's Simple Browser:
    that is an iframe, and an iframe drops a navigation to a custom scheme on the floor,
    so the click did nothing at all. A top-level tab does not need it — see EDITOR_JS,
    which takes the target back off there rather than strand an about:blank tab behind
    every jump to a file."""

    def fix(m):
        whole = m.group(0)
        href = m.group("href")
        if href.startswith("#") or "target=" in whole.lower():
            return whole
        return whole[:-1] + ' target="_blank" rel="noopener">'

    return ANCHOR.sub(fix, doc)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("content", help="JSON content file")
    ap.add_argument("--out", required=True, help="where to write the HTML")
    args = ap.parse_args(argv)

    root = Path(
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
        ).stdout.strip()
    )
    spec = json.loads(Path(args.content).read_text(encoding="utf-8"))
    out_path = Path(args.out).resolve()
    out_dir = out_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    for f in spec.get("findings", []):
        f["_refs"] = resolve_refs(f.get("refs", []), root)
        f["_snippets"] = "".join(
            snippet_html(s["ref"], s.get("caption"), root) for s in f.get("snippets", [])
        )

    sections = []
    for s in spec.get("sections", []):
        snips = "".join(
            snippet_html(x["ref"], x.get("caption"), root) for x in s.get("snippets", [])
        )
        # An include is a fragment another generator produced (e.g. the complexity delta):
        # rendered by whoever owns that data, pasted in here rather than re-derived.
        inc = ""
        if s.get("includeHtml"):
            inc = (out_dir / s["includeHtml"]).read_text(encoding="utf-8")
        vid = ""
        if s.get("video"):
            # Captions live under the player, driven by the cue list the recorder wrote as it
            # ran, so the narration cannot drift from what the video shows. Plain text swap on
            # timeupdate — no track element, which file:// pages are not allowed to load.
            cues_path = out_dir / s["video"].replace(".webm", ".cues.json")
            cues = json.loads(cues_path.read_text(encoding="utf-8")) if cues_path.is_file() else []
            items = "".join(
                f'<li data-t="{c["t"]:.2f}"><span class="ts">{int(c["t"]) // 60}:'
                f'{int(c["t"]) % 60:02d}</span><span>{html.escape(c["text"])}</span></li>'
                for c in cues
            )
            vid = (
                f'<div class="vidwrap"><video controls preload="metadata" '
                f'src="{html.escape(s["video"])}"></video>'
                f'<ol class="transcript">{items}</ol></div>'
            )
        sections.append(
            f'<h2 id="{html.escape(s["id"])}">{html.escape(s["title"])}</h2>\n'
            f'{expand_snippets(s.get("body", ""), root)}\n{inc}{vid}{snips}'
        )

    city = spec.get("codecity")
    city_html = ""
    if city:
        city_html = (
            f'<h2 id="codecity">{html.escape(city.get("title", "Where it landed in the city"))}</h2>\n'
            f'<p>{city.get("body", "")}</p>\n'
            f'<a class="city" href="{html.escape(city["href"])}" target="_blank" rel="noopener"'
            f' title="Open the interactive Code City in a new tab">'
            f'<img src="{html.escape(city["png"])}" alt="Code City with the branch change set highlighted"></a>\n'
            f'<p class="sub">{city.get("caption", "")}</p>'
        )

    # Chips carry HTML on purpose: a chip is often a link (to the branch on GitHub, to a
    # section further down) or coloured (+added / -removed), and escaping would kill both.
    chips = []
    for c in spec.get("scope", []):
        inner = f'{html.escape(c["label"])} <b>{c["value"]}</b>'
        if c.get("href"):
            chips.append(
                f'<a class="chip chip-link" href="{html.escape(c["href"])}"'
                f'{" target=_blank" if c["href"].startswith("http") else ""}>{inner}</a>'
            )
        else:
            chips.append(f'<span class="chip">{inner}</span>')
    chips = "".join(chips)

    v = spec.get("verdict")
    verdict_html = ""
    if v:
        n = int(v["score"])
        cls = "v-good" if n >= 8 else ("v-mid" if n >= 5 else "v-bad")
        pips = "".join(f'<i class="{"on" if i < n else ""}"></i>' for i in range(10))
        verdict_html = (
            f'<div class="verdict {cls}">'
            f'<div class="score"><b>{n}<small style="font-size:.42em;opacity:.5">/10</small></b>'
            f'<span>{html.escape(v.get("label", ""))}</span>'
            f'<div class="scale">{pips}</div></div>'
            + "<ul>"
            + "".join(f"<li>{b}</li>" for b in v.get("bullets", []))
            + "</ul></div>"
        )

    extra_css = "".join((out_dir / c).read_text(encoding="utf-8") for c in spec.get("extraCss", []))
    # The snippet extractor owns its own token colours, so the page asks it for them
    # rather than keeping a second copy that would drift from the highlighter.
    extra_css += subprocess.run(
        [sys.executable, str(EXTRACT), "--css"],
        capture_output=True,
        text=True,
        check=True,
        cwd=root,
    ).stdout

    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{TITLE_PREFIX}{html.escape(spec.get('title', 'Review guide'))}</title>
<style>{CSS}{extra_css}</style></head>
<body><div class="wrap">
<h1>{html.escape(spec.get('title', 'Review guide'))}</h1>
<p class="sub">{spec.get('subtitle', '')}</p>
<div class="scopebar">{chips}</div>
<div class="lede">{spec.get('summary', '')}</div>
{verdict_html}

<h2 id="first">Look here first</h2>
{render_findings(spec.get('findings', []))}

<h2 id="diagrams">{html.escape(spec.get('diagrams', {}).get('title', 'Diagram deltas'))}</h2>
<p>{spec.get('diagrams', {}).get('body', '')}</p>
{render_diagrams(spec.get('diagrams', {}), root, out_dir)}

{city_html}

{"".join(sections)}

<footer>{spec.get('footer', '')}</footer>
</div>
{CAPTION_JS}
{GENSEQ_JS}
{FOCUS_JS}
{EDITOR_JS}
</body></html>
"""
    doc = open_links_in_new_tabs(doc)
    out_path.write_text(doc, encoding="utf-8")
    print(f"[review] wrote {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
