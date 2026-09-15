# Project Memory
Coding agents auto-load this file in any new conversation in this folder.
It's the most important file on this Git repo.
Add to rules here to prevent AI fail/slop.
Review carefully its contents at every retrospective to remove: obvious, duplication, conflicts, drift, CYA comments.

- For Architecture, see `ARCHITECTURE.md` 
- For Guardrails, see `GUARDRAILS.md`

## AGENTS.md is the single source of truth
Claude Code: never write rules into `CLAUDE.md` - that file only contains @AGENTS.md to include this file.
GitHub Copilot: use this file over your proprietary `.github/copilot-instructions.md`.
Warning: git-pushed symlinks don't work reliably when clonsed on Windows machines.

## Project Overview
Full-stack PetClinic application, managing veterinary clinic operations (owners, pets, vets, visits, specialties)

**Structure:** independent Maven/npm builds — there is no aggregator `pom.xml` at the root.
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21), Maven-built. Has its own `AGENTS.md`
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3), npm built
- `petclinic-chatbot/` - separate Spring AI app on :8082 (teaching module): RAG over vet specialties, books visits through the backend's MCP. OpenAI-only, needs `OPENAI_API_KEY`; pgvector via its own `docker-compose.yml`
- `petclinic-database/` - tiny Maven launcher that runs embedded PostgreSQL on :5432 for dev (`ro.victorrentea`); the tests start their own in-process
- `petclinic-test/` - Playwright + Cucumber end-to-end suite (npm), plus the `.feature` specs and the genseq sequence-diagram generator. Has its own `AGENTS.md`
- `petclinic-observability/` - `grafana/otel-lgtm` container: Grafana on :3300, OTLP on :4317/:4318
- `refactoring-legacy/` - self-contained OpenRewrite recipe module, run from the CLI against the backend; wired into no other build
- `docker/` - the whole stack in containers, one isolated instance per branch under review (`start-docker.sh`), with an idle reaper
- `scripts/` - repo guardrails and helpers used by the hooks and the start scripts (preflight, AGENTS.md check, human-review resolution)
- `user-manual/` - generated end-user manual (`manual.md` + screenshots)

## Common Commands

