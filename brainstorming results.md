# Brainstorming Results: Issue #25 — Sorting & Pagination on Owners Screen

## Decisions

### Sorting
- **Where**: database-level (`ORDER BY`)
- **Sortable columns**: Name and City only
- **Name sort fields**: `firstName ASC, lastName ASC` (tiebreaker) — matches visual display order `"firstName lastName"`
- **Default on load**: sorted by `firstName ASC`; Name column shows ▲ indicator
- **Toggle behavior**: 2 states only — ASC ↔ DESC (no "unsorted" third state)

> **Business review needed**: sorting Name by `firstName` then `lastName` deviates from conventional surname-alphabetical order. See [GitHub comment](https://github.com/victorrentea/petclinic/issues/25#issuecomment-4601069276).

### Pagination
- **Where**: server-side
- **Response format**: Spring's `Page<OwnerDto>`
- **Query params**: Spring default (`?page=0&size=10&sort=firstName,asc`)
- **Page sizes**: 5, 10 (default), 20
- **New search resets to page 0**, preserving sort

### State
- Persisted in URL query params (`?lastName=...&page=...&size=...&sort=...`)

---

## Implementation Plan

### Backend
- `OwnerRepository`: add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` — keep minimal `Repository` interface
- `OwnerRestController.listOwners`: add `Pageable pageable` param with `@PageableDefault(sort = "firstName", direction = ASC, size = 10)`; return `Page<OwnerDto>` via `page.map(ownerMapper::toOwnerDto)`
- Sort field names: `firstName` / `city` (JPA field names)

### Frontend
- Add `MatSortModule` + `MatPaginatorModule`
- `mat-sort` on table with `matSortActive="firstName"` and `matSortDirection="asc"` as defaults
- `mat-paginator` with `[pageSizeOptions]="[5, 10, 20]"` and `pageSize="10"`
- On sort/page change: `Router.navigate([], { queryParams: { lastName, page, size, sort } })`
- On search: same navigate but force `page: 0`
- On init: read `ActivatedRoute.queryParams` and trigger API call

### Testing
- Backend: `@DataJpaTest` verifying paginated + sorted query returns correct slice and total
- Frontend: component test mocking HTTP, verifying URL params are set on sort/page change
