# Project Memory

Coding agents auto-load this file in any new conversation in this folder.
It's the most important file in any repo, pushed on git, added to on any AI failure/slop, carefully 👱🏻‍♂️-curated every retrospective.
**This file is the single source of truth. Never write rules into `CLAUDE.md`.**
`CLAUDE.md` next to it holds one line — `@AGENTS.md` — and exists only because Claude
Code does not read AGENTS.md; that import is how it reaches this file. Copilot CLI and
Codex read this file natively and have no import of their own, so anything written into
CLAUDE.md would be visible to Claude Code alone. It used to be a symlink; it no longer
is, because Git for Windows checks symlinks out as text files containing their target
path. `scripts/check-agents-md.sh` enforces all of this (pre-push and CI).

Copilot: use this file over your proprietary .github/copilot-instructions.md

## Additional Knowledge

Load one of these when the task calls for it — they are the sole source of truth on their subject.

When a guardrail test fails, or a living diagram no longer matches the code, the drift
checks and what each of them asserts are in [GUARDRAILS.md](GUARDRAILS.md).
When you need traces — starting the stack in the right order, or explaining a span, a SQL
label or a missing frontend trace — the whole OTel setup is in [OBSERVABILITY.md](OBSERVABILITY.md).
To see how the pieces fit together, every diagram generated from the code is rendered in
[ARCHITECTURE.md](ARCHITECTURE.md).
Before sizing anything — pagination, indexes, caching, an export — the data volumes the
business is actually aiming for are in [volumetrie.md](volumetrie.md).
Before touching the owners grid, the design decisions behind it — and what each one was
traded against — are recorded in [QA.md](QA.md).

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties)

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21), Maven-built; also hosts the MCP server at `/mcp`
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3), npm built
- `petclinic-chatbot/` - separate Spring AI + Embabel app (Maven): a triage assistant that RAGs a
  specialty knowledge base and books visits through the backend's MCP tools. Second client of the
  backend, next to the frontend.
- `petclinic-database/` - Maven module launching the embedded Postgres (`PostgresLauncher`) behind a
  `NetworkLatencyProxy`, so latency can be injected on demand. `data/` is its (gitignored) cluster.
- `petclinic-test/` - Playwright/TypeScript e2e + Cucumber suite (npm), run against the whole stack
- `petclinic-observability/` - docker-compose for the OTel collector, Tempo and Grafana; config in
  `otelcol-config.yaml`
- `refactoring-legacy/` - self-contained OpenRewrite recipe module (imperative + Refaster), applied to
  the backend from the command line; the backend build never references it
- `openspec/` - OpenSpec `specs/` and `changes/`, the spec-driven-development workspace
- `user-manual/` - `manual.md` plus screenshots, the end-user documentation
- `scripts/` - repo-level guardrail helpers (`check-agents-md.sh`, `ensure-human-review.sh`,
  `list-unversioned-deps.py`)

## Common Commands

### Helper Scripts
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh         # Starts grafana on localhost:3300 in a docker container
petclinic-backend/docs/scripts/start-structurizr.sh  # optional: C4model Structurizr view on localhost:8081
petclinic-backend/docs/generate-codecity.sh  # rebuilds docs/generated/codecity/codecity.html, the 3D code view.
     # Renderer = github.com/victorrentea/code-city, cloned into petclinic-backend/.tools/codecity/
     # (gitignored); change the rendering there, here only its output is committed.
