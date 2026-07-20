## Why

The Owners screen loads **every** owner in one unsorted Bootstrap table (`GET /api/owners` returns the full array). With thousands of owners planned in production within months, this does not scale and offers no way to sort or page. Issue #25 asks for a grid that is sortable and paginated in pages of 5/10/20.

## What Changes

- **BREAKING** `GET /api/owners` becomes paginated: it accepts `page`, `size`, `sort`, and the existing `lastName` filter, and returns a `PageDto` envelope (`{ content, totalElements, page, size, totalPages }`) instead of a bare `OwnerDto[]`.
- Server-side pagination + sorting via Spring Data `Pageable`; sorting is restricted to a whitelist of **`lastName`, `firstName`, `city`** (other sort keys rejected).
- The `lastName` search is preserved as a server-side filter that composes with paging/sorting and resets to page 0 on a new search.
- Owners grid migrates from the Bootstrap table to Angular Material **`mat-table` + `matSort` + `mat-paginator`**, styled to match the surrounding Bootstrap look (page-size options 5/10/20, default 10; default sort Name ascending).
- The **Name** column is corrected to display `lastName firstName` (as `"Franklin, George"`); only **Name** and **City** are sortable (Address, Telephone, Pets are not — they carry no meaningful order).
- List state (`page`/`size`/`sort`/`lastName`) lives in the **URL query params** as the source of truth (deep-linkable, back/forward/refresh safe).
- New Flyway migration `V9` adds indexes on `owners(last_name, first_name)` and `owners(city)` for scale.
- Regenerate `openapi.yaml` and the frontend generated `api-types.ts` from the new contract.

## Capabilities

### New Capabilities
- `owners-listing`: server-paginated, sortable, filterable listing of owners exposed by the REST API and rendered by the Owners grid (pagination, sort whitelist, lastName filter, URL-state, page-size options, response envelope).

### Modified Capabilities
<!-- None — openspec/specs/ is empty; no existing spec-level behavior to modify. -->

## Impact

- **API (breaking):** `GET /api/owners` response shape (`OwnerDto[]` → `OwnerPageDto`); new query params `page`/`size`/`sort`. Consumers to update: frontend `owner.service.ts` + generated `api-types.ts`, backend tests (`OwnerTest`, functional `owners.feature`/`OwnerSteps`, perf `OwnerSearchThroughLatencyProxyTest` + jmeter, `BasicAuthenticationConfigTest`), `petclinic-chatbot` `AssistantFlowTest`, `petclinic-ui-test` Playwright (`OwnersPage.ts`, `api-client.ts`). MCP (`PetClinicMcp`) is unaffected (uses the repository directly).
- **Backend:** `OwnerRestController.listOwners`, new `OwnerPageDto`, `OwnerRepository.findByLastNameStartingWith(String, Pageable)`, Flyway `V9`, regenerated `openapi.yaml`.
- **Frontend:** `owner-list` component (`.ts`/`.html`/`.css`), `owner.service.ts`, `owners.module.ts` (Material modules), regenerated `generated/api-types.ts`.
- **DB:** two new indexes (no-op at 28 rows, correct for the planned scale).
- **Scope:** Owners grid only (not Vets/Pets).
