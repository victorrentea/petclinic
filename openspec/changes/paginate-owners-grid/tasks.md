# Tasks

## 1. Database: collation, indexes, seed

- [x] 1.1 Append Ana Șerban of Brașov to the owners in `db/seed/R__seed.sql`, keeping every existing id; verify the backend boots and owner 1 is still Kevin McCallister, pet 3 still Milton
- [x] 1.2 Add `V4__owner_list_collation_and_indexes.sql`: `first_name`, `last_name`, `city` to `COLLATE "ro-RO-x-icu"`, plus the four indexes of design decision 8; verify Flyway migrates a fresh embedded database and `JpaMatchesDBSchemaTest` passes
- [x] 1.3 Regenerate `docs/generated/DB.sql` and `DB.puml` through `DbSchemaExtractorTest` (never by hand); verify the pre-commit DB guard is green
- [x] 1.4 In a throwaway database with ~50k generated owners, `EXPLAIN ANALYZE` the page query and count for each sort (name asc/desc, city asc/desc), with and without `lastName`; verify each plan uses an index and no full sort, drop any index no plan uses, and record the plans in this change's folder as `explain.md`

## 2. Backend: the paged endpoint (test-first)

- [x] 2.1 Write `OwnerListApiTest` (MockMvc, embedded DB, seed data) with one test per API scenario in `specs/owner-list/spec.md` — defaults, last/past-the-end page, slim items, size and page validation, unknown sort, name and city orders both ways, Romanian order, prefix search; verify they compile and fail for the right reason
- [x] 2.2 Add `OwnerPageDto` and `OwnerListItemDto` (pets as `{id, name}`) with an `OwnerMapper` method for them; verify `GET /api/owners/{id}` still returns visits (existing `OwnerTest` stays green)
- [x] 2.3 Add a `Pageable` overload of the last-name prefix query to `OwnerRepository` and `@BatchSize` on `Owner.pets`; verify with SQL logging that one page of 10 runs a constant number of queries
- [x] 2.4 Change `OwnerRestController.listOwners` to take `lastName`, `page`, `size`, `sort`, map the sort as in design decision 5 and return `OwnerPageDto`; update its `ApiExamples.OWNERS` sample; verify the 2.1 order and paging tests pass
- [x] 2.5 Map `HandlerMethodValidationException` to 400 in `ExceptionControllerAdvice`, naming the parameter, and refuse an unknown sort with a `ValidationException` listing `name`, `city`; verify the 2.1 validation tests pass
- [x] 2.6 Update the callers that assume a list — `OwnerTest`, `AddVisitApiTest` (and its genseq diagram), `functional/owners.feature` + `OwnerSteps`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`; verify `mvn test` is green
- [x] 2.7 Regenerate `openapi.yaml` via `OpenApiExtractorTest`; verify the diff shows only the `GET /api/owners` change and `npm run lint:openapi` passes
- [x] 2.8 Update the API Endpoints section of `AGENTS.md` to say `/api/owners` is paged (`page`, `size`, `sort=name|city`); verify it matches `openapi.yaml`

## 3. Frontend: the paged grid (test-first)

- [x] 3.1 Run `npm run generate:api` and make `owner-page.ts` re-export the generated page type; verify `npm run build` compiles
- [x] 3.2 Replace `getOwners`/`searchOwners` with `OwnerService.listOwners({lastName, page, size, sort})` that surfaces errors; update `owner.service.spec.ts` first; verify `npm run test-headless` passes for the service
- [x] 3.3 Write `owner-list.component.spec.ts` cases for: requests derived from the URL query, defaults omitted from the URL, search/size/sort resetting to page 1, the last-page jump past the end, "Last, First" name cell, sortable headers only on Name and City, "no owners found" only on `totalElements === 0`, an error on failure; verify they fail
- [x] 3.4 Implement `OwnerListComponent` with `MatPaginator` (`[5, 10, 20]`, total shown) and `matSort`, state in the URL as in design decision 11, and import `MatPaginatorModule`/`MatSortModule` in `OwnersModule`; verify the 3.3 specs pass
- [x] 3.5 Make the owner page's Back button return to the grid as the user left it (the grid's last URL, kept in `OwnerGridState`; `/owners` until the grid was seen), with `owner-detail.component.spec.ts` covering both; verify the spec passes

## 4. End-to-end

- [x] 4.1 Update `owner-search.feature` and its glue: names read "Last, First", and "empty search lists every owner" becomes "empty search shows the first page of all owners"; verify `npm run test:cucumber` passes
- [x] 4.2 Update `add-owner.spec.ts` (`toContainText` → `"<lastName>, Ada"`) and `add-visit.dsl.ts` (read `content`); verify both specs pass
- [x] 4.3 Write `owners-grid.spec.ts` (Playwright): paging between pages, size 5/10/20, sorting by Name and City both ways (relative order only, never exact totals — the dev DB holds test leftovers), Back from an owner and refresh keeping the view, `/owners` with no query on first open; verify it fails before 3.4 and passes after
- [ ] 4.4 Re-run `./run-tests-with-tracing.sh` to regenerate the owner-search and add-visit sequence diagrams; verify only the expected arrows changed

## 5. Integration check

- [x] 5.1 Run `mvn test`, `npm run test-headless`, `npm test` in `petclinic-test` and `npm run test:cucumber` against a fresh `./start-database.sh` stack; verify all green
- [x] 5.2 Open the Owners screen in a browser and walk the spec's grid scenarios by hand (page, size, both sorts, search from page 3, Back, refresh, `Zzzz`); verify each behaves as specified
