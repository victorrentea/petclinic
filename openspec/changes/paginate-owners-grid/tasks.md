# Tasks

## 1. Database

- [x] 1.1 Write a failing test that a Flyway-migrated test database sorts `Ștefan` between `Sam` and `Tom`, and that `search_key` reduces `Mureșan`, `Śliwiński` and `POTTER`; add `V4__owner_listing.sql` with the extension, function and collation; verify the test passes, and if `CREATE EXTENSION` is refused stop and raise design's fallback with Victor
- [x] 1.2 Add the three indexes from design decision 3 to `V4__owner_listing.sql` and verify `pg_indexes` lists them on a freshly migrated database
- [x] 1.3 Push the migration and verify with the `ci-watch` skill that the Linux CI run is green; it travels with the rest, since pre-push checks the working tree and refuses it alone
- [x] 1.4 Reset the dev database with `./start-database.sh`, restart the backend, and verify `flyway_schema_history` holds V1-V4 from this branch only
- [x] 1.5 Regenerate `petclinic-backend/docs/generated/DB.sql` and `DB.puml` by running the backend tests and verify the drift guardrail and the CI `DB.puml` sync check pass

## 2. Paged, sorted listing API

- [x] 2.1 Write failing MockMvc tests for the `owner-list` API scenarios (default page, later page, past the end, sizes, negative page, sort keys and directions, unsortable column, identical names across pages, London ties) and verify they fail
- [x] 2.2 Add `OwnerPageDto`, its mapper method and the paged repository query, and change `listOwners` to return a page with the design 4 sort mapping and design 6 validation; verify the tests from 2.1 pass
- [x] 2.3 Set `hibernate.default_batch_fetch_size=20` and verify with a query-count test that a page of 20 owners runs a constant number of queries
- [x] 2.4 Adapt `BasicAuthenticationConfigTest`, `AddVisitApiTest`, `OwnerSteps` and `OwnerSearchThroughLatencyProxyTest` to the page shape and verify `mvn test` has no new failure; `OwnerSearchThroughLatencyProxyTest` was already red before this change
- [x] 2.5 Update `ApiExamples.OWNERS`, regenerate `openapi.yaml` and `api-types.ts` through `OpenApiExtractorTest`, and verify the generated files show the new contract

## 3. Search API

- [x] 3.1 Write failing tests for the `owner-search` API scenarios (prefix, not a prefix, later word, blank, case, diacritics both ways, `sli`, literal `%` and `_`, totals counting only matches) and verify they fail
- [x] 3.2 Add the `search_key` repository query with escaping, route non-blank searches to it, remove `findByLastNameStartingWith`, adapt `OwnerCreateTest`, and verify the tests from 3.1 pass

## 4. Grid data flow

- [x] 4.1 Replace `getOwners()` and `searchOwners()` with `getOwners(query)` returning `OwnerPage`, including an empty page as the error fallback, and verify the updated `owner.service.spec.ts`, including URL encoding of the search text
- [x] 4.2 Drive the owner list from the URL's query params through `switchMap` and verify in `owner-list.component.spec.ts` that params produce the matching request and that a newer query cancels an older one

## 5. Grid UI

- [x] 5.1 Add `mat-paginator` with sizes 5, 10, 20 and `matSort` on Name and City only, import both modules, and verify in Karma that Address, Telephone and Pets have no sort header
- [x] 5.2 Make page, size, sort and search actions navigate, resetting to page 0 except on a page change, and verify in Karma
- [x] 5.3 Jump to the last page when a page past the end comes back with owners existing, and verify in Karma
- [x] 5.4 Show the no-match message from an empty `content`, keep Add Owner visible, and verify in Karma
- [x] 5.5 Run `npm run test:arch` and `npm run test-headless` and verify both pass

## 6. Browser acceptance

- [x] 6.1 Update `owner-search.feature` and its glue: the `potter` row now finds both owners, the title stops saying case-sensitive, a diacritics row is added, the "every owner" scenario reads totals, and the Given reads owners with paging; verify `npm run test:cucumber`
- [x] 6.2 Adapt `an_owner_with_at_least_one_pet_exists` in `add-visit.dsl.ts` to the page shape and verify `add-visit.spec.ts`
- [x] 6.3 Add `owners-grid.spec.ts` covering paging, sort by Name and City, size change, Back from an owner and a direct link, and verify it fails with a clear message if paging is removed

## 7. Integration and docs

- [x] 7.1 Note in `AGENTS.md` that `GET /api/owners` is paged, and add the consequences to `VOLUMETRY.md`; verify `AGENTS.md` stays under 200 lines
- [x] 7.2 On a throwaway database with 100,000 generated owners, run `EXPLAIN ANALYZE` on default, name descending, city, the single-letter search and the count; verify index use on the sorts and on the search, and record the timings in the PR
- [ ] 7.3 Run the Playwright and Cucumber suites on the isolated stack (`./test-on-own-stack.sh`) and verify they pass against `postgres:16`
- [ ] 7.4 Post the comment on #25 about the sortable columns, the search and the 100,000 target, only after Victor's explicit OK, and verify it appears on the issue
