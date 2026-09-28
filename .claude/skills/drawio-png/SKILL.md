---
name: drawio-png
description: Read the draw.io diagram embedded in a *.drawio.png (also .drawio / .drawio.svg) as text — vertices, edges, and the custom attributes behind the picture (kind, port, traced, …). Use whenever a task asks what a diagram says, who calls whom in an architecture/deployment picture, or to check a diagram against the code — instead of eyeballing the image.
allowed-tools: Bash(.claude/skills/drawio-png/drawio.py:*)
---

# drawio-png

A `*.drawio.png` is a picture **and** the full draw.io source: the XML sits in a PNG text
chunk. Read that, never the pixels — labels in the image omit the custom attributes that
carry the semantics (e.g. `traced="yes"` on edges, `port`/`tech` on containers).

```sh
.claude/skills/drawio-png/drawio.py <file>          # vertices + edges + attributes (graph)
.claude/skills/drawio-png/drawio.py json <file>     # same, JSON — pipe to jq
.claude/skills/drawio-png/drawio.py xml  <file>     # full decoded mxGraph XML (styles, geometry)
```

Diagrams in this repo: `petclinic-backend/docs/Deployment.drawio.png`,
`petclinic-backend/docs/ConceptualModel.drawio.png`.

## What the script unwraps (so you don't redo it)

- PNG chunks `tEXt` / `zTXt` / `iTXt`; keyword is `mxfile` (draw.io) or a bare `mxGraphModel`
  (`ConceptualModel.drawio.png` uses this keyword, yet its payload is still an `<mxfile>`).
- Payload is URL-encoded; a `<diagram>` body may further be base64 → raw deflate → URL-encoded.
- Custom properties: draw.io wraps the cell in `<object>`/`<UserObject>` and **moves `id` and
  `label` onto the wrapper**; the inner `<mxCell>` has no id. The script merges them.
- Multi-page files print one block per page.
- Vertices labelled `*`, `1`, … parented to an edge are that edge's multiplicity labels.

## A diagram is a claim, not evidence

The picture shows what someone drew. Before answering "only X calls Y", grep the code for
the other side — base URLs, ports, `RestClient`/`WebClient`, MCP clients, `.mcp.json`,
compose files — and report drift. Here, `Deployment.drawio.png` shows only
Frontend → Backend, while `petclinic-chatbot` also calls the backend (REST
`/api/specialties/feed` and MCP `/mcp`). `DeploymentDiagramTest` only checks that
`traced="yes"` edges appear in real traces, never that real callers appear in the drawing.

## Guardrail code

`petclinic-backend/src/test/java/victor/training/petclinic/guardrail/DrawioDiagram.java`
does the same decoding in Java for tests; keep both in step if the format handling changes.
