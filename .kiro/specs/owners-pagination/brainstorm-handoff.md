# Owners Grid Pagination — Brainstorm Handoff

Raw notes from a Q&A session. Hand these over to Kiro's native spec workflow in the IDE — use them to seed `requirements.md` / `design.md`. Not a spec yet.

## Scope

Add server-side pagination + sorting to the Owners list screen. Reuse the existing `GET /api/owners` endpoint (already returns `Page<OwnerDto>` via Spring Data `Pageable`; frontend currently throws the page metadata away).

## Decisions Reached

### 1. Pagination toolbar — 7 slots, cardinal labels only

At most 7 buttons: `first | current-2 | current-1 | [current] | current+1 | current+2 | last`.

- Labels are the **page numbers themselves** (cardinals). No "First" / "Last" words.
- `«` chevron prefix on the First slot, `»` suffix on the Last slot, as visual hints.
- Current page is visually distinct (bold / boxed).
- **Collapse rule:** whenever the First cardinal or Last cardinal would equal one of the middle five slots, render that page number **only once**. No duplicate numbers, no disabled placeholders. Hide (don't disable) missing slots near the edges.

Worked examples (10 total pages):

| Current | Rendered |
|---|---|
| 1  | `[1] 2 3 10 »` |
| 2  | `« 1 [2] 3 4 10 »` |
| 3  | `« 1 2 [3] 4 5 10 »` |
| 4  | `« 1 2 3 [4] 5 6 10 »` |
| 7  | `« 1 5 6 [7] 8 9 10 »` |
| 8  | `« 1 6 7 [8] 9 10 »` |
| 9  | `« 1 7 8 [9] 10 »` |
| 10 | `« 1 8 9 [10]` |

### 2. Page size selector

Values: **10 (default), 25, 50**.

### 3. Layout

Below the grid:
- **Left:** total-results line, e.g. `Showing 31–40 of 237 owners`.
- **Right:** the pager toolbar.

### 4. Sorting

- Sortable columns: **Name** and **City** only.
- Two-state toggle per click: `asc ↔ desc`. Sort is always on — no "unsorted" state.
- One column at a time (clicking a new column clears the other's sort).
- **Default on first load:** Name ascending. Column header shows the `▲` indicator from the start.
- Active column shows `▲` (asc) or `▼` (desc) next to its label.

### 5. Sortable display name — DRY concern (Option B chosen)

Frontend must **never** concatenate `firstName + lastName`. The backend emits the exact string used for both display and sort. No drift surface.

Chosen approach: **JPQL projection inside the repository query**.
- Repository query `SELECT`s `CONCAT(o.firstName, ' ', o.lastName)` into a DTO field (e.g. `displayName`).
- Incoming sort key `name` is translated (in the controller / a small mapper) to the same JPQL `CONCAT(...)` expression in `ORDER BY`.
- Entity stays untouched — no Hibernate `@Formula`.

Rejected alternative: `@Formula` on the `Owner` entity. Rejected to keep the entity clean.

### 6. Dedicated list DTO — `OwnerSummaryDto` (Option A)

New DTO for the list response only:

```
OwnerSummaryDto {
    id
    displayName            // server-built, from CONCAT
    address
    city
    telephone
    pets: List<PetSummaryDto>  // trimmed: { id, name } only
}
```

- `GET /api/owners/{id}` (detail) keeps returning the existing `OwnerDto` with `firstName` / `lastName` separate (edit form needs them).
- **Performance win, not just cleanliness:** current `OwnerDto` → `PetDto` → `List<VisitDto>` chain causes the list endpoint to load every visit for every pet of every owner. The new summary DTO drops visits entirely.

### 7. Client-side page cache — sliding window ±2, max 5 pages

- Prefetch `current-2`, `current-1`, `current+1`, `current+2` around the current page.
- **Hard cap: 5 pages in memory at any time.** Pages outside the window `[current-2, current+2]` are evicted on navigation.
- Near the edges, fewer pages are cached (no synthetic extra prefetch to "fill to 5").

### 8. Cache lifecycle — per-component only (KISS, Option A)

- Cache lives inside `OwnerListComponent`. Leaving the route destroys it.
- Returning to the owner list starts fresh (page 1, default sort, empty search).
- **No mutation-invalidation logic needed** — owner edit/add/delete on other screens can't produce stale data here because the cache is already gone.

### 9. Resetting to page 1

Triggered by:
- Search input value changes (existing debounced input stays).
- Sort column or direction changes.

(Page size change behaviour not explicitly decided — see Open Items.)

### 10. URL state — NO

State (page / size / sort / search) stays in the component. URL does not reflect it. Reload resets to defaults. No router wiring, no deep linking.

### 11. Commit tags

Final git commit(s) for this work must include the tags:

```
#rai$e #ididgood
```

## Open Items To Decide In The Formal Spec

1. **Page size change → reset to page 1?** (Standard UX: yes. Not explicitly confirmed.)
2. **Exact API sort parameter name** for the composed name — `sort=name,asc` vs `sort=displayName,asc`. Either works, need to pick one for the API contract.
3. **Loading/placeholder UX** when the user navigates to a page that hasn't finished prefetching yet (spinner overlay? skeleton rows? keep showing previous page?).
4. **Prefetch trigger timing** — kick off `±1` and `±2` immediately after current page responds, or on idle, or only on hover over pager buttons?
5. **In-flight request cancellation** when the user clicks next/prev rapidly (AbortController / RxJS switchMap?).
6. **Empty / zero-result rendering** — currently a "No results found" empty state exists; confirm it stays and the pager is hidden when `totalElements == 0`.

## Reference — Current Code

- Backend controller: `petclinic-backend/src/main/java/.../rest/OwnerRestController.java` — already has `@PageableDefault(size = 10, sort = {"firstName", "lastName"}, direction = ASC)`.
- Backend repository: `petclinic-backend/src/main/java/.../repository/OwnerRepository.java` — `findBySearch(q, Pageable)` already returns `Page<Owner>` with EXISTS-based pet filter.
- Frontend component: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.{ts,html}`.
- Frontend service: `petclinic-frontend/src/app/owners/owner.service.ts` — currently maps `response.content` and discards `totalElements` / `number` / etc.
- Unused type already present: `petclinic-frontend/src/app/owners/owner-page.ts` — `OwnerPage { content, totalElements, totalPages, number, size }`.
