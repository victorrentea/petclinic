# petclinic-test — Claude Notes

- Run all commands from this directory (`petclinic-test/`).
- Backend: `localhost:8080`, frontend: `localhost:4200` — both must be up before `npm test`.
- `npm run test:with-apps` auto-starts both apps, but is experimental; prefer starting apps manually.
- Screenshots land in `test-results/screenshots/` (git-ignored, auto-generated).
- Docker cleanup when things break: `docker-compose -f docker-compose.test.yml down -v`
- Layout: `src/` holds the scenarios (`*.spec.ts` + `*.dsl.ts`, `*.feature` + `*.glue.ts`),
  `src/support/` the fixtures/World, `src/genseq/` the Tempo→PlantUML tooling, `scripts/` the
  narrated screen recorders. Everything a run writes goes under `test-results/`.
- `scripts/record-bug40.sh before|after` films one take of GitHub issue #40 through the same
  selectors the e2e suite uses, deliberately slowed, and burns the narration into the frame with
  the review pipeline's `annotate-feature-video.py`; `scripts/combine-bug40.sh` joins the two takes
  into one `.mp4` behind title cards, with a merged `.srt`. A take asserts what it narrates and
  exits 3 on a mismatch, so a film can never claim a fix that is not there. The **before** take only
  reproduces while the bug does — re-shooting it means checking out a pre-fix commit.
- ⚠️ **An owner list in Gherkin is a data table, one owner per row — never a comma-separated
  cell.** The grid renders `Potter, Harry` (Lastname, Firstname), so a comma no longer separates
  two owners. A Scenario Outline is still right where the expectation is a *single* value (a
  search term, a page size, "no owners are listed"), never for a list.
- The owners grid is covered by two features sharing one glue set: `owner-search.feature`
  (the last-name filter) and `owners-pagination.feature` (paging, sorting, the pager strip).
  `owner-search.glue.ts` owns the steps both use — the Background, opening the page, searching,
  `exactly these owners are listed`; `owners-pagination.glue.ts` owns the rest. The grid's DOM
  contract (`#ownersTable`, `td.ownerFullName`, `th.sortable[data-sort-key]` + `span.sort-arrow`,
  `#ownersPager` with `#pageSizeSelect`/`#pagerPrev`/`#pagerNext`/`#pagerCurrentPage` **1-based**)
  lives in one place, `src/support/owners-grid.ts` — steps never spell a selector themselves.
- ⚠️ **`GET /api/owners` is paged** (`{content, totalElements, totalPages, number, size}`) and
  defaults to 10 rows. Nothing may `Array.isArray` the response or assume one call sees the whole
  clinic: `src/support/owners-api.ts` `fetchAllOwners()` walks every page, and `fullName()` there
  is the single definition of `Lastname, Firstname`. `scripts/record-bug40.js` and the
  `docker-compose.test.yml` backend healthcheck both ask for an explicit page.
- ⚠️ `src/*.genseq.puml` and their `src/*.genseq.json` sidecars are **generated** — one pair per
  test file, named after it (`owner-search.feature.genseq.puml`), sectioned by scenario. Never
  hand-edit: change the test and re-run `./run-tests-with-tracing.sh`.
- ⚠️ **Specs in `src/` must not create/delete visits or owners.** `visits.spec.ts` compares the
  *entire* visit list against the API, so a row appearing mid-run fails an unrelated test —
  the suite runs `fullyParallel` against one shared DB.
- A `Backend -> DB` arrow is labelled with **the call the query came from**, not the query —
  `SELECT petclinic` (operation + *database*) is what all sixty queries of an N+1 are named.
  `src/genseq/trace-to-puml.ts` takes the first of: Hibernate's own comment on the statement
  (`hibernate.use_sql_comments` in the backend — real HQL, but only for an `@Query` method;
  a derived method is built through the Criteria API and comments itself `<criteria>`), the
  Spring Data repository method above it, the Hibernate session call above it, and finally
  `select pets` / `insert into visits` read off the SQL — which is all a lazy load leaves
  behind, since it carries no comment and sits under no repository span.
  The statement itself lives behind the click; `src/genseq/sql-label.ts` folds it one clause
  per line (`SELECT` / `FROM` / `JOIN` / `WHERE` / …), clipped to 10 words a line and 8 lines
  an arrow, with the origin comment split off — it is Hibernate talking *about* the statement.
