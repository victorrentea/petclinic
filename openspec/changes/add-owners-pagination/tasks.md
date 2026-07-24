## 1. Database — collation and indexes

- [x] 1.1 Write a failing test asserting the `und-x-icu` collation is available on the embedded PostgreSQL used by the test suite (verified present on dev; fail fast before building on D6)
- [x] 1.2 Write a failing test that inserts `Bakker`, `de Vries`, `Gogh`, `Szabó`, `Ștefănescu`, `Tudor`, `van Gogh` and asserts the ascending order `Bakker, de Vries, Gogh, Ștefănescu, Szabó, Tudor, van Gogh` (VERIFIED against `und-x-icu`: root folds `Ș` to `S`, so `Ște…` < `Sza…`; the Romanian order `Szabó, Ștefănescu` is exactly the divergence finding 3c documents and D6 accepts)
- [x] 1.2a Write a test asserting the configured collation yields the same order as `nl-x-icu` (the Netherlands is the primary market — this is the guard on D6)
- [x] 1.2b Write a test pinning the accepted Hungarian divergence (`Csaba, Cukor, Czako`, not `Cukor, Czako, Csaba`) so a future move to per-locale ordering is deliberate
- [x] 1.3 Add `V9__recollate_and_index_owners.sql`: recollate `owners.last_name`, `owners.first_name`, `owners.city` to `und-x-icu` (leave `address` and `telephone` alone)
- [x] 1.4 In the same migration create `owners_sort_idx (last_name, first_name, id)` and `owners_city_sort_idx (city, last_name, id)`
- [x] 1.5 In the same migration create `owners_search_idx (last_name text_pattern_ops)` so the existing `LIKE 'prefix%'` search stays index-servable after recollation
- [x] 1.6 Tests 1.1–1.2 green; existing `findByLastNameStartingWith` tests still green

## 2. Backend — paged contract

- [x] 2.1 Write failing controller/integration tests for the envelope: `{content, totalElements, totalPages, number, size}`, correct totals on first, last-partial and past-the-end pages
- [x] 2.2 Add the hand-written `PageDto<T>` record in `rest/dto/`
- [x] 2.3 Change `GET /api/owners` to accept `Pageable` via springdoc `@ParameterObject` alongside the existing `lastName` filter, and return `PageDto<OwnerDto>`
- [x] 2.4 Switch the repository/service to a paged query — `Page<Owner>` with the `lastName` prefix filter applied in the database
- [x] 2.5 Tests from 2.1 green

## 3. Backend — deterministic ordering

- [x] 3.1 Write a failing page-stability test: sort by `city` (London ×7, Hogsmeade ×3), walk every page, assert each owner appears exactly once — no duplicates, no skips
- [x] 3.2 Write a failing test asserting the name sort expands to `last_name, first_name, id` (Beatrix Potter precedes Harry Potter)
- [x] 3.3 Implement server-side sort expansion in the controller: `lastName` → `lastName, firstName`, and unconditionally append `id` to every sort chain
- [x] 3.4 Write a failing test asserting the default sort (Name ascending, page 0, size 10) is applied when no parameters are supplied; then make it pass
- [x] 3.5 Tests 3.1–3.4 green

## 4. Backend — guards

- [x] 4.1 Write failing tests: `?size=100000` is clamped to 20 (response `size` is 20, at most 20 rows) and each of `5`, `10`, `20` is accepted unclamped
- [x] 4.2 Write a failing test: `?sort=bogus,asc` and `?sort=address,asc` return **400** with the standard error body, not 500
- [x] 4.3 Add `spring.data.web.pageable.max-page-size=20` and `spring.data.web.pageable.default-page-size=10` to `application.properties`
- [x] 4.4 Map `PropertyReferenceException` → 400 in the existing `@RestControllerAdvice`
- [x] 4.5 Tests 4.1–4.2 green

## 5. Backend — query count

- [x] 5.1 Write a failing test asserting the SQL statement count for one 10-row page is ~3, not ~46
- [x] 5.2 Add `spring.jpa.properties.hibernate.default_batch_fetch_size=50` to `application.properties`
- [x] 5.3 Assert Hibernate does not log `HHH000104` (in-memory pagination) for the owners page query
- [x] 5.4 Add a comment at the paged repository method warning that a collection `JOIN FETCH` with `Pageable` reintroduces in-memory pagination
- [x] 5.5 Tests 5.1 and 5.3 green; full backend suite green

