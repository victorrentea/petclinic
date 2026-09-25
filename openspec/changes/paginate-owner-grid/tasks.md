# Tasks

## 1. Backend Paging Contract

- [ ] 1.1 Rewrite `OwnerTest` list scenarios to specify the page envelope, default page, empty pages, last-name filtering, allowed sizes, all sort keys and directions, deterministic ties, and invalid-parameter HTTP 400 responses; verify the focused test fails for the missing behavior.
- [ ] 1.2 Add `OwnerRowDto`, `OwnerPageDto`, and the whitelist-backed owner-list query model; verify DTO serialization and query validation through the focused controller tests rather than accessor-only tests.
- [ ] 1.3 Add paged scalar and pet-count repository queries plus one batch pet-name query for current-page owner IDs; verify repository/controller tests cover owners with zero, one, and multiple pets without returning visits.
- [ ] 1.4 Change `OwnerRestController.listOwners` and mapping code to return the bounded page with deterministic ordering; verify `mvn test -Dtest=OwnerTest` passes and query-count assertions or trace evidence show no per-owner pet/visit queries.
- [ ] 1.5 Update in-repository backend test helpers that consume `GET /api/owners` to read the page envelope; verify the affected backend test classes pass.

## 2. Generated API Contract

- [ ] 2.1 Add precise OpenAPI annotations for page fields and constrained query parameters, run `mvn test -Dtest=OpenApiExtractorTest`, and verify `openapi.yaml` contains the generated `OwnerRowDto` and `OwnerPageDto` schemas without manual edits.
- [ ] 2.2 Run `npm run generate:api`, replace the handwritten owner-page model with generated `OwnerRowDto` and `OwnerPageDto` aliases, and verify `npm run lint:openapi` plus TypeScript compilation succeeds.

## 3. Frontend Query State and Service

- [ ] 3.1 Add `owner-query.ts` with defaults, allowed values, URL normalization, reset rules, and HTTP parameter serialization; verify focused unit tests cover invalid URL values and non-default parameter output.
- [ ] 3.2 Replace the separate list/search service calls with one typed paged request and update its consumers; verify service tests assert the exact backend query parameters and page response.
- [ ] 3.3 Drive owner loading from route query parameters through `switchMap`, retaining rows during loading and preventing stale responses; verify component tests cover refresh/history restoration, search/sort/size page resets, request cancellation, empty results, and errors.

## 4. Owners Grid Controls

- [ ] 4.1 Add Material sort headers for Name, Address, City, Telephone, and Pets while preserving the Bootstrap table and owner links; verify component tests cover ascending/descending actions and the Pets accessible label.
- [ ] 4.2 Add the design-system `app-combo` page-size selector with 5, 10, and 20 options plus bounded Previous/Next controls and page/total status; verify component tests cover first/final-page disabling and page-size reset behavior.
- [ ] 4.3 Add responsive loading, empty, error, and loaded states and import only the needed sort/design-system modules; verify the focused owner-list test and `npm run build` pass without warnings.

## 5. Acceptance and Performance Evidence

- [ ] 5.1 Update the owner-search Gherkin feature and glue for paged responses, then add a UI journey that selects 5 rows, navigates to a non-overlapping next page, sorts Name both ways, and verifies search resets to page 1; verify the focused Cucumber scenario passes without mutating shared owners.
- [ ] 5.2 Tag one cross-stack pagination scenario with `@generate_sequence`, run the tracing test workflow, and verify its generated sequence artifacts show the Browser-to-Backend paged request without N+1 visit loading.
- [ ] 5.3 Populate a disposable local database with 100,000 owners and measure filtered and unfiltered first, middle, and final pages for every sort; verify every request completes within 10 seconds and retain the timing and `EXPLAIN ANALYZE` evidence in `QA.md`.
- [ ] 5.4 If measurements identify an SLA-threatening plan, add the smallest justified forward-only Flyway index migration, regenerate database artifacts, and verify the same benchmark improves; otherwise record that no migration was needed.

## 6. Integration Verification

- [ ] 6.1 Run the complete backend test suite and verify OpenAPI, architecture, schema, and deployment guardrails pass.
- [ ] 6.2 Run the complete frontend headless test suite and production build and verify generated API types are clean.
- [ ] 6.3 Run the relevant Playwright and Cucumber suites against a running stack and manually verify deep-link refresh, browser Back, mobile layout, page bounds, loading, empty, and API-error states.
- [ ] 6.4 Run repository preflight checks and verify the final diff contains only the planned implementation, generated artifacts, acceptance updates, and recorded benchmark evidence.
