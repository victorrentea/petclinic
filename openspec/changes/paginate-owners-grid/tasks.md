# Tasks

## 1. Database: collation and indexes

- [ ] 1.1 Check that `und-x-icu` exists (`SELECT collname FROM pg_collation WHERE collname = 'und-x-icu'`) on the Zonky test database and on `./start-database.sh`; if it is missing in either, stop and revisit design D5 with Victor
- [ ] 1.2 Add `V4__owners_paging.sql`: ICU collation on `owners.last_name`, `first_name` and `city`, plus the three indexes from D5. Verify that the backend boots on a fresh `./start-database.sh` and that `StartingDatabaseTest` passes
- [ ] 1.3 Regenerate the schema guardrail output (`DbSchemaExtractorTest`, see GUARDRAILS.md) and verify the guardrail tests pass

## 2. Backend: paged, sorted endpoint

- [ ] 2.1 Write failing MockMvc tests in `OwnerTest` for the `owner-listing` scenarios: default page, last partial page, page past the end, the size whitelist, `page=-1`/`page=abc`, unknown or malformed `sort`, name and city tie-breakers, `name,desc` being the reverse of `name,asc`, Śliwiński between Scamander and Wensleydale, Mureșan before Muresby, the filtered `totalElements`, the case-sensitive prefix, and every owner on exactly one page across all size-5 pages sorted by city
- [ ] 2.2 Add the `OwnerSort` enum, parsed from `sort`, with each value's full `Sort` including tie-breakers. Unit-test the parsing of all 4 valid values and reject everything else
- [ ] 2.3 Add `OwnerPageDto` and `OwnerMapper.toOwnerPageDto(Page<Owner>)`. Verify with `MapperTest`
- [ ] 2.4 Change `OwnerRepository` to `Page<Owner> findByLastNameStartingWith(String, Pageable)` and `OwnerRestController.listOwners` to take `page`/`size`/`sort` (D1), and update `ApiExamples.OWNERS` to the envelope. Verify that the tests from 2.1 pass
- [ ] 2.5 Add `@BatchSize(size = 20)` on `Owner.pets`. Verify with a test that counts statements (Hibernate statistics or the existing SQL tracing): one owners select, one pets select and one count for a page of 20 owners with pets
- [ ] 2.6 Map `MethodArgumentTypeMismatchException` to a 400 `ProblemDetail` in `ExceptionControllerAdvice` (D7). Verify with `ExceptionControllerAdviceTest` and the `page=abc` test
- [ ] 2.7 Move the other callers of the old array to the envelope: `AddVisitApiTest`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`, and `owners.feature`/`OwnerSteps`. Verify that `mvn test` in `petclinic-backend` is green
- [ ] 2.8 Regenerate `openapi.yaml` with `OpenApiExtractorTest` and check that the diff shows only `listOwners` (new params, `OwnerPageDto`)

## 3. Frontend: grid with sort, paginator and URL state

- [ ] 3.1 Run `npm run generate:api`, delete the stale `owner-page.ts`, and change `OwnerService` to one `getOwners({lastName, page, size, sort})` returning the page type, replacing `getOwners()`/`searchOwners()`. Verify with `owner.service.spec.ts` (query string built and envelope returned)
- [ ] 3.2 Import `MatTableModule`, `MatSortModule` and `MatPaginatorModule` in `OwnersModule`. Rewrite `owner-list.component.html`:
  - `mat-table` with sort headers on Name and City only
  - a paginator with sizes [5, 10, 20]
  - inline pet names
  - an empty message keyed on `totalElements === 0`
  - Add Owner outside the table

  Verify that `npm run build` succeeds
- [ ] 3.3 Drive `OwnerListComponent` from `queryParamMap` + `switchMap` (D6). Search, sort and paginator events navigate with merged query params, search and sort set `page=0`, and unknown `size`/`sort` fall back to the defaults. Verify with `owner-list.component.spec.ts`: URL → request params, the reset to page 0 on search and sort, the default fallback, the empty message, and no empty message on error
- [ ] 3.4 Verify that `npm run test-headless` and `npm run test:arch` pass

## 4. End-to-end and volume check

- [ ] 4.1 Update `petclinic-test/src/owner-search.feature`: the "lists every owner" scenario becomes "the first page, with the total". Add scenarios for sorting by City, moving to the next page, switching the size to 5, a shared link with `sort=city,desc`, and Back returning to the previous page. Verify that the Playwright suite passes against the local stack
- [ ] 4.2 Generate 100k owners in a scratch database. For `name,asc`, `city,desc`, and `lastName=Pot` + `name,asc`, capture `EXPLAIN ANALYZE` of the page query and the count. Verify that each one uses the intended index and runs in milliseconds, and save the output for the PR description (not CI)
- [ ] 4.3 Open the running app at `/owners`, page, sort, change the size, refresh, and press Back. Confirm that it matches the `owners-grid` spec