## 6. Contract regeneration

- [x] 6.1 Run `OpenApiExtractorTest` to regenerate `openapi.yaml`; verify the envelope appears as a named schema and `page` / `size` / `sort` / `lastName` are documented parameters
- [x] 6.2 Run `npm run generate:api` to regenerate `petclinic-frontend/src/app/generated/api-types.ts`
- [x] 6.3 Confirm no hand edits were made to either file and the CI drift checks pass

## 7. Frontend — service and state

- [x] 7.1 Write failing `owner-list.component.spec.ts` tests: initial state is read from query params, and sort/page/size changes navigate with merged query params
- [x] 7.2 Adopt the existing unused `owners/owner-page.ts` interface as the page type (align it with the generated type)
- [x] 7.3 Update `owner.service.ts` to send `page`, `size`, `sort`, `lastName` and return the page envelope
- [x] 7.4 Make `ActivatedRoute.queryParams` the component's source of truth (`page`, `size`, `sort`, `direction`, `lastName`); every interaction does `router.navigate` with merged params
- [x] 7.5 Set UI defaults to page 0, size 10, Name ascending — identical to the server defaults
- [x] 7.6 Write failing tests that changing `lastName`, sort column, sort direction and `size` each reset `page` to 0 while preserving the other parameters, and that the pager itself does not reset anything
- [x] 7.7 Implement the reset as one rule in the navigation helper — drop `page` unless `page` is what changed — rather than four special cases at four call sites
- [x] 7.8 Tests 7.1 and 7.6 green

## 8. Frontend — grid rendering

- [x] 8.1 Write a failing test that the Name cell renders `lastName, firstName` (`Potter, Harry`); then render it that way in the template, leaving the two name fields separate in the DTO
- [x] 8.2 Write a failing test that an empty result renders the no-owners message; rework `*ngIf="!owners"` to test the result count (an empty `content` array is truthy)
- [x] 8.3 Make Name and City headers clickable sort toggles with an asc/desc indicator, on the existing Bootstrap `table table-striped` markup — no `mat-table`
- [x] 8.4 Leave Address, Telephone and Pets headers visibly inert — no hover, no pointer cursor, no sort affordance
- [x] 8.5 Add the Bootstrap pager (prev/next disabled at the boundaries, current position and total pages) reusing the existing `.owners-pagination` CSS
- [x] 8.6 Add the page-size selector offering exactly `[5, 10, 20]`, reusing the existing `.owners-page-size` / `.owners-controls` CSS
- [x] 8.7 Apply `table-layout: fixed` with an explicit width for each of the 5 columns so sorting never reflows column boundaries
- [x] 8.8 Match the existing theme values (`.btn-default` `#34302d` / `#6db33f` / `#f1f1f1`, stripe `#f9f9f9`)
- [x] 8.9 Full frontend test suite green

## 9. UI tests

- [x] 9.1 Update `petclinic-ui-test/tests/support/api-client.ts` — `get<OwnerDto[]>('/owners')` becomes an unwrap of `.content`
- [x] 9.2 Keep `owner-search.feature` green
- [x] 9.3 Add a pagination scenario (page through the grid, change page size, verify no duplicate rows across pages)
- [x] 9.4 Full UI suite green — Cucumber 7/7 (incl. the 3 new pagination scenarios), Playwright 6/7. The one failure (`chatbot.spec.ts` expects `George Franklin`, gets `Kevin McCallister`) is pre-existing and unrelated: that file is untouched by this change and its expectation contradicts the already-committed `V5` migration, which makes owner id=1 the demo owner

## 10. Verification at production scale

- [x] 10.1 Load a 10,000-row owners dataset into a scratch database
- [x] 10.2 `EXPLAIN` the default name sort — confirm it uses `owners_sort_idx` and performs no full sort
- [x] 10.3 `EXPLAIN` the City sort — confirm it uses `owners_city_sort_idx`
- [x] 10.4 `EXPLAIN` the `lastName` prefix search — confirm it uses `owners_search_idx` and does not seq-scan (the single largest unresolved risk: an ICU b-tree cannot serve `LIKE 'prefix%'`)
- [x] 10.5 Measure query count and response time for one page at 10k rows
- [x] 10.6 If any plan is wrong, adjust the indexes in `V9` before the change is considered done

