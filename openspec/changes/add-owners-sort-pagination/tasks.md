## 1. Backend — SortMapper (TDD)

- [ ] 1.1 Write failing tests for `SortMapper`: `name,asc` → `lastName ASC, firstName ASC, id ASC`; `city,asc` → `city ASC, lastName ASC, firstName ASC, id ASC`
- [ ] 1.2 Write failing tests for DESC toggle keeping tiebreakers ASC: `city,desc` → `city DESC, lastName ASC, firstName ASC, id ASC`
- [ ] 1.3 Write failing test that an unknown sort key (e.g. `password`) is rejected, not passed through
- [ ] 1.4 Implement `SortMapper` whitelist (`name`, `city`) to satisfy 1.1–1.3

## 2. Backend — repository & paged endpoint (TDD)

- [ ] 2.1 Add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` to `OwnerRepository` (keep case-sensitive prefix match)
- [ ] 2.2 Write failing controller/web test: `GET /api/owners?page=0&size=10` returns `PagedModel<OwnerDto>` with `page.totalElements` and ≤10 entries
- [ ] 2.3 Write failing test for default state: no params → Name ASC, page 0, size 10
- [ ] 2.4 Write failing test for size cap: `?size=500` returns `page.size=20` (configure `spring.data.web.pageable.max-page-size=20`)
- [ ] 2.5 Write failing test: filter shrinking results below current page clamps to the last valid page
- [ ] 2.6 Update `OwnerRestController.listOwners` to take `lastName` + `Pageable`, apply `SortMapper`, and return `PagedModel<OwnerDto>` (enable `@EnableSpringDataWebSupport(VIA_DTO)` or `new PagedModel<>(page)`)

## 3. Backend — pets batch-load (no N+1)

- [ ] 3.1 Write failing test asserting a page of owners loads pets without N+1 and without JOIN FETCH (e.g. assert query count / HHH000104 absence)
- [ ] 3.2 Implement batch-loading of pets for the page (`@BatchSize` on `pets` or `findPetsByOwnerIdIn`); do NOT `JOIN FETCH` while paging
- [ ] 3.3 Run full backend test suite green; verify Checkstyle (≤120 chars) passes

## 4. API contract regeneration

- [ ] 4.1 Run `npm run generate:api` so the `PagedModel<OwnerDto>` type regenerates
- [ ] 4.2 Commit the regenerated client to avoid CI drift

## 5. Frontend — service & module wiring

- [ ] 5.1 Update `owner.service.ts` to send `page/size/sort/lastName` and read `resp.page.*` from `PagedModel`
- [ ] 5.2 Import `MatTableModule`, `MatSortModule`, `MatPaginatorModule` (+ `MatProgressBarModule`) into `OwnersModule`

## 6. Frontend — owner-list migration to Material

- [ ] 6.1 Replace the Bootstrap `*ngFor` table with `mat-table` (columns: Name, Address, City, Telephone, Pets)
- [ ] 6.2 Add `matSort` on Name and City headers only (asc⇄desc, `matSortDisableClear`); leave Address/Telephone/Pets non-sortable
- [ ] 6.3 Render Name cell as `lastName, firstName`; render Pets as inline comma-separated names in one cell
- [ ] 6.4 Add `mat-paginator` (5 / 10 default / 20) below the table
- [ ] 6.5 Add `mat-progress-bar` while loading and a "No owners found" empty row

## 7. Frontend — URL state as source of truth

- [ ] 7.1 Sync `page/size/sort/lastName` to URL query params on every table change
- [ ] 7.2 React to `queryParamMap` to drive the table (survives refresh, back button, sharing)
- [ ] 7.3 New last-name search resets `page=0` while keeping sort + size

## 8. End-to-end tests (Playwright, mandatory)

- [ ] 8.1 e2e: clicking Name/City headers toggles asc⇄desc and reorders rows
- [ ] 8.2 e2e: paginator advances pages; 5/10/20 page-size selector works
- [ ] 8.3 e2e: URL-state round-trip — set sort/page/size, refresh + back button restore the same view
- [ ] 8.4 e2e: empty search shows "No owners found"

## 9. Wrap-up

- [ ] 9.1 Run full suite (backend tests, frontend build, e2e) green
- [ ] 9.2 Post the design summary as a comment on issue #25
