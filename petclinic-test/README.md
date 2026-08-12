# PetClinic E2E Tests (Playwright)

TypeScript/Playwright tests for the Owners page.

## Setup (once)

```sh
npm install
npx playwright install chromium
```

## Run

Apps must be running first (`../start-all.sh`), then:

```sh
npm test              # headless
npm run test:ui       # interactive
npm run test:headed   # visible browser
npm run test:debug    # step-through
npm run show-report   # HTML report
npm run test:docker   # fully isolated in Docker
```

> Override frontend URL: `BASE_URL=http://... npx playwright test`

## Gherkin, and the same tests without it

`features/` holds the add-visit scenarios twice, side by side, to compare the two styles:

| | Gherkin | plain TypeScript |
|---|---|---|
| spec | `add-visit.feature` | `add-visit.spec.ts` |
| binding | `step_definitions/*.steps.ts` (regex → glue) | direct function calls |
| state | `support/world.ts` (mutable `this`) | local `const`s |
| diagram opt-in | `@generate_sequence` scenario tag | `{tag: GENERATE_SEQUENCE_TAG}` |
| run | `npm run test:cucumber` | `npx playwright test --project=features` |

Both drive the **same glue functions** in `features/dsl/` — the readable
Given/When/Then sentences survive without a parser (`dsl/gherkin.ts` wraps
`test.step`), and the steps stay ctrl-clickable, renameable and type-checked.

`owner-search.feature` has **no** TypeScript twin on purpose: its whole contract is a table of
what-you-type / who-shows-up, so it is a `Scenario Outline` with `Examples:` blocks — the one
thing Gherkin says better than code. Where the scenarios are only prose, as with add-visit,
the choice between the two styles is taste.

`@generate_sequence` means the same thing on both sides (`src/trace-diagram/sequence-tag.ts`
reads Cucumber's `{name}` tags and Playwright's string tags alike): only tagged tests record a
Tempo window and get a `.puml` in `features/generated_sequences/`. In owner-search it sits on
the one plain `Scenario` — the Examples rows only vary the same round-trip, so diagramming
them all would say nothing extra. The add-visit scenarios carry the tag **only** in `.spec.ts`,
so their diagrams come from the TypeScript side.

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
| the browser batches spans every ~5s, but the runner closes the page immediately | `tests/support/otel-flush.ts` calls the `__OTEL_FLUSH__` hook published by `petclinic-frontend/src/otel.ts` |
| XHR spans end *asynchronously* (they wait for the `PerformanceResourceTiming` entry), so a flush fired at the last assertion misses the `Browser -> Backend` arrow | 1s grace period before the flush |
| each window ends ~5s in the future, and Tempo ingests asynchronously | `runGenerate` waits for the last window to close, then retries each search (8 × 2s) |