### Helper Scripts
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh         # Starts grafana on localhost:3300 in a docker container
./start-chatbot.sh         # Spring AI chatbot on localhost:8082 (needs OPENAI_API_KEY)
./start-tests.sh           # the petclinic-test Playwright suite
./start-docker.sh          # the whole stack in containers, isolated per branch
```
Each app prints `✅ started <name> on port <n>` once it is actually ready, and `❌ …` when
it is not coming — wait for whichever line appears, never for a fixed timeout. A port
already held by an orphan from a previous run is reported in under a second, before
anything is built or wiped; the scripts never kill the squatter, they print its PID and
stop, so freeing it is your call.

## Architecture

## Additional Knowledge
Load one of these when the task calls for it — they are the sole source of truth on their subject.

When a guardrail test fails, or a living diagram no longer matches the code, the drift
checks and what each of them asserts are described in [GUARDRAILS.md](GUARDRAILS.md).

To see how the pieces fit together, every diagram generated from the code is rendered in
[ARCHITECTURE.md](ARCHITECTURE.md).

### Every change starts as OpenSpec markdown
Any feature or non-trivial change is planned first with `/opsx:propose` (or `/opsx:new` +
`/opsx:continue`), which writes `openspec/changes/<name>/` — `proposal.md`, `specs/<capability>/spec.md`,
`design.md`, `tasks.md` — and only then implemented with `/opsx:apply`. Never jump from a ticket
or a design note straight to code. The per-artifact rules live in `openspec/config.yaml`:
`proposal.md` is for the business reader (screenshot of the screen today, no code identifiers —
those go to `design.md`), and `spec.md` ends with a Gherkin sketch that reuses the steps already
bound in `petclinic-test/src/*.glue.ts`.

**`/opsx:apply` runs the whole `tasks.md` to completion in one sitting.** Never stop partway
through a task list to "check in" once work is underway — keep going section by section (backend,
frontend, e2e, docs, wrap-up) until every task is checked off or you hit a genuine blocker (an
ambiguous requirement, a design issue the artifacts don't cover, a failing check you can't
resolve). A natural-seeming pause point between sections is not a blocker.

### Frontend UX design system
`petclinic-frontend/src/app/design-system/` holds the standardised widgets. Every
single-select in a form goes through `<app-combo>` (`ComboComponent`), a
`ControlValueAccessor` that drops in where a `<select>` was — a raw `<select>` in a form
template is a bug, not a shortcut. Vet-edit's multi-select is still a `mat-select`; the
design system has no multi-select yet.

An owner's name is rendered by the `ownerName` pipe (`src/app/shared/`, exported by
`SharedModule`) as `"Last, First"` — never interpolate `firstName`/`lastName` by hand in a
template, or the screens drift apart from the sort order.

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

### The visit-date rule is specified in Gherkin, and the ticket mirrors it

`petclinic-test/src/visit-date-range.feature` states bug #40's rule — a visit date sits
between the pet's birth date and one year from today, **both edges inclusive** — as four
Examples rows: each edge, and its nearest neighbour outside the range. That is the minimum
that pins inclusivity; drop either "accepted" row and an off-by-one implementation still
passes. It has **no step definitions on purpose**: it is the contract, not a test.

GitHub renders a code snippet box only for a permalink pinned to a commit SHA, so a link to
`main` would stay a bare link and a permalink would freeze. `.github/workflows/sync-issue-spec.yml`
therefore rewrites issue #40's body between `<!-- spec:begin -->` / `<!-- spec:end -->` on every
push that touches the file. **Edit the `.feature`, never the ticket** — the next push overwrites
whatever was typed there.

⚠️ The rule the feature states is the REST/UI one. The MCP `create_visit` tool enforces
something else entirely (`PetClinicMcp.requireFutureDate`: no upper bound at all, and the past
refused outright), and never calls `Visit.validateDate`. Reconciling them is open work.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)
- **Flyway seeds the DB when the backend boots** (`ddl-auto=none`; `db/migration/`: schema in
  `V1`, sample data in `V3__sample_data.sql`). An empty DB before that is normal, not broken.
- ⚠️ `./start-database.sh` starts by `rm -rf data`, wiping any rows added at runtime. Use it only
  for a deliberate reset; to keep runtime data, start Postgres from the jar directly.
- **Never design against the seed data alone — ask to look at the real rows.** Whenever a
  decision depends on what the data actually looks like (sortable columns, nullability,
  formats, cardinality), ask Victor for permission to run a query, then run it. He has
  context about the data that is nowhere in this repo. The way in is the `petclinic-db-cli`
  skill (`dbhub` MCP over `mcptools`) — and note the database is **PostgreSQL**, never MySQL.
- **Target scale: ~100.000 owners within a year** (Bizu, Sep 2026). The 28 seeded rows are a
  demo fixture, not the sizing. Anything that lists or searches owners must page and sort in
  the database — never load the table into the browser or the JVM — and every sortable or
  filterable column needs an index.
- **`GET /api/owners` is a page, not a list** (since the owners grid): `page`, `size` (only
  5/10/20 — anything else is a 400), `sort` (`NAME`/`CITY`), `dir`, optional `lastName`
  prefix. `NAME` means last name first, then first name; both sorts tiebreak on `id`.
  `V9__owner_sort_indexes.sql` backs them with `owners_name_idx` / `owners_city_idx`
  (ICU collation where available, default collation otherwise).

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default test user: `admin`/`admin`

## API Endpoints
Backend exposes REST API at http://localhost:8080/api/
REST Contract at `openapi.yaml` which is kept in sync with reality via tests 

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Core Values
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind comments when deleting or moving stuff (CYA comments)
- Always run tests after any complex refactoring
- Be brief 
- Challenge ambiguous prompts - I love hearing I'm wrong! I want a thinking partener, not a sycophantic yes-man.
- Before any git commit, make sure to update any drifted knowledge in AGENTS.md
