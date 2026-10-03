# Tasks

## 1. Backend page contract and bounded retrieval

- [x] 1.1 Before adding Java tests, load the project coverage/style skills and measure existing owner-list coverage; write failing MockMvc tests for the exact two-field envelope, defaults, sizes 5/10/20, invalid sizes/pages/sort tokens, empty/out-of-range pages, preserved prefix/case/literal wildcard semantics, and totals. Verify new tests fail for the current array contract rather than fixture/setup errors.
- [x] 1.2 Write deterministic ordering and cold-query regression tests using duplicate full names, shared cities, owners without pets, and multiple pets/types/visits. Flush/clear setup state, disable caches, and fail on collection-fetch pagination. Verify both directions across page boundaries, nested DTO completeness, and <= 3 SQL SELECTs through serialization for full pages of sizes 5 and 20.
- [x] 1.3 Implement `OwnerPageDto`, explicit request/default validation, business-key sort mapping, the pageable owner query/count, and a separate selected-ID graph fetch including types and visits. Reassemble fetched owners in page order and skip empty-page graph loads. Verify 1.1/1.2 pass without a new service layer or globally changing entity fetch behavior.
- [x] 1.4 Adapt `OwnerTest`, `OwnerSteps`/`owners.feature`, and `AddVisitApiTest` to the envelope; use selective filtering or page traversal when discovering fixture owners. Preserve detail/CRUD/booking/authentication contracts and change `BasicAuthenticationConfigTest` only where assertions require it. Verify the focused REST, functional owner, visit, and security test selectors pass.
- [x] 1.5 Update list operation annotations and `ApiExamples` to document defaults, allowed inputs, 400 responses, and the page envelope; regenerate `openapi.yaml` with `OpenApiExtractorTest`. Verify the extracted schema has only `content`/`totalElements`, preserves nested DTOs, and passes existing API lint/drift checks.

## 2. Database indexes and bounded retrieval

- [x] 2.1 Reconfirm migration numbering and owner indexes before authoring `V4__owner_list_indexes.sql`; add the pattern-prefix, Name-chain, and City-chain indexes without editing V1-V3 or seed data. Verify Flyway migrates a fresh embedded database and an existing V3 database and exposes the intended indexes via `pg_indexes`.
- [x] 2.2 Verify database-level LIMIT/OFFSET before graph loading using the small functional fixtures and query-budget tests from 1.2. Do not generate a 100,000-owner dataset or run load measurements for this change; verify the validation summary explicitly states that large-scale performance is unverified.
- [x] 2.3 Adapt `OwnerSearchThroughLatencyProxyTest` to the page envelope/default size while retaining its existing thresholds. Verify it compiles with test compilation only; do not execute this load test today, even if the proxy is available, and report the measurement as deferred for budget.

## 3. Frontend contract, request state, and grid controls

- [x] 3.1 Regenerate `api-types.ts` with `npm run generate:api`, align the unused `OwnerPage` with the exact backend envelope, and add failing `OwnerService` tests for typed pages, defaults, explicit filter/page/size/sort parameters, encoding, and propagated failures. Verify tests reject array-shaped responses and incorrectly encoded prefix values.
- [x] 3.2 Implement a single `HttpParams`-based service query builder used by actual list/search callers, and migrate owner fixtures/spies that depend on those methods. Verify targeted service tests pass and no caller expects framework-only page metadata.
- [x] 3.3 Add failing component tests for initial state, one request per action, page-0 resets, preserved sort/submitted filter, latest-response/error/completion protection, destroy cleanup, zero-total empty state, nonzero-total empty pages, and explicit errors. Verify tests catch stale initial-load updates and duplicate search submissions.
- [x] 3.4 Implement centralized component page state/loading, separate draft and submitted prefixes, cancel previous requests, and protect rows/totals/loading/errors from obsolete callbacks. Verify 3.3 passes and owner links/Add Owner remain available.
- [x] 3.5 Import Material paginator/sort modules and wire Name/City headers plus the paginator into the existing Bootstrap template, with sizes 5/10/20 and sort clearing disabled. Use a single submit path and distinct empty/error views. Verify rendered controls, range/total, next/previous navigation, keyboard sorting, and nonsortable Address/Telephone/Pets in focused component tests.
- [x] 3.6 Document the new grid behavior and API usage in existing relevant user/developer documentation, updating `AGENTS.md` only for actual knowledge drift. Verify examples use business sort keys and the two-field envelope; run the focused headless Angular tests and `npm run build` for strict typing/template validation.

## 4. End-to-end consumers and trace-derived outputs

- [x] 4.1 Update `petclinic-test/src/owner-search.feature` and its glue: obtain fixture owners by traversing API pages, replace the traced empty-search all-rows assertion with first-page/total assertions, and add ordered page traversal, sort, size-reset, and prefix-reset scenarios. Verify a seeded dataset larger than 20 owners is traversed without missing/duplicate IDs and existing case-sensitive search scenarios still pass.
- [x] 4.2 Audit and migrate affected Playwright specs and list mocks. Inspect the JMeter plan's actual HTTP methods and extractors; update only list consumers, leaving unchanged CRUD contracts intact. Verify the relevant Playwright scenarios pass and no list extractor/assertion assumes a top-level array.
- [x] 4.3 Run focused Cucumber/browser scenarios and regenerate affected sequence outputs with the existing trace tooling. Verify generated first-page traces contain the paged list flow and `DeploymentDiagramTest` passes, without editing guardrail/generator infrastructure or adding chatbot diagram scope.
- [ ] 4.4 Comment on #25 with the verified implementation state, breaking coordinated rollout, and Name/City-only sorting; notify Bizu through the available issue channel without guessing an identity. Verify the published update is accurate and references the narrower accepted scope.

## 5. Integrated acceptance and release readiness

- [x] 5.1 Run the relevant backend REST/functional/security/migration suites, frontend headless tests and strict build, owner browser/Cucumber scenarios, API lint/drift checks, and diagram guardrails together, explicitly excluding load/performance tests. Verify the owner-list spec scenarios are covered and record large-dataset and load measurements as deferred, not passed.
- [x] 5.2 Review the integrated diff for atomic backend/frontend contract migration, generated-file consistency, and unchanged detail/CRUD/chatbot behavior. Verify only intended application and generated-output changes are present; if tooling edits become necessary, follow the project's tooling-on-main rule rather than leaving them solely on `db27oct`.
- [x] 5.3 Prepare the one-PR/one-deploy release and paired application rollback instructions. Verify both old application versions remain compatible with the additive indexes and no applied Flyway migration is edited or removed.
