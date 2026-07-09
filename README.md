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

## Quickstart

A) Tell your agent: `start db,be,fe,grafana`

B) Manual: Run in separate terminals:
```sh
./start-database.sh   # embedded Postgres        :5432
./start-backend.sh    # Spring Boot (+OTel, MCP)  :8080
./start-frontend.sh   # Angular dev server        :4200
./start-grafana.sh   # Requires Docker        :3300
```

- UI: http://localhost:4200 
- BE Swagger: http://localhost:8080/swagger-ui.html

## Prompts to try

Tell an agent running in this repo:

### Context Engineering

- **Trim boilerplate** — remove from CLAUDE.md the mvn/npm instructions any LLM already knows.
- **Point at generated sources** — replace CLAUDE.md's `## API Endpoints` with a pointer to the auto-synced `openapi.yaml`.
- **Scope rules by folder** — extract backend rules into a nested `petclinic-backend/CLAUDE.md` that loads only there.
- **Path-scoped skill** — move `### Java Code Style` into a `java/SKILL.md`
- **Force load a skill for by file paths**: Add to skill's frontmatter `paths: petclinic-backend/**/*.java`, so it 100% activates before any `.java` edit.
- **Reference drift-safe knowledge** — replace the drifting `## Domain Model` chapter with a link to the in-sync `DomainModel.puml`. Add a link to DB.sql and openapi.yaml
- **Audit CLAUDE.md** — check it is non-contradictory and in sync with recent code changes.

### Tasks to try

Some require tools from the project's `.mcp.json` (which should autoload).

- **UI layout fix** — align the labels and values in the owner-details screen via Playwright screenshots.
- **Full-stack bug (TDD)** — reproduce bug gh#40 in the browser, write a failing e2e Playwright test, fix until green.
- **Exploratory QA** — explore the app using [Playwright test agents](https://playwright.dev/docs/test-agents) and write 10 significant automated .feature e2e tests.
- **Regenerate docs** — run `/regen-user-manual` to update the [user manual](user-manual/manual.md).
- **Grafana dashboard** — create a dashboard of what to monitor, then open it (start Grafana's Docker if needed).
- **Latency from traces** — break down the time budget of a "search owners" click from recorded Grafana traces.
- **Query tuning** — optimize the "search owners by last name" query.
- **Ad-hoc BI** — export an Excel pie chart of pet types straight from `postgres-db`.
- **Faster tests** — make the backend tests run faster.

### Tools
Start YOUR agent in YOUR🫵 work project, and tell it:

"Help me grant you access to:..."
- **Issues** — fetch the issues assigned to me on this git repo, put a test comment on last one
- **CI** — find out how much time did the tests took in the last CI run 
- **Logs** — get the last errors from the dev environment log
- **Browser** – reproduce a recent FE bug in a browser
- **DB** - which db tables have most rows in my dev DB?
- **Metrics** - What is the endpoint with highest latency in Grafana?
- **Token Saving** - Configure me headroom or at least RTK to save tokens.

Patiently guide the agent through this setup, then tell it: Turn the lessons you learned into a reusable skill, ideally scripting as much work you can. 

### Tools for Agentic Lifestyle
- (Wispr Flow)[https://wisprflow.ai] to dictate .
- (Codex Bar)[https://codexbar.app] to show remaining quota.
- (Screen Brush)[https://apps.apple.com/us/app/screenbrush/id1233965871] to draw on screen before screenshot to agent. 
- Configure yourself, my dear CLI agent, a status bar inspired from `victor-statusbar.md`.

### Adopt ideas from `petclinic` into your own project ❤️

Start an agent in **your** project and tell it: 
From the https://github.com/victorrentea/petclinic repo…
- get the mechanism that keeps `packages.puml` in sync with code structure.
- get the mechanism that generates `DomainModel.puml` from code.
- adopt the database migrations scripts technique
- get the mechanism to auto-build `DB.puml` from the incremental DB scripts.
- run the Code City 3D visualization on the sources of my projec XYZ. 
- copy the idea to keep the backend Java in sync with `openapi.yaml`, and the frontend `api-types.ts` - prove that a change in a backend Dto fails the FE build, ran automatically prepush and on CI.
- get the way agent is kept in a loop to fix CI its push broke.
- get how to run critical tests before every push and again remotely in CI.
- copy the CODEOWNERS idea to protect critical files behind tech-lead/architect review to prevent dev fatigue-LGTM.
- write 3 .feature tests for the most critical flows of my app XYZ
- adopt the technique to generate sequence diagrams from key e2e tests, as in `generated_sequences/*.puml`.
- get the code review skill using local sonar scanner and multi-agent review
- set up an End/Stop hook that plays a sound when the agent finishes its turn.
