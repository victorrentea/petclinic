#!/usr/bin/env python3
"""Diff two PlantUML class / package / ER diagrams and render the delta in red.

Given a previous snapshot (OLD) and a current one (NEW) — e.g. the last committed
diagram vs the working copy at review time — emit a single merged diagram built on
NEW, where:

  * added element (class/enum/entity/package) -> red header
  * added member / attribute                  -> red line
  * removed member                            -> red struck-through line (kept in place)
  * removed element                           -> red header, all members struck
  * added relationship                        -> red connector + red label
  * removed relationship                      -> red connector + struck red label (re-added)

This is the review-time counterpart to the snapshot generators: the committed
diagram stays a plain picture of current reality, and the *diff* is computed on
demand from two snapshots rather than baked into git.

Pure standard library — no third-party deps. Handles the diagram families this
repo generates: class (DomainModel), ER/entity (DB), and package/component (C4).

Usage:
    puml_diff.py OLD.puml NEW.puml [--out merged.puml]
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field

# Element headers open with one of these keywords (optionally after a modifier
# like `abstract`). Used to recognise a body-less element declaration.
ELEMENT_KEYWORDS = {
    "abstract", "class", "enum", "interface", "entity", "package", "component",
    "node", "database", "object", "struct", "protocol", "rectangle", "folder",
    "frame", "cloud", "annotation",
}

# A connector is a run of line-drawing characters; these substrings mark one.
_CONNECTOR = re.compile(r"--|\.\.|->|<-|<\||\|>|\*-|-\*|o-|-o")

# PlantUML's component shorthand — `[Domain] <<..domain>>`, as packages.puml uses.
# Without this, such a declaration matches no keyword, falls through to the
# preamble, and is copied verbatim from NEW: an added component would never be
# highlighted. Relationship lines also open with `[`, but parse() tries
# _split_relationship first, so they are consumed before this is consulted.
_BRACKET_COMPONENT = re.compile(r"^\[([^\]]+)\]")


def _strip_markup(s: str) -> str:
    """Normalise a line to its plain content: drop any diff colouring/strikeout."""
    s = re.sub(r"</?color[^>]*>", "", s)
    s = s.replace("<s>", "").replace("</s>", "")
    s = re.sub(r"\[#[0-9A-Za-z_]+\]", "", s)      # coloured connector: -[#red]-
    s = s.replace("#line:red;text:red", "")        # coloured element header
    return s.strip()


def _red(text: str) -> str:
    return f"<color:red>{text}</color>"


def _struck(text: str) -> str:
    return f"<color:red><s>{text}</s></color>"


def _struck_header(header: str) -> str:
    """A removed element's header: its display name struck through in red, kept
    addressable by an alias so relationships pointing at it still resolve.

    `class Role` -> `class "<struck>Role</struck>" as Role`;
    `entity "owners" as owners` -> `entity "<struck>owners</struck>" as owners`.
    """
    bracket = _BRACKET_COMPONENT.match(header)
    if bracket:                                # [Notification] <<..notification>>
        name = bracket.group(1)
        # Switch to the `component "display" as Alias` form: a struck name inside
        # the brackets would declare a *differently named* component, so the
        # relationships still pointing at [Notification] would spawn a second box.
        rest = header[bracket.end():].strip()
        return f'component "{_struck(name)}" as {name}' + (f" {rest}" if rest else "")
    if '"' in header:                          # already has a quoted display name
        before, disp, after = header.split('"', 2)
        return f'{before}"{_struck(disp)}"{after}'
    parts = header.split()                     # class Role / abstract class Foo / enum Type
    name = parts[-1]
    keyword = " ".join(parts[:-1])
    return f'{keyword} "{_struck(name)}" as {name}'


# `[[url{tooltip} label]]`, or the older `text [[url{tooltip}]]`. The domain-model
# generator hangs one on every class and field so a reviewer can click through to the
# source, and the line it points at moves whenever anything above it moves. That must not
# read as a change: identity is what the diagram *says*, and a link is how you get
# somewhere else. The tooltip holds spaces, so the url and the label are matched apart.
_LINK = re.compile(
    r"\[\[(?P<url>[^\s\[\]{]+)(?P<tip>\{[^}]*\})?(?:\s+(?P<label>[^\]]*))?\]\]"
)


def _identity(s: str) -> str:
    """A line reduced to what it means: every link replaced by the text it shows."""
    return " ".join(_LINK.sub(lambda m: m.group("label") or "", s).split())


def _endpoint(side: str) -> str:
    """The element a relationship end names, without the cardinality glued to it.

    `_split_relationship` hands back `User "1"` and `"0..*" Role`, because a cardinality
    change *is* a change to the relationship. It is not a change to which elements the
    relationship joins, which is what a focus level walks.
    """
    tokens = [t for t in _identity(side).split() if not t.startswith('"')]
    return " ".join(tokens) if tokens else _identity(side)


def _member(text: str, paint=None) -> str:
    """One member line, with its link *wrapping* the text rather than trailing it.

    PlantUML prints the URL itself when a `[[...]]` carries no label, so a member written
    as `id : Integer [[src://…]]` renders as its own name followed by sixty characters of
    absolute path. The generator emits the wrapped form now — but the base side of a diff
    was written before it did, and a delta has to stay readable against a base that
    predates every change in it. So both forms are normalised here, on the way out.

    The diff colouring goes on the label, inside the link, so a struck member is still a
    struck member and still clickable.
    """
    m = _LINK.search(text)
    if not m:
        return paint(text) if paint else text
    visible = (m.group("label") or _LINK.sub("", text)).strip()
    target = m.group("url") + (m.group("tip") or "")
    return f"[[{target} {paint(visible) if paint else visible}]]"


def _element_name(header: str) -> str:
    """Extract the identity of an element from its (clean) header line."""
    h = _identity(header)
    bracket = _BRACKET_COMPONENT.match(h)
    if bracket:                           # [Domain] <<..domain>>
        return f"[{bracket.group(1)}]"    # keyed as written, so relationships resolve
    if " as " in h:                       # entity "owners" as owners
        return h.split(" as ")[-1].strip()
    if '"' in h:                          # package "com.x.y" / entity "owners"
        return h.split('"')[1]
    return h.split()[-1]                  # class Owner / enum Type


def _is_element_header(clean: str) -> bool:
    tokens = clean.split()
    if tokens and tokens[0] in ELEMENT_KEYWORDS:
        return True
    return bool(_BRACKET_COMPONENT.match(clean))


def _split_relationship(clean: str):
    """Parse `Left "card" <conn> "card" Right : label` → (left, conn, right, label).

    Returns None when the line is not a relationship. Quoted cardinalities such as
    "0..*" are skipped so their dots aren't mistaken for the connector.
    """
    body, sep, label = clean.partition(" : ")
    label = label.strip() if sep else None
    tokens = body.split()
    conn_idx = None
    for i, tok in enumerate(tokens):
        if tok.startswith('"'):           # cardinality, not the connector
            continue
        if _CONNECTOR.search(tok):
            conn_idx = i
            break
    if conn_idx is None or conn_idx == 0 or conn_idx == len(tokens) - 1:
        return None
    left = " ".join(tokens[:conn_idx])
    conn = tokens[conn_idx]
    right = " ".join(tokens[conn_idx + 1:])
    return left, conn, right, label


def _colorize_connector(conn: str) -> str:
    """Inject `[#red]` into a connector so PlantUML draws the line red.

    `--` -> `-[#red]-`, `-->` -> `-[#red]->`, `||--o{` -> `||-[#red]-o{`, `..>` -> `.[#red].>`.
    """
    for i, ch in enumerate(conn):
        if ch in "-.":
            return conn[:i + 1] + "[#red]" + conn[i + 1:]
    return conn


@dataclass
class Element:
    header: str                      # clean, e.g. "class Owner" / 'entity "owners" as owners'
    has_body: bool
    members: list = field(default_factory=list)   # clean member lines, in order


@dataclass
class Diagram:
    preamble: list = field(default_factory=list)  # directive lines before the first element
    elements: dict = field(default_factory=dict)  # name -> Element (insertion order)
    relationships: list = field(default_factory=list)  # list[(left, conn, right, label)]


# Lines that describe the diagram rather than its content. Matched *before* anything
# else, because some of them look like content: `footer domain/*.java -> DomainModel.puml`
# parses as a relationship on the strength of its arrow, and every directive after it —
# `hide empty members`, the skinparams, the legend — was then dropped from the delta as
# "past the preamble". The rendered diff quietly disagreed with the diagram it was a diff of.
DIRECTIVE_RE = re.compile(
    r"^(?:!|title|caption|footer|header|legend|endlegend|end\s+legend|hide|show|skinparam|"
    r"scale|autonumber|left\s+to\s+right\s+direction|top\s+to\s+bottom\s+direction)\b",
    re.I,
)
LEGEND_OPEN_RE = re.compile(r"^legend\b", re.I)
LEGEND_CLOSE_RE = re.compile(r"^end\s*legend\b", re.I)


def parse(puml: str) -> Diagram:
    d = Diagram()
    current = None            # name of the element whose body we're inside
    seen_content = False      # have we passed the preamble yet?
    in_legend = False         # a legend's body is prose, and prose looks like anything

    for raw in puml.splitlines():
        clean = _strip_markup(raw.strip())
        if not clean or clean.startswith("@start") or clean == "@enduml":
            continue

        if in_legend:
            d.preamble.append(raw.rstrip())
            in_legend = not LEGEND_CLOSE_RE.match(clean)
            continue

        if DIRECTIVE_RE.match(clean):
            d.preamble.append(raw.rstrip())
            in_legend = bool(LEGEND_OPEN_RE.match(clean)) and not LEGEND_CLOSE_RE.match(clean)
            continue

        if current is not None:
            if clean == "}":
                current = None
            else:
                d.elements[current].members.append(clean)
            continue

        if clean.endswith("{"):                      # element opening a body
            header = clean[:-1].strip()
            name = _element_name(header)
            d.elements[name] = Element(header=header, has_body=True)
            current = name
            seen_content = True
            continue

        rel = _split_relationship(clean)
        if rel is not None:
            d.relationships.append(rel)
            seen_content = True
            continue

        if _is_element_header(clean):                # body-less element
            d.elements[_element_name(clean)] = Element(header=clean, has_body=False)
            seen_content = True
            continue

        if not seen_content:                         # directive: title/skinparam/…
            d.preamble.append(raw.rstrip())

    return d


def _rel_key(rel) -> str:
    left, right, label = rel[0], rel[2], rel[3]     # identity ignores connector styling
    return f"{_identity(left)} {_identity(right)} :: {_identity(label or '')}"


def _render_relationship(rel, mark) -> str:
    left, conn, right, label = rel
    if mark:
        conn = _colorize_connector(conn)
    line = f"{left} {conn} {right}"
    if mark == "added" and label:
        line += f" : {_red(label)}"
    elif mark == "removed":                     # struck label; label-less lines get a marker
        line += f" : {_struck(label) if label else _struck('(removed)')}"
    elif label:
        line += f" : {label}"
    return line


ALL = "all"


def _impacted(old: Diagram, new: Diagram) -> set:
    """The elements this change actually touched.

    An element is impacted when it is new, gone, has a member added or removed, or sits
    at either end of a relationship that appeared or disappeared. Everything else in the
    diagram is context — true before the change and true after it.
    """
    touched = set()
    for name, el in new.elements.items():
        if name not in old.elements:
            touched.add(name)
            continue
        before = {_identity(m) for m in old.elements[name].members}
        after = {_identity(m) for m in el.members}
        if before != after:
            touched.add(name)
    touched |= set(old.elements) - set(new.elements)

    old_keys = {_rel_key(r) for r in old.relationships}
    new_keys = {_rel_key(r) for r in new.relationships}
    for r in new.relationships:
        if _rel_key(r) not in old_keys:
            touched |= {_endpoint(r[0]), _endpoint(r[2])}
    for r in old.relationships:
        if _rel_key(r) not in new_keys:
            touched |= {_endpoint(r[0]), _endpoint(r[2])}
    return touched


def _within(old: Diagram, new: Diagram, hops: int) -> set:
    """The impacted elements, grown outwards `hops` relationships at a time.

    The DomainModel and DB diagrams are large enough that a two-line change arrives as a
    wall the reviewer has to search for red in. Zero hops is the change alone; each hop
    adds what it is directly attached to, which is what makes a change *readable* — a new
    column means little without the table it hangs off, and a new relationship means
    little without both things it relates.

    Both sides' relationships are walked, so an element pulled in by an edge this change
    deleted is reachable too.
    """
    frontier = _impacted(old, new)
    keep = set(frontier)
    edges = old.relationships + new.relationships
    for _ in range(hops):
        nxt = set()
        for raw_left, _conn, raw_right, _label in edges:
            left, right = _endpoint(raw_left), _endpoint(raw_right)
            if left in keep and right not in keep:
                nxt.add(right)
            if right in keep and left not in keep:
                nxt.add(left)
        if not nxt:
            break
        keep |= nxt
    return keep


def diff(old: Diagram, new: Diagram, focus=ALL) -> str:
    names = set(old.elements) | set(new.elements)
    keep = names if focus == ALL else _within(old, new, int(focus))

    out = ["@startuml"]
    out += [ln for ln in new.preamble if not ln.strip().startswith("caption")]
    caption = "caption <color:red>added</color> or <color:red><s>removed</s></color>"
    if focus != ALL:
        hops = int(focus)
        scope = "the impacted elements only" if hops == 0 else (
            f"impacted + {hops} neighbour" + ("s" if hops > 1 else ""))
        caption += f" — {scope} ({len(keep)} of {len(names)} shown)"
    out.append(caption)
    out.append("")

    # ── Elements present in NEW (red header if the whole element is new) ──────
    for name, el in new.elements.items():
        if name not in keep:
            continue
        is_new = name not in old.elements
        old_members = old.elements[name].members if not is_new else []
        current = {_identity(m) for m in el.members}
        removed = [m for m in old_members if _identity(m) not in current]

        header = el.header + (" #line:red;text:red" if is_new else "")
        if not el.has_body and not removed:
            out.append(header)
            continue

        out.append(header + " {")
        old_set = {_identity(m) for m in old_members}
        for m in el.members:
            fresh = not is_new and _identity(m) not in old_set
            out.append("  " + _member(m, _red if fresh else None))
        for m in removed:                            # gone in NEW → struck ghost
            out.append("  " + _member(m, _struck))
        out.append("}")

    # ── Elements removed entirely (present only in OLD): struck-through ghost ─
    for name, el in old.elements.items():
        if name in new.elements or name not in keep:
            continue
        header = _struck_header(el.header) + " #line:red;text:red"
        if not el.members:
            out.append(header)
            continue
        out.append(header + " {")
        for m in el.members:
            out.append("  " + _member(m, _struck))
        out.append("}")

    out.append("")

    # ── Relationships ────────────────────────────────────────────────────────
    old_keys = {_rel_key(r) for r in old.relationships}
    new_keys = {_rel_key(r) for r in new.relationships}
    # A relationship with one end pruned away would draw an arrow to nothing, so it goes
    # with the end it lost.
    def both_ends_kept(r):
        return _endpoint(r[0]) in keep and _endpoint(r[2]) in keep

    for r in new.relationships:
        if both_ends_kept(r):
            out.append(_render_relationship(r, "added" if _rel_key(r) not in old_keys else None))
    for r in old.relationships:
        if _rel_key(r) not in new_keys and both_ends_kept(r):   # gone in NEW → red ghost
            out.append(_render_relationship(r, "removed"))

    # PlantUML renders an error page for a diagram with no content, and an empty focus
    # level is a real answer — say it in the picture rather than break it.
    if not keep:
        out.append('note as EMPTY\n  nothing changed at this focus level\nend note')

    out.append("")
    out.append("@enduml")
    return "\n".join(out) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("old", help="Previous snapshot (.puml)")
    ap.add_argument("new", help="Current snapshot (.puml)")
    ap.add_argument("--out", help="Write merged diagram here (default: stdout)")
    ap.add_argument(
        "--focus", default=ALL, metavar="0|1|2|3|all",
        help=(
            "How much context to keep around what changed: 0 = the impacted elements "
            "alone, N = grow N relationships outwards from them, all = the whole "
            "diagram (default). For the large diagrams, where a two-line change "
            "otherwise arrives as a wall to search for red in."
        ),
    )
    args = ap.parse_args(argv)
    if args.focus != ALL and not args.focus.isdigit():
        ap.error("--focus takes a non-negative integer or 'all'")

    with open(args.old, encoding="utf-8") as f:
        old = parse(f.read())
    with open(args.new, encoding="utf-8") as f:
        new = parse(f.read())

    merged = diff(old, new, args.focus)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(merged)
    else:
        sys.stdout.write(merged)
    return 0


if __name__ == "__main__":
    sys.exit(main())
