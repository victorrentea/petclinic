# Tasks

## 1. Database: indexes for the two sort orders

- [ ] 1.1 Add `petclinic-backend/src/main/resources/db/migration/V5__owner_list_indexes.sql` with `CREATE INDEX IF NOT EXISTS owners_name_idx ON owners (last_name, first_name, id)` and `owners_city_idx ON owners (city, last_name, first_name, id)`; verify the backend boots on the dev DB (reset it with `./start-database.sh` if Flyway rejects the orphan V4) and `pg_indexes` lists both
- [ ] 1.2 Set `spring.jpa.properties.hibernate.default_batch_fetch_size=20` in `application.properties`; verify the existing backend suite stays green

## 2. Backend: paged, sorted `GET /api/owners`

- [ ] 2.1 Write failing MockMvc tests (in `OwnerTest`, `@DefaultFixture` where seeded owners are read) for every scenario of the "Owners are listed one page at a time", "Page size is 5, 10 or 20", "Owners sort by name or city only", "The last-name filter pages and sorts too" and "Each listed owner carries their pets" requirements; verify they fail for the right reason
- [ ] 2.2 Add the `OwnerSort` enum (`NAME`, `CITY`) that parses `sort=<field>[,asc|desc]` into the full `Sort` (with the `id` tie-breaker) and refuses other fields with `ValidationException`; verify with a unit test per field, direction and unknown field
- [ ] 2.3 Add the `OwnerPageDto` record and change `OwnerRepository.findByLastNameStartingWith` to take a `Pageable` and return `Page<Owner>`; move `OwnerCreateTest` to it; verify it compiles and `OwnerCreateTest` passes
- [ ] 2.4 Change `OwnerRestController.listOwners` to take `lastName`, `page`, `size` (5/10/20, else `ValidationException`), `sort` and return `OwnerPageDto`; ensure `ExceptionControllerAdvice` maps `ValidationException` to 400 (from the #40 fix); update the OpenAPI annotations and `ApiExamples.OWNERS`; verify the 2.1 tests pass
- [ ] 2.5 Assert the query count for one page (pets and visits batched, no per-owner query) with the project's existing SQL-count test helper or Hibernate statistics; verify it stays constant between a page of 5 and a page of 20
- [ ] 2.6 Adapt `OwnerSearchThroughLatencyProxyTest` to the page response; verify it no longer fails on the response shape (its throughput threshold is a separate, existing failure)
- [ ] 2.7 Regenerate `openapi.yaml` via `OpenApiExtractorTest`, then `npm run generate:api` in `petclinic-frontend`; verify `git diff openapi.yaml` shows the new params and response, and the guardrail tests (`PackagesArchTest`, `ConceptualModelDiagramTest`) pass with the full backend suite

## 3. Frontend: paginated, sortable owners grid

- [ ] 3.1 Change `OwnerService` to a single `getOwnersPage(query)` returning `Observable<OwnerPage>` (reusing `owner-page.ts`) that sends `lastName`, `page`, `size`, `sort`; update `owner.service.spec.ts`; verify `npm test` passes
- [ ] 3.2 Import `MatPaginatorModule` and `MatSortModule` in `owners.module.ts`; render the table with `mat-sort-header` on Name and City only and a `mat-paginator` with `[5, 10, 20]` bound to `totalElements`; verify visually on `ng serve` with the seed (26 owners, 3 pages of 10)
- [ ] 3.3 Drive `OwnerListComponent` from `ActivatedRoute.queryParamMap` (`lastName`, `page`, `size`, `sort`): paginator, sort and search only `router.navigate([], {queryParams, replaceUrl: true})`, a search resets `page`; drop the obsolete `isOwnersDataReceived`/`searchByLastName` race handling with `switchMap`; update `owner-list.component.spec.ts` for loading from the URL, page change, sort change and search reset; verify `npm test` passes

## 4. End-to-end

- [ ] 4.1 Adapt the `owner-search.feature` glue: "every owner in the clinic is listed" checks the total (26) and the first page instead of all rows; verify the Cucumber suite passes
- [ ] 4.2 Add a Playwright spec on the seeded owners (`test.use({dbFixture: 'default'})`) covering the grid scenarios: 5 rows per page → next page shows 6–10 of 26; City header sorts ascending then descending; no sort on Address/Telephone/Pets; page 2 sorted by city → open an owner → Back restores it; a search on page 3 lands on page 1; verify it passes with `PW_TRACE=on` and open the trace
- [ ] 4.3 Run the full backend suite, `npm test` and both Playwright suites; verify all green except the known `OwnerSearchThroughLatencyProxyTest` throughput threshold, and record that in the PR description
