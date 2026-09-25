# Project Memory
Coding agents auto-load this file in any new conversation in this folder.
It's the most important file on this Git repo.
Add to rules here to prevent AI fail/slop.
Review carefully its contents at every retrospective to remove: obvious, duplication, conflicts, drift, CYA comments.

## AGENTS.md is the single source of truth
GitHub Copilot: use this file over your proprietary `.github/copilot-instructions.md`.

## Project Overview
Full-stack PetClinic application, managing veterinary clinic operations (owners, pets, vets, visits, specialties)

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21), mvnw-built
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3), npm built
- `notification-service/` - Spring Boot app on :8090 that texts owners; the backend POSTs to it
  when a visit is booked via `POST /api/owners/{ownerId}/pets/{petId}/visits` (not `POST /api/visits`,
  not MCP `create_visit`)
- `petclinic-commons/` - plain jar both Java apps depend on (the notification request).
  No reactor pom: it is a standalone build, `mvn install`ed before either app compiles
- `petclinic-database/` - embedded Postgres launcher (+ latency proxy on :15432), `./start-database.sh`
- `petclinic-test/` - Playwright specs + Cucumber `.feature`s driving the UI (has its own AGENTS.md)
- `petclinic-chatbot/` - Spring AI triage-assistant teaching module on :8082, `./start-chatbot.sh`
- `petclinic-observability/` - Grafana LGTM + OTel collector (docker compose), `./start-grafana.sh`
- `docker/` - disposable full-stack containers per git ref, `./start-docker.sh`
- `refactoring-legacy/` - standalone OpenRewrite recipes run against the backend from the CLI
- `user-manual/` - end-user manual with screenshots
- `openspec/` - OpenSpec change proposals (`changes/`) and living specs (`specs/`), driven by `/opsx:*`
- `scripts/` - repo checks run by the git hooks and CI (`check-agents-md.sh`, `preflight.sh`, ...),
  plus `ui-mockup.cjs`, which turns a live page into the HTML/PNG mockup of an OpenSpec proposal

## Common Commands

### Helper Scripts
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # installs petclinic-commons, then BOTH Java apps: notification-service
                           # on :8090 (background) and the backend on :8080 (also Spring AI MCP at /mcp)
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

### Lifelines in the generated sequence diagrams
`service.name` picks the lifeline: `notification-service` is drawn as `NotificationService`, so
booking a visit shows `Backend -> NotificationService`. That name is a bare identifier on purpose:
`DeploymentDiagramTest` matches `\w+ -> \w+` and demands the same arrow on
`Deployment.drawio.png`, where the service has its own box.

A span carrying `genseq.participant="<name>"` is drawn on a lifeline of that name instead. It
keeps a `@SpringBootTest`'s own sentences off the app's lifeline (`Test`), and draws
notification-service's (fake) `SMS gateway`. A name that is not a bare identifier is quoted by
the generator and so stays out of `DeploymentDiagramTest`; `human-review.json` marks
`SMS gateway` external.

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
REST Contract: 
- Owners: `/api/owners` (one page: `lastName` prefix, `page` 0-based, `size` 5|10|20,
  `sort` name|city, `direction` asc|desc; anything else is a 400), `/api/owners/{id}`
- Pets: `/api/pets`, `/api/pets/{id}`
- Vets: `/api/vets`, `/api/vets/{id}`
- Visits: `/api/visits`
- PetTypes: `/api/pettypes`
- Specialties: `/api/specialties`
- Users: `/api/users`

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Core Values
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind CYA comments when deleting or moving stuff
- Always run tests after any complex refactoring
- Be brief as for experienced backend engineers with a pinch of ADHD
- Challenge my prompts - I love hearing I'm wrong! Be a thinking partener, not a sycophantic yes-man.
- Before any git commit, make sure to update any drifted knowledge in AGENTS.md

# Data Volume
- The business dreams of having 100,000 owners within a year in the database.
