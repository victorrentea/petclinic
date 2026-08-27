#!/usr/bin/env python3
"""Turn a recorder's cues.json into a sidecar .srt.

The captions are already burned into the annotated .webm; this is the same text in a form a
player, an editor or a reviewer can read without watching — each cue running until the next
one starts, the last until the end of the film.

Usage:
    cues-to-srt.py <cues.json> <out.srt> [video-for-duration]
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

TAIL_SECONDS = 4.0  # how long the final caption stays up when no duration is available


def stamp(seconds: float) -> str:
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def video_duration(video: Path) -> float | None:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
            str(video)],
            capture_output=True, text=True, check=True).stdout.strip()
        return float(out)
    except (OSError, ValueError, subprocess.CalledProcessError):
        return None


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    cues = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    end = video_duration(Path(sys.argv[3])) if len(sys.argv) > 3 else None

    blocks = []
    for i, cue in enumerate(cues):
        start = float(cue["t"])
        if i + 1 < len(cues):
            stop = float(cues[i + 1]["t"])
        else:
            stop = end if end and end > start else start + TAIL_SECONDS
        text = cue["text"].lstrip("⚠ ").strip()
        if cue["text"].startswith("⚠"):
            text = "[!] " + text
        blocks.append(f"{i + 1}\n{stamp(start)} --> {stamp(stop)}\n{text}\n")

    out.write_text("\n".join(blocks), encoding="utf-8")
    print(f"[srt] {len(blocks)} captions -> {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
