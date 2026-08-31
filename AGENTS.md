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

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties)

**Structure:** (no aggregator pom — each Maven module is built on its own)
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21), Maven-built. Also hosts the Spring AI
  MCP server at `/mcp` and, under `docs/`, the living-architecture tooling (Structurizr, codecity).
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3), npm built
- `petclinic-database/` - tiny Java module launching the **embedded Postgres** used by
  `./start-database.sh` and by the tests (`PostgresLauncher`), plus a `NetworkLatencyProxy`
  for demoing slow-DB scenarios
- `petclinic-chatbot/` - separate Spring Boot app on **:8082** (`./start-chatbot.sh`): a Spring AI
  triage assistant. RAG over the vet-specialty knowledge base picks a specialty, then it books the
  visit through the backend's MCP server. OpenAI-only (chat + embeddings, key from `secrets.env`),
  own pgvector on **:5433** (`docker compose up -d` in that folder). Also holds the
  `firefighter/` agent demo.
- `petclinic-test/` - Playwright + Cucumber e2e suite (TypeScript, `./start-tests.sh`) and the
  `src/genseq/` Tempo→PlantUML sequence-diagram tooling. Has its own `AGENTS.md` — read it before
  touching tests or diagrams.
- `petclinic-observability/` - `docker-compose.yml` for `grafana/otel-lgtm` (Grafana :3300,
  OTLP :4317/:4318), started by `./start-grafana.sh`
- `refactoring-legacy/` - self-contained OpenRewrite recipe module, run from the CLI against the
  backend; deliberately not wired into `petclinic-backend/pom.xml`
- `user-manual/` - `manual.md` + screenshots, **generated** by `/regen-user-manual`; never edit by hand
- `scripts/` - repo guardrails (`check-agents-md.sh`, `ensure-human-review.sh`, `list-unversioned-deps.py`)

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


### The /human-review skill lives in its own repo

`.claude/skills/human-review` is a **symlink** to `~/workspace/human-review/skills/human-review`
(github.com/victorrentea/human-review, public, installable as a Claude Code plugin). Edit it
there, not here — an edit through the symlink is an edit to that repo, and needs committing
there too.

The PlantUML differs moved with it. `docs/scripts/puml-diff/puml-diff-vs-git.sh` reaches
them through `scripts/ensure-human-review.sh`, which uses the symlink locally and clones the
repo into a gitignored `petclinic-backend/.tools/` otherwise. Never vendor a second copy: a
private fork of the review pipeline drifts in silence.

**The review guide is built by hand, not by CI.** It deep-links into a working tree and
drives a whole local stack — a browser, a database, Tempo, PlantUML, a Maven build — so
there is no online version and no PR automation for it. Run `/human-review` when you want
one. `diagram-preview.yml` still posts a PR comment rendering the branch's own diagrams,
which is a different and much cheaper thing: proxy URLs, no runner render, no publishing.

### Living Architecture & Guardrails

See [GUARDRAILS.md](GUARDRAILS.md) for the full list of guardrail tests, living architecture diagrams, and CI drift checks.

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

### Observability
- `./start-grafana.sh` brings up `grafana/otel-lgtm` (Grafana **:3300**, admin/admin; OTLP **:4317/:4318**).
- `./start-backend.sh` attaches the OTel Java agent **only if :4318 is already listening** — start
  Grafana *first*, otherwise the backend runs with telemetry silently disabled.
- Browser spans need a flush window: a scenario that finishes in <~5s closes the page before the
  frontend exporter ships anything, so no frontend traces reach Tempo.
- The agent is pinned at **2.20.1** and told to capture the maximum: SQL unsanitized, **bound
  query parameters** (`db.query.parameter.<n>`, which need `OTEL_SEMCONV_STABILITY_OPT_IN=database/dup`
  and only exist from agent ~2.20 — 2.10 has no such flag). What a sequence diagram *shows* is
  decided at render time in `petclinic-test/` (`SEQ_SQL`, `SEQ_HTTP_BODIES`), never here.
- The agent jar is versioned in its filename — otherwise an already-downloaded
  `opentelemetry-javaagent.jar` makes a version bump a silent no-op.
- `spring.jpa.properties.hibernate.use_sql_comments=true` makes Hibernate prefix each
  statement with the HQL that produced it, so a trace can say which call a bare
  `select … from owners` came from — the agent captures no HQL of its own. It only fires
  for queries *written* as HQL (`@Query`); a Spring Data derived method is assembled
  through the Criteria API and comments itself `/* <criteria> */`, and an entity or lazy
  load carries no comment at all. The sequence diagrams fall back accordingly — see
  `petclinic-test/AGENTS.md`. **A backend started before this property was added labels
  every DB arrow `SELECT petclinic`; restart it and re-record.**


## API Endpoints
Backend exposes REST API at http://localhost:8080/api/
REST Contract `/openapi.yaml`

**Rejecting a request = `IllegalArgumentException`.** That is the idiom already used by
`PetClinicMcp`, and `ExceptionControllerAdvice` maps it to a 400 ProblemDetail. Without that
handler it falls into the advice's catch-all `@ExceptionHandler(Exception.class)` and surfaces
as a 500 — so a new validation rule needs no new exception type, only the throw.

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

### Volumetry (business target, stated by Victor 2026-08-31)

**~100.000 owners** within one to five years. Today's seed has 26 — that number means
nothing for design. Anything that lists owners (or any collection that grows with them)
must be paginated **server-side**; fetching the whole table and paginating/sorting it in
the browser is not an option and must not be proposed again.

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind comments when deleting or moving stuff, to prevent later 'heresy resurrection'
- Always run tests after any refactoring
- Keep your explanations concise
- Challenge ambiguous prompts - I love hearing I'm wrong!  
- Before any git commit, make sure your changes are reflected in AGENTS.md
