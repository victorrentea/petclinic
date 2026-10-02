# PetClinic — an Agentic Engineering Playground

A full-stack PetClinic (Angular SPA + Spring Boot REST API). **The domain is
incidental** — this repo exists to demonstrate AI-assisted / agentic software
engineering techniques you can lift into your own projects.

## What this repo teaches

- **Living kept in sync architecture, kept honest by guardrail tests.** Diagrams and specs
  are *generated from the code*; ArchUnit + extractor tests fail the build when
  code and diagram drift apart. See [GUARDRAILS.md](GUARDRAILS.md).
- **Snapshot now, diff at review.** Committed diagrams stay a clean picture of
  *current* reality; the red add/remove delta is computed on demand from two git
  snapshots (`puml-diff`), when a human asks for it — see
  [`/human-review`](https://github.com/victorrentea/human-review).
- **Diagrams generated from code, rendered from source.** `.puml` files are
  committed and rendered live via the PlantUML proxy straight off GitHub raw —
  no build step to view them; each render carries a `footer` naming its own
  source (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- **C4 model** as versioned Structurizr DSL: stable, human C1/C2 + a
  *code-coupled* C3 that is unit-tested against the real packages.
- **E2E traces → sequence diagrams.** Tempo/OpenTelemetry spans from a browser
  run are replayed into a PlantUML sequence diagram.
- **MCP server** hosted by the backend at `/mcp` (Spring AI) — tools/resources
  an agent can call.
- **Code-first OpenAPI.** The spec is *extracted* from the controllers
  (`OpenApiExtractorTest` → `openapi.yaml`); the frontend's TS types are
  regenerated from it. Both drift-checked.
- **Hooks + CI backstop + CODEOWNERS.** Guardrail hooks run before every push,
  mirrored as unavoidable CI gates (blocking `--no-verify`), and compare
  *regenerated content* — not file paths — so they can't be gamed; sensitive
  files need elder review.
- **Observability.** Zero-code OpenTelemetry → Grafana LGTM, queryable from
  Claude Code via `mcp-grafana`.

For example, this domain class diagram is generated from the code by
`DomainModelExtractorTest` and rendered live from the committed
[`DomainModel.puml`](petclinic-backend/docs/generated/DomainModel.puml) — see
[ARCHITECTURE.md](ARCHITECTURE.md) for the rest:

![Domain model](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/DomainModel.puml)

## Quickstart

A) Tell your agent: `start db,be,fe,grafana`

B) Manual: Run in separate terminals:
```sh
./start-database.sh   # ⇒ embedded Postgres        :5432
./start-backend.sh    # ⇒ Spring Boot (+OTel, MCP)  :8080
./start-frontend.sh   # ⇒ Angular dev server        :4200
./start-grafana.sh   # ⇒ :3300 (Requires Docker)
```

- App UI: http://localhost:4200 
- Backend Swagger: http://localhost:8080/swagger-ui.html

## Browsing owners

The Owners screen displays names as **Last name, First name** and starts with 10 rows,
sorted by last name, first name, then owner ID.
Choose 5, 10, or 20 rows per page and use the first/previous/next/last buttons in the
bottom bar, alongside Add Owner; the range indicator shows the current rows and total matches. Name and City
headers toggle ascending/descending order, including with the keyboard. Address,
Telephone, and Pets are not sortable. Sorting keeps the scroll position and column
widths stable; existing rows stay visible, dimmed, until their replacement arrives.
On small screens, scroll the table horizontally;
the paginator remains below it.

Submit the Last name form with **Find Owner**, beside the input, or Enter to apply a case-sensitive,
literal prefix search. Submitting a search, changing size, or changing sort returns to
the first page. Searches keep the chosen sort; paging and sorting keep the last
submitted prefix, not unfinished edits in the search box.

