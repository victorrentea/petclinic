# Tasks

## 1. Database: collation and indexes

- [x] 1.1 Add Flyway migration `V4__owners_romanian_collation_and_indexes.sql`: pin `last_name`, `first_name`, `city` to `COLLATE "ro-RO-x-icu"`, add indexes `(last_name, first_name, id)`, `(city, last_name, first_name, id)`, `(last_name text_pattern_ops)`; verify the backend boots on the dev database and `mvn test` passes on fresh Zonky copies
- [x] 1.2 Add a repository test that sorts Sava, Szabo, Șerban, Tudor by name and expects that order; verify it passes (proves the collation in tests, and in CI on Linux)

## 2. Backend: paged, sorted `GET /api/owners`

- [x] 2.1 Write failing MockMvc tests in a new `OwnerListTest` for every scenario of `specs/owner-list/spec.md` on the API side: default page, last partial page, page past the end, size 50000 → 400, `sort=telephone,asc` → 400, name asc/desc, city with name tie-break, 6 namesakes across `size=5` pages, prefix search with its total
- [x] 2.2 Add `OwnerPageDto {content, totalElements}` and make `listOwners` take `lastName`, `page`, `size`, `sort`, map `name`/`city` to a `Sort` ending on `id`, and throw `ValidationException` for other keys or sizes; add `Page<Owner> findByLastNameStartingWith(String, Pageable)` to `OwnerRepository`; verify 2.1 is green
- [x] 2.3 Set `spring.jpa.properties.hibernate.default_batch_fetch_size=100`; add a test that counts the SQL statements for a page of 20 owners with pets and visits and expects at most 4; verify it passes
- [x] 2.4 Update the callers that expect a list — `AddVisitApiTest`, `OwnerSteps` / `owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest` if it reads the body; verify the whole backend suite passes
- [x] 2.5 Regenerate `openapi.yaml` via `OpenApiExtractorTest` and lint it (`npm run lint:openapi`); verify the diff shows only the `listOwners` parameters and the new page schema

## 3. Frontend: the grid

- [x] 3.1 Run `npm run generate:api`; change `OwnerService` to one `getOwnersPage({lastName, page, size, sort})` returning `{content, totalElements}`, replacing `getOwners`/`searchOwners`; verify `owner.service` and `owner-list` specs compile
- [x] 3.2 Rebuild `owner-list` on `mat-table` + `matSort` (`matSortDisableClear`, headers on Name and City only) + `mat-paginator` (`[5,10,20]`, default 10, first/last buttons); Name shows "Last, First", Pets comma-separated, Add Owner outside the results block; a new search, sort or size resets to page 0; verify with new `owner-list.component.spec.ts` cases for each grid scenario of the spec
- [x] 3.3 Import the Material table/sort/paginator modules in the owners module; verify `npm run test-headless`, `npm run test:arch` and `npm run build` pass

## 4. End-to-end and data hygiene

- [x] 4.1 Update `owner-search.feature` and its glue, `add-owner.spec.ts`, `add-visit.dsl.ts` and `db-fixture.spec.ts` for the paged grid (find an owner by searching, not by scanning all rows; "every owner is listed" pages through the paginator); verify they pass
- [x] 4.2 Add a Playwright spec that creates 6 owners under a unique last-name prefix via the API, searches that prefix, sorts by Name and City, pages with size 5, and checks every owner appears once; verify it passes against the running app
- [x] 4.3 Make `visit-date-range.spec.ts` delete the owner it creates (`afterAll`), then delete the 53 leftover "Ada Lovelace"/"Probe" owners from the dev database through the API; verify `GET /api/owners/count` returns 26

## 5. Volume check

- [x] 5.1 On a scratch database, generate 50,000 owners (`generate_series`), `EXPLAIN ANALYZE` the page query and the count for each sort and for a prefix search; verify each plan uses an index and runs under 50 ms, and record the timings in `VOLUMETRY.md`

## 6. After the first look in the browser

- [x] 6.1 Keep search, sort, page (1-based) and size in the URL, defaults left out, falling back on values the grid cannot show (`ownerQueryFrom` / `urlParamsOf` in `owner-page.ts`, `owner-page.spec.ts`); the component fetches only from `queryParamMap`; verify unit specs for reading the URL, writing it, and re-searching the same name
- [x] 6.2 Add an e2e test in `owners-grid.spec.ts`: the URL names the view, and a reload, a fresh browser on that URL, and Back from an owner all show the same page; verify it passes
- [x] 6.3 Header titles readable on a dark bar, sort arrows always visible (white on the sorted column), fixed column widths, search box and both buttons on one line with the label left-aligned, current navbar tab green; verify by screenshots and by measuring column widths across sorts and pages
