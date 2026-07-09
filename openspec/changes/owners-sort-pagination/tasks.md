## 1. Database migration (via `db` skill)

- [x] 1.1 Author Flyway `V10__owner_sort_functional_indexes.sql` (V9 was already taken by a pre-existing, uncommitted dev-DB migration) adding `owners (lower(last_name), lower(first_name))` and `owners (lower(city))` via plain `CREATE INDEX IF NOT EXISTS`
- [x] 1.2 Use plain (transactional) DDL — NOT `CONCURRENTLY`: it deadlocks against Flyway's schema-history lock and hangs context startup. Zero-downtime prod builds go through an out-of-band `CONCURRENTLY` runbook; the migration no-ops via `IF NOT EXISTS`
- [x] 1.3 In the same migration, `DROP INDEX IF EXISTS` the now-redundant raw `owners_last_name_first_name_idx` and `owners_city_idx`
- [ ] 1.4 Run the migration against dev Postgres; confirm the functional indexes exist, the raw ones are gone, and `EXPLAIN` shows the `name`/`city` sort using the functional index — **BLOCKED**: the shared dev DB has a pre-existing, uncommitted ghost `V9` (Jul 2) so Flyway can't validate there until the user reconciles it. Verified instead on fresh Zonky DBs (all tests green).

## 2. Backend — repository & sort mapping (TDD)

- [x] 2.1 Write a failing repository test: `Page<Owner> findByLastNameStartingWithIgnoreCase(String, Pageable)` returns the right page for a given `Pageable`
- [x] 2.2 Add the paged, case-insensitive query method to `OwnerRepository`
- [x] 2.3 Write a failing test for a `SortMapper` helper: `name` → `[lower(lastName), lower(firstName), id]`, `city` → `[lower(city), id]`, unknown key rejected
- [x] 2.4 Implement the sort-key → `Sort` mapping (with `Sort.Order.ignoreCase()` + `id` tiebreaker)
- [x] 2.5 Add `@BatchSize` to `Owner.pets` (or set `hibernate.default_batch_fetch_size`); assert no fetch-join is used in the page query

## 3. Backend — controller contract (TDD)

- [x] 3.1 Write failing controller tests: default params → page 0 / size 10 / sort name asc; `content` shape is a `Page` envelope
- [x] 3.2 Write failing tests for whitelist rejection: `size ∉ {5,10,20}` → 400, `sort ∉ {name,city}` → 400, invalid `dir` → 400
- [x] 3.3 Write failing tests for ordering: name asc/desc composite, city asc, case-insensitivity, `id` tiebreaker stability across pages
- [x] 3.4 Write a failing test for search + paging: `lastName` filter (case-insensitive) applied before paging/sorting
- [x] 3.5 Change `listOwners` to accept `page`, `size`, `sort`, `dir`, `lastName`, validate the whitelist, and return `Page<OwnerDto>`; make all section-3 tests pass

## 4. Contract regeneration & guardrails

- [x] 4.1 Run `OpenApiExtractorTest` to regenerate `openapi.yaml`; commit the drift
- [x] 4.2 Regenerate the frontend `api-types.ts` from the new `openapi.yaml`
- [x] 4.3 Update `OwnerSearchThroughLatencyProxyTest`: assert against `$.content` and `$.totalElements >= 10` (or request `size=20`)
- [x] 4.4 Update functional `owners.feature` / `OwnerSteps` and `OwnerTest` to the page envelope; run the full backend suite green

## 5. Frontend — Material grid (via `frontend-ux` skill)

- [x] 5.1 Collapse `getOwners`/`searchOwners` into one `getOwners({page,size,sort,dir,lastName}): Observable<OwnerPage>`; reuse the existing `OwnerPage` interface
- [x] 5.2 Import the Material table modules; replace the Bootstrap table in `owner-list.component` with `MatTable` + `MatSort` + `MatPaginator`
- [x] 5.3 Wire server-side mode: paginator page sizes 5/10/20 (default 10), `MatSort` on Name and City only, sort/search change resets to page 0
- [x] 5.4 Render the Name column as `lastName, firstName` (directory style) so the display matches the last-name sort
- [x] 5.5 Style the Material grid to match the surrounding Bootstrap screens (per `frontend-ux` skill)
- [x] 5.6 Update / add component specs (`owner-list.component.spec`, `owner.service.spec`) for the paged calls, including the `Last, First` rendering

## 6. Verify end-to-end

- [x] 6.1 Run backend `mvn test` and frontend unit tests — all green
- [ ] 6.2 Drive the running app (via `verify`/`run` skill): confirm paging, page-size switch, Name/City sort, and case-insensitive last-name search against dev Postgres — **BLOCKED** by the same ghost-`V9`: the backend won't boot against the shared dev DB until it's reconciled.
- [x] 6.3 Confirm CI drift gates (`openapi.yaml`, `DomainModel.puml`) pass; validate the change with `openspec validate owners-sort-pagination`
