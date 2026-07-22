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


def _element_name(header: str) -> str:
    """Extract the identity of an element from its (clean) header line."""
    h = header.strip()
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


def parse(puml: str) -> Diagram:
    d = Diagram()
    current = None            # name of the element whose body we're inside
    seen_content = False      # have we passed the preamble yet?

    for raw in puml.splitlines():
        clean = _strip_markup(raw.strip())
        if not clean or clean.startswith("@start") or clean == "@enduml":
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
    return f"{left} {right} :: {label or ''}"


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


def diff(old: Diagram, new: Diagram) -> str:
    out = ["@startuml"]
    out += [ln for ln in new.preamble if not ln.strip().startswith("caption")]
    out.append("caption <color:red>added</color> or <color:red><s>removed</s></color>")
    out.append("")

    # ── Elements present in NEW (red header if the whole element is new) ──────
    for name, el in new.elements.items():
        is_new = name not in old.elements
        old_members = old.elements[name].members if not is_new else []
        removed = [m for m in old_members if m not in set(el.members)]

        header = el.header + (" #line:red;text:red" if is_new else "")
        if not el.has_body and not removed:
            out.append(header)
            continue

        out.append(header + " {")
        old_set = set(old_members)
        for m in el.members:
            out.append("  " + (_red(m) if (not is_new and m not in old_set) else m))
        for m in removed:                            # gone in NEW → struck ghost
            out.append("  " + _struck(m))
        out.append("}")

    # ── Elements removed entirely (present only in OLD): struck-through ghost ─
    for name, el in old.elements.items():
        if name in new.elements:
            continue
        header = _struck_header(el.header) + " #line:red;text:red"
        if not el.members:
            out.append(header)
            continue
        out.append(header + " {")
        for m in el.members:
            out.append("  " + _struck(m))
        out.append("}")

    out.append("")

    # ── Relationships ────────────────────────────────────────────────────────
    old_keys = {_rel_key(r) for r in old.relationships}
    new_keys = {_rel_key(r) for r in new.relationships}
    for r in new.relationships:
        out.append(_render_relationship(r, "added" if _rel_key(r) not in old_keys else None))
    for r in old.relationships:
        if _rel_key(r) not in new_keys:              # gone in NEW → red ghost
            out.append(_render_relationship(r, "removed"))

    out.append("")
    out.append("@enduml")
    return "\n".join(out) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("old", help="Previous snapshot (.puml)")
    ap.add_argument("new", help="Current snapshot (.puml)")
    ap.add_argument("--out", help="Write merged diagram here (default: stdout)")
    args = ap.parse_args(argv)

    with open(args.old, encoding="utf-8") as f:
        old = parse(f.read())
    with open(args.new, encoding="utf-8") as f:
        new = parse(f.read())

    merged = diff(old, new)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(merged)
    else:
        sys.stdout.write(merged)
    return 0


if __name__ == "__main__":
    sys.exit(main())
