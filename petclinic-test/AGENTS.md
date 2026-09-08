# petclinic-test — Claude Notes

- Run all commands from this directory (`petclinic-test/`).
- Backend: `localhost:8080`, frontend: `localhost:4200` — both must be up before `npm test`.
- `npm run test:with-apps` auto-starts both apps, but is experimental; prefer starting apps manually.
- Screenshots land in `test-results/screenshots/` (git-ignored, auto-generated).
- Docker cleanup when things break: `docker-compose -f docker-compose.test.yml down -v`
- Layout: `src/` holds the scenarios (`*.spec.ts` + `*.dsl.ts`, `*.feature` + `*.glue.ts`),
  `src/support/` the fixtures/World, `src/genseq/` the Tempo→PlantUML tooling. Everything a
  run writes goes under `test-results/`.
- ⚠️ `src/*.genseq.puml` and their `src/*.genseq.json` sidecars are **generated** — one pair per
  test file, named after it (`owner-search.feature.genseq.puml`), sectioned by scenario. Never
  hand-edit: change the test and re-run `./run-tests-with-tracing.sh`.
- ⚠️ **Specs in `src/` must not create/delete visits or owners.** `visits.spec.ts` compares the
  *entire* visit list against the API, so a row appearing mid-run fails an unrelated test —
  the suite runs `fullyParallel` against one shared DB.
  The two booking scenarios are the standing exceptions: `add-visit.spec.ts` and
  `add-visit.feature` each book a real visit, because that *is* the feature under test. What
  keeps them safe is that the runners are **sequential** — `run-tests-with-tracing.sh` runs
  Playwright, then Cucumber — so no row appears while `visits.spec.ts` is counting. Running
  `npm test` and `npm run test:cucumber` at the same time breaks that, and so does filming a
  demo against the same stack: rows will appear in the visits list mid-take.
- `add-visit.feature` is the only `.feature` whose glue sits on a DSL: it binds to
  `add-visit.dsl.ts`, the same functions `add-visit.spec.ts` calls, so the two scenarios differ
  *only* in how they read. `owner-search.feature.glue.ts` deliberately does not — see
  `README.md`. The DSL sentences are snake_case (`open_owner_detail_page`) so a scenario body
  reads as prose; `sentenceOf()` in `src/genseq/steps.ts` collapses underscores and camelCase
  alike, so the diagram narration is unaffected by which convention a sentence uses.
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
- **A self-call on the leftmost lifeline is the test's own sentence**, not an instrumented
  span: the Gherkin step of a `.feature`, the DSL function name of a `.spec.ts`, the
  `given/when/then` of a `@SpringBootTest`. `src/genseq/steps.ts` records them (a timestamp per
  sentence — the browser and the test run in two processes, so a span would have to be threaded
  across); the renderer folds them between the traces. A sentence that caused no traffic is
  **not** drawn, and a trace is placed by the browser's span **for that one request** — never by
  the trace root, which opens on a click and stays open across everything that click leads to.
- ⚠️ **`petclinic-frontend/src/otel.ts` must start tracing synchronously under an e2e run.**
  `main.ts` imports it before bootstrapping Angular, so anything deferred to a promise misses the
  app's bootstrap request — which is the *first* request of every scenario. It used to gate on an
  async collector probe, so the opening navigation produced no trace and the diagram lost its
  first sentence. The probe is kept for everyone else and skipped when `__E2E_TEST_NAME__` is
  already on the page.
- ⚠️ **Moving the backend off :8080 silently loses every sequence diagram.**
  `petclinic-frontend/src/otel.ts` hard-codes `propagateTraceHeaderCorsUrls: [/localhost:8080/]`
  in **two** places. The API is cross-origin from the dev server, so that list is the only
  reason the browser attaches `traceparent` at all. Run the backend on any other port — a
  second stack beside a session already holding :8080, say — and the browser stops propagating:
  the browser spans and the backend spans land in **different traces**, the renderer finds only
  the browser half, and it writes a `.genseq.puml` with a title, a legend and no arrows. No
  error, no warning, no empty-diagram check. Widen the regex to match the port you chose, or
  the diagrams are worthless.
