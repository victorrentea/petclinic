# Tasks

## 1. Database: ICU collation and indexes (de-risk CI first)

- [x] 1.1 Write a failing `@DataJpaTest`/Spring test that saves owners "Silver", "Śliwiński", "Wensleydale" and asserts `ORDER BY last_name` returns them in that order; verify it fails on the current `C.UTF-8` order
- [x] 1.2 Add `db/migration/V4__owners_icu_collation.sql` (collation on `first_name`, `last_name`, `city` + the three indexes from design D5); verify test 1.1 passes locally and the backend boots on the dev database (`./start-backend.sh` prints ✅)
- [ ] 1.3 Push and verify the backend tests pass on the Linux CI runner; if `und-x-icu` is missing there, add the matching Linux Zonky 16.2 binaries to the pom and re-verify
- [x] 1.4 Verify the existing prefix search still uses an index: `EXPLAIN` of `last_name LIKE 'Pot%'` shows `owners_last_name_like_idx` (run via db-cli on the dev database)

## 2. Backend: paged, sorted `GET /api/owners`

- [x] 2.1 TDD the sort-key whitelist enum (D2): `name`, `name,desc`, `city`, `city,asc` parse to the expected orderings ending in `id`; `telephone`, `name,up`, `pets.name` throw `ValidationException`; verify with a plain unit test
- [x] 2.2 Add `OwnerPageDto` (D3) and its mapping in `OwnerMapper`; verify with a mapper unit test from a `PageImpl`
- [x] 2.3 Change `OwnerRepository` to `Page<Owner> findByLastNameStartingWith(String, Pageable)` (D4) and `listOwners` to take `page`/`size`/`sort` (D1); verify with new MockMvc tests in `OwnerTest` covering each spec scenario of "returned one page at a time", "page size is limited", "sorted by name or city", "stable across equal sort values" and "respects accented letters"
- [x] 2.4 Update the callers that read an array: `OwnerTest.search`, `AddVisitApiTest`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest` (if it reads the body), Cucumber `owners.feature` + `OwnerSteps`; verify `mvn test` is green
- [x] 2.5 Regenerate `openapi.yaml` via `OpenApiExtractorTest`; verify the diff shows only the new params and the page schema for `listOwners`

## 3. Backend: constant query count per page

- [x] 3.1 Set `spring.jpa.properties.hibernate.default_batch_fetch_size=20` (D6); verify with a test that loads a page of 20 owners with pets and visits and asserts the SQL statement count stays ≤ 5 (Hibernate statistics or a datasource proxy, whichever the project already uses)

## 4. Frontend: paginator and sort on the Owners screen

- [x] 4.1 Change `OwnerService` to `getOwners({lastName, page, size, sort}): Observable<OwnerPage>`, removing `searchOwners`; verify with an `HttpTestingController` spec asserting the query string and the parsed page
- [x] 4.2 Import `MatPaginatorModule` and `MatSortModule` in `OwnersModule`; add `mat-paginator` (`[5, 10, 20]`) and `matSort` with `mat-sort-header` on Name and City only; verify with a component spec that only those two headers are sortable
- [x] 4.3 Drive the list from route query params (D7): reload on change with `switchMap`; paginator, sort and search only navigate, resetting `page` to 0 on search/sort/size change; verify with component specs for "new search starts at page one" and "state restored from the URL"
- [x] 4.4 Show "no owners found" only when `totalElements === 0`, not on error; verify with component specs for the "no match" and "server error" scenarios
- [x] 4.5 Verify `npm run test-headless`, `npm run test:arch` and `npm run build` pass

## 5. End-to-end

- [x] 5.1 Update Playwright `owner-search.feature` + glue: replace "every owner in the clinic is listed" (impossible with 27 seeded owners and a page size of 10) with "the first page lists 10 owners and the paginator shows 27"; add scenarios for page size 5, sorting by city and Back from owner details; verify the Playwright suite passes
- [x] 5.2 Manually check the Owners screen in a browser against the seed data (sort by Name puts Śliwiński among the S names; 5/10/20 work; refresh keeps the view); verify with a screenshot
- [x] 5.3 Update `AGENTS.md`'s API section if needed and keep [QA.md](../../../QA.md) Q14 consistent with design D6; verify `AGENTS.md` stays under 200 lines
