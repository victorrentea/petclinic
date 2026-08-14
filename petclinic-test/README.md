# PetClinic E2E Tests (Playwright)

TypeScript/Playwright tests for the Owners page.

## Setup (once)

```sh
npm install
npx playwright install chromium
```

## Run

Apps must be running first — `../start-database.sh`, `../start-backend.sh` and
`../start-frontend.sh`, each in its own terminal — then:

```sh
npm test              # headless
npm run test:cucumber # the .feature scenarios
npm run test:sequence # only the @generate_sequence-tagged specs
npm run test:unit     # trace-diagram tooling, no browser
npm run test:ui       # interactive
npm run test:headed   # visible browser
npm run test:debug    # step-through
npm run show-report   # HTML report (test-results/playwright-report)
npm run test:docker   # fully isolated in Docker
```

> Override frontend URL: `BASE_URL=http://... npx playwright test`

## Gherkin, and the same scenario without it

Two scenarios sit side by side in `src/`, each written the way its style is meant to be written:

| | Gherkin | a DSL in TypeScript |
|---|---|---|
| scenario | `owner-search.feature` | `add-visit.spec.ts` |
| sentences | `owner-search.glue.ts` (regex → step) | `add-visit.dsl.ts` (functions) |
| state | `support/world.ts` (mutable `this`) | local `const`s |
| diagram opt-in | `@generate_sequence` scenario tag | `{tag: [GENERATE_SEQUENCE_TAG]}` |
| run | `npm run test:cucumber` | `npm test` |

Neither is a translation of the other — pick each for what it is good at:

- **owner-search is Gherkin's case.** Its whole contract is a table of what-you-type /
  who-shows-up, so it is a `Scenario Outline` with `Examples:` — the one thing Gherkin says
  better than code. Its steps do the work themselves; there is no DSL under them, because a
  second naming of the same sentences would only add indirection.
- **add-visit is the DSL's case.** The scenario is prose, so `add-visit.dsl.ts` names the
  sentences and `add-visit.spec.ts` reads top-to-bottom as the scenario itself — no parser, no
  regex step lookup, no shared mutable World, and every sentence stays ctrl-clickable,
  renameable and type-checked.

`@generate_sequence` means the same thing on both sides (`src/seqgen/sequence-tag.ts`
reads Cucumber's `{name}` tags and Playwright's string tags alike): only tagged tests record a
Tempo window and get a diagram. Each one is **filed next to its test and named after it** —
`src/owner-search.feature.seqgen.puml`, `src/add-visit.spec.ts.seqgen.puml` — with one `== section ==`
per tagged scenario inside, so a file with several tagged scenarios stays one picture. They are
generated artifacts and say so on their first lines; edit the test, not the `.puml`.

## Sequence diagrams from real traces

```sh
./run-tests-with-tracing.sh     # runs both suites, then collects the .puml files
```

**Start order matters:** `./start-grafana.sh` must run *before* `./start-backend.sh` — the
backend only attaches the OpenTelemetry Java agent if `:4318` is already listening. Both
scripts now say so out loud if the order was wrong, instead of silently producing no diagrams.

### How much detail a diagram shows

Capture and rendering are deliberately separate: the traces always carry everything — the SQL
statement, the **bound parameter values**, and the JSON request/response payloads — while these
two switches decide what reaches the page. Changing your mind is therefore a **re-render of the
traces already in Tempo (~1s)**, not another test run: no backend, no browser, only Grafana up.

```sh
npm run diagram:lean    # call flow only          SEQ_SQL=off       SEQ_HTTP_BODIES=0
npm run diagram         # + the SQL statements    SEQ_SQL=statement SEQ_HTTP_BODIES=0  (default)
npm run diagram:full    # + values + payloads     SEQ_SQL=values    SEQ_HTTP_BODIES=1
```

| switch | values | what it does |
|---|---|---|
| `SEQ_SQL` | `off` | the DB arrow keeps the generic span name (`SELECT petclinic.owners`) |
| | `statement` | the statement itself, folded one clause per line, `?` for each bound value |
| | `values` | the same, with the bound values put back: `WHERE o1_0.id=2` |
| `SEQ_HTTP_BODIES` | `0` / `1` | the JSON payload of each REST round-trip, as a note on the arrow |

Every generated file states its own level and repeats these commands in its header, so nobody
has to come back here to find out. Two things make the values possible: the OTel Java agent is
pinned at 2.20.1 with `OTEL_SEMCONV_STABILITY_OPT_IN=database/dup` (2.10 cannot capture bound
parameters at all), and the payloads are recorded by `petclinic-frontend/src/otel.ts`, since no
agent records HTTP bodies and the browser is the only place both sides are in hand.

Three timing hazards the pipeline handles, each of which otherwise yields an empty diagram:

| hazard | fix |
|---|---|
| the browser batches spans every ~5s, but the runner closes the page immediately | `src/support/otel-flush.ts` calls the `__OTEL_FLUSH__` hook published by `petclinic-frontend/src/otel.ts` |
| XHR spans end *asynchronously* (they wait for the `PerformanceResourceTiming` entry), so a flush fired at the last assertion misses the `Browser -> Backend` arrow | 1s grace period before the flush |
| each window ends ~5s in the future, and Tempo ingests asynchronously | `runGenerate` waits for the last window to close, then retries each search (8 × 2s) |