- A `@SpringBootTest` annotated `@GenerateSequence` feeds the *same* pipeline: the JVM writes a
  trace window into `test-results/trace-windows/` and `npm run diagram:java` (`GENSEQ_SUITE=java`)
  fetches and renders it. `GENSEQ_SUITE` is how Maven names its suite — the two Node runners pass
  a regex to `runGenerate()` directly, and with no owner the generator takes the replay-the-cache
  path and never asks Tempo for the traces the Java run just produced. Its diagram is filed next
  to the `.java` file, so its window's `source` climbs out of here as `../petclinic-backend/…`,
  which the heading renders from the repo root instead — `..` means nothing to a reader who does
  not know where the generator ran. There the sentences are real spans — one JVM, one OTel
  context — and **`genseq.participant=Test` is what keeps the test off the app's lifeline**: it is
  a contract with `petclinic-backend`'s `genseq/Steps.java`, and either half dropping it collapses
  the whole picture onto `Backend`. Code:
  `petclinic-backend/src/test/java/victor/training/petclinic/genseq/`, run with
  `petclinic-backend/run-tests-with-tracing.sh` (needs only Tempo up).
- A `Browser -> Backend` arrow carries the **operation's name above its route**, read from the
  repo's `openapi.yaml` by `src/genseq/openapi-operations.ts` (a `summary` where the API has
  one, else the `operationId`). The route says where a call went; the name says what it was for.
- **A repository call is drawn as a call**: a self-hop, an activation, and its statements
  fired from inside it — the shape a reader expects of a method that queries, and what
  gives the transaction frame somewhere to sit.
- **A transaction is drawn as a `group tx` frame, not an arrow.** The interceptor's
  `Transaction.commit` is emitted as the last child of whatever opened the transaction, so
  the renderer frames that span's whole subtree and drops the commit arrow — the frame's
  closing edge *is* the commit. A bare `Transaction.commit` arrow said a transaction ended
  somewhere above and left the reader to guess how far up. The frame also shows what is
  **outside** every transaction, which is the whole story of an N+1 behind
  open-session-in-view: in this codebase nothing above the repositories is `@Transactional`,
  so each repository call is its own transaction and its own Hibernate session, and the lazy
  loads that follow run in none of them. A query inside a frame does not repeat the frame's
  label — it falls back to describing itself (`select pets`).
  It is called just `tx`: the frame shows an *extent*, and whatever opened it is named by
  the call the frame sits inside. Where the interceptor opens it decides what the frame
  wraps, and all three placements are covered — on a **repository** or a **service** it sits
  inside that call's activation; on the **handler** (`@Transactional` on a controller
  method) the commit lands on the SERVER span, so the frame wraps the handler's *body*.
  Framing the span itself would swallow the request and response arrows with it, and the
  picture would lose the call it is about.
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
  vars with `npm run trace:diagram`. This note is the only place that says so: a generated
  file's footer carries the "do not edit" warning and nothing else, because a reader of the
  *image* cannot act on a list of npm scripts and it crowded out the diagram.
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
- ⚠️ **`narrate()` records step marks that nothing renders.** `src/genseq/steps.ts` is real and
  works — `add-visit.spec.ts` imports its DSL through `narrate(sentences)`, and every sentence
  stamps its own name into `StepRecorder`. But **`src/genseq/generate.ts` never references
  `steps`**, and neither does `trace-to-puml.ts`, `support/trace-fixture.ts` or `support/world.ts`.
  The renderer half of `632208ac` ("pune propozițiile testului pe diagramă") is not in this repo,
  on this branch or on `main`. So no diagram carries step narration today — verified by grepping
  the generated `.puml` of both styles after a traced run. Do not read a missing sentence as a
  regression, and do not wire up more marks expecting them to appear: the consumer is what is
  missing, not the marks. Keep the wrapper anyway — it is what `main` has, it costs nothing, and
  it is where the narration will attach when the renderer lands.
- The windows file (`test-results/trace-windows.json`) is what a standalone re-render replays,
  so each runner forgets only **its own** entries at start (`*.spec.ts` for Playwright,
  `*.feature` for Cucumber) — wiping it whole would shrink re-renders to the last suite that ran.
- HTTP payloads are captured in `petclinic-frontend/src/otel.ts` (`http.request.body` /
  `http.response.body` on the XHR client span, 4 KB cap) — no OTel agent records payloads, and
  the browser is the only place both sides are in hand. The renderer therefore reads them off
  the span **or its parent**, since the arrow is drawn from the backend's SERVER span.
