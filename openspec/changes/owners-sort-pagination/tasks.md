## 1. Reconcile concurrent work (do first)

- [x] 1.1 Confirmed: `owner-page.ts` holds the flat shape in this worktree; no `.owners-pagination` CSS scaffolding present. Decision: implement in the shared working tree with two module-disjoint parallel minions (backend vs frontend) — no inter-minion file conflict; git snapshotted clean of owners changes before starting.
- [x] 1.2 Noted: `owner-page.ts` will be corrected to the nested page envelope (handled in the frontend track), not extended from the flat shape.

## 2. Backend — page contract (TDD)

- [x] 2.1 Write a failing MockMvc test: `GET /api/owners` returns the nested envelope `{ content, page: { size, number, totalElements, totalPages } }` (not a flat array, not flat root keys)
- [x] 2.2 Add `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` to `PetClinicApplication`
- [x] 2.3 Add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` to `OwnerRepository` (empty `lastName` matches all)
- [x] 2.4 Change `OwnerRestController.listOwners` to accept `@RequestParam`s `lastName`, `page`, `size`, `sort`, `direction` and return `PagedModel<OwnerDto>` via `page.map(ownerMapper::toOwnerDto)`
- [x] 2.5 Make the MockMvc test pass

## 3. Backend — sort whitelist, validation, batch fetch (TDD)

- [x] 3.1 Write failing tests: `sort=name` → `last_name, first_name`; `sort=city|address|telephone` → 1:1; unknown `sort` (e.g. `pets`, `bogus`) → fallback `name, asc` with HTTP 200 (never 500)
- [x] 3.2 Implement the server-side sort-key whitelist mapping `sort` → `Sort`
- [x] 3.3 Write failing tests for validation/caps: `page >= 0`; `size` capped at 20; invalid `size` → 10; `direction` case-insensitive, invalid → `asc`
- [x] 3.4 Implement validation/caps when building `PageRequest.of(...)`
- [x] 3.5 Set `spring.jpa.properties.hibernate.default_batch_fetch_size=20` in `application.properties`
- [x] 3.6 Add a `@DataJpaTest` proving a page of owners loads pets with one batched `IN (...)` query (no N+1) and that the owner page query uses SQL `LIMIT/OFFSET` (no `JOIN FETCH` + pagination)

## 4. Backend — indexes & generated contract

- [x] 4.1 Add `V9__index_owners_sort_columns.sql`: indexes on `(last_name, first_name)`, `city`, `address`, `telephone`, plus a `text_pattern_ops` index on `last_name` for `LIKE 'prefix%'`
- [x] 4.2 (Optional) `@DataJpaTest` `EXPLAIN` check that the prefix filter is index-backed
- [x] 4.3 Regenerate `openapi.yaml` via the `OpenApiExtractorTest` guardrail; confirm the owners-list schema matches `PagedModel<OwnerDto>` and CI drift check passes

## 5. Frontend — contract & service

- [x] 5.1 Regenerate Angular API types from `openapi.yaml`; reconcile `owner-page.ts` to the nested `{ content, page: { size, number, totalElements, totalPages } }` envelope
- [x] 5.2 Update `owner.service.ts`: `getOwners(params: { lastName, page, size, sort, direction }): Observable<OwnerPage>` issuing the query-param request (replace the old `getOwners()`/`searchOwners()` array calls)

## 6. Frontend — Material grid (TDD)

- [x] 6.1 Write a failing component unit test: paginator `length = totalElements`, `pageSizeOptions = [5,10,20]`; a sort click triggers a server refetch (not client-side resort); Pets column is not sortable
- [x] 6.2 Add Material imports (`MatTableModule`, `MatSortModule`, `MatPaginatorModule`) to `owners.module.ts`
- [x] 6.3 Rewrite `owner-list.component.html` with `mat-table` + `matSort` (four sortable columns only) + `mat-paginator`, server-driven
- [x] 6.4a Render the Name cell surname-first ("Franklin, George") instead of `firstName lastName`, so the visible order matches the `last_name, first_name` sort (confirmed with business)
- [x] 6.4 Rewrite `owner-list.component.ts` to be server-driven (no client-side `MatTableDataSource` sort/paginate)
- [x] 6.5 Re-theme `owner-list.component.css` to match Bootstrap (header bg/bold/border, odd-row striping, cell borders, `table-layout: fixed`, explicit `.mat-column-*` widths)
- [x] 6.6 Make the component unit test pass

## 7. Frontend — URL as source of truth (TDD)

- [x] 7.1 Write failing tests: deep link `/owners?lastName=Fra&page=1&size=20&sort=city&direction=desc` reproduces state; changing `lastName` resets `page=0`
- [x] 7.2 Read `ActivatedRoute.queryParams`; initialize sort + paginator from the URL
- [x] 7.3 On sort/page/search, `router.navigate` with merged query params and refetch; reset `page=0` on new `lastName`
- [x] 7.4 Make the URL-state tests pass

## 8. E2E & verification

- [x] 8.1 Added Playwright e2e in `petclinic-ui-test/tests/owners.spec.ts` (server-side sort + page-size + paginate, asserting URL params and that rows match the API page order); reconciled `OwnersPage` (mat-table selectors, sort/paginate helpers) + `ApiClient` (page envelope, surname-first names). Compiles/lists 3 tests with no TS errors. NOTE: not executed live — see 8.3.
- [ ] 8.2 Visual parity check — BLOCKED: needs a freshly-built stack running (`:4200` is down and `:8080` is a stale pre-existing process). Not run to avoid disrupting the 6 concurrent sessions. Bootstrap-matching CSS is in place; awaiting a live screenshot comparison.
- [x] 8.3 Backend module suite **138 green** (incl. OpenAPI drift guardrail `OpenApiExtractorTest` + `openapi.yaml` regenerated to `PagedModel<OwnerDto>`); frontend unit suite **114 green** (after api-types regen). PENDING: the Playwright e2e live-run needs a fresh backend+frontend stack (not started here due to concurrency); unit/integration coverage already exercises the envelope, whitelist, caps, batch-load, URL-state, surname-first, and paginator.
