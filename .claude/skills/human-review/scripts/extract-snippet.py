#!/usr/bin/env python3
"""Lift a line range out of a source file, verbatim, as an HTML snippet block.

A review guide that paraphrases code is a review guide that goes stale the moment
someone edits the file. This exists so the guide never retypes a line: every
snippet in it is cut from the working tree at build time, carries its real line
numbers, and is titled with a `path:12-14` reference that opens the file at that
exact line in VS Code.

Usage:
    extract-snippet.py <path>:<from>-<to> [<path>:<line> ...] [--caption "..."]
    extract-snippet.py --self-test

Emits one <figure class="snippet"> per reference on stdout, ready to paste into
the guide. Paths are repo-relative in the caption and absolute in the vscode://
link, because VS Code resolves nothing itself.
"""
from __future__ import annotations

import argparse
import html
import re
import subprocess
import sys
from pathlib import Path

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_lexer_by_name, get_lexer_for_filename, guess_lexer
from pygments.util import ClassNotFound

REF_RE = re.compile(r"^(?P<path>.+?):(?P<start>\d+)(?:-(?P<end>\d+))?$")

LANG_BY_SUFFIX = {
    ".java": "java",
    ".ts": "typescript",
    ".js": "javascript",
    ".html": "html",
    ".sql": "sql",
    ".py": "python",
    ".sh": "bash",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".puml": "plantuml",
    ".feature": "gherkin",
    ".json": "json",
    ".css": "css",
}

# Highlighting is done here, at extraction time, by Pygments — not by a JS highlighter in
# the page. The guide is a local file that must render offline and survive being emailed
# around, and the language is already known from the filename, so there is nothing for a
# runtime highlighter to work out that we do not know at build time.
LIGHT_STYLE = "friendly"
DARK_STYLE = "github-dark"


def _lexer_for(path: Path, body: str):
    """Filename first (it is authoritative), guessing only as a fallback."""
    try:
        return get_lexer_for_filename(path.name, body)
    except ClassNotFound:
        pass
    lang = LANG_BY_SUFFIX.get(path.suffix)
    if lang:
        try:
            return get_lexer_by_name(lang)
        except ClassNotFound:
            pass
    try:
        return guess_lexer(body)
    except ClassNotFound:
        return None


def stylesheet() -> str:
    """The Pygments token colours, light and dark, scoped to our own code blocks."""
    light = HtmlFormatter(style=LIGHT_STYLE).get_style_defs("pre.code")
    dark = HtmlFormatter(style=DARK_STYLE).get_style_defs("pre.code")
    return (
        f"{light}\n@media (prefers-color-scheme: dark) {{\n{dark}\n}}\n"
        "pre.code .ln { color:inherit; }\n"
    )


def repo_root() -> Path:
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
    )
    return Path(out.stdout.strip())


def parse_ref(ref: str):
    m = REF_RE.match(ref)
    if not m:
        raise SystemExit(f"[extract-snippet] not a path:from-to reference: {ref!r}")
    start = int(m["start"])
    end = int(m["end"]) if m["end"] else start
    if end < start:
        start, end = end, start
    return m["path"], start, end


# A hand-written line range is a guess at where a construct begins and ends, and it is
# wrong in the same two ways every time: it opens on the tail of the comment above the
# code, and it stops a line or two before the closing brace. Both are fixed here rather
# than in each reference, because the reference is written by someone reading the file in
# an editor, where the range is obvious and the off-by-two is not.

COMMENT_LINE = re.compile(r"^\s*(//|#|/\*|\*/|\*(?!\S))")
OPENERS, CLOSERS = "([{", ")]}"
MAX_SNAP = 40


def _first_code_line(lines: list[str], start: int, end: int) -> int:
    """Skip leading comment and blank lines — the snippet is here for the code."""
    i = start
    while i < end and (not lines[i - 1].strip() or COMMENT_LINE.match(lines[i - 1])):
        i += 1
    return i if i <= end else start


def _depth(line: str) -> int:
    """Bracket balance of one line, ignoring anything after a `//`."""
    code = line.split("//")[0]
    return sum(c in OPENERS for c in code) - sum(c in CLOSERS for c in code)


