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
Wait for `✅ started <name> on port <n>` or `❌ …`, never for a fixed timeout. A port held
by an orphan is reported in under a second, before anything is built or wiped — the script
prints the squatter's PID and stops; killing it is your call.

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
5. Notification (`notification/`) - `NotificationSender` + a fake SMS sender, called after a
   visit is booked. Takes plain values, never an entity, and reaches no repository — which is
   what lets it be drawn as its own participant (see below) rather than a layer of the backend

**Data Flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec;
  editing it by hand is denied in `.claude/settings.json` — regenerate it instead
- Constructor injection, global exception handling via `@RestControllerAdvice`

## Additional Knowledge

When a guardrail test fails, or a living diagram no longer matches the code, the drift
checks and what each of them asserts are described in [GUARDRAILS.md](GUARDRAILS.md).

To see how the pieces fit together, every diagram generated from the code is rendered in
[ARCHITECTURE.md](ARCHITECTURE.md).

### A module can be its own lifeline in the generated sequence diagrams
A span carrying `genseq.participant="<name>"` is drawn on a lifeline of that name. It exists so
a `@SpringBootTest`'s own sentences stay off the app's lifeline (`Test`), and
`notification/FakeSmsNotificationSender` uses it for the opposite reason: to show a call
*entering* a module that runs in the backend's own process, and leaving it for the (fake) SMS
gateway. Everything else in a trace — `service.name`, span kind — says "backend" for all three.

A name that is not a bare identifier (`Notification module`) is quoted by the generator, on its
`participant` line and on every arrow. That also keeps it out of `DeploymentDiagramTest`, which
matches `\w+ -> \w+` — rightly, because a logical module ships inside the Backend container and
has no box of its own on a picture of what is deployed. `human-review.json` folds it onto
`Backend` for the same reason, and marks `SMS gateway` external.

### Frontend UX design system
`petclinic-frontend/src/app/design-system/` holds the standardised widgets. Every
single-select in a form goes through `<app-combo>` (`ComboComponent`), a
`ControlValueAccessor` that drops in where a `<select>` was — a raw `<select>` in a form
template is a bug, not a shortcut. Vet-edit's multi-select is still a `mat-select`; the
design system has no multi-select yet.

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

**Tooling changes go to `main` first.** Any change to the guardrails, the anti-drift checks or the `/human-review` wiring (`human-review.json`, `scripts/`, genseq, Code City, traces) made while working on a downstream PR branch is committed on `main`, pushed, and then merged into that branch (e.g. `test-pr`) — never left living only on the PR.

`scripts/ensure-human-review.sh` resolves it for the script that borrows its PlantUML
differs (`petclinic-backend/docs/scripts/puml-diff/puml-diff-vs-git.sh`): `$CLAUDE_PLUGIN_ROOT`,
then the installed plugin, then the marketplace's own clone, then a local checkout symlinked
into `.claude/skills/`, and finally a clone into a gitignored `petclinic-backend/.tools/` on
a runner. Never vendor a second copy — a private fork of the review pipeline drifts in
silence.

The installed plugin's path carries the installed commit
(`~/.claude/plugins/cache/human-review/human-review/<sha>/`), so that script asks the CLI's
own `installed_plugins.json` which one it installed rather than naming a directory that
changes on every update — or guessing. An update leaves the previous sha's directory in
place with an identical mtime, so "the newest one" tie-breaks alphabetically and hands back
the superseded skill; that happened, and `ensure-human-review-test.sh` now pins it.

⚠️ **There is no symlink here any more, and putting one back in git is a mistake with a
history.** `.claude/skills/human-review` was committed for a while as mode 120000 pointing
at `/Users/<someone>/workspace/…`, so every clone of this public repo carried a link that
resolved for exactly one person on one laptop. `scripts/check-agents-md.sh` no longer
allowlists it. Developing the skill against this repo does not need one either — install the
plugin from a local marketplace, or point `$HUMAN_REVIEW_HOME` at your checkout.

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
- Owners: `/api/owners`, `/api/owners/{id}`
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
- **Visit** N→1 **Vet**, *optional*: a visit booked before anyone is assigned has no vet, and
  neither has any row older than `V4__visit_vet.sql`. The FK is `ON DELETE SET NULL`, so retiring
  a vet is never blocked by their history — their past visits fall back to the "no vet" case
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Java Code Style
- Keep line length < 120 chars
- Keep methods under 30 lines
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write only the `equals`/`hashCode`/`toString` a class actually needs, not all three reflexively

## A feature is not done until one Gherkin scenario drives it through the UI

Every user-facing feature gets at least one `.feature` scenario in `petclinic-test/src/`
(bound by the `*.feature.glue.ts` beside it) that opens the screens a user opens. It is the
acceptance test of the story — the one artefact a non-programmer can read.

`petclinic-backend/src/test/resources/features/` does not count: that suite is Cucumber over
the REST API, so a field the backend stores and no page shows passes all of it. A `*.spec.ts`
does not count either — it is a second account of the same journey, written for the people
who write it (`add-visit.spec.ts` and `book-visit-with-vet.feature` are deliberately a pair).

Tag it `@generate_sequence` when the feature crosses the stack, so the story reaches the
review page with a picture of what its run did.

## Core Values
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind CYA comments when deleting or moving stuff
- Always run tests after any complex refactoring
- Be brief
- Challenge my prompts - I love hearing I'm wrong! Be a thinking partener, not a sycophantic yes-man.
- Before any git commit, make sure to update any drifted knowledge in AGENTS.md
