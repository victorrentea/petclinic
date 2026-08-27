#!/usr/bin/env python3
"""Join the BEFORE and AFTER takes into one .mp4, each behind a title card.

Called by combine-bug40.sh — see that script's header for the why.

The title cards are PNGs drawn with PIL and turned into short clips, for the same reason
annotate-feature-video.py composites its captions that way: this ffmpeg has neither freetype
nor libass, so `drawtext` and the `subtitles` filter are both unavailable.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 800
CARD_SECONDS = 2.4
BG = (11, 13, 20)
ACCENT_BAD = (255, 69, 88)
ACCENT_GOOD = (54, 211, 153)
MUTED = (150, 160, 176)
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def centered(draw: ImageDraw.ImageDraw, y: int, text: str, fnt, fill) -> int:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=fnt)
    draw.text(((W - (right - left)) // 2 - left, y), text, font=fnt, fill=fill)
    return bottom - top


def title_card(path: Path, kicker: str, headline: str, subline: str, accent) -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    y = 300
    y += centered(draw, y, kicker, font(30), MUTED) + 34
    y += centered(draw, y, headline, font(78), accent) + 30
    centered(draw, y, subline, font(30), (226, 232, 240))
    img.save(path)


def duration(video: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(video)],
                          capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def stamp(seconds: float) -> str:
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def srt_for(cues_path: Path, offset: float, video_end: float, start_index: int,
            banner: str, banner_until: float) -> tuple[list[str], int]:
    """The take's own cues, shifted onto the joined timeline, behind a card-length banner."""
    blocks = [f"{start_index}\n{stamp(offset - CARD_SECONDS)} --> {stamp(banner_until)}\n{banner}\n"]
    index = start_index + 1
    cues = json.loads(cues_path.read_text()) if cues_path.exists() else []
    for i, cue in enumerate(cues):
        start = offset + float(cue["t"])
        stop = offset + float(cues[i + 1]["t"]) if i + 1 < len(cues) else video_end
        text = cue["text"]
        text = "[!] " + text.lstrip("⚠ ").strip() if text.startswith("⚠") else text
        blocks.append(f"{index}\n{stamp(start)} --> {stamp(stop)}\n{text}\n")
        index += 1
    return blocks, index


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    before, after, out = (Path(p).resolve() for p in sys.argv[1:4])
    for src in (before, after):
        if not src.exists():
            print(f"[combine] missing take: {src}", file=sys.stderr)
            return 2
    out.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        cards = {
            "before": (tmp / "card-before.png", "GitHub issue #40", "BEFORE",
                      "Any date at all — the form and the API both wave it through", ACCENT_BAD),
            "after": (tmp / "card-after.png", "GitHub issue #40", "AFTER",
                      "Between the pet's birth date and one year from today", ACCENT_GOOD),
        }
        for path, kicker, headline, subline, accent in cards.values():
            title_card(path, kicker, headline, subline, accent)

        # Everything is normalised to one codec/size/rate here, so the concat below is a
        # straight copy — mixing a still-image clip with two VP8 recordings otherwise ends
        # in a stream ffmpeg refuses to join.
        segments = []
        for name, source in (("card-before", cards["before"][0]), ("clip-before", before),
                            ("card-after", cards["after"][0]), ("clip-after", after)):
            segment = tmp / f"{name}.mp4"
            if source.suffix == ".png":
                cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", str(CARD_SECONDS),
                      "-i", str(source)]
            else:
                cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(source)]
            cmd += ["-vf", f"scale={W}:{H},format=yuv420p", "-r", "25",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-an", str(segment)]
            subprocess.run(cmd, check=True)
            segments.append(segment)

        listing = tmp / "segments.txt"
        listing.write_text("".join(f"file '{s}'\n" for s in segments))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", str(listing), "-c", "copy", str(out)], check=True)

        before_start = duration(segments[0])
        before_end = before_start + duration(segments[1])
        after_start = before_end + duration(segments[2])
        after_end = after_start + duration(segments[3])

    blocks, next_index = srt_for(Path(str(before).replace(".webm", ".cues.json")), before_start,
                                before_end, 1, "BEFORE — issue #40 reproduced", before_start)
    more, _ = srt_for(Path(str(after).replace(".webm", ".cues.json")), after_start,
                      after_end, next_index, "AFTER — issue #40 fixed", after_start)
    srt = out.with_suffix(".srt")
    srt.write_text("\n".join(blocks + more), encoding="utf-8")

    print(f"[combine] {out}  ({after_end:.1f}s)", file=sys.stderr)
    print(f"[combine] {srt}  ({len(blocks + more)} captions)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
