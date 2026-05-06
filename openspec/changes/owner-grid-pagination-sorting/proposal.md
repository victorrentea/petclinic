## Why

The owner list currently loads all records at once without pagination or sorting, making it unusable at production scale (100k+ owners). Users also cannot sort by name or city, and cannot share a filtered/sorted/paged view via URL.

## What Changes

- Owner list API gains server-side pagination and sorting support
- Frontend owner grid gains pagination controls, sort headers, and URL-based state
- Search resets to page 1 on query change
- All grid state (search term, page, page size, sort column, sort direction) is reflected in the URL query string

## Capabilities

### New Capabilities

- `owners-page`: Paginated and sortable owner grid — configurable page sizes [5, 10, 25], navigation controls (first/prev-2/prev/next/next+2/last), "records X-Y of Z" display, sortable Name and City columns with 🔼/🔽 icons (DB-level sort by full name as displayed), and all state (search, page, pageSize, sort, direction) persisted in URL query params for shareable links

### Modified Capabilities

## Impact

- **Backend**: `GET /api/owners` endpoint gains `page`, `size`, `sort`, `direction` query params; returns `Page<OwnerSummary>` with total count
- **Frontend**: `owner-list` component refactored to manage pagination/sorting state via Angular `ActivatedRoute` query params
- **DB**: Sort by `CONCAT(first_name, ' ', last_name)` and `city`; Spring Data `Pageable` used
