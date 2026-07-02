## 1. Database indexes

- [x] 1.1 Add a schema migration creating a btree index on `owners(last_name, first_name)` (covers the last-name prefix filter and the Name sort)
- [x] 1.2 Add a btree index on `owners(city)` (covers the City sort)
- [x] 1.3 Consult the `db` skill while authoring the migration; confirm the migration runs against the embedded Postgres used in dev and tests

## 2. Backend repository (TDD)

- [x] 2.1 Write a failing repository test: `findByLastNameStartingWith(prefix, Pageable)` returns the correct page slice, respects the prefix filter, and `getTotalElements()` reflects only matching owners
- [x] 2.2 Add sort-behavior tests: sort by `lastName,firstName` and by `city`, ascending and descending
- [x] 2.3 Add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` to `OwnerRepository` (keep `extends Repository<Owner,Integer>`); make tests pass

## 3. Backend pets fetching (TDD)

- [x] 3.1 Write a test proving pets are loaded for a page of owners without in-memory pagination (verified behaviorally: page LIMIT respected while pets stay populated; derived query has no `JOIN FETCH`)
- [x] 3.2 Configure batch fetching for `Owner.pets` (`@BatchSize(100)`); the page query is the derived finder and does NOT `JOIN FETCH` the pets collection

## 4. Backend controller + response contract (TDD)

- [x] 4.1 Write a failing MockMvc test asserting `GET /api/owners` returns the `PagedModel` JSON shape (`content` + nested `page.{size,number,totalElements,totalPages}`), default page size 10
- [x] 4.2 Add tests: `size` above cap is clamped to 100; unsupported `sort` key (e.g. `telephone`) is ignored and falls back to `name` asc; `lastName` filter composes with `page`/`size`/`sort`
- [x] 4.3 Authorization (`OWNER_ADMIN`) on the paginated endpoint — covered by existing `BasicAuthenticationConfigTest` (401 anon / 200 admin on `GET /api/owners`), re-verified green
- [x] 4.4 Implement `listOwners` to accept `page`/`size`/`sort`, translate logical keys (`name` → `lastName,firstName`; `city` → `city`), whitelist/ignore others, clamp `size` to 100, default sort `name` asc
- [x] 4.5 Return `new PagedModel<>(page.map(ownerMapper::toOwnerDto))`; make all controller tests pass

## 5. Generated artifacts

- [x] 5.1 Regenerated `openapi.yaml` via `OpenApiExtractorTest`; owners response now `PagedModelOwnerDto` (`content` + `page` → `PageMetadata`)
- [x] 5.2 Regenerated the frontend `api-types.ts` (`npm run generate:api`); now exposes `PagedModelOwnerDto` + `PageMetadata`

## 6. Frontend grid (TDD)

- [x] 6.1 Reshaped `OwnerPage` to the nested paged form, derived from the generated `PagedModelOwnerDto` (per frontend-ux: don't hand-shape generated contracts)
- [x] 6.2 Replaced the array methods with `getOwnersPage({lastName,page,size,sort})` (via `HttpParams`) returning the paged body; updated the service unit tests
- [x] 6.3 Imported `MatTableModule`, `MatSortModule`, `MatPaginatorModule` into `owners.module.ts`
- [x] 6.4 Migrated `owner-list.component.html` to `mat-table` + `matSort` (sort handles on Name and City only) + `mat-paginator` (`pageSizeOptions=[5,10,20]`, default 10, `length`=`totalElements`); Name cell renders `{{lastName}}, {{firstName}}` with the owner-detail link; pets cell now a comma-joined `petNames(owner)`
- [x] 6.5 Wired `(matSortChange)` and `(page)` to refetch server-side; a new last-name search resets to page 0 while retaining sort and page size
- [x] 6.6 Applied the `frontend-ux` skill: component CSS re-themes the Material table to the Bootstrap look (#f9f9f9 stripes, #ddd borders, bold headers) with `table-layout: fixed` + explicit per-column widths
- [x] 6.7 Rewrote the component spec for server-side sort/page wiring, surname-first display, and search-resets-to-page-0 (added `NoopAnimationsModule`)

## 7. Verification

- [x] 7.1 Backend `mvn test` BUILD SUCCESS (incl. functional Cucumber hitting a live server); frontend `npm run test-headless` 109/109; production build clean (strict webpack-warning gate)
- [x] 7.2 Guardrails green as part of `mvn test`: `OpenApiExtractorTest` + `DbSchemaExtractorTest` (regenerated, no drift), `PackagesArchTest`, `C3ArchTest`, `JpaMatchesDBSchemaTest`, MCP security; Spectral lint 0 errors; Spotless check passes
- [ ] 7.3 Manual browser click-through against a seeded DB NOT done in this run (needs the full stack + browser). Automated e2e is green (Cucumber `/api/owners?lastName=Dav` against a live server asserts the paged body); recommend a manual eyeball or ask me to spin up db+backend+frontend and drive it
