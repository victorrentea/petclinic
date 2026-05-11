## Why

Owner search currently filters only by last name prefix, making it hard to find owners by first name, city, phone, or pet name. With 100k+ owners, the UI needs a single, fast, case-insensitive contains search across all visible fields, with server-side pagination and sorting.

## Database

- Add Flyway migration (V4) with `pg_trgm` GIN indexes on owners and pets tables for Postgres performance at scale

## Backend

- Replace `?lastName=X` query parameter with `?q=term` on `GET /api/owners`
- Query searches across `firstName`, `lastName`, `city`, `address`, `telephone`, and pet names (case-insensitive, contains match)
- Add server-side pagination: `?page=0&size=20` parameters; response wrapped in a page envelope (content + totalElements)
- `size` must be one of `[5, 10, 20]` — backend validates and rejects other values with `400 Bad Request`
- Add server-side sorting: `?sort=name&dir=asc` parameters (sortable by name, city)
- **API contract: BREAKING** — `?lastName=X` removed; `?q`, `?page`, `?size`, `?sort`, `?dir` introduced

## Frontend

- Replace the dedicated "Last name" input with a single "Search..." input with live debounce (300ms); use `switchMap` to cancel in-flight requests when a new search is triggered (prevents out-of-order response race conditions)
- Owner list grid gains sortable Name and City columns — clicking header triggers server-side re-fetch
- Add pagination controls below the grid (prev/next, page indicator, page size selector: 5/10/20)

## Capabilities

### New Capabilities
- `owner-search`: Single-field, case-insensitive contains search across all owner and pet fields, with server-side pagination and sorting, replacing the legacy last-name-only filter
