## Why

The Owners screen loads the entire owner table into the browser and renders it as one
unbounded list. At production scale (~100k owners) this is unusable: the page is slow,
unsortable, and there is no way to navigate the result set. Operators need to sort by any
column and page through results so the list stays fast and findable regardless of table size.

## What Changes

- **BREAKING** `GET /api/owners` returns a paginated, sortable result (Spring `Page` JSON
  shape: `content`, `totalElements`, `totalPages`, `number`, `size`) instead of a bare
  `List<OwnerDto>`. New query params: `page` (0-based), `size`, `sort` (`field,dir`).
- Sorting and paging are applied **at the database level** (never load all owners in memory),
  and compose with the existing `q` cross-column search param.
- Sortable columns: Name and City only. Sorting by Name orders by first name, then last name
  (to match the on-screen "First Last" display). Address, Telephone, and Pets are not sortable
  (Pets is a derived collection; Address/Telephone are excluded by product decision).
- Frontend Owners list gains clickable column headers that toggle ascending/descending and
  show a direction indicator, plus pagination controls below the table.
- Page-size selector offering 5, 10 (default), or 20 rows per page.
- Regenerate the affected contract/drift artifacts (`openapi.yaml`, `api-types.ts`).

## Capabilities

### New Capabilities
- `owner-list-sort-pagination`: server-side sorting, pagination, and page-size selection for
  the Owners list — covering the REST contract (params + paged response shape), the database
  query behavior, and the Owners-screen UI controls. Composes with existing owner search.

### Modified Capabilities
<!-- No existing specs in openspec/specs/; owner search/list behavior is not yet captured as a
     spec, so this is introduced as a new capability rather than a delta. -->

## Impact

- **Backend**: `OwnerRestController.listOwners` (return type + new `page`/`size`/`sort` params),
  `OwnerRepository.searchOwners` (accept `Pageable`, return `Page<Owner>`), `OwnerMapper`
  (map a `Page<Owner>` → paged `OwnerDto` response).
- **API contract**: `GET /api/owners` response shape changes (breaking) → `openapi.yaml`
  regenerated; downstream `petclinic-frontend/src/app/generated/api-types.ts` regenerated.
- **Frontend**: `owner-list.component.{ts,html}`, `owner.service.ts` (`getOwners`/`searchOwners`
  take page/size/sort and return `OwnerPage`); the existing `OwnerPage` model is now used.
- **Drift/guardrails**: `OpenApiExtractorTest` + TS-regen gates fire; `openapi.yaml` is
  CODEOWNERS-sensitive. No DB schema migration (read-only feature; `DB.sql` unchanged).
- **Consumers of the list endpoint**: any other client of `GET /api/owners` expecting a JSON
  array must adapt to the paged envelope.
