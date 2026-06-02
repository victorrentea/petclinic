## Context

The owners list (`GET /api/owners?lastName=`) currently returns a plain `List<OwnerDto>` with no pagination or ordering. The frontend `OwnerListComponent` performs two separate HTTP calls (`getOwners()` / `searchOwners(lastName)`) and holds all results in memory. There is no URL-driven state, so the page/sort position is lost on navigation.

Architecture note: no service layer exists — controllers call repositories directly (MapStruct mappers handle entity↔DTO conversion).

## Goals / Non-Goals

**Goals:**
- Add paginated, sorted query to `OwnerRepository` via Spring Data `Pageable`
- Change `GET /api/owners` to return `Page<OwnerDto>` (includes `content`, `totalElements`, `totalPages`, `number`, `size`)
- Synchronize frontend sort/page/filter state to URL query params (`lastName`, `page`, `size`, `sort`)
- Render sort indicators (▲/▼) and a paginator on the owners table

**Non-Goals:**
- Server-side multi-column sort
- Persistent user preferences (page size)
- Changing the owners detail, edit, or add flows

## Decisions

### Keep existing `findByLastNameStartingWith(String)` and add a Pageable overload

Spring Data resolves method overloads by parameter type, so both signatures coexist without conflict. Callers not needing pagination (e.g. MCP resource) continue using the non-pageable version unchanged.

Alternative considered: replace the existing method → breaks other callers, unnecessary churn.

### Return `Page<OwnerDto>` directly from the controller

`Page<OwnerDto>` serialises to JSON with `content`, `totalElements`, `totalPages`, `number`, and `size` — everything the frontend paginator needs. Using `page.map(ownerMapper::toOwnerDto)` keeps the mapping in one line.

Alternative considered: wrap in a custom DTO → extra boilerplate, no benefit here.

### URL-driven state via `Router.navigate` + `ActivatedRoute.queryParams`

Encoding `page`, `size`, `sort`, and `lastName` as query params makes the page bookmarkable and enables browser back/forward to restore pagination position. The component subscribes to `queryParams` changes and triggers the HTTP call reactively.

Alternative considered: component-local state → loses position on navigation, not shareable.

### `@PageableDefault(sort = "firstName", direction = ASC, size = 10)`

Matches the default frontend sort indicator (`matSortActive="firstName"`) so the first load is visually consistent. `size = 10` matches the paginator default.

### Sort field names: `firstName` and `city`

These are JPA field names on `Owner`. Spring Data translates them directly to SQL `ORDER BY` clauses — no custom query required.

## Risks / Trade-offs

- **API breaking change**: response body changes from `Owner[]` to `{ content: Owner[], totalElements, ... }`. → The Angular service's `getOwners()` / `searchOwners()` methods must be updated; the TypeScript `Owner` model is unaffected.
- **MCP resource uses the non-pageable overload** — it won't be touched, but any new caller must choose the right overload.
- **Frontend test complexity**: `ActivatedRoute` and `Router` require test doubles; use `RouterTestingModule` + a stub `ActivatedRoute`.
