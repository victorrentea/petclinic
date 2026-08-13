# Project Memory

Coding agents auto-load this file in any new conversation in this folder.
It's the most important file in any repo, pushed on git, added to on any AI failure/slop, carefully 👱🏻‍♂️-curated every retrospective.
CLAUDE.md is symlinked to [standard](https://agents.md) AGENTS.md, as GitHub Copilot prefers it.
Copilot: use this file over your proprietary .github/copilot-instructions.md

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties)

**Structure:** (8 modules, not just back+front)

| Module | What | Build |
|---|---|---|
| `petclinic-backend/` | Spring Boot 3.5 REST API (Java 21); also hosts the Spring AI **MCP server** at `/mcp` | Maven |
| `petclinic-frontend/` | Angular 16 SPA (Angular Material + Bootstrap 3) | npm |
| `petclinic-database/` | `PostgresLauncher` (embedded Postgres) + `NetworkLatencyProxy`; what `./start-database.sh` runs | Maven |
| `petclinic-chatbot/` | Spring AI triage assistant on **:8082** — RAG over specialties, books visits via the backend's MCP. Needs `OPENAI_API_KEY` + pgvector on **:5433** (`docker compose up -d` in that folder) | Maven |
| `petclinic-test/` | Playwright + Cucumber E2E in TypeScript; `features/` holds add-visit twice (Gherkin vs plain TS) on purpose. **Has its own CLAUDE.md — read it before touching tests** | npm |
| `petclinic-observability/` | `docker compose` for `grafana/otel-lgtm` (Grafana :3300, OTLP :4317/:4318) + `otelcol-config.yaml` | docker |
| `refactoring-legacy/` | Self-contained OpenRewrite recipes (imperative + Refaster). Deliberately **not** wired into the backend build | Maven |
| `user-manual/` | `manual.md` + screenshots |  |
| `scripts/` | `architecture-diff.sh`, `gh-pages-publish.sh`, `build_pr_gallery.py`, … |  |

**Root files worth knowing:** [ARCHITECTURE.md](ARCHITECTURE.md) (diagrams generated from code),
[GUARDRAILS.md](GUARDRAILS.md), `openapi.yaml` (generated), `sgconfig.yml` + `.ast-grep/` (lint rules),
`.githooks/`, `secrets.env` (gitignored, holds `OPENAI_API_KEY`).

## Common Commands

### Helper Scripts
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh         # Starts grafana on localhost:3300 in a docker container
./start-chatbot.sh         # Spring AI chatbot on localhost:8082 (needs backend up + OPENAI_API_KEY)
./start-tests.sh           # Playwright E2E in petclinic-test/ (needs backend + frontend up)
./install-all.sh           # one-time: git hooks + mvn/npm install across all modules
petclinic-backend/docs/scripts/start-structurizr.sh  # optional: C4model Structurizr view on localhost:8081
petclinic-backend/generate-codecity.sh  # rebuilds docs/generated/codecity/codecity.html, the 3D code view.
```
⚠️ There is **no** `./start-all.sh` / `./run-all.sh`, despite what `start-tests.sh` prints on failure.
Start each script above in its own terminal.

### Frontend (petclinic-frontend/)
```sh
npm start                           # Dev server on localhost:4200
npm run build                       # Production build
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
npm run e2e                         # Protractor e2e tests
npm run generate:api                # regenerate src/app/generated/api-types.ts from ../openapi.yaml
npm run lint:openapi                # Spectral lint of ../openapi.yaml
```

### E2E (petclinic-test/)
```sh
npm test                            # headless Playwright (needs backend + frontend up)
npm run test:cucumber               # the same scenarios via Gherkin step definitions
npm run test:ui                     # interactive runner
npm run show-report                 # HTML report
npm run test:docker                 # fully isolated in Docker
```
See `petclinic-test/CLAUDE.md` for the Gherkin-vs-plain-TS split and tracing setup.

## Architecture

### Frontend Architecture

- One **feature module per aggregate** under `src/app/<feature>/` (`owners`, `pets`, `vets`, `visits`,
  `pettypes`, `specialties`, `invoice`), each with its own `*-routing.module.ts`, `*.service.ts`,
  model class, and `-list` / `-add` / `-edit` / `-detail` components.
- `parts/` - shared bits (welcome, page-not-found); `testing/` - test doubles (`testing.module.ts`,
  `router-stubs.ts`).
- Cross-cutting: `app-routing.module.ts`, `error.service.ts`, `http-error.interceptor.ts`.
- ⚠️ `src/app/generated/api-types.ts` is **generated** from the root `openapi.yaml`
  (`npm run generate:api`, also run by `prebuild`) - never hand-edit it.
- In services, `.pipe()` goes on its **own line**, never chained onto `http.get(...)`.

### Living Architecture & Guardrails

See [GUARDRAILS.md](GUARDRAILS.md) for the full list of guardrail tests, living architecture diagrams, and CI drift checks.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)
- **Flyway seeds the DB when the backend boots** (`ddl-auto=none`; `db/migration/`: schema in
  `V1`, sample data in `V3__sample_data.sql`). An empty DB before that is normal, not broken.
- ⚠️ `./start-database.sh` starts by `rm -rf data`, wiping any rows added at runtime. Use it only
  for a deliberate reset; to keep runtime data, start Postgres from the jar directly

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default test user: `admin`/`admin`

### Observability
- `./start-grafana.sh` brings up `grafana/otel-lgtm` (Grafana **:3300**, admin/admin; OTLP **:4317/:4318**).
- `./start-backend.sh` attaches the OTel Java agent **only if :4318 is already listening** — start
  Grafana *first*, otherwise the backend runs with telemetry silently disabled.
- Browser spans need a flush window: a scenario that finishes in <~5s closes the page before the
  frontend exporter ships anything, so no frontend traces reach Tempo.


## API Endpoints
Backend exposes REST API with swagger kept in sync at `openapi.yaml`

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Task Modifiers
- Write non-trivial code using TDD
- Before any git commit, make sure your changes are reflected in CLAUDE.md
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind comments when deleting or moving stuff, to prevent later 'heresy resurrection'
- Always run tests after any refactoring
- Keep your explanations concise, we are experienced Spring dev
- Challenge ambiguous prompts - I love hearing I'm wrong!  
