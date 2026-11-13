#!/usr/bin/env python3
"""Read the draw.io diagram hidden inside a *.drawio.png (or .drawio / .drawio.svg).

    drawio.py toon <file>   vertices + edges, with every custom attribute, as TOON (default)
    drawio.py json <file>   same data, as JSON
    drawio.py xml  <file>   the decoded mxGraph XML, pretty-printed

Stdlib only.
"""
import base64
import html
import json
import re
import struct
import sys
import urllib.parse
import xml.dom.minidom
import xml.etree.ElementTree as ET
import zlib

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_text_chunks(data: bytes) -> dict:
    """keyword -> text, from tEXt / zTXt / iTXt chunks."""
    if not data.startswith(PNG_SIGNATURE):
        raise SystemExit("not a PNG")
    chunks, i = {}, len(PNG_SIGNATURE)
    while i < len(data):
        (length,) = struct.unpack(">I", data[i:i + 4])
        kind, body = data[i + 4:i + 8], data[i + 8:i + 8 + length]
        i += 12 + length
        if kind == b"tEXt":
            key, _, text = body.partition(b"\0")
            chunks[key.decode("latin1")] = text.decode("latin1")
        elif kind == b"zTXt":
            key, _, rest = body.partition(b"\0")
            chunks[key.decode("latin1")] = zlib.decompress(rest[1:]).decode("latin1")
        elif kind == b"iTXt":
            key, _, rest = body.partition(b"\0")
            compressed, rest = rest[0], rest[2:]
            _lang, _, rest = rest.partition(b"\0")
            _translated, _, text = rest.partition(b"\0")
            if compressed:
                text = zlib.decompress(text)
            chunks[key.decode("latin1")] = text.decode("utf-8")
    return chunks


def mxfile_of(path: str) -> str:
    data = open(path, "rb").read()
    if data.startswith(PNG_SIGNATURE):
        chunks = png_text_chunks(data)
        # draw.io writes keyword "mxfile"; some exporters write a bare "mxGraphModel" instead
        key = next((k for k in ("mxfile", "mxGraphModel") if k in chunks), None)
        if key is None:
            raise SystemExit(
                f"no draw.io XML in {path} (text chunks: {sorted(chunks) or 'none'}) "
                "- exported without 'Include a copy of my diagram'?")
        return urllib.parse.unquote(chunks[key])
    text = data.decode("utf-8")
    if text.lstrip().startswith("<svg"):
        match = re.search(r'\scontent="([^"]*)"', text)
        if not match:
            raise SystemExit(f"no draw.io content attribute in {path}")
        return html.unescape(match.group(1))
    return text


def inflate_diagrams(mxfile: str) -> ET.Element:
    """Expands compressed <diagram> bodies (base64 -> raw deflate -> URL-encoded XML) in place."""
    try:
        root = ET.fromstring(mxfile)
    except ET.ParseError as e:
        raise SystemExit(f"not draw.io XML: {e}")
    if root.tag == "mxGraphModel":
        wrapper = ET.Element("mxfile")
        ET.SubElement(wrapper, "diagram", name="(bare mxGraphModel)").append(root)
        root = wrapper
    for diagram in root.iter("diagram"):
        body = (diagram.text or "").strip()
        if body and len(diagram) == 0:
            inflated = zlib.decompress(base64.b64decode(body), -15).decode("utf-8")
            diagram.text = None
            diagram.append(ET.fromstring(urllib.parse.unquote(inflated)))
    return root


def plain(label: str) -> str:
    text = re.sub(r"<br\s*/?>", " · ", html.unescape(label or ""), flags=re.I)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip()


def cells_of(diagram: ET.Element) -> list:
    """mxCells with custom attributes merged in: draw.io wraps a cell in <object>/<UserObject>
    the moment it gets any custom property, and moves id + label onto that wrapper."""
    entries = []
    for element in diagram.iter():
        if element.tag in ("object", "UserObject"):
            cell = element.find("mxCell")
            extra = {k: v for k, v in element.attrib.items() if k not in ("id", "label")}
            entries.append((element.get("id"), element.get("label", ""), extra, cell))
        elif element.tag == "mxCell" and element.get("id") is not None:  # wrapped ones carry no id
            entries.append((element.get("id"), element.get("value", ""), {}, element))
    return [
        {
            "id": cell_id, "label": plain(label), "attrs": extra,
            "vertex": cell.get("vertex") == "1", "edge": cell.get("edge") == "1",
            "source": cell.get("source"), "target": cell.get("target"),
            "parent": cell.get("parent"), "x": edge_position(cell),
        }
        for cell_id, label, extra, cell in entries
        if cell is not None and (cell.get("vertex") == "1" or cell.get("edge") == "1")]


def edge_position(cell: ET.Element):
    """Where a label sits along its edge: -1 at the source, 0 mid-way, 1 at the target."""
    geometry = cell.find("mxGeometry")
    if geometry is None or geometry.get("relative") != "1":
        return None
    return float(geometry.get("x", 0))


