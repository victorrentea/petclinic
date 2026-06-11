## Why

The Owners list loads **all** matching owners into memory (`OwnerRepository.findByLastNameStartingWith` returns a plain `List`) and renders them in one unpaged Bootstrap table. At the target scale of ~100,000 owners (by ~June 2027) this is unusable and violates the project's "never load all owners in memory" rule. Users need to sort and page through owners; the DB must do the work.

## What Changes

- Add **server-side pagination** to the Owners endpoint: `GET /api/owners?lastName=&page=&size=&sort=` returns one page plus total count.
- Wrap the response in **`PagedModel<OwnerDto>`** (metadata nested under `page`). **BREAKING**: the endpoint no longer returns a bare `List<OwnerDto>`; clients read `resp.page.totalElements` etc.
- Add **server-side sorting** restricted to **Name and City** via a `SortMapper` whitelist that rewrites a logical sort key into an entity `ORDER BY` chain with always-ASC tiebreakers (Name → `lastName, firstName, id`; City → `city, lastName, firstName, id`). Unknown sort keys are rejected.
- Cap page size at **20** (`spring.data.web.pageable.max-page-size=20`); UI offers 5 / 10 (default) / 20.
- Avoid N+1 / in-memory pagination: page owners **without** fetching pets, then **batch-load** pets for the page.
- Migrate the frontend `owner-list` from the Bootstrap `*ngFor` table to **Angular Material** `mat-table` + `matSort` + `mat-paginator`, with **URL query params** (`page/size/sort/lastName`) as the source of truth.
- **Display change**: the Name cell switches from `firstName lastName` to **`lastName, firstName`** so the visible order matches the Name sort key.
- Regenerate the OpenAPI frontend types (`PagedModel`) and commit the regen.

## Capabilities

### New Capabilities
- `owners-list`: Listing owners with server-side filtering (last-name prefix), sorting (whitelisted columns with stable tiebreakers), and pagination (page/size with a server-enforced max), returned as a paged envelope and rendered with sortable headers, a paginator, a page-size selector, and URL-persisted state.

### Modified Capabilities
<!-- None — no existing specs in openspec/specs/. -->

## Impact

- **Backend**: `OwnerRestController.listOwners`, `OwnerRepository`, new `SortMapper`, owner→pets batch loading, `application.properties` (`max-page-size`).
- **API contract**: response shape changes to `PagedModel<OwnerDto>` (regenerated OpenAPI types).
- **Frontend**: `owner-list.component.{ts,html}`, `owner.service.ts`, `OwnersModule` (new Material module imports), generated API client.
- **Tests**: backend unit tests (sort-key translation, tiebreaker order, filtered count, size-cap clamp); Playwright e2e (header toggle, paginator, 5/10/20 selector, URL-state round-trip).
- **Dependencies**: Angular Material (already installed at v16.2.1, currently unused).
