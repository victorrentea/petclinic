## Context

`OwnerRestController.listOwners` → `GET /api/owners?lastName=` returns a plain `List<OwnerDto>`; `OwnerRepository.findByLastNameStartingWith(String)` extends a bare `Repository` with no `Pageable`/`Sort` and loads all matches into memory. The frontend `owner-list` is a Bootstrap 3 `*ngFor` table with no sort/paginator. Angular Material is installed (v16.2.1) but unused. This is the **first** paginated endpoint — all 13 backend DTOs are single-entity today.

The binding constraint is scale: ~100,000 owners within a year (by ~June 2027), with a project rule to never load all owners into memory and always paginate + filter at the DB level. This design was resolved in a grill-me session on issue #25.

## Goals / Non-Goals

**Goals:**
- DB-side sort + page + total count for owners; one page returned per request.
- Stable, abuse-resistant sort contract (logical key → whitelisted entity `ORDER BY` chain with tiebreakers).
- Angular Material table UI with URL-persisted state (page/size/sort/lastName).
- No N+1 and no in-memory pagination when loading pets.

**Non-Goals:**
- Changing search semantics (keep case-sensitive last-name prefix match; no fuzzy/ILIKE).
- Making Address/Telephone/Pets sortable.
- Paginating any other screen or endpoint.
- A third "unsorted" header state.

## Decisions

### D1 — Server-side pagination (not client-side)
DB does `ORDER BY` + `LIMIT/OFFSET` and returns one page + total count. *Alternative rejected:* client-side sort/paging — impossible at 100k owners; violates the scale rule.

### D2 — Response envelope: `PagedModel<OwnerDto>`
Return Spring HATEOAS `PagedModel<OwnerDto>` (via `@EnableSpringDataWebSupport(VIA_DTO)` or `new PagedModel<>(page)`). Metadata nests under `page`, so the frontend reads `resp.page.totalElements`. *Alternatives rejected:* a custom paged DTO (reinvents a standard shape) and raw `Page<T>` (unstable JSON contract). **Breaking** vs. the current bare-`List` response — OpenAPI types regenerate.

### D3 — `SortMapper` whitelist
A small server-side `SortMapper` rewrites an incoming logical `Sort` into an entity `ORDER BY` chain:
- `name` → `lastName, firstName, city, id`
- `city` → `city, lastName, firstName, id`

Unknown keys are rejected (no `?sort=password` abuse). Only the clicked column flips on a DESC toggle; tiebreakers are **always ASC** (e.g. `city,desc` → `city DESC, lastName ASC, firstName ASC, id ASC`). *Alternative rejected:* passing the frontend `Sort` straight to Spring Data — exposes arbitrary entity fields and yields unstable ordering without tiebreakers.

### D4 — Repository signature
`Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`. Controller takes `lastName` + `Pageable` and returns `PagedModel<OwnerDto>`.

### D5 — Pets: paginate owners, then batch-load
Page owners with **no** collection fetch, then batch-load pets for the page (`@BatchSize` on the `pets` collection, or an explicit `findPetsByOwnerIdIn`). ~2 queries, no N+1. **Do not** `JOIN FETCH pets` while paging — it triggers Hibernate HHH000104 (applies the limit in memory), defeating DB paging at scale.

### D6 — Page-size cap
`spring.data.web.pageable.max-page-size=20` silently caps any larger `?size=`. UI offers only 5 / 10 (default) / 20.

### D7 — Initial state and search interaction
Initial load: Name ASC, page 0, size 10. A new last-name search resets page to 0 but keeps sort + size. If a filter shrinks results below the current page, clamp to the last valid page.

### D8 — Frontend: Material + URL as source of truth
Migrate `owner-list` to `mat-table` + `matSort` + `mat-paginator`; import `MatTableModule`, `MatSortModule`, `MatPaginatorModule` into `OwnersModule`. Sync `page/size/sort/lastName` to URL query params; the table reacts to `queryParamMap` (survives refresh, back button, sharing). `matSortDisableClear` for asc⇄desc only. Pets shown inline comma-separated in one cell. `mat-progress-bar` while loading; "No owners found" empty row.

### D9 — Name display = `lastName, firstName`
Business-approved display change so the visible order matches the Name sort key. In scope despite being beyond the literal issue.

## Risks / Trade-offs

- **Breaking response shape (bare List → PagedModel)** → Regenerate OpenAPI types (`npm run generate:api`) and commit the regen to avoid CI drift; this endpoint has a single known frontend consumer.
- **Accidental in-memory pagination via JOIN FETCH** → Enforced by D5 (batch-load, never join-fetch while paging); add a backend test asserting page contents/queries.
- **Sort-key injection / arbitrary field ordering** → `SortMapper` whitelist rejects unknown keys.
- **URL state drift vs. table state** → URL is the single source of truth; table reads only from `queryParamMap`, never holds independent state.
- **OFFSET cost at deep pages** for 100k rows → acceptable for this issue; deep-page/keyset optimization is out of scope.

## Migration Plan

1. Backend: repo `Pageable` overload + `SortMapper` + controller returns `PagedModel<OwnerDto>` + batch-load pets + `max-page-size=20`. TDD.
2. Regenerate OpenAPI frontend types; commit the regen.
3. Frontend: migrate `owner-list` to `mat-table`/`matSort`/`mat-paginator`, wire `queryParamMap` ↔ table state, update `OwnersModule` + `owner.service.ts`.
4. Playwright e2e: header toggle, paginator, 5/10/20 selector, URL-state round-trip.
5. Post the design summary as a comment on issue #25.

Rollback: revert the commit(s); the change is additive to one endpoint and one screen with no schema migration.

## Open Questions

None — all design questions (Q1–Q11 + fast-forwarded recommendations) were resolved in the issue #25 grill-me session.
