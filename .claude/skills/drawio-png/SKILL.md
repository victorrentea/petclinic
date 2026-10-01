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
- Labels parented to an edge (`*`, `1`, …) are its multiplicities: printed on the edge, at
  the end they sit at (`Owner --> Pet [*]` = many pets per owner), not as vertices.

## A diagram is a claim, not evidence

The picture shows what someone drew. Before answering "only X calls Y", grep the code for
the other side — base URLs, ports, `RestClient`/`WebClient`, MCP clients, `.mcp.json`,
compose files — and report drift. Here, `Deployment.drawio.png` has no chatbot, while
`petclinic-chatbot` calls the backend (MCP `/mcp`, and polls `/api/specialties/feed`).
`DeploymentDiagramTest` compares the drawing with traces both ways, but only the traces of
the browser suites, and the chatbot runs no OTel agent — so it can never notice that gap.

Same with `ConceptualModel.drawio.png`: `ConceptualModelDiagramTest` checks it against
`DomainModelExtractor`, which reads fields by plain reflection and so takes the
unidirectional `@ManyToMany` Vet→Specialty for one-to-many. The map shows no `*` at the Vet
end, and the test agrees with it.

## Guardrail code

`petclinic-backend/src/test/java/victor/training/petclinic/guardrail/DrawioDiagram.java`
does the same decoding in Java for tests; keep both in step if the format handling changes.
