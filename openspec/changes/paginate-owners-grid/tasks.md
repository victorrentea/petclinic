# Tasks

## 1. Database

- [ ] 1.1 Check `flyway_schema_history` in the dev DB for a foreign `V4`; if present, reset once with `./start-database.sh` — verify the backend boots cleanly afterwards
- [ ] 1.2 Add `V4__owner_grid_indexes.sql` with the three indexes of design D5 — verify with `EXPLAIN` in the dev DB that a name-sorted page, a city-sorted page and a `last_name LIKE 'Da%'` filter each use an index
- [ ] 1.3 Add `@BatchSize(size = 20)` on `Owner.pets` and `Pet.visits` (D6) — verify with a test that listing a page issues a bounded number of statements, independent of the page size

## 2. Paged, sorted owners API (TDD)

- [ ] 2.1 Write failing `OwnerTest` cases for the `owner-grid` API scenarios (default page, next page continues, page past the end, size 5 / 1000, sort by name and by city desc, `sort=telephone` → 400, filtered page, diacritics) — verify they fail for the right reason
- [ ] 2.2 Add `OwnerPageDto`, the sort-key/direction enum and the paged repository method; change `listOwners` to take `lastName, sort, dir, page, size`, reject invalid values through `ValidationException`, and update its `@Operation`/`@ApiResponse` + `ApiExamples.OWNERS` — verify 2.1 passes
- [ ] 2.3 If the embedded test Postgres sorts `Ś` after `Z`, set its locale where the test DB is initialised — verify the diacritics case passes without being weakened
- [ ] 2.4 Migrate the backend callers of the full list to `$.content` / `totalElements`: `owners.feature` + `OwnerSteps`, `PetSteps`, `OwnerSearchThroughLatencyProxyTest`, `AddVisitApiTest`, `VisitDateRangeTest`, `genseq/Rest` + `Steps`, the JMeter plan — verify `mvn test` in `petclinic-backend` is green
- [ ] 2.5 Regenerate `openapi.yaml` (`OpenApiExtractorTest`) and the frontend types (`npm run generate:api`), and run `npm run lint:openapi` — verify the diff shows only the new params and `OwnerPageDto`, and Spectral passes

## 3. Owner name as "Last, First"

- [ ] 3.1 Write the `ownerName` pipe test-first (`{firstName:'Kevin', lastName:'McCallister'}` → `McCallister, Kevin`), in a shared module — verify its unit test passes
- [ ] 3.2 Use the pipe in the 7 templates: owner-list, owner-detail, visits-page, pet-add, pet-edit, visit-add, visit-edit — verify `grep -rn 'firstName }} {{' petclinic-frontend/src/app` finds only vets, and `owner-detail` / `visits-page` unit tests expect "Last, First"
- [ ] 3.3 Update the e2e expectations reading an owner's name (`visits.spec.ts`, `pages/VisitsPage.ts`, `add-owner.spec.ts`, `chatbot.spec.ts`, `owner-search.feature` + glue) — verify those specs pass against the running stack

## 4. Owners screen pages and sorts

- [ ] 4.1 Change `OwnerService` to one `getOwnersPage({lastName, sort, dir, page, size})` returning the generated page type; delete `owners/owner-page.ts` — verify `owner.service.spec.ts` asserts the query params and the page body
- [ ] 4.2 Import `MatSortModule` + `MatPaginatorModule` in `owners.module.ts`; add `matSort` (Name, City only, `matSortDisableClear`, start Name asc) and `<mat-paginator [pageSizeOptions]="[5, 10, 20]">` to the grid; drive loads with `switchMap` and reset to page 0 on search/sort/size change (D7) — verify `owner-list.component.spec.ts` covers the initial request, a sort click, a size change and search-resets-page
- [ ] 4.3 Fix the nested `<tr>` inside the Pets cell while there (invalid HTML inside a sortable table) — verify the pets still render one per line
- [ ] 4.4 Migrate `owner-search.feature` glue ("every owner" → `totalElements`, first page only) and `add-visit.dsl.ts` (find the pet through `GET /api/pets` + `ownerId`) — verify both pass

## 5. Acceptance

- [ ] 5.1 Add `petclinic-test/src/owners-grid.feature` + glue, tagged `@generate_sequence`: open Owners, sort by City, pick 5 rows, go to page 2 — assert order and counts only (never which names), since suites share one DB — verify it passes and its `generated/*.genseq.puml` is committed
- [ ] 5.2 Run `DeploymentDiagramTest` against the new traces — verify it stays green
- [ ] 5.3 Regenerate the user manual's Owners section (`/regen-user-manual`) — verify it shows sorting and the paginator

## 6. Integration

- [ ] 6.1 Full run: backend `mvn test`, frontend `npm test`, e2e `npm test` in `petclinic-test` — verify all green, then click through the Owners screen at 1280px once by hand
