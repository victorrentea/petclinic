## 1. Database

- [x] 1.1 Probe ICU on Zonky: in a throwaway `@SpringBootTest` (or `psql` against the embedded jar) run `CREATE COLLATION t (provider = icu, locale = 'und')`; record the outcome in design.md's Open Questions and delete the probe
- [x] 1.2 Write `V9__owner_sort_indexes.sql` per design D7 (DO-block with ICU column collation + `owners_name_idx`, fallback to default collation, plus `owners_city_idx`); verify the full backend suite still boots on Zonky and `\d owners` on dev Postgres shows both indexes

## 2. Backend (TDD, per Mici.md T4 — write the tests before each production step)

- [x] 2.1 New `OwnerListTest` (MockMvc, `OWNER_ADMIN`, Zonky) with failing tests for: default page (size 10, NAME asc), explicit `page=2&size=10` numbers, off-the-end page → 200 + empty `content`, `size` outside {5,10,20} → 400, `sort=address` / `dir=sideways` → 400, NAME asc/desc order, CITY order with `id` tiebreak, `lastName=Pot` combined with paging and case-sensitivity, `petNames` sorted and `[]` for a petless owner; verify they all fail red
- [x] 2.2 Add `@ExceptionHandler(MethodArgumentTypeMismatchException)` to `ExceptionControllerAdvice` returning the Problem Detail shape with parameter name and accepted values; extend `ExceptionControllerAdviceTest`; verify the two 400-on-bad-enum tests go green
- [x] 2.3 Add `Page<Owner> findByLastNameStartingWith(String, Pageable)` to `OwnerRepository` and `List<Pet> findByOwnerIdIn(Collection<Integer>)` to `PetRepository`; verify with a repository-level test that a page of 5 issues exactly one select + one count
- [x] 2.4 Create `OwnerListItemDto` (`id, firstName, lastName, address, city, telephone, petNames`) with Swagger `@Schema` descriptions; add `OwnerMapper.toListItems(Page<Owner>, List<Pet>)` grouping pet names by owner and sorting them; verify with a unit test next to `OwnerDtoTest`
- [x] 2.5 Rewrite `OwnerRestController.listOwners` per design D1/D2: `page`, `size`, inner `enum SortField {NAME, CITY}`, `Sort.Direction dir`, whitelist check on `size`, `PageRequest` with the tiebreak sorts, two-query assembly; verify all of `OwnerListTest` is green and `OwnerTest` still passes
- [x] 2.6 Diacritic ordering test (`Smith`, `Śliwiński`, `Taylor`) in `OwnerListTest`, `@EnabledIf` on ICU availability from 1.1; verify it passes on dev Postgres via `./start-database.sh` and is reported as skipped (not failed) where ICU is missing
- [x] 2.7 Update `ApiExamples.OWNERS` to the page shape (4 rows max, per the minimal-examples rule) and the `@ApiResponse` schema on `listOwners`; run `OpenApiExtractorTest` to regenerate `openapi.yaml`; verify `npm run lint:openapi` passes and the `/api/owners` schema in `openapi.yaml` reads as a page of `OwnerListItemDto`
- [x] 2.8 Grep `petclinic-backend` (MCP resources, `OwnerMcpResourceTest`) and `petclinic-chatbot` for consumers of `GET /api/owners`; adapt or record "none" in design.md Risks; verify the full backend suite (`mvn test`, never a partial `-Dtest=`) is green before the first commit

## 3. Frontend

