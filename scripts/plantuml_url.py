#!/usr/bin/env python3
"""Encode a .puml file into a plantuml.com render URL.

Why this exists: the READMEs render committed diagrams through the PlantUML
*proxy*, which needs a publicly fetchable URL. A review-time diff diagram is
never committed (pr-diff/ is git-ignored), so there is no URL to proxy. This
encodes the source straight into the URL instead, so the picture travels with
the link and needs nothing hosted.

Encoding is PlantUML's own: raw DEFLATE (zlib stream minus its 2-byte header
and 4-byte checksum), then base64 over PlantUML's alphabet rather than the
standard one. Do NOT prepend the `~1` format marker — plantuml.com accepts the
URL but silently renders an empty diagram.

Pure standard library, matching puml_diff.py next door.

Usage:
    plantuml_url.py diagram.puml [--format svg|png] [--server URL]
"""
from __future__ import annotations

import argparse
import sys
import zlib
import base64
from pathlib import Path

STANDARD_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
PLANTUML_B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
_TO_PLANTUML = str.maketrans(STANDARD_B64, PLANTUML_B64)

DEFAULT_SERVER = "https://www.plantuml.com/plantuml"

# plantuml.com rejects very long URLs; warn well before the render silently fails.
URL_WARN_LENGTH = 4000


def encode(source: str) -> str:
    """PlantUML-encode diagram source into the path segment of a render URL."""
    deflated = zlib.compress(source.encode("utf-8"), 9)[2:-4]
    return base64.b64encode(deflated).decode("ascii").translate(_TO_PLANTUML)


def url_for(source: str, fmt: str = "svg", server: str = DEFAULT_SERVER) -> str:
    return f"{server.rstrip('/')}/{fmt}/{encode(source)}"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("puml", help="Diagram source (.puml); '-' reads stdin")
    ap.add_argument("--format", default="svg", choices=("svg", "png", "txt"),
                    help="Render format (default: svg)")
    ap.add_argument("--server", default=DEFAULT_SERVER, help="PlantUML server base URL")
    args = ap.parse_args(argv)

    source = sys.stdin.read() if args.puml == "-" else Path(args.puml).read_text(encoding="utf-8")
    url = url_for(source, args.format, args.server)

    if len(url) > URL_WARN_LENGTH:
        print(f"[plantuml-url] warning: URL is {len(url)} chars — the server may reject it",
              file=sys.stderr)

    print(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
