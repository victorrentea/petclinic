# Tasks

## 1. Setup

- [ ] 1.1 Create branch `owners-pagination` from `main` (QA.md #23) carrying this OpenSpec change, and verify `git branch --show-current` and `openspec validate owners-grid-pagination --strict` both pass there

## 2. Database: locale-aware collation and sort indexes

- [ ] 2.1 Write a failing `@DataJpaTest`-style repository test that saves "Long Silver", "Łukasz Śliwiński", "Tom Thumb", "Rafael de la Cruz", "Ana Diaz" and cities "Lyon", "Łódź", "Madrid", and asserts the name and city orders from the spec's locale-aware scenarios; verify it fails on the current `C.UTF-8` columns
- [ ] 2.2 Add `db/migration/V4__owner_list_sorting.sql` altering `owners.last_name`, `first_name`, `city` to `COLLATE "und-x-icu"` and creating `(last_name, first_name, id)` and `(city, last_name, first_name, id)` indexes; verify the 2.1 test passes
- [ ] 2.3 Regenerate `petclinic-backend/docs/generated/DB.sql` via `DbSchemaExtractorTest` and let the pre-commit hook regenerate `DB.puml`; verify `mvn test -Dtest=DbSchemaExtractorTest` passes with no drift

## 3. Backend: the owner list is paged

- [ ] 3.1 Rewrite `OwnerTest`'s list tests to expect a `PagedModel` (`content` + `page`) and add failing tests for: default page (10 of 26, 3 pages), `page=2`, `size=50000` clamped to 20, `page=99` empty with totals, `lastName` filter totals, and owners keeping their pets; verify they fail
- [ ] 3.2 Enable `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)`, set `spring.data.web.pageable.default-page-size=10` and `max-page-size=20`, change `OwnerRepository` to `Page<Owner> findByLastNameStartingWith(String, Pageable)` and `listOwners` to return `PagedModel<OwnerDto>`; verify the 3.1 tests pass
- [ ] 3.3 Add `@BatchSize(size = 20)` to `Owner.pets` and `Pet.visits`, with a test that enables Hibernate statistics and asserts a page of 20 owners with pets and visits costs at most 4 statements; verify the test fails without the annotations and passes with them
- [ ] 3.4 Update the other backend tests that read the list (`AddVisitApiTest:104`, `OwnerSteps` + `owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`) to the paged shape; verify `mvn test` in `petclinic-backend` is green

## 4. Backend: sort keys `name` and `city`

- [ ] 4.1 Add failing `OwnerTest` cases for: default order by name, `sort=name,desc`, `sort=city,desc`, the George/Wendy Darling tie-break, walking every page of 5 sorted by city returning each owner once, and `sort=telephone` / `sort=pets` answering 400 with a `ProblemDetail` naming the key; verify they fail
- [ ] 4.2 Translate the sort key in `listOwners` (`name` → `lastName, firstName, id`; `city` → `city, lastName, firstName, id`; none → `name,asc`) and map an unknown key to 400 in `ExceptionControllerAdvice`; verify the 4.1 tests pass

## 5. Backend: contract and performance evidence

- [ ] 5.1 Rewrite `ApiExamples.OWNERS` as a one-page `PagedModel` example and document `page`, `size`, `sort` (allowed values `name`, `city`) on `listOwners`; regenerate `openapi.yaml` with `OpenApiExtractorTest` and verify `npm run lint:openapi` passes
- [ ] 5.2 Run `npm run generate:api` in `petclinic-frontend` and verify `api-types.ts` describes the paged response with no other drift
- [ ] 5.3 Load 50,000 generated owners into a local database (a throwaway `generate_series` script, not committed to `db/seed`), run `EXPLAIN ANALYZE` for the first page sorted by name and by city, and verify both plans use their index and read about one page of rows; paste both plans into the PR description

## 6. Frontend: the paged, sortable Owners grid

- [ ] 6.1 Change `OwnerService` to `getOwners({page, size, sort, lastName})` returning the generated page type (drop `searchOwners`), with a spec checking the query string it sends; verify `npm run test-headless` passes
- [ ] 6.2 Write failing `owner-list` specs for: loading from URL query params, "McCallister, Kevin" in the Name column, sort headers only on Name and City toggling asc/desc, paginator sizes 5/10/20 and total, search navigating to page 0 keeping sort and size, a stale page moving to the last page with `replaceUrl`, and the "No owners with LastName starting with" message on zero results; verify they fail
- [ ] 6.3 Implement the grid per design D7–D8 (URL as single source of state, `switchMap` over `queryParamMap`, `matSort` + `mat-paginator`, `MatSortModule`/`MatPaginatorModule` in `OwnersModule`); verify the 6.2 specs, `npm run test:arch` and `npm run build` pass

## 7. End-to-end

- [ ] 7.1 Update `add-owner.spec.ts` and the `owner-search.feature` glue to read "Last, First" names, and rewrite the "every owner in the clinic is listed" scenario to check the first page and the reported total; verify `npm test` and `npm run test:cucumber` in `petclinic-test` pass against the running stack
- [ ] 7.2 Add an `owner-list` Cucumber feature covering page size change, next page, sorting by City twice, a shared `/owners?page=1&size=5&sort=city,desc` link, and Back from an owner's details restoring the page; verify it passes
- [ ] 7.3 Run the e2e suite on the Docker stack (`./start-docker.sh`), whose official `postgres` image must apply the ICU migration; verify it passes there too

## 8. Documentation

- [ ] 8.1 Update the `/api/owners` line under *API Endpoints* in `AGENTS.md` to mention `page`, `size`, `sort=name|city`, mark QA.md items 9–25 as adopted by this change, and regenerate the Owners section of `docs/user-manual/manual.md` with `/regen-user-manual`; verify the manual's Owners screenshot shows the paginator
