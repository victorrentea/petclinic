# Tasks

## 1. De-risk the ICU collation (spike)

- [x] 1.1 Add `V4__owner_listing_collation_and_indexes.sql` (columns `first_name`, `last_name`, `city` → `COLLATE "und-x-icu"`, plus the three indexes from design D5). Verify that `mvn test -Dtest=OwnerTest` passes locally, and with db-cli that `\d owners` shows the collation and the indexes.
- [x] 1.2 Push the migration alone and verify that CI (`ci.yml`, ubuntu-latest, Zonky Linux binaries) boots Flyway green. If ICU is missing there, stop and revisit Q8 with Victor before continuing.

## 2. Backend: paged, sorted, validated endpoint (TDD)

- [x] 2.1 Write failing MockMvc tests in `OwnerTest` for: the default page (size 10, name asc, totals), `page=1&size=5`, a page past the end (empty content with totals), and `lastName` combined with paging. Verify that they fail for the right reason.
- [x] 2.2 Add `OwnerPageDto` (record in `rest/dto/`), change `OwnerRepository` to `Page<Owner> findByLastNameStartingWith(String, Pageable)`, and rewrite `listOwners` to take `page`/`size`/`sort` and return `OwnerPageDto`. Verify that the 2.1 tests pass.
- [x] 2.3 Add an `OwnerSort` mapping (`name` → firstName, lastName, id; `city` → city, firstName, lastName, id; the direction applies to every key). Add tests for `city,desc`, for paging through duplicated "Kevin McCallister" owners without repeats or gaps, for "Ștefan" before "Tom", and for "de Panne"/"Dublin" before "Edinburgh". Verify that they pass.
- [x] 2.4 Add validation that throws `ValidationException` for `size` ∉ {5,10,20}, `page` < 0, and an unknown sort key or direction. Add tests asserting 400 with a `ProblemDetail` that names the parameter. Verify that they pass.
- [x] 2.5 Set `spring.jpa.properties.hibernate.default_batch_fetch_size=100`. Add a test that counts the SQL statements of one page request (e.g. with Hibernate `Statistics`) and asserts a constant number of queries for 5 versus 20 owners with pets and visits. Verify that it passes.
- [x] 2.6 Adapt the other backend callers of the old array: `AddVisitApiTest.anOwnerWithAPet` (read `content`), `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`, `OwnerCreateTest` (repository call with `Pageable.unpaged()`), and `owners.feature` + `OwnerSteps`. Verify that `mvn test` is green.
- [x] 2.7 Regenerate `openapi.yaml` and `petclinic-frontend/src/app/generated/api-types.ts` via `OpenApiExtractorTest` (update the `@ApiResponse` schema/example to the page shape in `ApiExamples.OWNERS`). Verify that the guardrail tests pass and the diff shows the new parameters and the page schema.

## 3. Frontend: server-side paginated, sortable grid

- [x] 3.1 Replace `getOwners()`/`searchOwners()` in `OwnerService` with `getOwners({page, size, sort, lastName}): Observable<OwnerPage>`. Update `owner.service.spec.ts` to assert the query string and the page mapping. Verify with `npm run test-headless`.
- [x] 3.2 Add `MatPaginatorModule` and `MatSortModule` to `OwnersModule`. In `owner-list.component.html`, put `matSort` on the table, `mat-sort-header` on the Name (`name`) and City (`city`) headers only, and a `<mat-paginator>` with `[5,10,20]` and the total count. Verify that `npm run build` passes and `npm run test:arch` stays green.
- [x] 3.3 Rewrite `OwnerListComponent` to derive its state from `queryParamMap`, with `switchMap` for the request. Paginator, sort and search update the URL (sort, size and search reset `page` to 0), and an out-of-range page redirects to the last page with `replaceUrl`. Add component specs for each of these behaviors. Verify with `npm run test-headless`.
- [x] 3.4 Update the Owners section of `user-manual/manual.md` to describe paging, page sizes and sortable columns. Verify that the text matches the running grid.

## 4. End-to-end and contract consumers

- [x] 4.1 Adapt the `petclinic-test` callers of `GET /api/owners`: `add-visit.dsl.ts`, `db-fixture.spec.ts`, `owner-search.feature.glue.ts` (read `content`, ask for `size=20` or page through when all owners are needed) and `add-owner.spec.ts` (search so the new owner is on page 1). Verify that these specs pass against the running stack.
- [x] 4.2 Add a Playwright spec for the grid: change the page size, sort by City twice, go to page 2, reload (the state is kept), open an owner and press Back (still page 2). Verify that it passes.
- [ ] 4.3 Run the full backend suite, `npm run test-headless`, and the `petclinic-test` suite, then push and verify that CI is green.
