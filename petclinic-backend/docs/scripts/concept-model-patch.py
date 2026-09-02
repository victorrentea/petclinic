#!/usr/bin/env python3
"""Bring docs/ConceptModel.drawio.png back in sync with the code — without touching the layout.

The concept map is hand-arranged on purpose: people remember where things are, so nothing
here is allowed to move a box a human put somewhere. This script does the two jobs a human
should not have to do by hand:

  * a concept or an association the code has and the map does not is ADDED — every new box
    in the staging lane down the left-hand side, marked `placed="auto"`, so
    ConceptModelDiagramTest keeps failing until someone drags it onto the map proper;
  * a staged box that has since been moved is GRADUATED — the marker and the staging style
    come off, and it becomes an ordinary part of the map.

What it never does: reposition, restyle or delete anything else. Removing a concept the
code dropped is left to a human too, because deleting from a map is a decision about the
map, not about the code.

Truth comes from docs/generated/DomainModel.puml, which DomainModelExtractorTest writes
from the domain classes. Reading it here rather than re-deriving associations in Python
keeps ONE implementation of the "what is an association, and what cardinality" rules; the
Java guardrail still checks the picture against reflection directly, so a stale .puml
cannot make a wrong map pass.

Usage:  python3 docs/scripts/concept-model-patch.py [--dry-run]
Needs the draw.io desktop CLI (`brew install --cask drawio`) to re-render the PNG.
"""

import argparse
import base64
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

MODULE = Path(__file__).resolve().parents[2]  # petclinic-backend/
DIAGRAM = MODULE / "docs" / "ConceptModel.drawio.png"
TRUTH = MODULE / "docs" / "generated" / "DomainModel.puml"

BOX_STYLE = (
    "rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
    "fontSize=15;fontStyle=1;")
STAGED_BOX_STYLE = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;"
                    "dashed=1;fontSize=15;fontStyle=1;")
EDGE_STYLE = "endArrow=none;html=1;strokeColor=#333333;fontSize=12;"
# the * is the only marker on the map, so it is read at a glance; no white label
# background either, which would chew a notch out of the box border underneath it
LABEL_STYLE = (
    "edgeLabel;html=1;align=center;verticalAlign=middle;fontSize=24;fontStyle=1;"
    "labelBackgroundColor=none;")

BOX_W, BOX_H = 140, 50
LANE_GAP = 300  # how far left of the map the staging lane sits
ROW_GAP = 90


# ── the code's model, as the generated PlantUML states it ────────────────────────

def marker(cardinality):
    """What the map shows at an end: a bare * for many, nothing at all for exactly one.
    An unmarked line reads as 1, so the to-one end carries no label to go stale."""
    return "*" if cardinality == "0..*" else ""


def read_truth():
    """(concepts, associations) out of DomainModel.puml."""
    text = TRUTH.read_text()
    concepts = set(re.findall(r"^(?:class|enum)\s+(\w+)", text, re.MULTILINE))
    associations = {}
    for left, left_card, right_card, right, label in re.findall(
            r'^(\w+)\s+"([^"]+)"\s+--\s+"([^"]+)"\s+(\w+)(?:\s*:\s*(\S+))?\s*$',
            text, re.MULTILINE):
        key = "-".join(sorted([left, right]))
        associations[key] = dict(
            left=left, left_card=marker(left_card),
            right=right, right_card=marker(right_card))
    if not concepts:
        sys.exit(f"{TRUTH} lists no classes — run the guardrail tests to regenerate it first.")
    return concepts, associations


# ── the picture ──────────────────────────────────────────────────────────────────

