---
name: drawio-png
description: Read the draw.io diagram embedded in a *.drawio.png (also .drawio / .drawio.svg) as text — vertices, edges, and the custom attributes behind the picture (kind, port, tech, traced, …). Use whenever someone mentions the deployment, architecture, container or conceptual-model diagram, a "drawio" picture, or its hidden/embedded XML, metadata or "headers"; whenever a question is who calls, consumes or depends on the backend / its API, or what talks to what; and to check a diagram against the code. Load it FIRST, even mid-task, before searching for the file, eyeballing the image, or decoding PNG text chunks (zTXt/tEXt/mxGraphModel) by hand. The diagrams live in petclinic-backend/docs/.
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
- Labels parented to an edge (`*`, `1`, …) are its multiplicities: printed on the edge, at
  the end they sit at (`Owner --> Pet [*]` = many pets per owner), not as vertices.

## A diagram is a claim, not evidence

The picture shows what someone drew. Before answering "only X calls Y", grep the code for
the other side — base URLs, ports, `RestClient`/`WebClient`, MCP clients, `.mcp.json`,
compose files — and report drift. `DeploymentDiagramTest` compares the drawing with traces
both ways, but only the traces of the browser suites: an edge marked `traced="no"` — the
chatbot's, which runs no OTel agent — is checked by nothing. It once vanished from the
picture for a month (`a57d5e18`) with every test green.

## Guardrail code

`petclinic-backend/src/test/java/victor/training/petclinic/guardrail/DrawioDiagram.java`
does the same decoding in Java for tests; keep both in step if the format handling changes.

## Trigger eval

`evals/trigger_eval.py [reps]` runs every phrasing in `evals/prompts.json` through headless
`claude -p` and passes a run only if it loads this skill (~2 min, a few $). Rerun it after
touching `description`; the bar is 10/10 at 2 reps. It was 9/10 before the 2026-10-15
rewording ("architecture diagram" without "drawio" went grepping instead).
