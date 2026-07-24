# Project Memory - AGENTS.md ~ CLAUDE.md

This file is automatically loaded in any conversation you have with an agent in this folder. It's the most important file in any repo, pushed on git, improved on any AI fail, reviewed every sprint, symlinked to AGENTS.md for inclusiveness.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21); also hosts the Spring AI MCP server at `/mcp` and the C4 model docs
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)
- `petclinic-chatbot/` - Spring AI triage assistant (RAG over specialties + MCP client, Embabel agent)
- `petclinic-database/` - embedded PostgreSQL runner, shaded into a standalone jar + seed `data/`
- `petclinic-observability/` - OpenTelemetry collector + Grafana stack (`docker-compose.yml`, `otelcol-config.yaml`)
- `petclinic-ui-test/` - Playwright + Cucumber end-to-end UI tests (TypeScript)
- `openspec/` - OpenSpec specs and change proposals
- `docs/`, `user-manual/` - project docs and the end-user manual (with screenshots)
- `scripts/` - repo tooling (architecture diff, gh-pages publish, dependency audit, PlantUML)
- Root scripts: `start-database.sh`, `start-backend.sh`, `start-frontend.sh`, `start-chatbot.sh`, `start-grafana.sh`, `start-ui-tests.sh`, `install-all.sh`

## Common Commands

### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh
```

The C4 model viewer now lives with the backend docs it serves:
```sh
petclinic-backend/docs/scripts/start-structurizr.sh   # optional: Structurizr view of the C4 model (localhost:8081)
```

## Architecture


### Living Architecture & Guardrails

See [GUARDRAILS.md](GUARDRAILS.md) for the full list of guardrail tests, living architecture diagrams, and CI drift checks.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)
- **The backend seeds the DB via Flyway on startup** (`ddl-auto=none`; schema in `V1`,
  sample data in `V3__sample_data.sql`, under `db/migration/`). A freshly (re)started
  Postgres therefore looks **empty until the backend boots** — that is normal, *not* a broken
  DB. Do not be surprised by an empty DB after a restart; start the backend and it re-seeds
  itself.
- ⚠️ `./start-database.sh` runs `rm -rf data` first — it **wipes the on-disk data dir** (and any
  rows added at runtime). Flyway recreates the seed on the next backend boot regardless, but to
  preserve runtime data start Postgres from the jar directly; use the script only for a
  deliberate reset.

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default user: `admin`/`admin`

## Domain Model (ER Model)

### Query the data, don't guess
Never reason about "what the data probably looks like". A `postgres-db` MCP connector is
wired to the dev database — **query it** whenever there is any doubt about column types,
nullability, cardinality, duplicates, formats, collation or realistic row counts. Assumptions
about data have already produced wrong designs here; a `SELECT` is always cheaper.

### Production data volumes
The dev seed data (28 owners) is **not** representative. Production is planned for
**~10,000 owners**. Never design a list screen or endpoint that loads all owners
(or all of any owner-scale collection) into memory — paginate, sort and filter
**server-side**, and watch for N+1 queries on `Owner.pets`.

Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## API Endpoints

Backend exposes its REST API under http://localhost:8080/api/.

The single source of truth is [`openapi.yaml`](openapi.yaml)
at the repo root, kept in sync automatically at both ends:
- **Backend →** `OpenApiExtractorTest` regenerates it from the running app; CI fails on drift.
- **→ Frontend:** `npm run generate:api` regenerates `petclinic-frontend/src/app/generated/api-types.ts`
  from it in pre-commit + CI.

Browse it live at http://localhost:8080/swagger-ui.html. See [GUARDRAILS.md](GUARDRAILS.md) for the drift checks.

## Development Notes

### Owner's Java Code Preferences

Extracted into the **`java` skill** ([.claude/skills/java/SKILL.md](.claude/skills/java/SKILL.md)) —
DI, transactions, MapStruct, `@RestControllerAdvice`, `@Validated`, allowed Lombok annotations,
builder-chain formatting. It auto-loads when working on `**/*.java`; invoke it explicitly with `/java`.

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names.
- Always run tests after any refactoring
- Keep explanations concise
- Challenge ambiguous prompts. Tell me when I'm wrong!  
