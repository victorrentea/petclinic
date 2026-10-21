# Tasks

## 1. Database: collation and indexes

- [ ] 1.1 Add Flyway migration `V4__owners_romanian_collation_and_indexes.sql`: pin `last_name`, `first_name`, `city` to `COLLATE "ro-RO-x-icu"`, add indexes `(last_name, first_name, id)`, `(city, last_name, first_name, id)`, `(last_name text_pattern_ops)`; verify the backend boots on the dev database and `mvn test` passes on fresh Zonky copies
- [ ] 1.2 Add a repository test that sorts Sava, Szabo, Șerban, Tudor by name and expects that order; verify it passes (proves the collation in tests, and in CI on Linux)

## 2. Backend: paged, sorted `GET /api/owners`

- [ ] 2.1 Write failing MockMvc tests in `OwnerTest` for every scenario of `specs/owner-list/spec.md` on the API side: default page, last partial page, page past the end, size 50000 → 400, `sort=telephone,asc` → 400, name asc/desc, city with name tie-break, 6 namesakes across `size=5` pages, prefix search with its total
- [ ] 2.2 Add `OwnerPageDto {content, totalElements}` and make `listOwners` take `lastName`, `page`, `size`, `sort`, map `name`/`city` to a `Sort` ending on `id`, and throw `ValidationException` for other keys or sizes; add `Page<Owner> findByLastNameStartingWith(String, Pageable)` to `OwnerRepository`; verify 2.1 is green
- [ ] 2.3 Set `spring.jpa.properties.hibernate.default_batch_fetch_size=20`; add a test that counts the SQL statements for a page of 20 owners with pets and visits and expects at most 4; verify it passes
- [ ] 2.4 Update the callers that expect a list — `AddVisitApiTest`, `OwnerSteps` / `owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest` if it reads the body; verify the whole backend suite passes
- [ ] 2.5 Regenerate `openapi.yaml` via `OpenApiExtractorTest` and lint it (`npm run lint:openapi`); verify the diff shows only the `listOwners` parameters and the new page schema

## 3. Frontend: the grid

- [ ] 3.1 Run `npm run generate:api`; change `OwnerService` to one `getOwnersPage({lastName, page, size, sort})` returning `{content, totalElements}`, replacing `getOwners`/`searchOwners`; verify `owner.service` and `owner-list` specs compile
- [ ] 3.2 Rebuild `owner-list` on `mat-table` + `matSort` (`matSortDisableClear`, headers on Name and City only) + `mat-paginator` (`[5,10,20]`, default 10, first/last buttons); Name shows "Last, First", Pets comma-separated, Add Owner outside the results block; a new search, sort or size resets to page 0; verify with new `owner-list.component.spec.ts` cases for each grid scenario of the spec
- [ ] 3.3 Import the Material table/sort/paginator modules in the owners module; verify `npm run test-headless`, `npm run test:arch` and `npm run build` pass

## 4. End-to-end and data hygiene

- [ ] 4.1 Update `owner-search.feature` glue, `add-owner.spec.ts`, `visits.spec.ts` and `pages/VisitsPage.ts` for the paged grid (find an owner by searching, not by scanning all rows); verify they pass
- [ ] 4.2 Add a Playwright spec that creates 6 owners under a unique last-name prefix via the API, searches that prefix, sorts by Name and City, pages with size 5, and checks every owner appears once; verify it passes against the running app
- [ ] 4.3 Make `visit-date-range.spec.ts` delete the owner it creates (`afterAll`), then delete the 53 leftover "Ada Lovelace"/"Probe" owners from the dev database through the API; verify `GET /api/owners/count` returns 26

## 5. Volume check

- [ ] 5.1 On a scratch database, generate 50,000 owners (`generate_series`), `EXPLAIN ANALYZE` the page query and the count for each sort and for a prefix search; verify each plan uses an index and runs under 50 ms, and record the timings in `VOLUMETRY.md`
