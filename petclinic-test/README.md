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

`@generate_sequence` means the same thing on both sides (`src/genseq/sequence-tag.ts`
reads Cucumber's `{name}` tags and Playwright's string tags alike): only tagged tests record a
Tempo window and get a diagram. Each one is **filed next to its test and named after it** —
`src/owner-search.feature.genseq.puml`, `src/add-visit.spec.ts.genseq.puml` — with one `== section ==`
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
spans cached from the last run (~1s)**, not another test run: no backend, no browser, not even
Grafana — the fetched spans live in `test-results/trace-spans.json`, and `GENSEQ_REFRESH=1`
re-fetches them from Tempo when they go stale.

```sh
npm run diagram         # simplified, click to reveal      SEQ_INTERACTIVE=1  (default)
npm run diagram:reveal  # the same, payloads included too  SEQ_HTTP_BODIES=1
npm run diagram:lean    # baked in: call flow only         SEQ_SQL=off       SEQ_HTTP_BODIES=0
npm run diagram:static  # baked in: + the SQL statements   SEQ_SQL=statement SEQ_HTTP_BODIES=0
npm run diagram:full    # baked in: + values + payloads    SEQ_SQL=values    SEQ_HTTP_BODIES=1
```

| switch | values | what it does |
|---|---|---|
| `SEQ_SQL` | `off` | the DB arrow keeps the generic span name (`SELECT petclinic.owners`) |
| | `statement` | the statement itself, folded one clause per line, `?` for each bound value |
| | `values` | the same, with the bound values put back: `WHERE o1_0.id=2` |
| `SEQ_HTTP_BODIES` | `0` / `1` | the JSON payload of each REST round-trip |
| `SEQ_INTERACTIVE` | `1` | *(default)* draw none of it; hang it off each arrow to be clicked open |
| | `0` | bake it into the picture, at the level `SEQ_SQL` / `SEQ_HTTP_BODIES` ask for |

### Progressive disclosure

`SEQ_SQL` and `SEQ_HTTP_BODIES` say **what** a diagram carries; `SEQ_INTERACTIVE` says
whether it is *drawn* or *clicked open*. Baked in, every arrow shows the same amount of
detail whether or not you care about it, and a diagram with the SQL on it is unreadable
as a picture of the call flow — which is the thing the reader wanted first.

So the default diagram is the simplified one, and each arrow that has more to say carries
a `⊕` marker: a PlantUML link (`[[genseq://<id>{…} ⊕]]`) that renders as an `<a href>` in
the SVG. Clicking that arrow in `review/review.html` opens a panel beside it —

| arrow | click 1 | click 2 | click 3 |
|---|---|---|---|
| `Backend -> DB` | the statement, `?` for each bound value | the same, values put back | closed |
| `GET /api/…`, `201` | that call's JSON body | closed | |

State is per arrow, not a switch on the page: one arrow open says nothing about the next.

Two files come out of a run, and both belong to the diagram:

| | |
|---|---|
| `src/<test>.genseq.puml` | the picture, with a stable id on each revealable arrow |
| `src/<test>.genseq.json` | what those ids reveal — statements, bound values, payloads |

The id is a **hash of the detail**, never a counter: `.claude/skills/human-review/scripts/puml-diff.sh` renders the
diagram as a *textual* diff against `origin/main`, so a positional id would shift with
every inserted query and repaint the whole diagram below it as changed. Two arrows running
the identical statement on identical values therefore share one id, which is also why the
N+1 loops in these diagrams cost one entry rather than forty.

`.claude/skills/human-review/scripts/build-review-html.py` inlines the sidecar next to the SVG it belongs to, so the
whole thing keeps working from `file://` with no network — the guide still survives being
mailed as a single file.

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
