# Tasks

## 1. Database: ICU collation and indexes

- [x] 1.1 Check that `und-x-icu` exists in both embedded Postgres builds (zonky 16.2.0 used by tests, `petclinic-database` used in dev) with `SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu'`. Verify it returns one row on each. If it does not, stop and reopen Q10.
- [x] 1.2 Add `petclinic-backend/src/main/resources/db/migration/V4__owners_icu_collation_and_indexes.sql` as in design D5 (`first_name`, `last_name` and `city` use `COLLATE "und-x-icu"`; `address` stays unchanged, plus `owners_name_sort_idx` and `owners_last_name_like_idx`). Verify that `mvn test -Dtest=OwnerTest` boots Flyway cleanly and that `\d owners` on the dev DB, after `./start-database.sh` + `./start-backend.sh`, shows the collation and both indexes.

## 2. Backend: paged, sorted, validated `GET /api/owners`

- [x] 2.1 TDD in `OwnerTest`: write failing tests for the spec scenarios "First page of a larger list", "Last partial page", "Page past the end", "No parameters" (defaults) and "Each owner still carries its pets". Verify they fail for the expected reason (the response is an array, not an object).
- [x] 2.2 Add `OwnerPageDto(List<OwnerDto> content, long totalElements)` in `rest/dto/`, `OwnerSortKey { name, city }` with its property lists, `SortDirection { asc, desc }`, and the `OwnerListQuery` record with defaults, `@Min(0) page` and `@AssertTrue isAllowedSize()` (design D1–D3). Verify it compiles with `mvn -q compile`.
- [x] 2.3 Change `OwnerRepository` to `Page<Owner> findByLastNameStartingWith(String, Pageable)`, delete the `List` overload, and move `OwnerCreateTest` to the new method. Rewrite `OwnerRestController.listOwners` as `@ParameterObject @Validated OwnerListQuery` → `OwnerPageDto`, and update its `@ApiResponse` schema and `ApiExamples.OWNERS`. Verify the tests from 2.1 pass.
- [x] 2.4 TDD the sort rules in `OwnerTest`: name ascending and descending, same-name owners spread over pages ("Wendy Darling" ×6, size 5), city with a tie-breaker ("London" ×5), and diacritics ("Ann Śliwiński" before "Ann Wensleydale"). Verify they all pass. The diacritics test also proves that migration V4 applied.
- [x] 2.5 TDD the 400 cases in `OwnerTest`: `size=50000`, `size=7`, `page=-1`, `page=abc`, `sort=telephone`, `sort=address`, `sort=first_name`, `dir=up`. Verify each returns 400 with a `ProblemDetail` body and never 500, and that `ExceptionControllerAdvice` needs no new handler (design D1).
- [x] 2.6 TDD the last-name filter in `OwnerTest`: "Filtered total" (`lastName=Dav&size=5` → 2 owners, `totalElements` = 2) and "Filter matching nothing". Verify they pass. The existing `lastName=Java` and `NonExistent` tests are adapted to read `content`.
- [x] 2.7 Add `@BatchSize(size = 20)` on `Owner.pets` and `Pet.visits` (design D4). Add a test that loads a 20-owner page where each owner has 2 pets with 2 visits, and verify with Hibernate statistics (or a datasource-proxy count) that the query count is constant: the same for 5 owners as for 20.
- [x] 2.8 Update the Cucumber `owners.feature` "Search owners by last name" scenario and `OwnerSteps` to assert on `content` and `totalElements` instead of a JSON array. Verify with `mvn test -Dtest=CucumberTest` (or the project's functional runner) that it is green.
- [x] 2.9 Update `OwnerSearchThroughLatencyProxyTest` to assert that `$.content` has 10 items and `$.totalElements` ≥ 10. Verify it compiles. It only runs when the latency proxy on :15432 is up.
- [x] 2.10 Regenerate `/openapi.yaml` with `mvn test -Dtest=OpenApiExtractorTest` and verify the diff shows `listOwners` with `page`, `size`, `sort` (enum `name|city`), `dir` (enum `asc|desc`) and an `OwnerPageDto` response. Run `npm run lint:openapi` in `petclinic-frontend/` and verify it passes.
- [x] 2.11 Update the API Endpoints section of `AGENTS.md` to say that `/api/owners` is paged (`page`, `size`, `sort`, `dir`, `lastName`) and returns `{content, totalElements}`. Verify by reading it.
- [x] 2.12 Run the whole backend suite with `mvn test` in `petclinic-backend/` and verify it is green, guardrails included.

## 3. Frontend: server-driven Material grid

- [x] 3.1 Regenerate the types with `npm run generate:api` in `petclinic-frontend/` and verify `api-types.ts` has the new `listOwners` query and `OwnerPageDto`.
- [x] 3.2 TDD `OwnerService.getOwners(query)` in `owner.service.spec.ts`: it sends `lastName/page/size/sort/dir` as `HttpParams` and returns `{content, totalElements}`, with an empty page as the error fallback. Delete `searchOwners`, and rewrite `owner-page.ts` to the new shape. Verify with `npm run test-headless`.
- [x] 3.3 TDD `OwnerListComponent` in `owner-list.component.spec.ts`: a search goes back to page 0 and keeps the sort; a size change goes back to page 0; a sort change goes back to page 0; only the latest response is rendered (the first stubbed response is delayed after the second); `totalElements === 0` shows the "No owners…" message. Verify the tests fail first, then pass with `npm run test-headless`.
- [x] 3.4 Implement design D6: add `MatTableModule`, `MatSortModule` and `MatPaginatorModule` to `OwnersModule`. Write the `BehaviorSubject` → `switchMap` query stream. Use a `<table mat-table matSort id="ownersTable">` with `mat-sort-header` only on Name and City, keep `class="ownerFullName"` on the name cell, and add a `mat-paginator` with `[5,10,20]` and `[length]="totalElements"`. Verify the tests from 3.3 pass and `npm run build` succeeds.
- [x] 3.5 Verify `npm run test:arch` still passes (imports respect `docs/frontend-packages.puml`).
- [x] 3.6 Update the Owners section of `user-manual/manual.md`: the list is paged (5/10/20), can be sorted by Name and City, and Address, Telephone and Pets are not sortable. Regenerate `screenshots/owners-list.png`. Verify the screenshot shows the paginator and the sort arrows.

## 4. Frontend: grid state in the URL (cuttable, see design D7)

- [x] 4.1 TDD `toQueryParams` / `fromQueryParams` in the component spec: a round trip keeps page, size, sort and dir, and invalid or missing values fall back to the defaults. Verify with `npm run test-headless`.
- [x] 4.2 Wire them in: each query change calls `router.navigate([], {queryParams, replaceUrl: true})`, and init reads `ActivatedRoute` query params. Verify in the browser that reloading `/owners?page=2&size=20&sort=city&dir=desc` restores that state, and that Back from an owner's page returns to it.
- [x] 4.3 If this group is cut, remove the "Grid state survives refresh and Back" requirement from `specs/owner-listing/spec.md` instead of leaving it unimplemented.

## 5. End-to-end tests (`petclinic-test/`)

- [x] 5.1 Rewrite the `owner-search.feature` scenario "Searching with an empty last name lists every owner" and its glue step: with the default fixture (more than 10 owners) it checks that the first page shows 10 owners in name order and that the paginator total equals the number of owners. Verify with `./start-tests.sh` (or the petclinic-test runner) that it is green, and regenerate its `.genseq` files if `@generate_sequence` changes them.
- [x] 5.2 Add a Playwright test: open Owners, sort by City descending, go to the next page, change size to 5, and check that the server answered each step (the rows change, page indicator back to 1 after the size change). Verify it passes.
- [x] 5.3 Verify the existing `add-owner.spec.ts` and the prefix scenarios in `owner-search.feature` still pass unchanged (they search by a unique last name, so they return a single page).
- [x] 5.4 Move the other `petclinic-test` code that reads `GET /api/owners` as an array to `.content`: `add-visit.dsl.ts` (picks an owner with a pet), `db-fixture.spec.ts`, and the owner-list helper in `owner-search.feature.glue.ts`. Found while running the full backend suite: the Java twin `AddVisitApiTest` failed the same way. Verify `add-visit.spec.ts` and `db-fixture.spec.ts` pass.

## 6. Volume check (Q17)

- [x] 6.1 On a disposable database (not the dev seed), insert 50,000 owners with `generate_series`, including accented and duplicate names, then `ANALYZE owners`. Verify with `EXPLAIN ANALYZE` that the default sort (`ORDER BY first_name, last_name, id LIMIT 20`) uses `owners_name_sort_idx`, that `last_name LIKE 'Dav%'` uses `owners_last_name_like_idx`, and that the deep page (`OFFSET 49980`) plus the city sort each finish in a few milliseconds. Record the plans and timings in `volumetry.md`.
- [ ] 6.2 Post the comment on #25 explaining why Address (production data too dirty), Telephone (mixed formats; E.164 normalization is a separate topic) and Pets (an unindexed count per page) are not sortable, and that `GET /api/owners` now returns a page (a breaking change). Verify the comment is visible on the issue.

## 7. Code-review fixes

- [x] 7.1 The owner page's in-app "Back" button returns to the grid state last shown (page, size, sort, dir, lastName), not to a fresh `/owners`: the grid remembers its last query in a root-provided `OwnerListState`, and `OwnerDetailComponent.gotoOwnersList()` navigates to `/owners` with those query params, or with none if the grid was never opened. Verify with a failing-then-passing `owner-detail.component.spec.ts` test and the browser.
- [x] 7.2 Make the e2e test "Telephone, Address and Pets headers do not sort" able to fail: record `/api/owners` requests around the header clicks, end with a City click as a sentinel, and assert that the sentinel's is the only request sent. Verify by temporarily adding `mat-sort-header` to Address: the test must fail, then pass again once it is removed.
