# Handover — Issue #25: Sorting & Pagination on the Owners screen

> Source: grill-me design session on https://github.com/victorrentea/petclinic/issues/25
> Status: design resolved, ready to spec (OpenSpec) and implement. No code written yet.

## Issue summary

Add sorting + pagination to the Owners list screen:
- Sorting: click a column header to toggle ascending / descending.
- Pagination: navigation controls below the table.
- Page-size selector: 5, 10 (default), or 20 rows per page.

## Current state (as explored)

- **Backend** `OwnerRestController.listOwners` → `GET /api/owners?lastName=` returns a plain `List<OwnerDto>`.
  Repo: `OwnerRepository.findByLastNameStartingWith(String)` (extends bare `Repository`, **no** `Pageable`/`Sort`, loads all matches into memory).
  `OwnerDto` fields: id, firstName, lastName, address, city, telephone, pets[].
- **Frontend** `owner-list.component.{ts,html}` — plain Bootstrap 3 `*ngFor` table. Columns: Name (firstName+lastName link), Address, City, Telephone, Pets (nested `<tr>` per pet). No sort/paginator UI.
  Service `owner.service.ts`: `getOwners()` / `searchOwners(lastName)` via string-concatenated query param.
  Angular Material **is installed (v16.2.1) but unused anywhere** — no MatTable/MatSort/MatPaginator yet.
- No existing paged DTO in the backend (all 13 DTOs are single-entity). This is the first paginated endpoint.

## Decisions (Q&A)

| # | Question | Decision |
|---|----------|----------|
| Q1 | Server-side vs client-side sort/paging | **Server-side** — DB does `ORDER BY` + `LIMIT/OFFSET`, returns one page + total count. Required by the 100k-owner scale rule. |
| Q2 | Response envelope shape | **Spring `PagedModel<OwnerDto>`** (`@EnableSpringDataWebSupport(VIA_DTO)` or `new PagedModel<>(page)`). Stable JSON; metadata nested under `page` → frontend reads `resp.page.totalElements`. (Custom DTO and raw `Page` rejected.) |
| Q3 | Sortable columns + Name sort key | Sortable = **Name and City only** (Address/Telephone/Pets are NOT sortable). After business confirmation, **names will be displayed `lastName, firstName`** and Name sorts by last-then-first to match the display. |
| Q5 | Sort contract + stable pagination | Frontend sends a **logical sort key** (`?sort=name,asc` / `?sort=city,asc`); backend **whitelist-maps** it to an entity `ORDER BY` chain with a tiebreaker. Whitelist rejects unknown keys (no `?sort=password` abuse). Tiebreaker chains: **Name → `lastName, firstName, id`**; **City → `city, lastName, firstName, id`**. |
| Q6 | Tiebreaker direction on DESC toggle | **Tiebreakers always ASC.** Only the clicked column flips. E.g. City desc → `city DESC, lastName ASC, firstName ASC, id ASC`. |
| Q7 | Initial load state | **Name ASC, page 0, size 10.** |
| Q8 | Search ↔ paging interaction | A new last-name search **resets page to 0**, **keeps** the chosen sort + size. Clamp to last valid page if a filter shrinks results below the current page. |
| Q9 | State persistence | **Sync page / size / sort / search to URL query params** (`?page=&size=&sort=&lastName=`). URL is the source of truth; table reacts to `queryParamMap`. Survives refresh + back button + sharing. |
| Q10 | Loading pets for the page | **Paginate owners with no collection fetch, then batch-load pets** (`@BatchSize` or `findPetsByOwnerIdIn`) → ~2 queries, no N+1. **Do NOT JOIN FETCH pets** (triggers HHH000104 in-memory pagination → breaks DB paging at scale). |
| Q11 | Page-size guard | **`spring.data.web.pageable.max-page-size=20`** — Spring silently caps any larger `?size=` request. UI still offers only 5/10/20. |

## Fast-forwarded decisions (my recommendations, agreed)

- **Sort toggle:** asc ⇄ desc only, no third "unsorted" state (`matSortDisableClear`).
- **Sort translation:** small server-side `SortMapper` whitelist rewrites incoming `Sort` → entity chain (see Q5/Q6). Unknown keys rejected.
- **Backend signature:** `Page<Owner> findByLastNameStartingWith(String, Pageable)`; controller returns `PagedModel<OwnerDto>`, takes `lastName` + `Pageable`.
- **Search semantics:** keep existing case-sensitive prefix match — NOT expanding to fuzzy/ILIKE in this issue.
- **Pets cell:** inline comma-separated pet names in a single mat-table cell (no nested `<tr>`).
- **Module wiring:** import `MatTableModule`, `MatSortModule`, `MatPaginatorModule` into `OwnersModule`.
- **Loading/empty UX:** `mat-progress-bar` while fetching; "No owners found" row when empty.
- **OpenAPI:** run `npm run generate:api` after the backend change so the `PagedModel` type regenerates; commit the regen to avoid CI drift.
- **Tests (TDD):** backend tests for sort-key translation, tiebreaker order, filtered count, and size-cap clamp; Playwright e2e for header toggle, paginator, 5/10/20 selector, and URL-state round-trip (e2e mandatory).

## Scope note

Beyond the literal issue, this adds **one display change**: the Name cell switches from `firstName lastName` to `lastName, firstName` (business-approved, required for the Name sort to match the visible order).

## Suggested next steps (OpenSpec)

1. Backend: repo `Pageable` overload + `SortMapper` whitelist + controller returns `PagedModel<OwnerDto>` + batch-load pets + `max-page-size=20`. TDD.
2. Regenerate OpenAPI frontend types.
3. Frontend: migrate `owner-list` to `mat-table` + `matSort` + `mat-paginator`, wire `queryParamMap` ↔ table state, update `OwnersModule` + service.
4. Playwright e2e for sort/paginate/size/URL-state.
5. Post the design summary as a comment on issue #25.