The address bar stores the applied `page`, `size`, `sort`, and `lastName` settings.
Refresh the page, copy its URL to another user, or use Back/Forward to restore the
same view. For example,
[this shared view](http://localhost:4200/petclinic/owners?page=1&size=5&sort=city,desc&lastName=)
opens the second page of five owners, sorted by City descending. A submitted search
adds its encoded prefix to `lastName`; draft text is never shared until submission.
Opening a link still requires the same application access as browsing normally.

Missing URL settings use the defaults. Invalid or repeated owner-list settings
reset **all** settings to defaults, show a visible warning, and replace the invalid
address without adding a broken history entry. This browser behavior does not
change the API: malformed API requests still return HTTP 400.

Only the latest request can update the screen. A successful search with zero matches
shows a no-owners message and hides pagination; a failed request shows an explicit
error instead. An empty page with a nonzero total still permits navigation back.
Owner-name links, Add Owner, owner editing, pets, and visit booking remain unchanged.

### Owner list API

`GET /api/owners` now returns an object containing **only** `content` (existing owner
DTOs, including pets, types, and visits) and `totalElements` (all matching owners).
It no longer returns a top-level array. Authentication and owner-detail/CRUD contracts
are unchanged. See the generated [OpenAPI contract](openapi.yaml) for DTO definitions.

For example, `GET /api/owners?lastName=Pot&page=0&size=5&sort=city,desc` returns:

```json
{
  "content": [],
  "totalElements": 0
}
```

The example represents a dataset with no matching owners. With matches, `content`
contains up to five owner DTOs, ordered by city, last name, first name, and ID descending.

- Omitted parameters default to `lastName=`, `page=0`, `size=10`, `sort=name,asc`.
- `page` is a nonnegative zero-based integer; `size` is only 5, 10, or 20.
- `sort` is exactly `name,asc`, `name,desc`, `city,asc`, or `city,desc`.
  Direction applies to every field in the corresponding ordering chain.
- Unsupported or malformed paging/sort inputs return HTTP 400. Entity-property sort
  keys such as `lastName,asc` are not accepted.
- Prefix matching is case-sensitive; `%` and `_` are literal characters. URL-encode
  prefixes when constructing requests.
- A page beyond the last match returns empty `content` and the actual matching total.
  Consumers needing every owner must traverse pages rather than assuming the first
  response contains the whole dataset.

### Coordinated release and rollback

Ship backend, frontend, regenerated API types, and migrated list consumers in **one PR
and one coordinated deploy**. Do not serve the old array-expecting frontend against the
new backend or the new frontend against the old backend. Apply the additive
`V4__owner_list_indexes.sql` migration before routing traffic to the paired new versions.
For separate deployments, keep traffic on the old pair (or pause traffic) until both
new versions are ready, then switch them together.

If rollback is necessary, restore **both application versions together**, including
the matching frontend assets, before resuming traffic. The extra prefix/Name/City
indexes are compatible with the old application and may remain. Never edit or remove
an already-applied Flyway migration, and do not roll back by resetting the database.

Small-fixture tests verify database pagination and a bounded query count. Response
times on 100,000 owners and concurrent-load/latency-proxy measurements are **unverified
and deferred for budget**; this change does not claim large-scale performance results.

## Prompts to try

Tell an agent running in this repo:

### Context Engineering

- **Trim boilerplate** — remove from CLAUDE.md the mvn/npm instructions any LLM already knows.
- **Point at generated sources** — replace CLAUDE.md's `## API Endpoints` with a pointer to the auto-synced `openapi.yaml`.
- **Scope rules by folder** — extract backend rules into a nested `petclinic-backend/CLAUDE.md` that loads only there.
- **Path-scoped skill** — move `### Java Code Style` into a `java/SKILL.md`
- **Force load a skill for by file paths**: Add to skill's frontmatter `paths: petclinic-backend/**/*.java`, so it 100% activates before any `.java` edit.
- **Reference drift-safe knowledge** — replace the drifting `## Domain Model` chapter with a link to the in-sync `DomainModel.puml`. Add a link to DB.sql and openapi.yaml
- **Audit CLAUDE.md** — check it is non-contradictory and in sync with recent code changes.

### Tasks

The tasks below have the pattern: **<description>** – <prompt to paste to agent>

- **⭐BE+FE feature** – Improve the owner search ([Issue #24](https://github.com/victorrentea/petclinic/issues/24)), then optionally review the code
- **Fix BE+FE bug** – Fix missing visit date validation ([Issue #40](https://github.com/victorrentea/petclinic/issues/40)): reproduce it in a browser, write a failing Playwright e2e test, then fix the bug so the test passes
- **Fix UI layout** – align the labels and values in the [owner details screen](http://localhost:4200/petclinic/owners/1) via Playwright screenshots
- **Exploratory QA** — download the [Playwright test agents](https://playwright.dev/docs/test-agents) and explore the app to write 10 significant automated .feature e2e tests
- **Regenerate the [user manual](user-manual/manual.md)** — `/regen-user-manual`
- **Grafana dashboard** — create a dashboard of what to monitor, then open it (start Grafana's Docker if needed).
- **Latency study** — break down the time budget of a "search owners" click from recorded Grafana traces - where is most time lost?
- **SQL** — export an Excel pie chart of the pet types querying `postgres-db`, and open it when ready.
- **Query tuning** — optimize the "search owners by last name" query.
- **Speedup tests** — speedup the backend tests.
- **Rule → guardrail** — replace the AGENTS.md rule "Keep line length < 120 chars" with a script that enforces it on `git push`, over the Java files the push actually changes.
- **⭐DevOps drills** — seed a red pipeline, a latency incident or a stale runbook, then drive an agent to green: [`exercises/devops/`](exercises/devops/)
  
Some tasks above require tools from the project's `.mcp.json`, which should autoload when you start the agent in this folder.


### Tools
Start YOUR agent in YOUR🫵 work project and tell it:

"Help me grant you access to:..."
- **Issues** — fetch the issues assigned to me on this git repo, put a test comment on the last one
- **CI** — find out how much time the tests took in the last CI run 
- **Logs** — get the last errors from the dev environment log
- **Browser** – reproduce a recent FE bug in a browser
- **DB** - which database tables have the most rows in my dev DB?
- **Metrics** - What is the endpoint with the highest latency in Grafana?
- **Token Saving** - Configure me headroom or at least RTK to save tokens.

Patiently guide the agent through this setup, then tell it: Turn the lessons you learned into a reusable skill, ideally scripting as much work you can. 

### Tools for Agentic Lifestyle
- [WisprFlow](https://wisprflow.ai) to dictate.
- [CodexBar](https://codexbar.app) to see the remaining Claude/Codex/Copilot quota.
- [ScreenBrush](https://apps.apple.com/us/app/screenbrush/id1233965871) to draw on screen before screenshot to agent. 
- Custom statusline: [victorrentea/victor-statusline](https://github.com/victorrentea/victor-statusline) — rich status bars for Claude Code and Copilot CLI (per-turn cost, quota burn-rate, prompt-cache health). Tell your CLI agent: *configure yourself a status bar following that repo's README*.

### Adopt ideas from `petclinic` into your own project ❤️

Start an agent in **your** project and tell it: 
From the https://github.com/victorrentea/petclinic repo…
- get the mechanism that keeps `packages.puml` in sync with code structure.
- get the mechanism that generates `DomainModel.puml` from code.
- adopt the database migrations scripts technique
- get the mechanism to auto-build `DB.puml` from the incremental DB scripts.
- show me where my GitHub Copilot AI credits went — per day, per model and per session — using
  https://github.com/victorrentea/copilot-usage.
- copy the idea to keep the backend Java in sync with `openapi.yaml`, and the frontend `api-types.ts` - prove that a change in a backend Dto fails the FE build, ran automatically prepush and on CI.
- get the way agent is kept in a loop to fix CI its push broke.
- get how to run critical tests before every push and again remotely in CI.
- copy the CODEOWNERS idea to protect critical files behind tech-lead/architect review to prevent dev fatigue-LGTM.
- write 3 .feature tests for the most critical flows of my app XYZ
- adopt the technique to generate sequence diagrams from key e2e tests, one per scenario, as in `petclinic-test/generated/*.genseq.puml`.
- get the code review skill using local sonar scanner and multi-agent review
- assemble a reviewer's guide for a change set — diagram deltas, Code City, a video of the
  feature, complexity delta and snippets deep-linked into the editor — with
  https://github.com/victorrentea/human-review (`/plugin marketplace add victorrentea/human-review`),
  which is the `/human-review` skill this repo symlinks into `.claude/skills/`.
- set up an End/Stop hook that plays a sound when the agent finishes its turn.
