## Context

Owner search currently uses `findByLastNameStartingWith` (prefix match, case-sensitive, last name only). The production database will have ~100k owners, so any search strategy must scale. The frontend has a dedicated "Last name" text input; the new UX wants a single search box with live results, server-side pagination, and server-side sorting.

## Non-Goals

- Full-text ranking / relevance scoring (plain contains match is sufficient)
- H2 trigram support (H2 test profile uses LIKE, indexes are Postgres-only)

---

## Database

**Goal:** `pg_trgm` GIN indexes for sub-100ms latency at 100k rows

**Flyway V4 migration**
Adding `pg_trgm` extension and GIN indexes as a migration keeps schema changes tracked and reproducible. Uses `IF NOT EXISTS` — safe to re-run.


---

## Backend

**Goals:**
- Single `?q=` parameter for case-insensitive contains search across firstName, lastName, city, address, telephone, and pet names
- Server-side pagination via `?page=0&size=20`; response is a page envelope (content + totalElements)
- Server-side sorting via `?sort=name&dir=asc` (name, city)
- `size` validated to `[5, 10, 20]` — any other value returns `400 Bad Request`

**JPQL `ILIKE '%q%'` over Postgres Full Text Search**
FTS with `tsvector` is designed for document retrieval and word stemming — not ideal for partial matches on short fields (phone, city). `ILIKE` (case-insensitive LIKE) is simpler and directly supported by `pg_trgm` GIN indexes without requiring expression indexes on `LOWER(col)`. For H2 compatibility in tests, use `LOWER(col) LIKE LOWER(:q)` via a dialect-aware query or test against Postgres only.

**EXISTS subquery for pet name search**
Pet name matching uses `EXISTS (SELECT 1 FROM Pet p WHERE p.owner = o AND LOWER(p.name) LIKE :q)` instead of `LEFT JOIN + DISTINCT`. This keeps one row per owner, so `LIMIT/OFFSET` pagination and count queries are correct by construction.

**Pagination with Spring Data `Pageable`**
Use Spring Data's `Pageable` parameter in the repository method and `Page<Owner>` return type. Controller maps `?page`, `?size`, `?sort`, `?dir` to a `PageRequest`. `size` is validated before constructing `PageRequest`.

**Risks:**
- [Blank `q`] → Return all owners (paginated); frontend always sends `q` but API allows empty
- [API breaking change] → Frontend is the only consumer; coordinated deploy, no versioning needed

---

## Frontend

**Goals:** Single search box with live results; server-side sortable Name and City columns; pagination controls with page size selector (5/10/20)

**Debounce + `switchMap`**
300ms debounce avoids hammering the API on every keystroke. `switchMap` cancels the previous in-flight request when a new search is triggered, preventing out-of-order responses from stale requests overwriting fresh results. Enter key triggers immediately.

**No search button**
The debounce replaces a button. There is no explicit "Search" button.

**Sort triggers server re-fetch**
Clicking a column header changes `?sort` and `?dir` params and re-fetches page 0. Sort state is not applied client-side.

---

## Migration Plan

1. Deploy Flyway V4 migration (adds extension + indexes) — no data changes, safe
2. Deploy new backend with `?q=`, `?page=`, `?size=`, `?sort=`, `?dir=` params (`?lastName=` no longer exists)
3. Deploy new frontend simultaneously or immediately after