def embedded_xml(png_bytes):
    """The mxfile draw.io stores in the PNG's own text chunks."""
    offset = 8  # PNG signature
    while offset < len(png_bytes):
        (length,) = struct.unpack(">I", png_bytes[offset:offset + 4])
        chunk = png_bytes[offset + 4:offset + 8].decode("ascii")
        data = png_bytes[offset + 8:offset + 8 + length]
        offset += 12 + length
        if chunk == "IEND":
            break
        if chunk not in ("tEXt", "zTXt", "iTXt"):
            continue
        split = data.index(b"\0")
        if data[:split].decode("ascii") not in ("mxfile", "mxGraphModel"):
            continue
        if chunk == "tEXt":
            payload = data[split + 1:].decode("utf-8")
        elif chunk == "zTXt":
            payload = zlib.decompress(data[split + 2:]).decode("utf-8")
        else:
            rest = data[split + 3:]
            rest = rest[rest.index(b"\0") + 1:]
            rest = rest[rest.index(b"\0") + 1:]
            payload = (zlib.decompress(rest) if data[split + 1] == 1 else rest).decode("utf-8")
        return maybe_url_decode(payload)
    sys.exit(f"{DIAGRAM} carries no draw.io metadata — it is a flat image, not a diagram.")


def maybe_url_decode(text):
    text = text.strip()
    return text if text.startswith("<") else urllib.parse.unquote(text)


def decode_diagrams(mxfile):
    """Inflate any <diagram> body draw.io stored deflated+base64."""
    def inflate(match):
        body = match.group(1).strip()
        if body.startswith("<"):
            return match.group(0)
        raw = zlib.decompress(base64.b64decode(body), -15).decode("utf-8")
        return match.group(0).replace(match.group(1), maybe_url_decode(raw))
    return re.sub(r"<diagram[^>]*>(.*?)</diagram>", inflate, mxfile, flags=re.DOTALL)


def index_cells(root):
    """Every mxCell, paired with the <object> wrapping it — draw.io moves a cell's id and
    its custom attributes onto that wrapper the moment the cell is given any."""
    cells = []
    for parent in root.iter():
        for child in parent:
            if child.tag == "mxCell":
                cells.append((child, parent if parent.tag == "object" else None))
    return cells


def cell_attr(cell, obj, name):
    if obj is not None and obj.get(name):
        return obj.get(name)
    return cell.get(name, "")


# ── patching ─────────────────────────────────────────────────────────────────────

def patch(model_root, concepts, associations):
    """Returns a list of human-readable changes; mutates model_root in place."""
    changes = []
    root = model_root.find("root")
    cells = index_cells(model_root)

    drawn_concepts = {}   # concept -> (cell, obj)
    for cell, obj in cells:
        name = cell_attr(cell, obj, "concept")
        if name:
            drawn_concepts[name] = (cell, obj)
    drawn_assocs = {cell_attr(cell, obj, "assoc") for cell, obj in cells
                    if cell_attr(cell, obj, "assoc")}

    # 1. graduate the boxes a human has since moved
    for name, (cell, obj) in drawn_concepts.items():
        if obj is None or obj.get("placed") != "auto":
            continue
        geometry = cell.find("mxGeometry")
        dropped_at = obj.get("autoAt", "")
        if geometry is not None and dropped_at == f"{geometry.get('x')},{geometry.get('y')}":
            continue  # still parked where it was dropped
        del obj.attrib["placed"]
        obj.attrib.pop("autoAt", None)
        cell.set("style", BOX_STYLE)
        changes.append(f"graduated  {name} — moved onto the map, staging marker cleared")

    # 2. stage every concept the code has and the map does not
    missing = sorted(concepts - drawn_concepts.keys())
    if missing:
        x, y = staging_origin(model_root)
        for i, name in enumerate(missing):
            row_y = y + i * ROW_GAP
            root.append(staged_box(name, x, row_y))
            drawn_concepts[name] = (None, None)
            changes.append(f"staged     {name} — parked at ({x}, {row_y}); drag it onto the map")

    # 3. draw every association the code has and the map does not
    for key in sorted(associations.keys() - drawn_assocs):
        a = associations[key]
        if a["left"] not in drawn_concepts or a["right"] not in drawn_concepts:
            changes.append(f"skipped    {key} — one of its concepts is not on the map yet")
            continue
        root.extend(edge_cells(key, a))
        changes.append(f"drew       {key} — check how it routes")

    return changes


