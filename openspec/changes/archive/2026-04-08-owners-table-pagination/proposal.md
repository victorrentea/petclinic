## Why

The `GET /api/owners` endpoint currently loads all owners from the database into memory, which is unsustainable at production scale (100k+ owners). The frontend owners table needs server-side pagination to display large datasets efficiently without degrading performance.

## What Changes

- `GET /api/owners` gains `page` and `size` query parameters for pagination
- `GET /api/owners` gains a `sort` query parameter; supported sort fields are `lastName` (Name column) and `city`
- Response changes from a flat array to a paginated envelope with `content`, `totalElements`, `totalPages`, `page`, and `size`
- The existing `lastName` filter continues to work, now applied before pagination
- Frontend owners table switches from client-side to server-side pagination, sending page/size to the API
- Name and City column headers become clickable sort toggles (asc/desc)

## Capabilities

### New Capabilities

- `owner-list-pagination`: Paginated and sortable listing of owners with optional `lastName` filter, returning a paginated envelope instead of a flat list

### Modified Capabilities

<!-- No existing specs to modify -->

## Impact

- **Backend API**: `GET /api/owners` response shape changes — breaking change for any consumer expecting a flat array
- **OpenAPI spec**: `openapi.yml` must be updated to reflect new request params and response schema
- **Backend**: `OwnerRepository` needs paginated query methods; `OwnerRestController.listOwners` updated to use `Pageable`
- **Frontend**: `OwnersListComponent` must use Angular Material paginator + sortable column headers, calling the API with `page`/`size`/`sort` params
- **Frontend service**: `OwnerService` updated to pass pagination params and parse paginated response
