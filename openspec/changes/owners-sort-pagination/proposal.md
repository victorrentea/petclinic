## Why

The Owners screen loads the **entire** owners table into memory and the browser on every visit. In production that table holds ~1,000,000 rows, so the current `GET /api/owners` (unbounded `List<OwnerDto>`) is a latency and memory hazard, and the grid offers no way to sort or page through the data. GitHub issue #25 asks for a sortable, paginated Owners grid.

## What Changes

- **BREAKING**: `GET /api/owners` changes its response from an unbounded JSON array to a paginated `Page<OwnerDto>` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`).
- Add server-side pagination: `page` (default 0) and `size` (whitelisted to **{5, 10, 20}**, default 10).
- Add server-side sorting via a whitelisted `sort` key (**{`name`, `city`}**, default `name`) plus `dir` (**{`asc`, `desc`}**, default `asc`). `name` sorts by `(lastName, firstName)`; every sort is tie-broken by `id` for deterministic paging.
- Render the Name column as `Last, First` (directory style) so the displayed order matches the last-name sort (fixes the current `First Last` display / sort mismatch).
- Sorting and the existing last-name search become **case-insensitive** (`lower(...)`), backed by new functional DB indexes.
- Reject out-of-whitelist `size`/`sort`/`dir` with **400 Bad Request** (closes a DoS vector: unindexed sorts / `size=1000000` on a 1M-row table).
- Frontend Owners grid moves to Angular Material `MatTable` + `MatSort` + `MatPaginator`, wired to the server params; changing sort or search resets to page 0. Only Name and City headers are sortable.
- New Flyway migration adds `lower(last_name, first_name)` and `lower(city)` functional indexes and drops the redundant raw `owners_last_name_first_name_idx` / `owners_city_idx`.

## Capabilities

### New Capabilities
- `owners-listing`: Server-side paginated, sorted, case-insensitively searchable listing of owners exposed by `GET /api/owners` and rendered by the Owners grid.

### Modified Capabilities
<!-- None: there is no existing spec for owners listing; this introduces the first one. -->

## Impact

- **API** (BREAKING): `GET /api/owners` response shape and query params. Regenerates `openapi.yaml` (OpenApiExtractorTest drift gate) and the frontend `api-types.ts`.
- **Backend**: `OwnerRestController.listOwners`, `OwnerRepository` (paged case-insensitive query), `@BatchSize` on `Owner.pets` to avoid N+1 without a fetch-join (fetch-join + `Pageable` would paginate in memory — fatal at 1M rows).
- **Database**: new migration `V10` — add two `lower(...)` functional indexes, drop two redundant raw indexes (plain DDL; `CONCURRENTLY` deadlocks Flyway's migration lock, so prod zero-downtime builds run it out-of-band).
- **Frontend**: `owner-list.component`, `owner.service` (`getOwners`/`searchOwners` collapse into one paged call), reuse of the existing `OwnerPage` interface, new Angular Material module imports.
- **Tests**: `OwnerSearchThroughLatencyProxyTest` (array → `$.content`), functional `owners.feature`/`OwnerSteps`, `OwnerTest`; new tests for paging, sort order, tiebreaker, case-insensitivity, and whitelist 400s.
- **Not affected**: MCP (`PetClinicMcp` uses `findByIdFetchingPets`, not the list) and `DomainModel.puml` (no entity-shape change).
