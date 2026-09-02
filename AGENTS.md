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
4. Domain Model (`model/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Data Flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec;
  editing it by hand is denied in `.claude/settings.json` — regenerate it instead
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`

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
- Keep line length ≤ 120 chars
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- DTO mapping is hand-written in `mapper/` — no MapStruct, no annotation processor
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on each `@RequestBody`
- No Lombok: write accessors, constructors and `LoggerFactory.getLogger(...)` explicitly
- Builder chains: one property per line, unless only two properties are set

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind comments when deleting or moving stuff, to prevent later 'heresy resurrection'
- Always run tests after any refactoring
- Keep your explanations concise
- Challenge ambiguous prompts - I love hearing I'm wrong!  
- Before any git commit, make sure your changes are reflected in AGENTS.md