def end_labels(edge_id: str, cells: list) -> dict:
    """Labels a vertex hangs on an edge (multiplicities, mostly), keyed by the end they sit at."""
    ends = {}
    for c in cells:
        if c["vertex"] and c["parent"] == edge_id and c["label"] and c["x"] is not None:
            end = "source" if c["x"] < -0.3 else "target" if c["x"] > 0.3 else "middle"
            ends[end] = c["label"]
    return ends


def graph(root: ET.Element) -> dict:
    pages = []
    for diagram in root.iter("diagram"):
        cells = cells_of(diagram)
        by_id = {c["id"]: c for c in cells}
        on_edge = lambda c: c["parent"] in by_id and by_id[c["parent"]]["edge"]
        name = lambda cid: (by_id[cid]["label"] or cid) if cid in by_id else f"<{cid}>"
        vertices = [
            {"id": c["id"], "label": c["label"],
                "insideOf": c["parent"] if c["parent"] in by_id else None, **typed(c["attrs"])}
            for c in cells if c["vertex"] and not on_edge(c)]
        edges = []
        for c in cells:
            if c["edge"]:
                ends = end_labels(c["id"], cells)
                edges.append({
                    "from": name(c["source"]), "to": name(c["target"]), "label": c["label"],
                    "fromMultiplicity": ends.get("source"), "toMultiplicity": ends.get("target"),
                    "midLabel": ends.get("middle"), **typed(c["attrs"])})
        edges = [{k: v for k, v in e.items() if v not in (None, "")} for e in edges]
        pages.append({"page": diagram.get("name"), "vertices": table(vertices), "edges": edges})
    return pages[0] if len(pages) == 1 else {"pages": pages}


def typed(attrs: dict) -> dict:
    return {k: int(v) if re.fullmatch(r"[1-9]\d*", v) else v for k, v in attrs.items()}


def table(rows: list) -> list:
    """Same columns in every row (absent = None), minus the columns empty in all of them."""
    columns = list(dict.fromkeys(k for row in rows for k in row))
    columns = [k for k in columns if any(row.get(k) not in (None, "") for row in rows)]
    return [{k: row.get(k) for k in columns} for row in rows]


# ---- TOON (Token-Oriented Object Notation, toonformat.dev): JSON's data model, with a
# uniform array of objects written once as a header `key[N]{col,col}:` plus one CSV-like row each.
# Edges stay one `- key: value` block each: in a table, gpt-*-luna dropped the Chatbot -> Backend
# row from "every traced=no edge" in 10 of 12 runs; written this way, in 2 of 14 (evals/).
KEYED_ROWS = {"edges"}


def is_scalar(value) -> bool:
    return not isinstance(value, (dict, list))


def is_table(key, rows: list) -> bool:
    return bool(rows) and key not in KEYED_ROWS and all(
        isinstance(r, dict) and list(r) == list(rows[0]) and all(map(is_scalar, r.values()))
        for r in rows)


def toon(value, key=None, depth=0) -> list:
    pad = "  " * depth
    head = f"{pad}{toon_key(key)}" if key is not None else pad
    if isinstance(value, dict):
        lines = [f"{head}:"] if key is not None else []
        for k, v in value.items():
            lines += toon(v, k, depth + (key is not None))
        return lines
    if isinstance(value, list):
        if is_table(key, value):
            columns = ",".join(toon_key(k) for k in value[0])
            return [f"{head}[{len(value)}]{{{columns}}}:"] + [
                f"{pad}  " + ",".join(toon_scalar(v) for v in r.values()) for r in value]
        if all(map(is_scalar, value)):
            items = " " + ",".join(map(toon_scalar, value)) if value else ""
            return [f"{head}[{len(value)}]:{items}"]
        lines = [f"{head}[{len(value)}]:"]
        for item in value:
            body = toon(item, None, depth + 2) if isinstance(item, dict) else [
                "  " * (depth + 2) + toon_scalar(item)]
            lines += [f"{pad}  - " + body[0].lstrip()] + body[1:]
        return lines
    return [f"{head}: {toon_scalar(value)}"]


def toon_key(key: str) -> str:
    return key if re.fullmatch(r"[A-Za-z_][\w.]*", key) else json.dumps(key, ensure_ascii=False)


def toon_scalar(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, (int, float)):
        return json.dumps(value)
    needs_quotes = (
        value == "" or value != value.strip() or value in ("true", "false", "null")
        or re.fullmatch(r"-?\d+(\.\d+)?([eE][+-]?\d+)?", value) or value.startswith("-")
        or re.search(r'[:,"\\\[\]{}\x00-\x1f]', value))
    return json.dumps(value, ensure_ascii=False) if needs_quotes else value


def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return
    mode, path = (args[0], args[1]) if len(args) > 1 else ("toon", args[0])
    root = inflate_diagrams(mxfile_of(path))
    if mode == "xml":
        print(xml.dom.minidom.parseString(ET.tostring(root)).toprettyxml(indent="  "))
    elif mode == "json":
        print(json.dumps(graph(root), indent=2, ensure_ascii=False))
    elif mode == "toon":
        print("\n".join(toon(graph(root))))
    else:
        raise SystemExit(f"unknown mode {mode!r}: use toon | json | xml")


if __name__ == "__main__":
    main()
