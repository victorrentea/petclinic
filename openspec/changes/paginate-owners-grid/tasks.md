# Tasks

## 1. Database: collation and indexes

- [x] 1.1 Write a failing repository test (Zonky, empty DB): owners Silver, Śliwiński, Tremaine, Wensleydale sorted by last name come back in that order — verify it fails on today's `C.UTF-8` columns
- [x] 1.2 Add `V4__owner_sort_collation_and_indexes.sql` (`und-x-icu` on `last_name`, `first_name`, `city`; indexes `(last_name, first_name, id)`, `(city, id)`, `(last_name text_pattern_ops)`) — verify 1.1 passes; if Zonky lacks ICU, stop and ask (design D5 risk)
- [x] 1.3 Add a test that runs `EXPLAIN` on the name-sorted page query over ~50,000 generated owners and asserts an index scan on `(last_name, first_name, id)` — verify it passes

## 2. Backend: paged, sorted `GET /api/owners`

- [x] 2.1 Add `OwnerSort` (`name,asc|desc`, `city,asc|desc` → Spring `Sort` ending in `id`) with a unit test of the mapping — verify the test passes
- [x] 2.2 Change `OwnerRepository.findByLastNameStartingWith` to take a `Pageable` and return `Page<Owner>` — verify the repository tests pass
- [x] 2.3 Add `OwnerPageDto` and its `OwnerMapper` method; make `listOwners` accept `lastName`, `page`, `size` (5/10/20, default 10), `sort` (default `name,asc`) — verify REST tests in `OwnerTest`: default first page with totals, page 3 of 27, size 20, sort by name with the Darlings tie, city descending
- [x] 2.4 Reject `size` outside {5, 10, 20} and an unknown `sort` with 400 (`ValidationException`, plus a 400 handler for `MethodArgumentTypeMismatchException` in `ExceptionControllerAdvice`) — verify REST tests for `size=50000` and `sort=telephone,asc` return 400 `ProblemDetail`
- [x] 2.5 Test 15 identical owners over 3 pages of 5: each id appears exactly once — verify it passes
- [x] 2.6 Put `@BatchSize(size = 20)` on `Owner.pets` and test that one page with pets runs a bounded number of SQL statements (not one per owner) — verify it passes
- [x] 2.7 Update every backend test that called the old list endpoint (`OwnerSteps`/`owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`, …) — verify `mvn test` is green
- [x] 2.8 Regenerate `openapi.yaml` via `OpenApiExtractorTest` and `petclinic-frontend/src/app/generated/api-types.ts` — verify the guardrail tests pass and the diff shows only the owners list change

## 3. Frontend: service and URL-driven grid

- [x] 3.1 Change `OwnerService` to `getOwnerPage({lastName, page, size, sort})` returning `OwnerPage` (1-based page in, 0-based on the wire); remove `getOwners`/`searchOwners` once unused — verify `owner.service.spec.ts`
- [x] 3.2 Drive `OwnerListComponent` from `queryParamMap` (`switchMap`, so only the latest load answers); search, sort and size changes navigate with `page` dropped — verify component specs: URL → request, search resets to page 1
- [x] 3.3 Add `MatPaginatorModule`/`MatSortModule`; paginator with 5/10/20, `mat-sort-header` on Name and City only — verify specs: Address/Telephone/Pets headers are not sortable, two clicks on City → `city,desc`
- [x] 3.4 Past-the-end: empty `content` with `totalPages > 0` → navigate to the last page with `replaceUrl`; no matches → "no owners" message and no paginator — verify component specs for both
- [x] 3.5 Run `npm run test-headless`, `npm run test:arch` and `npm run build` — verify all green

## 4. End-to-end scenarios

- [x] 4.1 Update `petclinic-test/src/owner-search.feature`: the "every owner" scenario becomes "first page and the total"; the case-sensitive prefix examples stay unchanged — verify the suite passes and regenerate its `@generate_sequence` diagram
- [x] 4.2 Add `owner-list.feature` (`@fixture:default`): next page, 20 per page, sort by City then reverse, Back from an owner's details returns to the same page, a shared link opens the page it names, a link past the end lands on the last page — verify it passes against the running stack (`./start-tests.sh`)

## 5. Demo data and docs

- [x] 5.1 Add a "large" dataset location whose `R__seed.sql` generates ~50,000 owners with `generate_series`, selectable through `spring.flyway.locations` — verify the backend boots on it and page 1 by name answers in < 100 ms
- [ ] 5.2 Update `AGENTS.md` (API Endpoints: `/api/owners` params) and `docs/user-manual/manual.md` (paging and sorting) — verify `AGENTS.md` stays under 200 lines
- [x] 5.3 File the follow-up issues from `/Q&A.md` (case/accent-insensitive search, E.164 telephones, the test that leaves duplicate owners in the dev DB) — verify three issue links exist
