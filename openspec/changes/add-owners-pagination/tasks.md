## 1. Database — collation and indexes

- [ ] 1.1 Write a failing test asserting the `und-x-icu` collation is available on the embedded PostgreSQL used by the test suite (verified present on dev; fail fast before building on D6)
- [ ] 1.2 Write a failing test that inserts `Bakker`, `de Vries`, `Gogh`, `Szabó`, `Ștefănescu`, `Tudor`, `van Gogh` and asserts that exact ascending order
- [ ] 1.2a Write a test asserting the configured collation yields the same order as `nl-x-icu` (the Netherlands is the primary market — this is the guard on D6)
- [ ] 1.2b Write a test pinning the accepted Hungarian divergence (`Csaba, Cukor, Czako`, not `Cukor, Czako, Csaba`) so a future move to per-locale ordering is deliberate
- [ ] 1.3 Add `V9__recollate_and_index_owners.sql`: recollate `owners.last_name`, `owners.first_name`, `owners.city` to `und-x-icu` (leave `address` and `telephone` alone)
- [ ] 1.4 In the same migration create `owners_sort_idx (last_name, first_name, id)` and `owners_city_sort_idx (city, last_name, id)`
- [ ] 1.5 In the same migration create `owners_search_idx (last_name text_pattern_ops)` so the existing `LIKE 'prefix%'` search stays index-servable after recollation
- [ ] 1.6 Tests 1.1–1.2 green; existing `findByLastNameStartingWith` tests still green

## 2. Backend — paged contract

- [ ] 2.1 Write failing controller/integration tests for the envelope: `{content, totalElements, totalPages, number, size}`, correct totals on first, last-partial and past-the-end pages
- [ ] 2.2 Add the hand-written `PageDto<T>` record in `rest/dto/`
- [ ] 2.3 Change `GET /api/owners` to accept `Pageable` via springdoc `@ParameterObject` alongside the existing `lastName` filter, and return `PageDto<OwnerDto>`
- [ ] 2.4 Switch the repository/service to a paged query — `Page<Owner>` with the `lastName` prefix filter applied in the database
- [ ] 2.5 Tests from 2.1 green

## 3. Backend — deterministic ordering

- [ ] 3.1 Write a failing page-stability test: sort by `city` (London ×7, Hogsmeade ×3), walk every page, assert each owner appears exactly once — no duplicates, no skips
- [ ] 3.2 Write a failing test asserting the name sort expands to `last_name, first_name, id` (Beatrix Potter precedes Harry Potter)
- [ ] 3.3 Implement server-side sort expansion in the controller: `lastName` → `lastName, firstName`, and unconditionally append `id` to every sort chain
- [ ] 3.4 Write a failing test asserting the default sort (Name ascending, page 0, size 10) is applied when no parameters are supplied; then make it pass
- [ ] 3.5 Tests 3.1–3.4 green

## 4. Backend — guards

- [ ] 4.1 Write failing tests: `?size=100000` is clamped to 20 (response `size` is 20, at most 20 rows) and each of `5`, `10`, `20` is accepted unclamped
- [ ] 4.2 Write a failing test: `?sort=bogus,asc` and `?sort=address,asc` return **400** with the standard error body, not 500
- [ ] 4.3 Add `spring.data.web.pageable.max-page-size=20` and `spring.data.web.pageable.default-page-size=10` to `application.properties`
- [ ] 4.4 Map `PropertyReferenceException` → 400 in the existing `@RestControllerAdvice`
- [ ] 4.5 Tests 4.1–4.2 green

## 5. Backend — query count

- [ ] 5.1 Write a failing test asserting the SQL statement count for one 10-row page is ~3, not ~46
- [ ] 5.2 Add `spring.jpa.properties.hibernate.default_batch_fetch_size=50` to `application.properties`
- [ ] 5.3 Assert Hibernate does not log `HHH000104` (in-memory pagination) for the owners page query
- [ ] 5.4 Add a comment at the paged repository method warning that a collection `JOIN FETCH` with `Pageable` reintroduces in-memory pagination
- [ ] 5.5 Tests 5.1 and 5.3 green; full backend suite green

## 6. Contract regeneration

