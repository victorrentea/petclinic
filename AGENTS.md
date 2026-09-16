# Project Memory
Coding agents auto-load this file in any new conversation in this folder.
It's the most important file on this Git repo.
Add to rules here to prevent AI fail/slop.
Review carefully its contents at every retrospective to remove: obvious, duplication, conflicts, drift, CYA comments.

## AGENTS.md is the single source of truth
Claude Code: never write rules into `CLAUDE.md` - that file only contains @AGENTS.md to include this file.
GitHub Copilot: use this file over your proprietary `.github/copilot-instructions.md`.
Warning: git-pushed symlinks don't work reliably when cloned on Windows not having WSL.

## Project Overview
Full-stack PetClinic application, managing veterinary clinic operations (owners, pets, vets, visits, specialties)

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21), Maven-built; also hosts the Spring AI MCP server at `/mcp`
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3), npm built
- `petclinic-database/` - embedded PostgreSQL module (Java jar), backs `./start-database.sh`
- `petclinic-chatbot/` - Spring AI triage assistant (RAG + MCP tool calls into the backend)
- `petclinic-test/` - Playwright/TypeScript E2E tests for the Owners page
- `petclinic-observability/` - Grafana/OTel collector docker-compose stack (`./start-grafana.sh`)
- `refactoring-legacy/` - standalone OpenRewrite recipes module, run against the backend from the CLI
- `docker/` - shared docker-compose + Testcontainers reaper helpers
- `user-manual/` - generated end-user manual (`manual.md` + screenshots)

## Common Commands

### Helper Scripts
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh         # Starts grafana on localhost:3300 in a docker container
```
Wait for `✅ started <name> on port <n>` or `❌ …`, never for a fixed timeout. A port held
by an orphan is reported in under a second, before anything is built or wiped — the script
prints the squatter's PID and stops; killing it is your call.

## Architecture

## Additional Knowledge

When a guardrail test fails, or a living diagram no longer matches the code, the drift
checks and what each of them asserts are described in [GUARDRAILS.md](GUARDRAILS.md).

To see how the pieces fit together, every diagram generated from the code is rendered in
[ARCHITECTURE.md](ARCHITECTURE.md).

### Frontend UX design system
`petclinic-frontend/src/app/design-system/` holds the standardised widgets. Every
single-select in a form goes through `<app-combo>` (`ComboComponent`), a
`ControlValueAccessor` that drops in where a `<select>` was — a raw `<select>` in a form
template is a bug, not a shortcut. Vet-edit's multi-select is still a `mat-select`; the
design system has no multi-select yet.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)
- **Flyway boots from two locations** (`ddl-auto=none`); an empty DB before that is normal.
  `db/migration/` is the versioned **schema** chain — no rows here, ever: seed data in a frozen
  migration is what forced the old V5/V7/V8 to patch each other. `db/seed/R__seed.sql` is the
  **dataset**, repeatable, so edit it freely; it re-runs on checksum change after all versioned
  migrations, opening with `TRUNCATE ... RESTART IDENTITY` (ids are deterministic — tests rely on
  owner 1 = Kevin McCallister, pet 3 = Milton). A second dataset = a sibling location reusing the
  name `R__seed.sql`, picked by swapping `spring.flyway.locations`; Flyway refuses to boot on two
  resolved migrations sharing one description, so two can never both apply.
- ⚠️ `./start-database.sh` starts by `rm -rf data`, wiping any rows added at runtime. Use it only
  for a deliberate reset; to keep runtime data, start Postgres from the jar directly.

## API Endpoints
Backend exposes REST API at http://localhost:8080/api/
REST Contract is kept in sync in `openapi.yaml`

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

### Expected data volumes
The `owners` table is expected to reach **~100.000 rows within a year** (business input, per Bizu).
Treat owner listing and search as a large dataset: paging, sorting and filtering belong in the
database — never "fetch them all and filter in the browser".

## Core Values
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind CYA comments when deleting or moving stuff
- Always run tests after any complex refactoring
- Be brief
- Inspect the running UI through Playwright's default **accessibility snapshot**, never by taking a
  screenshot and feeding the image back to the model — pixels burn tokens to re-derive text the
  snapshot already hands over. Screenshots are for the human (`open -a Preview`), not for the agent.
- Challenge my prompts - I love hearing I'm wrong! Be a thinking partener, not a sycophantic yes-man.
- Before any git commit, make sure to update any drifted knowledge in AGENTS.md