def staging_origin(model_root):
    """Left of everything already drawn, at the top of the map."""
    xs, ys = [], []
    for cell, _ in index_cells(model_root):
        geometry = cell.find("mxGeometry")
        if geometry is not None and geometry.get("x") and cell.get("vertex") == "1":
            xs.append(float(geometry.get("x")))
            ys.append(float(geometry.get("y", 0)))
    if not xs:
        return 40, 40
    return int(min(xs) - LANE_GAP), int(min(ys))


def staged_box(name, x, y):
    obj = ET.Element("object", {"label": name, "concept": name, "id": f"c-{name.lower()}",
                                "placed": "auto", "autoAt": f"{x},{y}"})
    cell = ET.SubElement(obj, "mxCell", {"style": STAGED_BOX_STYLE, "vertex": "1", "parent": "1"})
    ET.SubElement(cell, "mxGeometry", {
        "x": str(x), "y": str(y),
        "width": str(BOX_W), "height": str(BOX_H), "as": "geometry"})
    return obj


def edge_cells(key, a):
    """The line, plus a * at each many end. Nothing is drawn on a to-one end, and the line
    carries no role name: the map shows the shape of the model, not the field names."""
    edge_id = "e-" + key.lower()
    obj = ET.Element("object", {"label": "", "assoc": key, "id": edge_id})
    cell = ET.SubElement(obj, "mxCell", {
        "style": EDGE_STYLE, "edge": "1", "parent": "1",
        "source": f"c-{a['left'].lower()}", "target": f"c-{a['right'].lower()}"})
    ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})

    labels = []
    for suffix, value, position in (("s", a["left_card"], "-0.6"), ("t", a["right_card"], "0.6")):
        if not value:
            continue  # a to-one end is left unmarked
        label = ET.Element("mxCell", {"id": f"{edge_id}-{suffix}", "value": value,
                                      "style": LABEL_STYLE, "vertex": "1",
                                      "connectable": "0", "parent": edge_id})
        ET.SubElement(label, "mxGeometry", {"x": position, "relative": "1", "as": "geometry"})
        labels.append(label)
    return [obj] + labels


# ── rendering ────────────────────────────────────────────────────────────────────

def render(model_root):
    """Back to a .drawio.png, picture and embedded XML together."""
    drawio = shutil.which("drawio") or "/Applications/draw.io.app/Contents/MacOS/draw.io"
    if not Path(drawio).exists() and not shutil.which("drawio"):
        sys.exit("draw.io CLI not found — install it with: brew install --cask drawio")

    body = ET.tostring(model_root, encoding="unicode")
    mxfile = (f'<mxfile host="petclinic-guardrail">'
              f'<diagram name="Concept Model" id="concept-model">{body}</diagram></mxfile>')

    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "ConceptModel.drawio"
        source.write_text(mxfile)
        subprocess.run([
            drawio, "--export", "--format", "png", "--embed-diagram",
            "--border", "20", "--scale", "2",
            "--output", str(DIAGRAM), str(source)], check=True, capture_output=True)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true",
                        help="say what would change without touching the diagram")
    args = parser.parse_args()

    concepts, associations = read_truth()
    mxfile = decode_diagrams(embedded_xml(DIAGRAM.read_bytes()))
    model_root = ET.fromstring(mxfile).find(".//mxGraphModel")
    if model_root is None:
        sys.exit(f"{DIAGRAM} has no mxGraphModel inside it.")

    changes = patch(model_root, concepts, associations)
    if not changes:
        print(f"{DIAGRAM.name} already draws every concept and link the code has.")
        return

    for change in changes:
        print(" ", change)
    if args.dry_run:
        print("\n--dry-run: the diagram was left alone.")
        return

    render(model_root)
    print(f"\nRe-rendered {DIAGRAM}.")
    if any(c.startswith("staged") for c in changes):
        print("Open it in the draw.io desktop app, drag the orange boxes onto the map, save,\n"
              "then run this script again to clear their staging markers.")


if __name__ == "__main__":
    main()
