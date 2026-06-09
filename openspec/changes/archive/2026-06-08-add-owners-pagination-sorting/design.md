## Context

The Owners screen currently fetches **all** owners via `GET /api/owners` (`OwnerRestController.listOwners` → `OwnerRepository.findByLastNameStartingWith` → bare `List<OwnerDto>`) and renders them in a plain Bootstrap 3 table with no sort or paging. In production `owners` holds hundreds of thousands of rows, so loading everything is a memory/perf hazard and unusable UX.

Useful current state:
- Frontend already declares `@angular/material@16.2.1` (unused) and an `owner-page.ts` interface matching the Spring `Page` shape (`content`, `totalElements`, `totalPages`, `number`, `size`).
- `Owner.pets` is `@OneToMany(fetch = LAZY)` with **no** `@BatchSize`.
- Frontend API types are generated from root `openapi.yaml` via `npm run generate:api`.
- E2E (`petclinic-ui-test/`) uses a POM (`OwnersPage`) + `ApiClient` returning a flat array today.

This design records the choices already resolved in the GH25 grill-me ledger (D1–D11) and how they map to code.

## Goals / Non-Goals

**Goals:**
- Server-side paging + sorting pushed to the DB; never load the full table into memory.
- Sortable Name + City columns, Name shown last-name-first, deterministic paging.
- Angular Material `MatPaginator` UX with page-size selector and URL-synced view state.
- Red-green TDD coverage at every layer, including Playwright e2e.

**Non-Goals:**
- Numbered page buttons (paginator uses first/prev/next/last + range label only).
- Sorting on Address / Telephone / Pets (Pets is a 1→N collection — no single sort key).
- Multi-column sort, free-text search beyond the existing last-name prefix.
- A custom `PageDto` wrapper or HATEOAS — we accept Spring's `Page` serialization (see D2).

## Decisions

### D1/D7 — Paging & sorting via Spring Data `Pageable`, with a sort whitelist
Add a `Pageable` parameter to `listOwners` and a repository method (e.g. `findByLastNameStartingWith(String, Pageable)`) returning `Page<Owner>`. Sorting happens in SQL. We do **not** trust the raw `sort` param: map it through a logical whitelist `{name, city}` — where `name` expands to `lastName, firstName` (matching the "Name" column) — and always append an `id` tiebreaker. Unknown fields are dropped and we fall back to `name asc` — never a 500.
- *Alternative considered:* hand-rolled `limit/offset` + manual `count` query. Rejected — Spring Data gives `Page` (content + total) for free and integrates with `MatPaginator`.
- Page-size bounds: `default-page-size=10`, `max-page-size=20` (config in `application.properties`); clamp oversized requests.

### D2 — Return `Page<OwnerDto>` as-is (accept Boot 3 serialization warning)
The endpoint returns Spring's `Page<OwnerDto>`. This logs the known Spring Boot 3 "serializing PageImpl is unstable" warning and couples the wire shape to `PageImpl`, but it's the lowest-friction option and `owner-page.ts` already matches it. `openapi.yaml` is updated to describe the `{content, totalElements, totalPages, number, size}` shape and TS types are regenerated.
- *Alternative considered:* a stable custom `PageResponse<T>` DTO. Rejected for now to avoid extra mapping; revisit if the wire contract needs to be frozen.

### D3/D6 — Name column = last-name-first, sort by `lastName,firstName`, two-state toggle
Display "lastName firstName" so the visible order matches the sort key. Default sort `lastName asc`. A single active column with a two-state asc↔desc toggle (no unsorted third state). `id` tiebreaker always appended for stable paging across requests.

### D4 — Sortable columns: Name + City only
Address / Telephone / Pets render but are not clickable. Enforced both in the UI (only those headers are sortable) and the backend whitelist.

### D5 — Pets via `@BatchSize`
Add `@BatchSize(20)` to `Owner.pets`. The paged root query stays collection-free (no `join fetch` on a paginated query — that would force in-memory paging and trigger `HHH000104`). Pets are loaded lazily in batches; DTO mapping runs inside the transaction / OSIV so lazy access succeeds.
- *Alternative considered:* `@EntityGraph` / `join fetch` on the page query. Rejected — Hibernate cannot safely paginate a fetched collection at the DB level.

### D8/D9 — Angular Material `MatPaginator`
Wire `MatPaginatorModule` into `owners.module.ts`. Use `MatPaginator` for first/prev/next/last and the "Showing X–Y of Z" label (`showFirstLastButtons`, no numbered buttons). `pageSizeOptions = [5, 10, 20]`, default 10. The component holds page/size/sort/lastName state, calls the service with those params, and binds `length=totalElements`.
- *Alternative considered:* full `MatTable` + `MatSort`. Deferred — keep the existing table markup and add only sortable header click handlers + the paginator to minimize churn (the current table also needs its malformed pets markup fixed).

### D10 — URL query-param sync
`page` / `size` / `sort` / `lastName` are written to and read from the route query params (Angular `Router` + `ActivatedRoute`). On load, initialize state from the URL; on any change, update the URL (and let it drive the fetch) so refresh / Back / shared links restore the view.

### D11 — Red-green TDD across layers
- Repository: `@DataJpaTest` — paging, prefix filter, sort whitelist + tiebreaker, batch loading.
- Controller: MockMvc — params → page envelope, default sort, invalid-sort fallback (200), size clamp.
- Frontend: component spec — header toggle, page-size change, URL sync, edge cases.
- E2E: Playwright in `petclinic-ui-test/` — paginate, sort, page-size, deep-link restore (runs in CI, not the pre-commit hook).

### Edge cases
Changing search / sort / page size resets to page 0. Out-of-range page clamps to the last valid page. Zero results → "No owners found" and the paginator is hidden entirely (nothing to page).

## Risks / Trade-offs

- **Boot 3 `PageImpl` serialization is "unstable" (D2)** → accept the warning; `openapi.yaml` pins the documented shape and `owner-page.ts` already targets it. Mitigation if it bites: introduce a stable `PageResponse<T>` DTO.
- **Breaking API change** (`List` → `Page`) → any other `GET /api/owners` consumer breaks. Mitigation: update frontend + e2e in the same change; the app is the only known consumer.
- **`@BatchSize` + OSIV lazy loading** → mapping must occur inside the transaction or lazy pet access throws. Mitigation: map within the request transaction / rely on OSIV; assert bounded query count in the `@DataJpaTest`.
- **Unsanitized `sort` param** → injection / `PropertyReferenceException` / 500. Mitigation: strict whitelist + fallback, covered by a controller test.
- **Pagination drift when data changes between requests** → mitigated by the deterministic `id` tiebreaker and out-of-range clamping.

## Open Questions

- Should last-name search be a prefix (`startingWith`, current behavior) or substring (`ILIKE %x%`)? Default to keeping the existing prefix semantics unless the issue intends otherwise.
- Is case-insensitive last-name matching required? Lean yes (`IgnoreCase`) to match user expectations; confirm during implementation.
