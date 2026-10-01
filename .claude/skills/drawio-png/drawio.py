#!/usr/bin/env python3
"""Read the draw.io diagram hidden inside a *.drawio.png (or .drawio / .drawio.svg).

    drawio.py graph <file>   vertices + edges, with every custom attribute (default)
    drawio.py json  <file>   same, as JSON
    drawio.py xml   <file>   the decoded mxGraph XML, pretty-printed

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


def graph(root: ET.Element) -> list:
    pages = []
    for diagram in root.iter("diagram"):
        cells = cells_of(diagram)
        by_id = {c["id"]: c for c in cells}
        on_edge = lambda c: c["parent"] in by_id and by_id[c["parent"]]["edge"]
        name = lambda cid: (by_id[cid]["label"] or cid) if cid in by_id else f"<{cid}>"
        pages.append({
            "page": diagram.get("name"),
            "vertices": [
                {k: c[k] for k in ("id", "label", "attrs", "parent")}
                for c in cells if c["vertex"] and not on_edge(c)
            ],
            "edges": [
                {"id": c["id"], "label": c["label"], "attrs": c["attrs"], "from": name(c["source"]),
                    "to": name(c["target"]), "ends": end_labels(c["id"], cells)}
                for c in cells if c["edge"]
            ],
        })
    return pages


def print_graph(pages: list) -> None:
    for page in pages:
        print(f"=== page: {page['page']}")
        print("--- vertices")
        for v in page["vertices"]:
            attrs = f"  {v['attrs']}" if v["attrs"] else ""
            print(f"[{v['id']}] {v['label']}{attrs}")
        print("--- edges")
        for e in page["edges"]:
            label = f" [{e['label']}]" if e["label"] else ""
            attrs = f"  {e['attrs']}" if e["attrs"] else ""
            ends = e["ends"]
            src = f"[{ends['source']}] " if "source" in ends else ""
            tgt = f" [{ends['target']}]" if "target" in ends else ""
            mid = f" ({ends['middle']})" if "middle" in ends else ""
            print(f"{src}{e['from']} --{label}--> {e['to']}{tgt}{mid}{attrs}")


def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return
    mode, path = (args[0], args[1]) if len(args) > 1 else ("graph", args[0])
    root = inflate_diagrams(mxfile_of(path))
    if mode == "xml":
        print(xml.dom.minidom.parseString(ET.tostring(root)).toprettyxml(indent="  "))
    elif mode == "json":
        print(json.dumps(graph(root), indent=2, ensure_ascii=False))
    elif mode == "graph":
        print_graph(graph(root))
    else:
        raise SystemExit(f"unknown mode {mode!r}: use graph | json | xml")


if __name__ == "__main__":
    main()
