## Context

Today `GET /api/owners` returns the full `List<OwnerDto>`; the Owners grid is a Bootstrap 3 table with no sort or paging and loads every row. The DB schema is owned by **Flyway** (`V1..V8`, `ddl-auto=none`); `owners` has only a PK index and the DB collation is **`C`**. Angular Material 16.2.1 is already a dependency but unused for tables, and the frontend consumes **generated** OpenAPI types (`generated/api-types.ts`). Production is planned to grow to **thousands of owners within months**, so loading all rows is not acceptable — a project rule now mandates server-side paginate/sort/filter for list endpoints.

## Goals / Non-Goals

**Goals:**
- Server-side pagination + sorting + last-name filtering for owners in a single composed request.
- Migrate the Owners grid to Material `mat-table` + `matSort` + `mat-paginator`, styled to match the existing Bootstrap look.
- Stable, documented API contract (`OwnerPageDto`) that regenerates cleanly into `openapi.yaml` and `api-types.ts`.
- URL query params as the source of truth for list state.
- Indexing that supports the planned scale.

**Non-Goals:**
- Vets/Pets grids (Owners only).
- Making the last-name search case-insensitive (stays `startingWith`).
- A generic reusable grid component.

## Decisions

- **Server-side over client-side.** Chosen because owners will reach thousands; client-side would ship every row. Alternative (in-browser `MatTableDataSource`) rejected as it violates the scale rule.
- **Change `GET /api/owners` in place (BREAKING) rather than add a new endpoint.** Keeps one always-paginated list endpoint; a parallel non-paginated endpoint would keep a "load all rows" path that contradicts the scale rule. Cost: update all consumers.
- **Custom slim `OwnerPageDto` envelope** (`content`, `totalElements`, `page`, `size`, `totalPages`) over raw `Page`/`PageImpl` (Spring warns its JSON is unstable) or `PagedModel` (nested `page.*`, less OpenAPI control). A concrete DTO (not a Java generic) keeps `openapi.yaml`/type-gen clean and gives `MatPaginator` `length = totalElements` directly.
- **Sort whitelist `{lastName, firstName, city}`.** The `matSort` "name" column maps to `sort=lastName,{dir}&sort=firstName,{dir}`; "city" maps to `sort=city,{dir}`. Only Name and City are sortable because the data shows Address is ~unique free-form (house-number prefixes) and Telephone is NULL-bearing mixed-format international numbers — neither has meaningful order. Whitelisting also prevents arbitrary/injection sort keys.
- **Repository:** `OwnerRepository.findByLastNameStartingWith(String, Pageable): Page<Owner>`, mapped to `OwnerPageDto` in the controller. `@PreAuthorize` unchanged.
- **URL-state:** `(sortChange)`/`(page)`/search navigate via `Router` with merged query params; a single `load()` rebuilds the request from `ActivatedRoute.queryParams`.
- **Indexes via Flyway `V9`:** `idx_owners_last_name_first_name (last_name, first_name)` serves both the default sort and the `LIKE 'prefix%'` filter (usable on a plain btree because the DB collation is `C`); `idx_owners_city (city)` serves the city sort. Placed in Flyway, not a JPA `@Index`, since Flyway owns the schema.
- **Styling per frontend-ux:** replicate Bootstrap header/zebra/cell borders, `table-layout: fixed` with explicit per-column widths (prevents reflow on sort toggle), reuse `.btn-default`, `white-space: nowrap` on buttons/labels.

## Risks / Trade-offs

- **Breaking API shape** → Mitigation: update every consumer in the same change (frontend service + generated types, backend/functional/perf/security tests, chatbot `AssistantFlowTest`, Playwright), regenerate `openapi.yaml` via `OpenApiExtractorTest`.
- **Mixing Material into a Bootstrap app looks off** → Mitigation: apply the frontend-ux consistency CSS; treat "indistinguishable from sibling screens" as acceptance.
- **`OFFSET`-based paging degrades on deep pages at scale** → Accepted for now (UI offers small pages); keyset pagination is a future option.
- **Two-field "name" sort vs single `matSort` active column** → Mitigation: map the single active "name" header to the two-key sort in the request builder.

## Migration Plan

1. Backend: `OwnerPageDto` + controller `Pageable` + repository signature + sort whitelist; Flyway `V9` indexes.
2. Regenerate `openapi.yaml` (`OpenApiExtractorTest`), then regenerate frontend `api-types.ts`.
3. Frontend: `owner.service.ts` (params + `PageDto`), `owner-list` component to `mat-table`/`matSort`/`mat-paginator` with URL-state, consistency CSS, fix the invalid nested-`<tr>` Pets cell.
4. Update broken tests (backend, chatbot, Playwright); run the full suite.
- **Rollback:** revert the change commit; `V9` indexes are additive and safe to drop (`DROP INDEX`).

## Open Questions

- Exact per-column widths (needs a quick visual pass).
- Confirm indexes (D11) are wanted now vs deferred until closer to the scale event.
