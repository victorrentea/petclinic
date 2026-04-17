## Why

Users in distant geographies (e.g., Thailand connecting to EU servers) experience high latency when navigating the owners list. Loading all owners at once increases payload and time-to-interact; lack of sorting forces users to manually scan for records. Pagination with pre-fetching reduces perceived latency, and server-side sorting improves usability at scale.

## What Changes

- `GET /owners` now accepts `page`, `size`, and `sort` query parameters and returns a paginated `Page<OwnerDto>` instead of a flat `List<OwnerDto>`. **BREAKING** (response shape changes)
- Owners can be sorted by `firstName`/`lastName` (combined Name column) and `city`; default sort is `firstName ASC, lastName ASC`
- Frontend calculates page size dynamically from the available viewport height (no scrollbar)
- On resize (debounced), the frontend resets to page 1 and clears the page cache
- Frontend pre-fetches next and previous pages immediately after rendering the current page; pages beyond ±1 from current are evicted from cache
- Pagination controls show: current page number, total pages, previous/next buttons
- Sortable column headers show sort direction indicator; clicking toggles ASC → DESC → ASC

## Capabilities

### New Capabilities

- `owner-pagination`: Server-side pagination of the owners list via Spring Data `Pageable`; backend returns `Page<OwnerDto>` with metadata (`totalElements`, `totalPages`, `number`, `size`)
- `owner-sorting`: Sort owners by Name (`firstName, lastName`) or City via `sort` query param; default on page load is Name ASC
- `owner-prefetch`: Angular `OwnerPaginationService` manages a page cache (Map keyed by page number), pre-fetches adjacent pages immediately after current page renders, and evicts pages beyond ±1 from current page; cache is invalidated on sort/filter/resize changes

### Modified Capabilities

<!-- No existing specs to modify -->

## Impact

- **Backend:** `OwnerRestController.listOwners` signature changes (returns `Page<OwnerDto>`); `OwnerRepository` extends `PagingAndSortingRepository` or equivalent; `searchByText` gains `Pageable` overload
- **API contract:** Response body for `GET /owners` changes from array to page object — a breaking change; `openapi.yaml` must be updated
- **Frontend:** `OwnerService.getOwners()` returns `Observable<OwnerPage>`; new `OwnerPaginationService` encapsulates cache, pre-fetch, and resize logic; `OwnerListComponent` delegates to the service and renders pagination controls
- **Tests:** Existing backend tests for `listOwners` need updating; new unit tests for `OwnerPaginationService` cache/eviction logic
