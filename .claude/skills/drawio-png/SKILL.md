---
name: drawio-png
description: Reads a *.drawio.png (.drawio, .drawio.svg) diagram as text — vertices, edges and their hidden attributes (port, tech, traced). Use FIRST for any question about the deployment, architecture or conceptual-model diagram in petclinic-backend/docs/, who calls or depends on the backend, or whether a diagram matches the code.
allowed-tools: Bash(.claude/skills/drawio-png/drawio.py:*)
---

# drawio-png

A `*.drawio.png` is a picture **and** the full draw.io source: the XML sits in a PNG text
chunk. Read that, never the pixels — labels in the image omit the custom attributes that
carry the semantics (e.g. `traced="yes"` on edges, `port`/`tech` on containers).

```sh
.claude/skills/drawio-png/drawio.py <file>          # vertices + edges + attributes, as TOON
.claude/skills/drawio-png/drawio.py json <file>     # same data, JSON — pipe to jq
.claude/skills/drawio-png/drawio.py xml  <file>     # full decoded mxGraph XML (styles, geometry)
```

The default output is [TOON](https://toonformat.dev): vertices as one table
(`vertices[N]{id,label,kind,…}:` then a row each, `null` = attribute not set), edges as one
`- from: … / to: …` block each, listing only the attributes that edge has.

Diagrams in this repo: `petclinic-backend/docs/Deployment.drawio.png`,
`petclinic-backend/docs/ConceptualModel.drawio.png`.

## What the script unwraps (so you don't redo it)

- PNG chunks `tEXt` / `zTXt` / `iTXt`; keyword is `mxfile` (draw.io) or a bare `mxGraphModel`
  (`ConceptualModel.drawio.png` uses this keyword, yet its payload is still an `<mxfile>`).
- Payload is URL-encoded; a `<diagram>` body may further be base64 → raw deflate → URL-encoded.
- Custom properties: draw.io wraps the cell in `<object>`/`<UserObject>` and **moves `id` and
  `label` onto the wrapper**; the inner `<mxCell>` has no id. The script merges them.
- Multi-page files print one block per page.
- Labels parented to an edge (`*`, `1`, …) are its multiplicities: printed on the edge as
  `fromMultiplicity` / `toMultiplicity` (`from: Owner, to: Pet, toMultiplicity: *` = many pets
  per owner), not as vertices.

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
Cut from 688 to 320 chars on 2026-10-27: still 10/10 here and 30/30 on three extra tasks, on Sonnet 5.5.

## Comprehension eval

`evals/comprehension_eval.py [reps] [model …]` hands the output of both diagrams, with no word
about the format, to the cheapest Copilot CLI models (gpt-*-luna, Haiku 4.5, Gemini Flash,
MAI flash) and grades 10 questions that need a correct reading: edge direction, `null` cells,
multiplicities (~3 min). `DRAWIO=<other drawio.py>` runs it against another version of the
script, for an A/B. On 2026-11-13: 148/150. The old `repr` text format scored 97/100, and
all-tabular TOON (edges as a table too) only 95/100: both Lunas dropped one row from "every
`traced=no` edge" in 10 of 12 runs, hence the keyed edges.