```

## Architecture

### /human-review lives in its own repo

`.claude/skills/human-review` is a symlink into `~/workspace/human-review`
(github.com/victorrentea/human-review) — editing through it edits that repo, so commit there;
`scripts/ensure-human-review.sh` fetches the same repo for the PlantUML differs, and a second
vendored copy would drift in silence.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)
- **Flyway seeds the DB when the backend boots** (`ddl-auto=none`; `db/migration/`: schema in
  `V1`, sample data in `V3__sample_data.sql`). An empty DB before that is normal, not broken.
- ⚠️ `./start-database.sh` starts by `rm -rf data`, wiping any rows added at runtime. Use it only
  for a deliberate reset; to keep runtime data, start Postgres from the jar directly.

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default test user: `admin`/`admin`

## API Endpoints
Backend exposes REST API at http://localhost:8080/api/
REST Contract: see `openapi.yaml`

### `GET /api/owners` is paged, and its rows carry no pets

It returns `PagedModel<OwnerRowDto>` — `content` plus metadata nested under `page` — not a bare
array. Anything reading it walks the pages (`petclinic-test/src/owners-api.ts` does this once for
the whole e2e suite); anything needing an owner's pets calls `GET /api/owners/{id}`, because the
rows are deliberately slim: `JOIN FETCH` on a collection plus pagination makes Hibernate paginate
in memory (`HHH000104`).

- `page` (0-based, default 0), `size` (default 10, **hard cap 20** — a request for 21 is a `400`),
  `sort` (`NAME` | `CITY` only), `dir` (`ASC` | `DESC`), alongside the existing case-sensitive
  `lastName` prefix filter.
- **Every ordering ends in `id`** (`last_name, first_name, id` / `city, id`). Last names are not
  unique in the seed, and without a unique tie-breaker `LIMIT/OFFSET` can return one row on two
  pages and skip another. The sort indexes in `V10__index_owners_for_paging.sql` carry `id` as
  their last column for the same reason. `OwnerPaginationTest` guards both.
- The grid sorts **in Postgres**, so its ordering is the cluster's collation, and Zonky's default
  `initdb` is byte-wise (`C`), which drops `Śliwiński` below every ASCII surname instead of into
  the S block. **Both clusters are therefore pinned to `en_US.UTF-8`**: the dev one in
  `PostgresLauncher` (`setLocaleConfig("locale", …)`, applied on a fresh `initdb`), the test one in
  `OwnerPaginationTest` (`@SpringBootTest(properties = "zonky…lc-collate=en_US.UTF-8")`). Unpin
  either and the grid quietly orders diacritics differently from what the guard asserts. There is
  deliberately **no `COLLATE`** in the query: JPQL cannot express it.
- The full design interview behind all of this — including what each decision was traded against —
  is in [QA.md](QA.md).

### `GET /api/owners` is paged, and its rows carry no pets

It returns `PagedModel<OwnerRowDto>` — `content` plus metadata nested under `page` — not a bare
array. Anything reading it walks the pages (`petclinic-test/src/owners-api.ts` does this once for
the whole e2e suite); anything needing an owner's pets calls `GET /api/owners/{id}`, because the
rows are deliberately slim: `JOIN FETCH` on a collection plus pagination makes Hibernate paginate
in memory (`HHH000104`).

- `page` (0-based, default 0), `size` (default 10, **hard cap 20** — a request for 21 is a `400`),
  `sort` (`NAME` | `CITY` only), `dir` (`ASC` | `DESC`), alongside the existing case-sensitive
  `lastName` prefix filter.
- **Every ordering ends in `id`** (`last_name, first_name, id` / `city, id`). Last names are not
  unique in the seed, and without a unique tie-breaker `LIMIT/OFFSET` can return one row on two
  pages and skip another. The sort indexes in `V10__index_owners_for_paging.sql` carry `id` as
  their last column for the same reason. `OwnerPaginationTest` guards both.
- The grid sorts **in Postgres**, so its ordering is the cluster's collation. Production is
  `en_US.UTF-8`, where `Śliwiński` lands right after `Silver`; a default `initdb` on a CI runner
  is byte-wise and drops it to the end. `OwnerPaginationTest` pins the embedded cluster's locale
  via `@SpringBootTest(properties = "zonky...lc-collate=en_US.UTF-8")` so the guard means the same
  thing everywhere. There is deliberately **no `COLLATE`** in the query: JPQL cannot express it.
- The full design interview behind all of this — including what each decision was traded against —
  is in [QA.md](QA.md).

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind comments when deleting or moving stuff, to prevent later 'heresy resurrection'
- Always run tests after any refactoring
- Keep your explanations concise; we are experienced backend developers
- Challenge ambiguous prompts - I love hearing I'm wrong!  
- Before any git commit, make sure your changes are reflected in AGENTS.md
