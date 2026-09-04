# Project Memory

Coding agents auto-load this file in any new conversation in this folder.
It's the most important file in any repo, pushed on git, added to on any AI failure/slop, carefully 👱🏻‍♂️-curated every retrospective.
**This file is the single source of truth. Never write rules into `CLAUDE.md`.**
`CLAUDE.md` next to it holds one line — `@AGENTS.md` — and exists only because Claude
Code does not read AGENTS.md; that import is how it reaches this file. Copilot CLI and
Codex read this [standard](https://agents.md) file natively and have no import of their
own, so anything written into CLAUDE.md would be visible to Claude Code alone. It is not
a symlink, and must never become one again: Git for Windows checks symlinks out as text
files containing their target path, so a clone would hand every agent the word "CLAUDE.md"
as its complete instructions. `scripts/check-agents-md.sh` enforces all of this (pre-push
and CI, on Linux and on Windows).

Copilot: use this file over your proprietary .github/copilot-instructions.md

## Additional Knowledge

Load one of these when the task calls for it — they are the sole source of truth on their subject.

When a guardrail test fails, or a living diagram no longer matches the code, the drift
checks and what each of them asserts are in [GUARDRAILS.md](GUARDRAILS.md).
To see how the pieces fit together, every diagram generated from the code is rendered in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties)

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21), Maven-built
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3), npm built

## Common Commands

### Helper Scripts
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh         # Starts grafana on localhost:3300 in a docker container
```

### Backend (petclinic-backend/)
```sh
mvn spring-boot:run              # Run backend
mvn test                         # Run tests
mvn clean install                # Build
mvn test -Dtest=ClassName#methodName # Run a single test
```

### Frontend (petclinic-frontend/)
```sh
npm start                           # Dev server on localhost:4200
npm run build                       # Production build
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
npm run e2e                         # Protractor e2e tests
```

## Architecture

### Backend Architecture

**Layered Structure:**
1. REST Controllers (`petclinic-backend/src/main/java/.../rest/`) - expose API endpoints
2. Mappers (`mapper/`) - hand-written `@Component` entity↔DTO conversion
3. Repository Layer (`repository/`) - Spring Data JPA interfaces (no service layer!)
4. Domain Model (`domain/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Data Flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec;
  editing it by hand is denied in `.claude/settings.json` — regenerate it instead
- Constructor injection, global exception handling via `@RestControllerAdvice`

### /human-review is a plugin, and nothing of it lives in this repo

It is installed, not vendored:

```
/plugin marketplace add victorrentea/human-review
/plugin install human-review@human-review
```

Everything petclinic-specific about it is **`human-review.json`** at the root — the traced
test run, the Code City generator, the complexity extractor, the screens the design-system
audit visits. The skill itself knows nothing about this project, and a step this file does
not describe is skipped and named on the built page. That is the only file to touch when a
command here changes.

`scripts/ensure-human-review.sh` resolves the skill for the two scripts that borrow its
PlantUML differs (`docs/scripts/puml-diff/puml-diff-vs-git.sh`): installed plugin first,
then a local checkout symlinked into `.claude/skills/`, then a clone into a gitignored
`petclinic-backend/.tools/`. Never vendor a second copy — a private fork of the review
pipeline drifts in silence.

⚠️ **That symlink is untracked, and putting it back in git is a mistake with a history.**
It was committed for a while as mode 120000 pointing at `/Users/<someone>/workspace/…`, so
every clone of this public repo carried a link that resolved for exactly one person on one
laptop. `scripts/check-agents-md.sh` no longer allowlists it; if you develop the skill
locally, symlink it in and leave it ignored.

**Run the review passes before you ask for the guide.** `/human-review` no longer invokes
`/code-review` or `/simplify` — it writes up the passes that already ran in the
conversation, and stops with an explanation if it finds none. So the order is: finish the
work, run whichever passes you trust, *then* `/human-review`.

**The review guide is built by hand, not by CI.** It deep-links into a working tree and
drives a whole local stack — a browser, a database, Tempo, PlantUML, a Maven build — so
there is no online version and no PR automation for it. Run `/human-review` when you want
one. `diagram-preview.yml` still posts a PR comment rendering the branch's own diagrams,
which is a different and much cheaper thing: proxy URLs, no runner render, no publishing.

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
REST Contract: 
- Owners: `/api/owners`, `/api/owners/{id}`
- Pets: `/api/pets`, `/api/pets/{id}`
- Vets: `/api/vets`, `/api/vets/{id}`
- Visits: `/api/visits`
- PetTypes: `/api/pettypes`
- Specialties: `/api/specialties`
- Users: `/api/users`
OpenAPI docs: http://localhost:8080/swagger-ui.html

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Development Notes

### Java Code Style
- Keep line length < 120 chars
- Keep methods under 30 lines
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- DTO mapping is hand-written in `mapper/` — no MapStruct, no annotation processor
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on each `@RequestBody`
- No Lombok: write accessors, constructors and `LoggerFactory.getLogger(...)` explicitly
- Write only the `equals`/`hashCode`/`toString` a class actually needs, not all three reflexively

### Frontend design system

`petclinic-frontend/src/app/design-system/` holds the standardised widgets. Every
single-select in a form goes through `<app-combo>` (`ComboComponent`), a
`ControlValueAccessor` that drops in where a `<select>` was — a raw `<select>` in a form
template is a bug, not a shortcut. Vet-edit's multi-select is still a `mat-select`; the
design system has no multi-select yet.

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind comments when deleting or moving stuff, to prevent later 'heresy resurrection'
- Always run tests after any refactoring
- Keep your explanations concise
- Challenge ambiguous prompts - I love hearing I'm wrong!  
- Before any git commit, make sure your changes are reflected in AGENTS.md
