# Tasks

## 1. Backend: paged, sorted owners endpoint

- [x] 1.1 Find out whether Zonky's embedded Postgres pins a collation here: run `SHOW lc_collate` from a throwaway test, then delete it. Record the answer in design.md's Open Questions and decide whether 1.4 adds a diacritics case.
- [x] 1.2 TDD in `OwnerTest` (MockMvc): the default call returns `{content, totalElements}` with 10 owners in first-name order and total 26; `page=1&size=5` returns owners 6–10. Implement `OwnerPageDto` (record in `rest/dto`), `Page<Owner> findByLastNameStartingWith(String, Pageable)` and the paged `listOwners`. Verify the new tests pass.
- [x] 1.3 TDD the sort keys: `name,asc|desc` orders by first name, last name, id; `city,asc|desc` by city, id. Walking every page of size 5 by city returns each of the 26 owners exactly once, Londoners included. Verify the tests pass.
- [x] 1.4 TDD the rejections: size ∉ {5, 10, 20}, a negative page, sort key `telephone`, and direction `up` each return a 400 ProblemDetail naming the parameter. A page past the end returns 200, empty `content`, total 26. Add the `ExceptionControllerAdvice` handler. Verify the tests pass.
- [x] 1.5 TDD the filter: `lastName=Potter&size=5` returns total 2 and only Potters. Verify the test passes.
- [x] 1.6 Add `@BatchSize(size = 20)` on `Owner.pets` and `Pet.visits`, with a one-line note tying 20 to the largest page size. Verify with a test that counts SQL statements for one page of 20 (Hibernate statistics or the project's SQL-count helper, if one exists): page + count + pets + visits, independent of the number of owners.
- [x] 1.7 Update the other backend tests that read `GET /api/owners` as an array (`AddVisitApiTest`, `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`) to read `content`. Remove the `List` repository method if nothing calls it any more. Verify `mvn test` is green apart from the known `OwnerSearchThroughLatencyProxyTest` throughput flake.
- [x] 1.8 Regenerate `openapi.yaml` (via `OpenApiExtractorTest`) and the frontend `api-types.ts`, and update the `@ApiResponse` example. Verify the guardrail and diagram drift tests pass (GUARDRAILS.md lists them).

## 2. Performance check at 10k owners

- [x] 2.1 With a throwaway script, insert 10,000 generated owners (each with 0–3 pets) into the local dev DB through the DB CLI. Run `EXPLAIN ANALYZE` on the page and count queries for `name` and `city`, both directions, with and without `lastName`. Delete the rows afterwards; the seed reruns on the next backend start anyway. Verify by recording the timings in design.md. Only if a query exceeds 50 ms, add a Flyway index migration and record the before/after.

## 3. Frontend: the Owners grid

- [x] 3.1 TDD in `owner.service.spec.ts`: `getOwners({page, size, sort, lastName})` calls `GET /api/owners` with exactly those query params and returns the typed page. Replace `getOwners()`/`searchOwners()` and delete the orphan `owner-page.ts`. Verify Karma passes.
- [x] 3.2 TDD in `owner-list.component.spec.ts`: query params drive the fetch, with defaults when absent; a page or size change, a header click and a search each navigate with new query params; a search resets page to 0 and keeps the sort; a page past the end replaces the URL with the last page. Implement with `ActivatedRoute.queryParamMap`. Verify Karma passes.
- [x] 3.3 Template: `mat-paginator` with `[5, 10, 20]`; `matSort` with `disableClear` on the table, `mat-sort-header` on Name and City only; the no-match message driven by `totalElements == 0`; "Add Owner" outside the results `*ngIf`. Import `MatPaginatorModule` and `MatSortModule` in `OwnersModule`. Verify Karma covers the no-match + Add Owner case and `npm run test:arch` passes.

## 4. Browser tests and helpers

- [x] 4.1 Update `add-visit.dsl.ts` to read `content`. Make `visit-date-range.feature.glue.ts` find the pet through `GET /api/pets` (`ownerId` is on the pet). Verify both features pass.
- [x] 4.2 Rewrite the "the clinic has these owners" step and the "empty last name lists every owner" scenario in `owner-search.feature` into "an empty search shows the first page and the total". Verify the feature fails on the old frontend (stash the template change) and passes on the new one.
- [x] 4.3 New `owners-grid.feature` plus glue: choosing 5 rows per page shows 5 owners and the total; clicking City twice sorts descending with the arrow on City; going to page 2 sorted by city, opening an owner and pressing back returns to page 2 sorted by city; a search for a missing last name shows the message and Add Owner. Verify each scenario fails without the matching frontend change and that all features pass.
- [x] 4.4 Update the backend readiness probe in `start-apps.ts` and the `isOwnersApi` matcher in `.human-review/feature-script.js` if the URL check needs it. Verify `petclinic-test` starts the apps and runs the suite end to end.

## 5. Integration and docs

- [x] 5.1 Update AGENTS.md: the Owners endpoint is paged, giving the parameter contract in one line, and the user manual if it documents the grid. Verify that `git grep` finds no doc still describing `GET /api/owners` as returning all owners.
- [x] 5.2 Run the full stack (`./start-backend.sh`, `./start-frontend.sh`) and click through paging, both sorts, search, back navigation and the empty result in a browser. Verify CI is green on the pushed branch, Sonar gate included (coverage ≥ 80%, duplication ≤ 3%).
