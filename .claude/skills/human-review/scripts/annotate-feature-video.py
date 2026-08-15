#!/usr/bin/env python3
"""Burn the narration and a spotlight on the element each cue is about into the raw clip.

`record-feature-video.sh` films the app but films it *silently*: Playwright does not capture
the mouse pointer, so a reviewer watching the raw .webm cannot tell which of the forty widgets
on screen just changed. The recorder therefore writes, per cue, the on-screen box of the
element the narration is talking about; this turns those boxes into something visible.

Per boxed cue: a bright rectangle just outside the element, the rest of the frame dimmed a
little so the rectangle reads as a spotlight, both stepped down over ~1.8s so the emphasis
fades instead of snapping off (ffmpeg has no alpha-animated drawbox — the fade is a handful
of `enable`-gated drawboxes with decreasing alpha).

The narration is rendered to PNG bars with PIL and composited with `overlay`, not drawn with
`drawtext`: this ffmpeg has neither freetype nor libass (no drawtext, no subtitles filter),
and even where it does, feeding curly quotes and em dashes through a filtergraph is where
these scripts break.

Usage:
    annotate-feature-video.py <raw.webm> <cues.json> <out.webm> [--offset SECONDS]
"""
from __future__ import annotations
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ACCENT = (255, 45, 85)
BAR_BG = (11, 13, 20, 228)
BAR_BG_WARN = (58, 12, 20, 220)
BAR_EDGE = (255, 255, 255, 46)
BAR_MAX_W = 1140
BAR_BOTTOM_MARGIN = 26
BAR_PAD_X, BAR_PAD_Y = 24, 16
LINE_H = 34
FONT_SIZE = 25
FONTS = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
  "/Library/Fonts/Arial.ttf",
]

# Box padding keeps the rectangle off the element, and the thickness grows inward from that
# padded rect — so even the fattest step sits in the gutter rather than over the widget.
BOX_PAD = 6
# (duration, dim alpha of the surround, outline thickness, outline alpha)
PHASES = [
  (0.90, 0.24, 5, 1.00),
  (0.30, 0.17, 4, 0.78),
  (0.30, 0.10, 3, 0.52),
  (0.30, 0.05, 2, 0.28),
]


def font() -> ImageFont.FreeTypeFont:
  for path in FONTS:
    if Path(path).is_file():
      return ImageFont.truetype(path, FONT_SIZE)
  raise SystemExit("no usable TTF found for the captions")


def wrap(text: str, fnt, draw, max_w: int) -> list[str]:
  lines, line = [], ""
  for word in text.split():
    probe = f"{line} {word}".strip()
    if line and draw.textlength(probe, font=fnt) > max_w:
      lines.append(line)
      line = word
    else:
      line = probe
  if line:
    lines.append(line)
  return lines


def caption_y(box: dict | None, bar_h: int, frame_h: int) -> int:
  """Bottom of the frame, unless the bar would sit on top of the element being spotlit."""
  bottom = frame_h - bar_h - BAR_BOTTOM_MARGIN
  top = BAR_BOTTOM_MARGIN
  if not box:
    return bottom
  hits_bottom = box["y"] + box["height"] + BOX_PAD > bottom - 10
  hits_top = box["y"] - BOX_PAD < top + bar_h + 10
  return top if hits_bottom and not hits_top else bottom


def caption_png(text: str, path: Path, fnt) -> None:
  """One translucent bar, sized to its own text, transparent everywhere else."""
  warn = text.startswith("⚠")
  # The warning glyph has no place in Arial — it would render as tofu. The red bar says it.
  text = text.lstrip("⚠ ").strip() if warn else text
  probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
  lines = wrap(text, fnt, probe, BAR_MAX_W - 2 * BAR_PAD_X)
  text_w = max(probe.textlength(ln, font=fnt) for ln in lines)
  w = int(min(BAR_MAX_W, text_w + 2 * BAR_PAD_X))
  h = LINE_H * len(lines) + 2 * BAR_PAD_Y
  img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
  d = ImageDraw.Draw(img)
  d.rounded_rectangle([0, 0, w - 1, h - 1], radius=10,
      fill=BAR_BG_WARN if warn else BAR_BG, outline=BAR_EDGE, width=1)
  if warn:
    d.rounded_rectangle([0, 0, 5, h - 1], radius=3, fill=ACCENT + (255,))
  for i, ln in enumerate(lines):
    lw = d.textlength(ln, font=fnt)
    d.text(((w - lw) / 2, BAR_PAD_Y + i * LINE_H + 2), ln, font=fnt, fill=(255, 255, 255, 240))
  img.save(path)


