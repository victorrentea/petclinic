## Context

The Owners page currently loads a full owner array and renders it directly in the Angular component. The backend exposes `/api/owners` with an optional `lastName` prefix filter and returns an unsorted `List<OwnerDto>`. Issue GH-25 requires pagination and sorting on the Owners grid, and repository conventions require those behaviors to be server-side because list sizes can grow very large. The agreed UX also changes the first column to display `Last name First name`, keeps the existing last-name prefix search, applies sorting and pagination to the filtered result set, and syncs grid state into the URL.

## Goals / Non-Goals

**Goals:**
- Add server-side pagination for the Owners directory with page sizes of 5, 10, and 20.
- Add server-side sorting for Name and City.
- Make Name sort mean `lastName` then `firstName`, with the UI rendering `Last name First name`.
- Preserve filter, page, page size, and sort in URL query parameters.
- Normalize invalid URL state to safe defaults so the page still renders predictably.

**Non-Goals:**
- Adding new search fields beyond the existing last-name prefix filter.
- Making the Pets column sortable.
- Introducing live search, infinite scroll, or client-side data-table behavior.
- Changing owner detail, add, or edit flows beyond links reached from the grid.

## Decisions

### 1. Extend the Owners API contract instead of paging client-side
The backend will accept filter, page, page size, sort field, and sort direction, and it will return one page of owners plus total count metadata. This follows the repository rule that large grids must page and sort on the server.

**Alternatives considered**
- **Client-side pagination and sorting**: rejected because it does not scale and conflicts with repository guidance.
- **Separate count endpoint plus paged list endpoint**: rejected because the page metadata belongs to the same filtered query and should stay consistent in one response.

### 2. Use Spring Data pagination and mapped sort fields
The repository layer will expose a pageable query for owner search. The REST layer will translate UI sort keys into an allowlisted backend sort definition:
- `name` → `lastName`, then `firstName`
- `city` → `city`

Any invalid sort field or direction will be normalized to the default `name asc`. This keeps URL state shareable without making bad links fatal.

**Alternatives considered**
- **Pass raw property names from the UI**: rejected because it couples the public API to persistence fields and makes invalid values harder to control.
- **Sort by rendered full-name text**: rejected because the business chose last-name-first semantics with an explicit tie-breaker.

### 3. Introduce a dedicated paged DTO instead of overloading the existing array response
The list endpoint will return a response object with `items`, `page`, `pageSize`, `totalItems`, `totalPages`, `sort`, and the active `lastName` filter. This makes the contract explicit and keeps the frontend from inferring pagination state from ad hoc headers.

**Alternatives considered**
- **Reuse plain `OwnerDto[]` and expose totals in headers**: rejected because it makes the Angular code and generated API types harder to reason about.
- **Return Spring’s `Page` shape directly**: rejected in favor of a small purpose-built DTO that avoids leaking framework details into the external contract.

### 4. Make the Angular component URL-driven for grid state
The Owners list component will read query params on startup and react to query-param changes. User interactions (search submit, header click, page change, page-size change) will update the query string, and data loading will derive from the normalized query state. This makes refresh, back/forward navigation, and shared links behave consistently.

**Alternatives considered**
- **Keep state only in component fields**: rejected because the agreed behavior requires URL persistence.
- **Write directly to component state first, then mirror to URL**: rejected because it creates duplicate sources of truth.

### 5. Keep only the business-approved sortable fields
The grid will expose sorting only for Name and City. Address, Telephone, and Pets remain informational columns. This keeps the UI aligned with the narrowed business scope and avoids backend/API complexity for fields that are not meant to drive browsing.

**Alternatives considered**
- **Keep all owner fields sortable**: rejected after business feedback narrowed the useful sortable columns.
- **Hide non-sortable columns**: rejected because Address and Telephone remain useful display data even without sorting.

### 6. Reset or clamp page indices based on the type of state change
When filter, sort, or page size changes, the frontend will navigate to page 1 before requesting data. When the URL points to an out-of-range page for the current filtered result set, the backend will still return valid metadata, and the frontend will clamp by navigating to the last available page and reloading once with normalized params. This preserves a stable UX without silent empty pages.

**Alternatives considered**
- **Show empty results for out-of-range pages**: rejected because it is misleading when matching data exists on earlier pages.
- **Raise an error for invalid page numbers**: rejected because URL normalization is the agreed behavior.

## Risks / Trade-offs

- **[API contract change]** → The Owners list response shape will change from array to paged object. Mitigation: update generated types and all affected frontend callers in the same change.
- **[URL normalization loops]** → Query-param normalization can trigger duplicate navigations. Mitigation: normalize once, compare against the current param state, and only navigate when the canonical state differs.
- **[Sorting by joined data]** → The Pets column is displayed but intentionally excluded from sorting to avoid heavier query logic and ambiguous behavior. Mitigation: keep the UI explicit about which headers are sortable.
- **[Page clamping after data load]** → A stale shared URL can require one corrective navigation. Mitigation: clamp only when needed and reuse returned metadata to avoid repeated retries.
