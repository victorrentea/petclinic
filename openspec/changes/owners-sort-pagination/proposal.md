## Why

The owners list currently loads all results at once and offers no sorting, making it hard to navigate as the dataset grows. Pagination and column sorting are standard UX expectations for tabular data.

## What Changes

- Backend exposes a paginated, sorted query for owners filtered by last name
- REST API returns `Page<OwnerDto>` with total count metadata
- Frontend owners table gains sortable columns (Name, City) and a paginator
- URL query params (`page`, `size`, `sort`, `lastName`) drive navigation state, enabling shareable/bookmarkable searches

## Capabilities

### New Capabilities

- `owners-sort-pagination`: Paginated and sorted owner list with URL-driven state (page, size, sort, lastName filter)

### Modified Capabilities

<!-- No existing spec-level behavior changes -->

## Impact

- **Backend**: `OwnerRepository` gets a new `findByLastNameStartingWith(String, Pageable)` method; `OwnerController` search endpoint changes response type from `List<OwnerDto>` to `Page<OwnerDto>`
- **Frontend**: `OwnersComponent` gains `MatSortModule`, `MatPaginatorModule`, `ActivatedRoute`, and `Router` dependencies; HTTP call moves to a reactive query-param-driven flow
- **API contract**: Response body shape changes — callers currently consuming a plain array will need to read `.content[]`
