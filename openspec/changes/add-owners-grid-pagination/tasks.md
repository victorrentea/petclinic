## 1. Workspace setup

- [ ] 1.1 Create a git worktree off `main` on branch `feat/25-owners-grid-pagination` (two other Claude Code sessions are live in this folder)
- [ ] 1.2 Ensure Postgres is up with the curated dataset — start it via `java -jar petclinic-database/target/petclinic-database.jar`, **not** `./start-database.sh` (which `rm -rf data`)
- [ ] 1.3 Record the baseline: run the backend + frontend + Playwright suites and note which tests pass today

## 2. Database migration (D6, D12)

- [ ] 2.1 Write `db/migration/V9__owner_grid_sorting.sql`: `ALTER COLUMN last_name/first_name/city TYPE TEXT COLLATE "en-US-x-icu"`
- [ ] 2.2 Add `CREATE INDEX owners_last_first_id_idx ON owners (last_name, first_name, id)` and `owners_city_id_idx ON owners (city, id)` to the same migration
- [ ] 2.3 Comment the `varchar_pattern_ops` trap in the migration: a pinned non-`C` collation means a plain btree cannot serve `LIKE 'Dav%'`
- [ ] 2.4 Run the migration locally and verify with `\d owners` that collation and both indexes are present

## 3. Backend tests first (D13)

- [ ] 3.1 Collation test: insert `van Gogh`, `Ångström`, `Zephyr`, `Andrews`, `de Vries`; assert ICU order (fails before task 2)
- [ ] 3.2 Envelope test: `GET /api/owners` returns `content`/`totalElements`/`totalPages`/`number`/`size`, default `size=10`, `number=0`
- [ ] 3.3 Page-size tests: `size=5`, `size=20` honoured; `size=1000000` clamps to 20 and the envelope reports `size=20`
- [ ] 3.4 Sort tests: `sort=name,asc` orders by last then first name; `sort=city,desc` orders by city descending
- [ ] 3.5 Sort rejection tests: `sort=telephone` → 400 naming `name`/`city`; `sort=pets.visits.description` → 400
- [ ] 3.6 Default-sort test: no `sort` param ⇒ `name,asc`
- [ ] 3.7 **Pagination stability test** (load-bearing): seed several owners sharing one city, page through the whole set with `sort=city,asc`, assert the union of pages equals the full set — no duplicates, no omissions
- [ ] 3.8 Composition test: `lastName=Da` + `sort=city,asc` + `page/size` — filter applied, `totalElements` counts only matches
- [ ] 3.9 Query-count test: a 20-owner page loads pets in a bounded number of queries (asserts `@BatchSize`, catches the `HHH000104` in-memory fallback)

## 4. Backend implementation (D1, D2, D7, D8, D10)

- [ ] 4.1 Add `OwnerPageDto` (`content`, `totalElements`, `totalPages`, `number`, `size`) — explicitly not `Page`/`PagedModel`
- [ ] 4.2 Change `OwnerController.findOwners` to accept `Pageable` + `lastName` and return `OwnerPageDto`
- [ ] 4.3 Implement the sort whitelist: map UI keys `name` → `(lastName, firstName, id)` and `city` → `(city, id)`; anything else ⇒ `400` naming the accepted keys
- [ ] 4.4 Update `OwnerService` / `OwnerRepository` to a `Page<Owner>` query composing the `lastName` prefix filter
- [ ] 4.5 Add `@BatchSize(size = 20)` to `Owner.pets`; confirm no `JOIN FETCH` is used with `Pageable`
- [ ] 4.6 Set `spring.data.web.pageable.default-page-size=10` and `max-page-size=20` in `application.properties`
- [ ] 4.7 Verify `GET /api/owners/count` is untouched and still `permitAll()`
- [ ] 4.8 Run the task-3 tests to green

## 5. Existing backend tests to repair (D13)

- [ ] 5.1 `OwnerTest` — envelope instead of bare array
- [ ] 5.2 `OwnerSteps` + `owners.feature` — move *"the response JSON array has size 2"* onto `content`
- [ ] 5.3 Add 2 Cucumber scenarios: page through owners; sort by city
- [ ] 5.4 `OwnerSearchThroughLatencyProxyTest`
- [ ] 5.5 `BasicAuthenticationConfigTest`

## 6. Generated backend artifacts (drift checks + CODEOWNERS elders)

- [ ] 6.1 Regenerate `openapi.yaml` and make `OpenApiExtractorTest` pass
- [ ] 6.2 Run Spectral lint over the new params/schema
- [ ] 6.3 Regenerate `petclinic-backend/DB.sql` (`DbSchemaExtractorTest`) and `docs/generated/DB.puml`

## 7. Frontend tests first (D13)

- [ ] 7.1 `owner.service.spec.ts` — new signature and envelope parsing
- [ ] 7.2 `owner-list.component.spec.ts` — sort/page events trigger service calls with the right params
- [ ] 7.3 `owner-list.component.spec.ts` — URL sync: state read from query params on init; sort/page/filter navigate with merged params; filter change resets to page 0
- [ ] 7.4 `owner-list.component.spec.ts` — Name cell renders `Last, First`

## 8. Frontend implementation (D14, D15)

- [ ] 8.1 Regenerate `src/app/generated/api-types.ts` (`npm run generate:api`)
- [ ] 8.2 Wire up the orphan `owner-page.ts` interface; update `owner.service.ts` to the paged signature
- [ ] 8.3 Import `MatTableModule`, `MatSortModule`, `MatPaginatorModule`
- [ ] 8.4 Rewrite `owner-list.component.html` as `MatTable` with `matSort` on Name and City only, and a `MatPaginator` with `[pageSizeOptions]="[5,10,20]"`
- [ ] 8.5 Render the Name cell as `Last, First`
- [ ] 8.6 Drive all state from the URL: read `page`/`size`/`sort`/`lastName` from query params, navigate with merged params on every sort/page/filter action
- [ ] 8.7 Restyle to Bootstrap in `owner-list.component.scss`: header treatment, `tr.mat-mdc-row:nth-child(odd)` striping, cell borders, `.btn-default` buttons, `white-space: nowrap` on buttons/labels
- [ ] 8.8 `table-layout: fixed` with an explicit width per `.mat-column-*` so column boundaries don't jump when sorting
- [ ] 8.9 Run the task-7 tests to green

## 9. End-to-end verification

- [ ] 9.1 Update `OwnersPage` selectors for the Material table/paginator
- [ ] 9.2 Rename `owners.spec.ts`'s *"shows all owners on initial load"* to *"shows the first page of owners"* and assert 10 of N
- [ ] 9.3 Add Playwright specs: navigate to page 2; sort by city; change page size to 20
- [ ] 9.4 Run backend + frontend + Playwright suites green
- [ ] 9.5 Open the grid side by side with the Vets screen and confirm it is visually indistinguishable

## 10. Docs and PR

- [ ] 10.1 Update `user-manual/manual.md` line 46 — *"The list shows **every** registered owner"* is now false
- [ ] 10.2 Retake `user-manual/screenshots/owners-list.png` with the paginated grid
- [ ] 10.3 Open the PR referencing #25 with normal concise commits; flag the CODEOWNERS-elders files (migration, `openapi.yaml`, `DB.sql`, `DB.puml`)
- [ ] 10.4 File the two out-of-scope follow-up issues: case-sensitive `lastName` filter; `Owner.telephone` `@Pattern`/`@NotEmpty` contradicting the live data (13-digit numbers, one NULL)