def probe_size(video: Path) -> tuple[int, int, float]:
  cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
      "stream=width,height:format=duration", "-of", "json", str(video)]
  out = subprocess.run(cmd, check=True, capture_output=True, text=True).stdout
  meta = json.loads(out)
  stream = meta["streams"][0]
  return stream["width"], stream["height"], float(meta["format"]["duration"])


def spotlight(box: dict, w: int, h: int, start: float, budget: float) -> list[str]:
  """Rectangle + dimmed surround, stepped down over `budget` seconds."""
  x0 = max(0, int(box["x"]) - BOX_PAD)
  y0 = max(0, int(box["y"]) - BOX_PAD)
  x1 = min(w, int(box["x"] + box["width"]) + BOX_PAD)
  y1 = min(h, int(box["y"] + box["height"]) + BOX_PAD)
  if x1 - x0 < 4 or y1 - y0 < 4:
    return []
  filters, t = [], start
  span = sum(p[0] for p in PHASES)
  for dur, dim, thick, alpha in PHASES:
    end = min(t + dur * budget / span, start + budget)
    if end - t < 0.02:
      break
    gate = f"enable=between(t\\,{t:.3f}\\,{end:.3f})"
    for bx, by, bw, bh in (
        (0, 0, w, y0),
        (0, y1, w, h - y1),
        (0, y0, x0, y1 - y0),
        (x1, y0, w - x1, y1 - y0)):
      if bw > 0 and bh > 0:
        filters.append(
            f"drawbox=x={bx}:y={by}:w={bw}:h={bh}:color=black@{dim}:t=fill:{gate}")
    filters.append(
        f"drawbox=x={x0}:y={y0}:w={x1 - x0}:h={y1 - y0}:"
        f"color=0x{ACCENT[0]:02x}{ACCENT[1]:02x}{ACCENT[2]:02x}@{alpha}:t={thick}:{gate}")
    t = end
  return filters


def build(raw: Path, cues: list[dict], out: Path, tmp: Path, offset: float) -> None:
  w, h, duration = probe_size(raw)
  fnt = font()
  windows = []
  for i, cue in enumerate(cues):
    start = max(0.0, cue["t"] + offset)
    if i == 0:
      start = 0.0
    end = cues[i + 1]["t"] + offset if i + 1 < len(cues) else duration
    windows.append((start, min(end, duration)))

  emphasis = []
  for cue, (start, end) in zip(cues, windows):
    if not cue.get("box"):
      continue
    budget = min(1.8, max(0.6, end - max(start, cue["t"] + offset) - 0.05))
    emphasis += spotlight(cue["box"], w, h, max(start, cue["t"] + offset), budget)

  chain = ["format=rgba"] + emphasis
  graph = [f"[0:v]{','.join(chain)}[emph]"]
  inputs, prev = [], "emph"
  for i, (cue, (start, end)) in enumerate(zip(cues, windows)):
    png = tmp / f"cue{i:02d}.png"
    caption_png(cue["text"], png, fnt)
    inputs += ["-i", str(png)]
    nxt = f"v{i}"
    y = caption_y(cue.get("box"), Image.open(png).height, h)
    graph.append(
        f"[{prev}][{i + 1}:v]overlay=x=(W-w)/2:y={y}:"
        f"format=rgb:enable=between(t\\,{start:.3f}\\,{end:.3f})[{nxt}]")
    prev = nxt
  graph.append(f"[{prev}]format=yuv420p[vout]")

  encode = ["-filter_complex", ";".join(graph), "-map", "[vout]", "-an",
      "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1",
      "-deadline", "good", "-cpu-used", "4", str(out)]
  subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw)] + inputs + encode, check=True)


def main() -> int:
  ap = argparse.ArgumentParser()
  ap.add_argument("raw")
  ap.add_argument("cues")
  ap.add_argument("out")
  ap.add_argument("--offset", type=float, default=0.0,
      help="shift every cue against the video clock, in seconds")
  args = ap.parse_args()

  cues = json.loads(Path(args.cues).read_text(encoding="utf-8"))
  if not cues:
    print("[annotate] no cues — nothing to burn in", file=sys.stderr)
    return 1
  with tempfile.TemporaryDirectory() as td:
    build(Path(args.raw), cues, Path(args.out), Path(td), args.offset)
  boxed = sum(1 for c in cues if c.get("box"))
  print(f"[annotate] {len(cues)} captions, {boxed} spotlights -> {args.out}", file=sys.stderr)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