- [ ] 6.1 Run `OpenApiExtractorTest` to regenerate `openapi.yaml`; verify the envelope appears as a named schema and `page` / `size` / `sort` / `lastName` are documented parameters
- [ ] 6.2 Run `npm run generate:api` to regenerate `petclinic-frontend/src/app/generated/api-types.ts`
- [ ] 6.3 Confirm no hand edits were made to either file and the CI drift checks pass

## 7. Frontend — service and state

- [ ] 7.1 Write failing `owner-list.component.spec.ts` tests: initial state is read from query params, and sort/page/size changes navigate with merged query params
- [ ] 7.2 Adopt the existing unused `owners/owner-page.ts` interface as the page type (align it with the generated type)
- [ ] 7.3 Update `owner.service.ts` to send `page`, `size`, `sort`, `lastName` and return the page envelope
- [ ] 7.4 Make `ActivatedRoute.queryParams` the component's source of truth (`page`, `size`, `sort`, `direction`, `lastName`); every interaction does `router.navigate` with merged params
- [ ] 7.5 Set UI defaults to page 0, size 10, Name ascending — identical to the server defaults
- [ ] 7.6 Write failing tests that changing `lastName`, sort column, sort direction and `size` each reset `page` to 0 while preserving the other parameters, and that the pager itself does not reset anything
- [ ] 7.7 Implement the reset as one rule in the navigation helper — drop `page` unless `page` is what changed — rather than four special cases at four call sites
- [ ] 7.8 Tests 7.1 and 7.6 green

## 8. Frontend — grid rendering

- [ ] 8.1 Write a failing test that the Name cell renders `lastName, firstName` (`Potter, Harry`); then render it that way in the template, leaving the two name fields separate in the DTO
- [ ] 8.2 Write a failing test that an empty result renders the no-owners message; rework `*ngIf="!owners"` to test the result count (an empty `content` array is truthy)
- [ ] 8.3 Make Name and City headers clickable sort toggles with an asc/desc indicator, on the existing Bootstrap `table table-striped` markup — no `mat-table`
- [ ] 8.4 Leave Address, Telephone and Pets headers visibly inert — no hover, no pointer cursor, no sort affordance
- [ ] 8.5 Add the Bootstrap pager (prev/next disabled at the boundaries, current position and total pages) reusing the existing `.owners-pagination` CSS
- [ ] 8.6 Add the page-size selector offering exactly `[5, 10, 20]`, reusing the existing `.owners-page-size` / `.owners-controls` CSS
- [ ] 8.7 Apply `table-layout: fixed` with an explicit width for each of the 5 columns so sorting never reflows column boundaries
- [ ] 8.8 Match the existing theme values (`.btn-default` `#34302d` / `#6db33f` / `#f1f1f1`, stripe `#f9f9f9`)
- [ ] 8.9 Full frontend test suite green

## 9. UI tests

- [ ] 9.1 Update `petclinic-ui-test/tests/support/api-client.ts` — `get<OwnerDto[]>('/owners')` becomes an unwrap of `.content`
- [ ] 9.2 Keep `owner-search.feature` green
- [ ] 9.3 Add a pagination scenario (page through the grid, change page size, verify no duplicate rows across pages)
- [ ] 9.4 Full UI suite green

## 10. Verification at production scale

- [ ] 10.1 Load a 10,000-row owners dataset into a scratch database
- [ ] 10.2 `EXPLAIN` the default name sort — confirm it uses `owners_sort_idx` and performs no full sort
- [ ] 10.3 `EXPLAIN` the City sort — confirm it uses `owners_city_sort_idx`
- [ ] 10.4 `EXPLAIN` the `lastName` prefix search — confirm it uses `owners_search_idx` and does not seq-scan (the single largest unresolved risk: an ICU b-tree cannot serve `LIKE 'prefix%'`)
- [ ] 10.5 Measure query count and response time for one page at 10k rows
- [ ] 10.6 If any plan is wrong, adjust the indexes in `V9` before the change is considered done

## 11. Wrap-up

- [ ] 11.1 Run the full backend, frontend and UI suites together
- [ ] 11.2 Verify the grid visually against a sibling list screen (Vets) — same table, buttons and colours
- [ ] 11.3 On the PR, explicitly call out the deviation from #25's "sortable by any column" (Address and Telephone excluded) for confirmation
- [ ] 11.4 File a follow-up issue for the other five list grids (Vets, Pets, Visits, Specialties, PetTypes), which share the same unpaginated problem
