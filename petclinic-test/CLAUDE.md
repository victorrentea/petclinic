# petclinic-test — Claude Notes

- Run all commands from this directory (`petclinic-test/`).
- Backend: `localhost:8080`, frontend: `localhost:4200` — both must be up before `npm test`.
- `npm run test:with-apps` auto-starts both apps, but is experimental; prefer starting apps manually.
- Screenshots land in `test-results/screenshots/` (git-ignored, auto-generated).
- Docker cleanup when things break: `docker-compose -f docker-compose.test.yml down -v`
- Layout: `src/` holds the scenarios (`*.spec.ts` + `*.dsl.ts`, `*.feature` + `*.glue.ts`),
  `src/support/` the fixtures/World, `src/seqgen/` the Tempo→PlantUML tooling. Everything a
  run writes goes under `test-results/`.
- ⚠️ `src/*.seqgen.puml` are **generated** — one per test file, named after it
  (`owner-search.feature.seqgen.puml`), sectioned by scenario. Never hand-edit: change the test
  and re-run `./run-tests-with-tracing.sh`.
- ⚠️ **Specs in `src/` must not create/delete visits or owners.** `visits.spec.ts` compares the
  *entire* visit list against the API, so a row appearing mid-run fails an unrelated test —
  the suite runs `fullyParallel` against one shared DB.
- A `Backend -> DB` arrow is labelled with the **statement itself** (the span's `db.statement`,
  or `db.query.text` under the stable semconv), not the generic span name — `src/seqgen/sql-label.ts`
  folds it one clause per line (`SELECT` / `FROM` / `JOIN` / `WHERE` / …), clipped to 10 words a
  line and 8 lines an arrow. A DB span without a statement keeps its span name.
- Activation bars are drawn **only around a call that encloses something**. A leaf hop (a DB
  query, a childless `@WithSpan`) gets a bare arrow — the box would enclose nothing and each
  `activate`/`deactivate` pair costs vertical space the N+1-heavy diagrams cannot spare.
- **Detail is a render-time switch, not a capture-time one.** The traces always carry
  everything (SQL + bound values from the agent, HTTP payloads from the browser); `SEQ_SQL`
  (`off`|`statement`|`values`) and `SEQ_HTTP_BODIES` (`0`|`1`) decide what is drawn —
  `src/seqgen/options.ts`. So re-rendering is **~1s and needs only Grafana up**, no test run,
  no backend, no browser: `npm run diagram:lean` / `diagram` / `diagram:full`, or the two env
  vars with `npm run trace:diagram`. Every generated file repeats this in its own header.
- The windows file (`test-results/trace-windows.json`) is what a standalone re-render replays,
  so each runner forgets only **its own** entries at start (`*.spec.ts` for Playwright,
  `*.feature` for Cucumber) — wiping it whole would shrink re-renders to the last suite that ran.
- HTTP payloads are captured in `petclinic-frontend/src/otel.ts` (`http.request.body` /
  `http.response.body` on the XHR client span, 4 KB cap) — no OTel agent records payloads, and
  the browser is the only place both sides are in hand. The renderer therefore reads them off
  the span **or its parent**, since the arrow is drawn from the backend's SERVER span.
