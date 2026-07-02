## Why

The Owners screen offers a single "Last name" box that hits `GET /api/owners?lastName=X` →
`OwnerRepository.findByLastNameStartingWith`: **case-sensitive**, **starts-with**, **lastName-only**,
**unpaginated**, and the frontend **loads the entire owner list into memory** on init. Issue #24 asks
for case-insensitive **contains** search across **every visible column** of the table. Because the
owners table holds **~1 million rows** (see `CLAUDE.md` → Data Volume / Scale), the current approach
is both wrong (too narrow) and unscalable (full-list loads, unindexed scans).

## What Changes

- Add a single **"Search"** box that matches, case-insensitively, a `contains` substring against every
  visible column: **Name** (`firstName + ' ' + lastName`), **Address**, **City**, **Telephone**, and
  **Pets** (pet names).
- Add a new backend query parameter **`q`** on the owners list endpoint driving the cross-column search.
- **BREAKING (frontend contract):** the frontend stops sending `lastName` and stops loading the full
  list; `lastName` stays **accepted-but-deprecated** on the API for external back-compat, mapped to the
  old starts-with behavior.
- Make the owners list endpoint **paginated** (`page`, `size`, default size 20) and return a paged
  response carrying `totalElements`; the frontend gains pagination controls and loads page 0 instead of
  everything.
- Introduce **pg_trgm GIN indexes** so `ILIKE '%term%'` stays fast at 1M rows (a plain B-tree cannot
  serve a leading-wildcard `LIKE`).
- Use a **native SQL query** whose expressions match the index expressions exactly (JPQL `concat()` ≠
  `||`, so JPQL would silently skip the trigram index).
- Frontend search is **debounced (~300 ms), min 2 chars**; empty box → first page of all owners.

## Capabilities

### New Capabilities
- `owners-search`: Case-insensitive cross-column `contains` search over the paginated owners list,
  backed by trigram indexes, exposed via the `q` parameter and server-side pagination.

### Modified Capabilities
<!-- No existing specs in openspec/specs/; nothing to modify. -->

## Impact

- **DB:** new Flyway migration `V6__owners_search_trgm.sql` — `CREATE EXTENSION pg_trgm` + five GIN
  trigram indexes (owners full-name, address, city, telephone; pets name). Test embedded Postgres must
  support `pg_trgm`.
- **Backend:** `OwnerRepository` gains a native paged `search(q, Pageable)` (+ `countQuery`);
  `OwnerController.listOwners` accepts `q`, `page`, `size` and returns a paged DTO; `lastName` kept
  deprecated. `@PreAuthorize(hasRole(OWNER_ADMIN))` unchanged.
- **Frontend:** `owner-list` component (relabel box, debounce pipeline, pagination controls, load page 0);
  `OwnerService.searchOwners(q, page, size)` and the new paged response shape.
- **API spec:** regenerate the OpenAPI document (generated output) and re-run GUARDRAILS drift checks.
- **Tests:** backend query/pagination/ordering + `pg_trgm` availability; frontend debounce/min-length/
  pagination/empty-query paths.
