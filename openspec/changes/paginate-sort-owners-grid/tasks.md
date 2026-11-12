# Tasks

## 1. Bounded owner repository and ordering

- [ ] 1.1 Add focused embedded-Postgres paging tests using explicit test data for compound/accented names, ties, missing values, literal prefix metacharacters and all four sort keys in both directions; verify the new tests fail against the current unpaged implementation.
- [ ] 1.2 Implement the custom OwnerRepository fragment with parameterized count/page/pet-name projection queries, fixed sort/direction allowlists, English ICU ordering and ascending ID ties; verify the focused repository tests pass with exact page boundaries and no duplicate/missing IDs.
- [ ] 1.3 Add the lean owner-grid row/pet summary and page types without changing existing detail DTOs; verify serialized rows omit visit histories, empty pages omit pet lookup, and instrumentation shows at most three data statements independent of page size.
- [ ] 1.4 Validate English ICU availability in the embedded test database and document the runtime collation prerequisite with the API behavior; verify an unavailable collation cannot silently fall back to another order.
- [ ] 1.5 Exercise an isolated 50,000-owner fixture with sizes 5/10/20, all sorts/directions, first/middle/last positions and selective prefixes; capture EXPLAIN (ANALYZE, BUFFERS), timings, row counts and query counts, verifying bounded materialization without touching the live database. Add a new schema-only index migration only if these measurements justify it, and rerun the same checks if added.

## 2. Compatible paginated owner API

- [ ] 2.1 Add controller integration tests and GET /api/owners/page with the specified defaults, metadata and existing OWNER_ADMIN access policy; verify focused OwnerTest/paging tests cover successful, empty, final and out-of-range pages while existing array/search tests still pass.
- [ ] 2.2 Implement explicit type/range/sort/direction validation and narrowly extend existing REST error handling where needed; verify malformed numbers, negative pages, unsupported sizes, unsafe offsets, pets sorting and arbitrary sort expressions return descriptive HTTP 400 responses rather than 500 or fallback success.
- [ ] 2.3 Document the additive API and generate openapi.yaml through OpenApiExtractorTest, then run frontend npm run generate:api and npm run lint:openapi; verify generated contracts describe the lean page shape and the legacy endpoint remains an array.

## 3. Route-driven frontend data flow

- [ ] 3.1 Adapt the existing OwnerPage envelope to the lean row type and add a typed OwnerService paginated request; extend owner.service.spec.ts and verify parameter encoding, metadata and propagated HTTP failures without altering legacy methods.
- [ ] 3.2 Replace owner-list's separate array/search loads with one route-state request flow and proper teardown; extend owner-list.component.spec.ts to verify defaults, Back/reload restoration, first-page resets for search/sort/size, and unchanged case-sensitive submitted search behavior.
- [ ] 3.3 Add current-state retry, visible invalid-URL/reset behavior and bounded out-of-range-page recovery; verify focused component tests distinguish errors from empty success, stop recovery loops, and prevent stale responses/cancellations from overwriting newer rows or loading state.

## 4. Owners grid controls and browser acceptance

- [ ] 4.1 Add labelled sortable header buttons, direction indicators, first/previous/next/last controls, page/range totals and the app-combo page-size selector using DesignSystemModule; verify component interaction tests cover toggling, boundaries and the non-sortable Pets header.
- [ ] 4.2 Render distinct loading/empty/error states with accessible announcements and visible keyboard focus; keep Add Owner/search available without rows, and verify focused DOM tests plus keyboard operation in a browser.
- [ ] 4.3 Update petclinic-test/src/owner-search.feature and its glue so empty search verifies every owner across pages rather than on one screen; preserve prefix examples, and verify the focused Cucumber feature passes.
- [ ] 4.4 Add a focused Playwright owner-grid scenario using the project's declared fixture mechanism for sort/paging/size changes, pet-name display, detail navigation and browser Back; verify exact row order and that grid requests use the paginated endpoint, not the legacy full-list endpoint.
- [ ] 4.5 Update the Owners section of docs/user-manual/manual.md for controls, defaults, search and the Pets exception; verify its descriptions match the browser acceptance results.

## 5. Integrated verification

- [ ] 5.1 Run the selected backend owner/paging tests and OpenApiExtractorTest together, then the frontend owner service/list headless tests, npm run build, npm run lint:openapi and npm run test:arch; verify all checks pass and generated API types remain consistent.
- [ ] 5.2 Run the focused owner-grid Playwright scenario and owner-search Cucumber feature against an isolated test stack, then recheck the 50,000-owner evidence; verify the complete owner-grid spec is covered without claiming an unagreed latency SLA or changing shared runtime data.