def _closing_line(lines: list[str], start: int, end: int) -> int:
    """Extend `end` until whatever the range opened is closed.

    A snippet that stops at `return vetName;` and never shows the `}` reads as a method
    the reviewer cannot see the end of — and they cannot tell whether that is the range
    or the code. Bounded, so an unbalanced file (or a brace inside a string this does not
    parse) costs a slightly long snippet rather than the whole rest of the file.
    """
    depth = sum(_depth(l) for l in lines[start - 1 : end])
    limit = min(len(lines), end + MAX_SNAP)
    while depth > 0 and end < limit:
        end += 1
        depth += _depth(lines[end - 1])
    return end


def render(ref: str, caption: str | None, root: Path) -> str:
    rel, start, end = parse_ref(ref)
    path = (root / rel).resolve()
    if not path.is_file():
        raise SystemExit(f"[extract-snippet] no such file: {rel}")

    lines = path.read_text(encoding="utf-8").splitlines()
    if start > len(lines):
        raise SystemExit(f"[extract-snippet] {rel} has {len(lines)} lines, asked for {start}")
    end = min(end, len(lines))
    start = _first_code_line(lines, start, end)
    end = _closing_line(lines, start, end)
    body = lines[start - 1 : end]

    # Strip the common indent so a deeply nested method does not read as a column
    # of whitespace, but keep the relative shape.
    indents = [len(l) - len(l.lstrip()) for l in body if l.strip()]
    shift = min(indents) if indents else 0

    label = f"{rel}:{start}-{end}" if end != start else f"{rel}:{start}"
    link = f"vscode://file/{path}:{start}:1"
    lang = LANG_BY_SUFFIX.get(path.suffix, "")

    dedented = [l[shift:] if l.strip() else "" for l in body]
    lexer = _lexer_for(path, "\n".join(dedented))
    if lexer is not None:
        # nowrap=True keeps Pygments from adding its own <pre>/<div>, and it closes and
        # reopens token spans at every newline, so splitting per line stays well-formed
        # even through a block comment or a multi-line string.
        rendered = (
            highlight("\n".join(dedented), lexer, HtmlFormatter(nowrap=True))
            .rstrip("\n")
            .split("\n")
        )
    else:
        rendered = [html.escape(l) for l in dedented]

    numbered = "\n".join(
        f'<span class="ln">{n}</span>{code}' for n, code in zip(range(start, end + 1), rendered)
    )

    cap = f'<figcaption class="snippet-note">{html.escape(caption)}</figcaption>' if caption else ""
    return (
        f'<figure class="snippet">\n'
        f"{cap}"
        f'<a class="srcref" href="{html.escape(link)}" title="Open in VS Code">{html.escape(label)}</a>\n'
        f'<pre class="code lang-{lang}"><code>{numbered}</code></pre>\n'
        f"</figure>\n"
    )


def self_test() -> int:
    """The one case worth pinning: a range is lifted verbatim, numbered from `start`."""
    root = repo_root()
    me = Path(__file__).resolve().relative_to(root)
    out = render(f"{me}:1-2", None, root)
    assert "srcref" in out and f"{me}:1-2" in out, out
    assert '<span class="ln">1</span>' in out and "usr/bin/env python3" in out, out
    assert 'class="c"' in out or 'class="ch"' in out, "shebang should be highlighted as a comment"
    print("[extract-snippet] self-test ok", file=sys.stderr)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("refs", nargs="*", metavar="path:from-to")
    ap.add_argument("--caption", help="one-line note shown above the snippet")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument(
        "--css",
        action="store_true",
        help="print the syntax-highlighting stylesheet these snippets need",
    )
    args = ap.parse_args(argv)

    if args.css:
        print(stylesheet())
        return 0
    if args.self_test:
        return self_test()
    if not args.refs:
        ap.error("give at least one path:from-to reference")

    root = repo_root()
    for ref in args.refs:
        sys.stdout.write(render(ref, args.caption, root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