- A `Browser -> Backend` arrow carries the **operation's name above its route**, read from the
  repo's `openapi.yaml` by `src/genseq/openapi-operations.ts` (a `summary` where the API has
  one, else the `operationId`). The route says where a call went; the name says what it was for.
- **A transaction is drawn as a `group` frame, not an arrow.** The interceptor's
  `Transaction.commit` is emitted as the last child of whatever opened the transaction, so
  the renderer frames that span's whole subtree and drops the commit arrow — the frame's
  closing edge *is* the commit. A bare `Transaction.commit` arrow said a transaction ended
  somewhere above and left the reader to guess how far up. The frame also shows what is
  **outside** every transaction, which is the whole story of an N+1 behind
  open-session-in-view: in this codebase nothing above the repositories is `@Transactional`,
  so each repository call is its own transaction and its own Hibernate session, and the lazy
  loads that follow run in none of them. A query inside a frame does not repeat the frame's
  label — it falls back to describing itself (`select pets`).
  Where the interceptor opens it decides what the frame wraps, and all three placements are
  covered: on a **repository** or a **service**, the frame *replaces* that span's self-hop
  (it already carries the name and the extent, so drawing both states the call twice); on
  the **handler** (`@Transactional` on a controller method) the commit lands on the SERVER
  span, so the frame wraps the handler's *body* — framing the span itself would swallow the
  request and the response arrows with it, and the picture would lose the call it is about.
- The **`Session.*` / `Hibernate Query` spans are dropped** when a Spring Data repository span
  above them already said the same thing. They are kept with no repository above them — code
  using the EntityManager directly, where the session call is the only account of the request.
- Activation bars are drawn **only around a call that encloses something**. A leaf hop (a DB
  query, a childless `@WithSpan`) gets a bare arrow — the box would enclose nothing and each
  `activate`/`deactivate` pair costs vertical space the N+1-heavy diagrams cannot spare.
- **Detail is a render-time switch, not a capture-time one.** The traces always carry
  everything (SQL + bound values from the agent, HTTP payloads from the browser); `SEQ_SQL`
  (`off`|`statement`|`values`) and `SEQ_HTTP_BODIES` (`0`|`1`) decide what is drawn —
  `src/genseq/options.ts`. So re-rendering is **~1s and needs nothing running** — not even
  Grafana: the fetched spans are cached in `test-results/trace-spans.json` and replayed
  (`GENSEQ_REFRESH=1` forces a fresh Tempo fetch). No test run, no backend, no browser: `npm run diagram:lean` / `diagram` / `diagram:full`, or the two env
  vars with `npm run trace:diagram`. Every generated file repeats this in its own header.
- **A diagram is interactive by default** (`SEQ_INTERACTIVE=1`): the picture stays simplified
  and each revealable arrow's **whole label** is wrapped in `[[genseq://<id>{…} <label>]]`, a
  PlantUML link that becomes an `<a href>` in the SVG — the hook
  `.claude/skills/human-review/scripts/build-review-html.py` binds to, so nothing ever matches
  rendered label text. (It used to be a trailing `⊕`: a second, smaller thing to aim at when
  the reviewer already wants to click the arrow.) One click reveals, another closes; a DB
  panel **toggles** between `?` and the bound values, carried as the step's `alternate`.
  That was a second click before, which swapped the text under the reader and counted itself
  `1 / 2` — advertising neither that it existed nor what it would do. `SEQ_INTERACTIVE=0`
  bakes the detail back into the picture, which is what `diagram:lean`/`:static`/`:full` do. The ids are **hashes of the detail, never counters** — `.claude/skills/human-review/scripts/puml-diff.sh` diffs the
  `.puml` textually, so a positional id would repaint everything under an inserted query.
- The windows file (`test-results/trace-windows.json`) is what a standalone re-render replays,
  so each runner forgets only **its own** entries at start (`*.spec.ts` for Playwright,
  `*.feature` for Cucumber) — wiping it whole would shrink re-renders to the last suite that ran.
- HTTP payloads are captured in `petclinic-frontend/src/otel.ts` (`http.request.body` /
  `http.response.body` on the XHR client span, 4 KB cap) — no OTel agent records payloads, and
  the browser is the only place both sides are in hand. The renderer therefore reads them off
  the span **or its parent**, since the arrow is drawn from the backend's SERVER span.
