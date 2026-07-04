# PetClinic — an Agentic Engineering Playground

A full-stack PetClinic (Angular SPA + Spring Boot REST API). **The domain is
incidental** — this repo exists to demonstrate AI-assisted / agentic software
engineering techniques you can lift into your own projects.

## What this repo teaches

- **Living architecture, kept honest by guardrail tests.** Diagrams and specs
  are *generated from the code*; ArchUnit + extractor tests fail the build when
  code and diagram drift apart. See [GUARDRAILS.md](GUARDRAILS.md).
- **Diagrams generated from code, rendered from source.** `.puml` files are
  committed and rendered live via the public PlantUML proxy straight off
  GitHub raw — no build step to view them (see [Architecture](#architecture)).
- **C4 model** as versioned Structurizr DSL: stable, human C1/C2 + a
  *code-coupled* C3 that is unit-tested against the real packages.
- **Code City** — a 3D visualization of the codebase (size = LOC, height =
  complexity) generated from source metrics.
- **E2E traces → sequence diagrams.** Tempo/OpenTelemetry spans from a browser
  run are replayed into a PlantUML sequence diagram.
- **MCP server** hosted by the backend at `/mcp` (Spring AI) — tools/resources
  an agent can call.
- **Code-first OpenAPI.** The spec is *extracted* from the controllers
  (`OpenApiExtractorTest` → `openapi.yaml`); the frontend's TS types are
  regenerated from it. Both drift-checked.
- **Hooks + CI backstop + CODEOWNERS.** Every advisory git hook is mirrored as
  an unavoidable CI gate; sensitive files require elder review.
- **Observability.** Zero-code OpenTelemetry → Grafana LGTM, queryable from
  Claude Code via `mcp-grafana`.

## Architecture

Diagrams are **generated from code** and rendered live via the
[PlantUML proxy](https://plantuml.com/) from the GitHub-hosted `.puml` sources.
Each source file carries a `footer` naming its own repo path, so every render
is self-identifying.

#### Domain model
![Domain model](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/DomainModel.puml)

#### Database (ER)
![Database](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/DB.puml)

#### Packages (logical architecture)
![Packages](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/packages.puml)

#### E2E sequence (from real traces)
![E2E sequence](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-ui-test/features/generated_sequences/add-a-visit-to-an-existing-pet.puml)

#### C4 — System Context
![C4 System Context](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/c4views/C1-Context.puml)

#### Code City (3D)
[Open the Code City in your browser →](https://htmlpreview.github.io/?https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/codemap/codecity.html)

> More C4 views (containers, per-component focus) live in
> [`petclinic-backend/docs/README.md`](petclinic-backend/docs/README.md).

## Quickstart

One-time: `./install-all.sh` — installs all Maven/npm deps **and** wires git to
`.githooks/` (guardrail hooks; bypass once with `--no-verify`).

Each script is foreground — run in separate terminals:

```sh
./start-database.sh   # embedded Postgres        :5432
./start-backend.sh    # Spring Boot (+OTel, MCP)  :8080
./start-frontend.sh   # Angular dev server        :4200
```

- App: http://localhost:4200 · Swagger: http://localhost:8080/swagger-ui.html
- Security is off by default (`petclinic.security.enable=true`; `admin`/`admin`).
- Observability (optional): `./start-grafana.sh` (Grafana at :3300), then query
  it from Claude Code via `mcp-grafana`.

Per-module commands, tech stack, testing, and Docker: see
[CLAUDE.md](CLAUDE.md) and [GUARDRAILS.md](GUARDRAILS.md).

## Miscellaneous

Reusable prompts (harness tweaks) from [prompts-to-try.md](prompts-to-try.md):

#### Set up the status bar (statusline)
> Configure my agent CLI's status bar as per `victor-statusbar.md`.

Copies/sets up a Claude Code statusline from a reference spec.

#### Ring a sound when Claude ends its turn
> Set me up a `Stop` hook that plays a sound every time you end your turn.

Registers a harness `Stop` hook so each finished turn is audible.

#### Watch the build after every push
> After you push, watch CI. If the push broke the build, stay in a loop until
> CI is green again.

A tripwire that keeps the agent accountable for the pushes it makes.
