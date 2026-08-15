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
    build-review-html.py content.json --out review/review.html
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
.diagram .head span { color:var(--muted); font-size:.82rem; font-family:ui-monospace,Menlo,monospace; }
.diagram .svgbox { overflow-x:auto; margin-top:.7rem; background:#fff; border-radius:6px; padding:.6rem; }
.diagram .svgbox svg { max-width:100%; height:auto; display:block; margin:0 auto; }
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
.vidwrap { max-width:900px; margin:1rem 0; }
.vidwrap video { width:100%; display:block; border:1px solid var(--line);
                  border-radius:8px 8px 0 0; background:#000; }
.vidcap { border:1px solid var(--line); border-top:0; border-radius:0 0 8px 8px;
          background:var(--card); padding:.7rem .95rem; min-height:3.2rem;
          font-size:.95rem; color:var(--fg); }
.vidcap:empty::before { content:"Press play — each step is narrated here."; color:var(--muted); }
video.vid { width:100%; max-width:900px; border:1px solid var(--line); border-radius:8px; display:block; margin:1rem 0; background:#000; }
footer { margin-top:3.5rem; padding-top:1rem; border-top:1px solid var(--line); color:var(--muted); font-size:.85rem; }
"""


CAPTION_JS = """<script>
document.querySelectorAll('.vidwrap').forEach(function (wrap) {
  var video = wrap.querySelector('video');
  var cap = wrap.querySelector('.vidcap');
  var cues = JSON.parse(video.dataset.cues || '[]');
  if (!cues.length) return;
  video.addEventListener('timeupdate', function () {
    var text = '';
    for (var i = 0; i < cues.length; i++) {
      if (cues[i].t <= video.currentTime) text = cues[i].text; else break;
    }
    if (cap.textContent !== text) cap.textContent = text;
  });
});
</script>"""


SNIPPET_TOKEN = re.compile(r"\{\{snippet:(?P<ref>[^|}]+)(?:\|(?P<caption>[^}]*))?\}\}")


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


def inline_svg(path: Path) -> str:
    """Inline rather than <img src>: the guide must survive being emailed as one file."""
    svg = path.read_text(encoding="utf-8")
    svg = re.sub(r"^<\?xml[^>]*\?>\s*", "", svg)
    svg = re.sub(r"<!DOCTYPE[^>]*>\s*", "", svg)
    return svg


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
            inline_svg(svg_rel)
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
            + f'<div class="svgbox">{body}</div></div>'
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


def resolve_refs(items, root: Path):
    """Turn `path:from-to` strings into {label, abs} so the renderer can link them."""
    out = []
    for ref in items:
        rel, _, pos = ref.rpartition(":")
        start = pos.split("-")[0]
        out.append({"label": ref, "abs": f"{(root / rel).resolve()}:{start}:1"})
    return out


ANCHOR = re.compile(r'<a\s+([^>]*?)href="(?P<href>[^"]*)"([^>]*)>', re.I)


def open_links_in_new_tabs(doc: str) -> str:
    """Every outbound link leaves the guide in a new tab — a reviewer reading this page
    should never lose their place in it. In-page anchors keep the current tab (a new tab
    for a jump to a section is nonsense), and `vscode://` hands off to the editor without
    navigating at all."""

    def fix(m):
        whole = m.group(0)
        href = m.group("href")
        if href.startswith("#") or href.startswith("vscode:") or "target=" in whole.lower():
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
            vid = (
                f'<div class="vidwrap"><video controls preload="metadata" '
                f'src="{html.escape(s["video"])}" data-cues="{html.escape(json.dumps(cues))}">'
                f'</video><div class="vidcap"></div></div>'
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
<title>{html.escape(spec.get('title', 'Review guide'))}</title>
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
</body></html>
"""
    doc = open_links_in_new_tabs(doc)
    out_path.write_text(doc, encoding="utf-8")
    print(f"[review] wrote {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