## 11. Wrap-up

- [x] 11.1 Run the full backend, frontend and UI suites together — backend 152/152, frontend 134/134, UI as noted in 9.4, all against a live database + backend + frontend + chatbot stack
- [x] 11.2 Verify the grid visually against a sibling list screen (Vets) — same table, buttons and colours: screenshots of both compared; identical header bar, striping and `.btn-default` treatment, and `mat-table` count in the rendered DOM is 0
- [ ] 11.3 On the PR, explicitly call out the deviation from #25's "sortable by any column" (Address and Telephone excluded) for confirmation
- [ ] 11.4 (SKIPPED at the owner's request) File a follow-up issue for the other five list grids (Vets, Pets, Visits, Specialties, PetTypes), which share the same unpaginated problem

## 12. Review feedback (live review round)

- [x] 12.1 Sortable columns were not discoverable — only the active column carried an indicator. Give every sortable header a permanent affordance: the active column shows its real direction in white, an idle one shows the same triangle greyed (`.sort-hint`), pointing ascending so it previews the click rather than implying an existing sort
- [x] 12.2 Move the page-size selector and pager from above the table to **below** it — they act on rows the user has just read
- [x] 12.3 Put Add Owner on that same bottom control bar (left, paging right), keeping it visible when a search matches nothing
- [x] 12.4 Put the Find Owner button to the right of the Last name input instead of stacked underneath
- [x] 12.5 Align the search row's left edge with the heading, the table and Add Owner (Bootstrap `.form-group` was pulling it 15px left; all now at x=60, measured in the browser)
- [x] 12.6 Lock 12.1–12.3 in with component tests (frontend suite 139/139); UI suites re-run green (Cucumber 7/7, Playwright 6/7 with the same pre-existing chatbot failure)
- [ ] 12.7 DEFERRED to a later iteration at the owner's request: dark mode

## 13. Code-review findings (`/code-review`)

Triaged 8 findings: 5 fixed, 3 deliberately not.

- [x] 13.1 (finding 4) The `id` tiebreaker was hard-coded `ASC`, so a descending sort was neither a forward nor a backward walk of the all-`ASC` composite index — verified by `EXPLAIN` at 10k rows to force an Incremental Sort (0.67ms) where the fix gives a pure Index Scan Backward (0.016ms). `toTotalOrder` now appends `id` in the sort's own direction; two desc-stability tests added
- [x] 13.2 (finding 3) `owner.service.getOwners` swallowed every error into `EMPTY_OWNER_PAGE`, so a 500 rendered as the benign "No owners" message. The service now lets errors propagate; the component catches them and shows a distinct `#ownersError` banner. Service + component tests added
- [x] 13.3 (finding 2) The reload subscribed to the HTTP call inside the `queryParams` subscription with no cancellation, so out-of-order responses could render a stale page. Switched to `switchMap`; a mutation-verified test (fails under `mergeMap`) guards it
- [x] 13.4 (finding 1) The pager was hidden by `owners.length > 0`, stranding anyone on a page past the end (deep link `?page=99`, or last-page row deletion) with no way back but URL surgery. Paging now keys on `totalElements > 0`; `#noOwners` only shows on a genuinely empty result. Verified live at `?page=99`
- [x] 13.5 (finding 8) `?size=0` / fractional page indices were forwarded verbatim, desyncing the page-size `<select>` from the clamped rows the server returned. `toPageSize` now snaps to an offered size and `toPageIndex` requires a whole number ≥ 0
- [ ] 13.6 (finding 5) NOT FIXED — case-sensitive prefix search is **pre-existing** (`findByLastNameStartingWith` was already case-sensitive under the old `C` collation, and remains so under `text_pattern_ops`). Making it case-insensitive needs a `lower(last_name)` functional index and product sign-off — a separate change, not this one
- [ ] 13.7 (finding 6) NOT FIXED — the `queryParams` subscription is not manually unsubscribed, but Angular's Router completes `ActivatedRoute` observables on component destroy, so there is no leak; this also matches the existing codebase pattern
- [ ] 13.8 (finding 7) NOT FIXED — `getFullNames` in the UI-test helper is guarded by the DTO's required name fields; a non-issue, test-helper only

