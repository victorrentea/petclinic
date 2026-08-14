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

`@generate_sequence` means the same thing on both sides (`scripts/trace-diagram/sequence-tag.ts`
reads Cucumber's `{name}` tags and Playwright's string tags alike): only tagged tests record a
Tempo window and get a `.puml` in `generated_sequences/`. One tag per style, so the folder holds
exactly two diagrams — one drawn from a Gherkin run, one from a DSL run.

## Sequence diagrams from real traces

```sh
./run-tests-with-tracing.sh     # runs both suites, then collects the .puml files
```

**Start order matters:** `./start-grafana.sh` must run *before* `./start-backend.sh` — the
backend only attaches the OpenTelemetry Java agent if `:4318` is already listening. Both
scripts now say so out loud if the order was wrong, instead of silently producing no diagrams.

Three timing hazards the pipeline handles, each of which otherwise yields an empty diagram:

| hazard | fix |
|---|---|
| the browser batches spans every ~5s, but the runner closes the page immediately | `src/support/otel-flush.ts` calls the `__OTEL_FLUSH__` hook published by `petclinic-frontend/src/otel.ts` |
| XHR spans end *asynchronously* (they wait for the `PerformanceResourceTiming` entry), so a flush fired at the last assertion misses the `Browser -> Backend` arrow | 1s grace period before the flush |
| each window ends ~5s in the future, and Tempo ingests asynchronously | `runGenerate` waits for the last window to close, then retries each search (8 × 2s) |
