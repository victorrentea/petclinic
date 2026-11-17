# Tasks

## 1. Bounded owner retrieval and page API

- [ ] 1.1 Add focused cases in `OwnerTest` for default/5/10/20 pages, partial and out-of-range pages, filtered totals, and the explicit envelope; verify they fail against the current array endpoint before implementing.
- [ ] 1.2 Implement repository-level root-ID paging/count with fixed allow-listed native sort expressions using `lower(column) COLLATE "ro-RO-x-icu"` for names/address/city, plus bulk graph retrieval without collection-fetch pagination; verify cross-page ordering, lastName/firstName direction, ID ties, nullable fields, bound/escaped prefix parameters, and complete nested DTO data with focused backend tests.
- [ ] 1.6 Verify `ro-RO-x-icu` availability in embedded and target PostgreSQL and add integration cases for Romanian letters in Name (both keys), Address, and City across ascending/descending page boundaries; assert `a, ă, â, b, i, î, j, s, ș, t, ț, z`, case-only ties, and unchanged case/accent-sensitive prefix search, with explicit failure rather than a default-collation fallback.
- [ ] 1.3 Add the explicit page DTO, validated allow-listed request parameters, and controller coordination; verify default behavior and HTTP 400 for malformed/negative/oversized/duplicate parameters, invalid directions, and unsupported sorts, while owner detail/count and access tests retain their existing behavior.
- [ ] 1.4 Add a focused query-count regression test using cleared persistence state and failure on collection-fetch pagination; verify at most three SELECTs including serialization on nonempty pages and at most two on empty pages, with counts unchanged when more pets/visits are added.
- [ ] 1.5 Update list OpenAPI annotations/examples, run `mvn test -Dtest=OpenApiExtractorTest` in `petclinic-backend`, then `npm run generate:api` and `npm run lint:openapi` in `petclinic-frontend`; verify generated schema/types describe the exact envelope, defaults, supported sorts/sizes, and validation errors.

## 2. Migrate existing collection consumers

- [ ] 2.1 Update backend array assertions/helpers in `OwnerTest`, `AddVisitApiTest`, functional owner steps/features, and other direct collection consumers identified in the change; verify the related REST tests and owner/visit functional scenarios pass using the new page contract, not an unpaginated fallback.
- [ ] 2.2 Update `OwnerSearchThroughLatencyProxyTest` to assert envelope content and totals; verify compilation and, when its proxy is available, retain and meet the existing percentile/throughput requirements without changing the dev database.
- [ ] 2.3 Replace array collection calls in the Owners service with a typed paginated method using `OwnerPage` and encoded HTTP parameters; update its existing spec and verify filter encoding, defaults, all criteria, response metadata, and logged/rethrown errors with the focused frontend service tests.
- [ ] 2.4 Adapt `petclinic-test/src/add-visit.dsl.ts` and `owner-search.feature.glue.ts` to arrange/read known fixture entities or deliberately navigate pages rather than assume the needed owner is on page one; verify the existing visit and owner-search scenarios still operate on the intended entity.

## 3. URL-driven list state and request lifecycle

- [ ] 3.1 Implement normalized applied state from route query parameters and keep draft search text separate; add focused component/router tests proving default/valid deep links, independent malformed-field correction with replace history, duplicate handling, and safe numeric bounds.
- [ ] 3.2 Drive one paginated request stream from applied route state with cancellation and lifecycle cleanup; verify delayed earlier responses and cancellation cannot overwrite new results or clear the current loading state, and subsequent navigation still works after a request error.
- [ ] 3.3 Implement filter submission through button/Enter, sort toggling, size changes, and page navigation as route updates; verify reset/preservation rules, unsubmitted draft isolation, and Back/Forward state restoration in focused tests.
- [ ] 3.4 Implement retry with unchanged criteria and out-of-range recovery using replacement history; verify last-page deletion, zero-total normalization, and invalid-link correction terminate without repeated request/navigation loops.

## 4. Grid controls, feedback, and user documentation

- [ ] 4.1 Render linked names as "Last name, First name" and add accessible sorting controls for Name/Address/City/Telephone only; update component expectations and verify mouse/keyboard operation, visible direction, correct `aria-sort`, and a nonsortable Pets header.
- [ ] 4.2 Import `DesignSystemModule` and add numeric 5/10/20 `app-combo` plus first/previous/next/last controls and result range; verify 0-0, first/middle/partial-last page ranges, disabled boundaries, and retained owner-detail/Add Owner navigation in focused tests.
- [ ] 4.3 Render mutually exclusive current loading/success/error/empty states, with Retry and Add Owner available as specified; verify no stale rows masquerade as current data, errors are not empty results, and filtered/unfiltered empty messages differ.
- [ ] 4.4 Update only the affected Owners user-manual section after browser verification, integrating concurrent edits; verify its pagination/sort/search/name instructions and any refreshed screenshots match the implemented UI.

## 5. End-to-end and expected-scale acceptance

- [ ] 5.1 Add a focused browser scenario using the existing fixture mechanism for deep link -> sort/size/filter -> owner details -> Back/refresh; run it with the existing Playwright runner and verify URL, rows, totals, and restored criteria, including a match outside the initial default page.
- [ ] 5.2 Add and execute an opt-in scale regression using disposable embedded Postgres with 100,000 owners and representative pets/visits; verify exact counts, first/deep/final pages, filtered global sorting, database page bounds, and the three-SELECT ceiling, recording timings without modifying the running dev database or claiming an unagreed SLA.
- [ ] 5.3 Run the combined targeted backend REST/retrieval/security tests and frontend Owners service/component tests, then `npm run build` and `npm run test:arch` in `petclinic-frontend`; verify type safety, generated API consistency, and package boundaries without unrelated fixes.
- [ ] 5.4 Run the affected browser/Cucumber owner-search and visit flows plus existing relevant API/schema/architecture drift checks; verify MCP/detail/count contracts and deployment connections remain unchanged, and report any infrastructure-dependent checks that could not run.
