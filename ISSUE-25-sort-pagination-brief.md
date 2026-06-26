# Brainstorm Minutes — Issue #25: Sorting & Pagination on the Owners screen

**Issue:** Add sorting and pagination to the Owners screen — grid sortable by any column, paginated in pages of 5 / 10 / 20 rows.
**Format:** Q&A decision brief (spec-driven kickoff).
**Date:** 2026-06-26

---

## Decisions (Q&A)

### Q1 — Client-side or server-side sorting/pagination?
**A: Server-side.**
Business targets ~1M owners, so the client must never load all rows. Sort/filter/paginate in the DB.
→ Captured as a permanent rule in `CLAUDE.md` (Scale Assumptions) so it isn't re-litigated.

### Q2 — What JSON shape does `GET /api/owners` return for a page?
**A: A Spring `Page<>`** (not a hand-written page DTO).

### Q3 — Raw `PageImpl` or stable serialization?
**A: Stable.** Use `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)`.
Raw `PageImpl` logs an "unstable serialization" warning on every call and is not a guaranteed contract; the stable mode emits the documented `{ content, page: { size, number, totalElements, totalPages } }` shape. This matters because `openapi.yaml` is regenerated and CI fails on drift.

### Q4 — How does the controller accept the inputs?
**A: Explicit `@RequestParam`s** — `lastName`, `page`, `size`, `sort`, `direction`.
Controller builds `PageRequest.of(page, size, Sort.by(direction, sort))`. Single-column sort.

### Q5 — Is the "Pets" column sortable?
**A: No.** Pets is a per-owner list, not a scalar; sorting it isn't well-defined. The four scalar columns (Name, Address, City, Telephone) are sortable.
- **Name** → `ORDER BY last_name, first_name`
- **Address / City / Telephone** → 1:1
- **Unknown sort key** → fall back to `name, asc` (server-side whitelist; never 500).

### Q6 — How are each page's pets loaded without N+1 or the in-memory-pagination trap?
**A: Batch fetch.** Page owners scalar-only, then load the page's pets in one `IN(...)` query via `hibernate.default_batch_fetch_size`.
Never `JOIN FETCH` a to-many together with pagination (Hibernate would paginate in memory). N+1 was explicitly rejected.
→ Captured as a permanent rule in `CLAUDE.md`.

### Q7 — Which indexes support sorting/filtering at 1M rows?
**A: Index every sortable path** (new `V9` migration). The `owners` table currently has only its PK.
- `(last_name, first_name)`, `city`, `address`, `telephone`
- plus a `text_pattern_ops` variant so `last_name LIKE 'prefix%'` is index-backed.

### Q8 — How is the grid rendered?
**A: Angular Material** — `mat-table` + `matSort` + `mat-paginator`, server-driven (`length = totalElements`, `pageSizeOptions = [5,10,20]`; `(matSortChange)` / `(page)` events refetch — not the client-side `MatTableDataSource`).
Must be **re-themed to look identical to the Bootstrap screens** (header bg/bold/border, odd-row striping, cell borders, `table-layout: fixed` + explicit `.mat-column-*` widths). `matSort` on the four sortable columns only.

### Q9 — Where does list state live?
**A: URL query params** are the source of truth — `?lastName=&page=&size=&sort=&direction=`.
Component reads `ActivatedRoute.queryParams`; every sort/page/search navigates with merged params; paginator + sort initialize from the URL. Back/forward/refresh/deep-link all work.

---

## Settled by recommendation (fast-forwarded, accepted)

- **Defaults:** `page=0`, `size=10`, `sort=name`, `direction=asc`.
- **Validation/caps:** `page ≥ 0`; `size` capped at 20 (default 10 on invalid); `direction` case-insensitive, invalid → `asc`.
- **Repository:** `Page<Owner> findByLastNameStartingWith(String lastName, Pageable)` — empty `lastName` matches all.
- **Batch size:** `hibernate.default_batch_fetch_size = 20` (≥ max page size).
- **Contract integrity:** controller returns `PagedModel<OwnerDto>` (built from `page.map(ownerMapper::toOwnerDto)`) so the runtime JSON, `openapi.yaml`, and the generated Angular types all match.
- **Search:** changing `lastName` resets to page 0.
- **Tests (TDD):** backend MockMvc + `@DataJpaTest`; frontend component unit test; one Playwright e2e in `petclinic-ui-test/`.

---

## Rules captured in `CLAUDE.md`

1. **Scale Assumptions** — ~1M owners; list screens sort/filter/paginate server-side and never load all rows.
2. **No N+1; no `JOIN FETCH` of a to-many with pagination** — load children in bulk (batch fetch / `IN(...)` / join).

---

## Open item / risk

⚠️ **Concurrent work detected.** A leftover `owner-page.ts` defines a **flat** `{content, totalElements, totalPages, number, size}` shape (raw `PageImpl`), and `owner-list.component.css` already has `.owners-pagination` / `.owners-page-size` scaffolding. These contradict the decisions above (stable `PagedModel` shape, Material grid). Another session likely started this issue with a different design — **reconcile before implementation.**
