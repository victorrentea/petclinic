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
- `petclinic-database/` - Embedded PostgreSQL launcher (Maven module), used by `./start-database.sh`
- `petclinic-chatbot/` - Spring AI RAG chatbot module (Maven-built)
- `petclinic-observability/` - Grafana/Tempo/otel-collector stack (`./start-grafana.sh`, docker-compose)
- `petclinic-test/` - end-to-end tests (Playwright/Cucumber, npm-built); see `petclinic-test/AGENTS.md`
- `refactoring-legacy/` - self-contained OpenRewrite recipes module (Maven-built), not wired into the backend build
- `user-manual/` - end-user documentation (`manual.md` + screenshots)
- `scripts/` - repo-wide helper/check scripts (e.g. `check-agents-md.sh`)

## Common Commands

### Helper Scripts
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh         # Starts grafana on localhost:3300 in a docker container
```

## Architecture

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
REST Contract kept in sync with BE and FE code: `openapi.yaml`.

## Domain Model
Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

### Volumetry
The PO's target is **100,000 owners** in production. The seeded dev database holds 28, so
any screen or query over owners that looks fine locally will not be fine in production:
never load or sort the full owners table in the browser or in memory — page and sort it in
the database.

## Development Notes

### Frontend design system
`petclinic-frontend/src/app/design-system/` holds the standardised widgets. Every
single-select in a form goes through `<app-combo>` (`ComboComponent`), a
`ControlValueAccessor` that drops in where a `<select>` was — a raw `<select>` in a form
template is a bug, not a shortcut. Vet-edit's multi-select is still a `mat-select`; the
design system has no multi-select yet.

## Core Values
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names
- Don't leave behind comments when deleting or moving stuff, to prevent later 'heresy resurrection'
- Always run tests after any complex refactoring
- Keep your explanations concise as for senior engineers with a pinch of ADHD
- Challenge ambiguous prompts - I love hearing I'm wrong!  
- Before any git commit, make sure to update any drifted knowledge in AGENTS.md
