# PetClinic — an Agentic Engineering Playground

A full-stack PetClinic (Angular SPA + Spring Boot REST API). **The domain is
incidental** — this repo exists to demonstrate AI-assisted / agentic software
engineering techniques you can lift into your own projects.

## What this repo teaches

- **Living architecture, kept honest by guardrail tests.** Diagrams and specs
  are *generated from the code*; ArchUnit + extractor tests fail the build when
  code and diagram drift apart. See [GUARDRAILS.md](GUARDRAILS.md).
- **Snapshot now, diff at review.** Committed diagrams stay a clean picture of
  *current* reality; the red add/remove delta is computed on demand from two git
  snapshots (`puml-diff`), and a whole PR's architecture change is reviewable as
  a gallery of delta images (`architecture-diff.sh`).
- **Diagrams generated from code, rendered from source.** `.puml` files are
  committed and rendered live via the PlantUML proxy straight off GitHub raw —
  no build step to view them; each render carries a `footer` naming its own
  source (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- **C4 model** as versioned Structurizr DSL: stable, human C1/C2 + a
  *code-coupled* C3 that is unit-tested against the real packages.
- **[Code City](https://victorrentea.github.io/petclinic/petclinic-backend/docs/generated/codemap/codecity.html)** —
  a 3D view of the codebase (size = LOC, height = complexity, colour = churn)
  across Classes / Packages / Modules lenses, with commits/committers mined from
  git history.
- **E2E traces → sequence diagrams.** Tempo/OpenTelemetry spans from a browser
  run are replayed into a PlantUML sequence diagram.
- **MCP server** hosted by the backend at `/mcp` (Spring AI) — tools/resources
  an agent can call.
- **Code-first OpenAPI.** The spec is *extracted* from the controllers
  (`OpenApiExtractorTest` → `openapi.yaml`); the frontend's TS types are
  regenerated from it. Both drift-checked.
- **Hooks + CI backstop + CODEOWNERS.** Guardrail hooks run before every push,
  mirrored as unavoidable CI gates (blocking `--no-verify`), and compare
  *regenerated content* — not file paths — so they can't be gamed; sensitive
  files need elder review.
- **Observability.** Zero-code OpenTelemetry → Grafana LGTM, queryable from
  Claude Code via `mcp-grafana`.

## Architecture

Generated, self-identifying diagrams (domain model, DB, packages, E2E sequence,
C4, Code City) live in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

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

## Prompts to try

Paste-ready prompts to run against this repo:

### Context Engineering

- **Trim boilerplate** — remove from CLAUDE.md the mvn/npm instructions any LLM already knows.
- **Point at generated sources** — replace CLAUDE.md's `## API Endpoints` with a pointer to the auto-synced `openapi.yaml`.
- **Scope rules by folder** — extract backend rules into a nested `petclinic-backend/CLAUDE.md` that loads only there.
- **Path-scoped skill** — move `### Java Code Style` into a `java/SKILL.md` with frontmatter `paths: petclinic-backend/**/*.java`, so it activates before any `.java` edit.
- **Prose → live diagram** — replace the drifting `## Domain Model` text with a URL that renders `DomainModel.puml`.
- **Audit CLAUDE.md** — check it is non-contradictory and in sync with recent code changes.

### Tasks to try

Some require tools from the project's `.mcp.json` (which Claude Code should autoload).

- **UI layout fix** — align the labels and values in the owner-details screen via Playwright screenshots.
- **Full-stack bug (TDD)** — reproduce bug gh#40 in the browser, write a failing e2e Playwright test, fix until green.
- **Exploratory QA** — explore the app using [Playwright test agents](https://playwright.dev/docs/test-agents).
- **Regenerate docs** — run `/regen-user-manual` to update the [user manual](user-manual/manual.md).
- **Grafana dashboard** — create a dashboard of what to monitor, then open it (start Grafana's Docker if needed).
- **Latency from traces** — break down the time budget of a "search owners" click from recorded Grafana traces.
- **Query tuning** — optimize the "search owners by last name" query.
- **Ad-hoc BI** — export an Excel pie chart of pet types straight from `postgres-db`.
- **Faster tests** — make the backend tests run faster.

### Tool-up YOUR 🫵 Agent 
Start YOUR agent in your work project, and tell it to help you grant it access to:
- **Issues** — fetch the issues assigned to me on this git repo
- **CI** — find out how much time did the tests took in the last CI run 
- **Logs** — get the last errors from the staging environment log
- **Browser** – reproduce a recent FE bug in a browser
- **DB** - which db tables have most rows in my dev DB?
- **Turn lessons into a skill** – capture the steps needed as a reusable skill/script. 

### Adopt ideas from `petclinic` into your own project ❤️

Start an agent in **your** project and tell it 
*"From the https://github.com/victorrentea/petclinic repo…"*:
- **Package diagram in sync** — get the mechanism that keeps `packages.puml` in sync with code.
- **Domain model from code** — get the mechanism that generates `DomainModel.puml` from code.
- **DB diagram from migrations** — get `DB.puml` built from the incremental SQL scripts.
- **Code City** — run the Code City visualization on your own sources.
- **API ↔ code in sync** — keep the backend Java in sync with `openapi.yaml` and the frontend `api-types.ts`.
- **Broken-build tripwire** — if a push breaks the build, keep looping until CI is green.
- **Guardrail git hooks** — run critical tests before every push and again in CI, blocking `--no-verify` pushes.
- **CODEOWNERS** — protect critical files behind tech-lead review to prevent fatigue-LGTM.
- **Trace-based sequences** — adopt the `generated_sequences/*.puml` idea for your cross-service/module e2e tests.
- **Critical `.feature` tests** — generate 3 functional tests for the most critical business rules, to confirm with business/QA.
- **Statusline** — configure your agent CLI's status bar per `victor-statusbar.md`.
- **Hooks demo** – set up an End/Stop hook that plays a sound when the agent finishes its turn.
