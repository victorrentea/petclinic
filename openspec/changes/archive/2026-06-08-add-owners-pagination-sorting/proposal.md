## Why

The Owners list screen loads **all** owners into memory and renders them in a single unsorted table. In production the `owners` table holds hundreds of thousands of rows, so this is both a performance/memory hazard and an unusable UX. Users need to sort and page through owners with the work pushed down to the database.

## What Changes

- **BREAKING (API response shape):** `GET /api/owners` returns a paged `Page<OwnerDto>` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) instead of a bare `List<OwnerDto>`. Accepts `page`, `size`, `sort`, and `lastName` query params.
- **Server-side paging + sorting at the DB level** via Spring Data `Pageable`; the paged root query stays collection-free and pets are loaded lazily + batched (`@BatchSize(20)`).
- **Sortable columns:** Name and City only. Name displays *last name first* ("Carter Adam") and sorts by `lastName,firstName`; an `id` tiebreaker is always appended for deterministic paging. Address / Telephone / Pets are display-only.
- **Sort whitelist** `{lastName, firstName, city}`, default `lastName asc`; invalid sort falls back to `lastName asc` (no 500). `default-page-size=10`, `max-page-size=20`.
- **Frontend:** Angular Material `MatPaginator` (first/prev/next/last + "Showing X–Y of Z", no numbered buttons), page-size selector 5 / 10 / 20, clickable sortable headers with two-state asc↔desc toggle.
- **URL sync:** `page` / `size` / `sort` / `lastName` reflected in query params so refresh, Back, and shared links preserve the view. Changing search / sort / page size resets to page 0; out-of-range page clamps to the last valid page; zero results show "No owners found" with the paginator at 0 of 0.
- Regenerate the frontend API types from the updated `openapi.yaml` to reflect the paged shape.

## Capabilities

### New Capabilities
- `owners-list`: Listing, searching (by last-name prefix), server-side sorting, and pagination of owners on the Owners screen — covering both the REST contract and the Angular UI behavior.

### Modified Capabilities
<!-- None — no existing specs under openspec/specs/. -->

## Impact

- **Backend:** `OwnerRestController.listOwners` (return type + params), `OwnerRepository` (new `Pageable` query / sort whitelist handling), `Owner` entity (`@BatchSize` on `pets`), `application.properties` (default/max page size), `openapi.yaml`.
- **Frontend:** `owner-list.component.{ts,html,css}`, `owner.service.ts`, reuse existing `owner-page.ts`, `owners.module.ts` (wire Angular Material `MatPaginatorModule`), regenerate `generated/api-types.ts`.
- **E2E:** `petclinic-ui-test/tests/owners.spec.ts` + `pages/OwnersPage.ts` + `support/api-client.ts` updated for the paged response and new pagination/sort UI.
- **Consumers:** any client of `GET /api/owners` must adapt to the `Page` envelope (breaking).