- [x] 3.1 Create `shared/owner-name.pipe.ts` + `shared.module.ts` per design D11 with a spec covering "Potter, Harry", missing first name, missing last name; verify `ng test --include='**/owner-name.pipe.spec.ts'` is green
- [x] 3.2 Apply `ownerName` to the six owner-name templates (owner-list, owner-detail, pet-add, pet-edit, visit-add, visit-edit); verify no `firstName }} {{ x.lastName` remains for owners (`grep`) and the existing component specs pass
- [x] 3.3 Run `npm run generate:api`; retype `OwnerPage` in `owner-page.ts` from the generated `OwnerListItemDto` page schema and delete the unused `Owner.pets` dependency of the list; add `OwnerService.getOwnersPage(params)` with no `catchError` (design D12); update `owner.service.spec.ts`; verify `ng test` for the service is green
- [x] 3.4 Write the failing `owner-list.component.spec.ts` cases first: renders `content` rows; reads `page/size/sort/dir/lastName` from `ActivatedRoute.queryParams` with defaults; header click navigates with `replaceUrl:true`; page change navigates; search navigates with `page: 0` and keeps `sort`/`size`; a slower first response never overwrites a later one (`switchMap`); "No owners" only when `totalElements === 0`
- [x] 3.5 Rebuild `OwnerListComponent` per design D9/D10 with `MatTable`/`MatSort`/`MatPaginator` in server-side mode, `id="ownersTable"` and `td.ownerFullName` kept; import the Material modules in `OwnersModule`; verify 3.4 is green and the page renders against wiremock (`get-api-owners.json` updated to `petNames`)
- [x] 3.6 Manual check with the real stack: sort by Name/City, switch to 5 and 20 rows, deep-link `/owners?page=1&size=5&sort=CITY&dir=desc`, reload keeps the place, stop the backend and confirm a toast instead of "No owners"; verify with a short note in the PR description

## 4. End-to-end

- [x] 4.1 Adapt `owner-search.feature.glue.ts` (design D13): `data.content`, `fullName` → `"Last, First"`, `namesIn` on `;`, "every owner is listed" walks the paginator and asserts the sorted union; switch tbhe Examples cells in `owner-search.feature` to `;`; verify `npm test` in `petclinic-test` is green for that feature
- [x] 4.2 New `owners-grid.feature` + glue: sort by Name asc/desc, sort by City, page size 5/10/20 row counts, walk-the-pages union with `size=5`, deep link restores the view; read-only on the DB; verify it is green and `run-tests-with-tracing.sh` regenerates its `genseq` sidecars showing two queries + count per page load
- [x] 4.3 Run the whole `petclinic-test` suite plus the backend's Cucumber `owners.feature` and the guardrail tests; verify everything is green before pushing

## 5. Scale evidence (not CI)

**Deferred (2026-09-15):** loading 100k rows into the shared dev Postgres and running a JMeter
load test would perturb any other session pointed at that DB (multiple concurrent sessions in
this checkout). Victor chose to skip this section for now rather than touch shared DB state —
tasks 5.1-5.3 remain undone. Run them manually when the dev DB is free, or ask before resuming.

- [ ] 5.1 Add gitignored `petclinic-backend/scripts/gen-owners-100k.sql` (generator with realistic name distribution and a few diacritics) and a short how-to in `petclinic-backend/docs/`; verify it loads into dev Postgres in under a minute
- [ ] 5.2 `EXPLAIN (ANALYZE)` the last page sorted by NAME and by CITY on 100k rows; verify an Index Scan on `owners_name_idx`/`owners_city_idx` and no Sort node, and paste the plans into the how-to
- [ ] 5.3 JMeter plan next to `petclinic-jmeter-crud-benchmark.jmx` hitting `page=9999&size=10&sort=NAME`; verify p95 under 50 ms on the 100k dataset and record the number in the how-to

## 6. Wrap-up

- [ ] 6.1 Update `AGENTS.md` (root: owner list is paged, sort columns, `ownerName` pipe under `shared/`; `petclinic-test/AGENTS.md`: `;` separator) and `GUARDRAILS.md` if a new guardrail was added; verify `scripts/check-agents-md.sh` passes
- [ ] 6.2 Commit progressively (backend, frontend, e2e, docs), each with regenerated `openapi.yaml`/`api-types.ts`/`ApiExamples`/wiremock in the same commit; verify CI is green after each push
- [ ] 6.3 Post the decisions comment on GitHub issue #25 (last-name-first sort, 5/10/20 whitelist, `Page` contract, divergence from the outside contributor's claim); verify the comment is visible on the issue
