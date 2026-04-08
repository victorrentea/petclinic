## Context

`GET /api/owners` currently returns `List<OwnerDto>` — all owners loaded into memory in one query. At 100k+ owners this causes heap pressure and slow responses. The frontend `OwnerListComponent` fetches everything upfront and filters/displays client-side. This design replaces both with server-side pagination.

## Goals / Non-Goals

**Goals:**
- Add `page` and `size` query params to `GET /api/owners`
- Return a paginated envelope (`content`, `totalElements`, `totalPages`, `page`, `size`) instead of a flat array
- Preserve the `lastName` filter, now applied at the DB level before paging
- Update the frontend to drive pagination via Angular Material paginator
- Update `openapi.yml` to reflect the new contract

**Non-Goals:**
- Sorting by columns other than Name (`lastName`) and City
- Cursor-based pagination
- Changes to other list endpoints (vets, pets, etc.)

## Decisions

### 1. Spring `Pageable` as request parameter
Use Spring MVC's `Pageable` argument resolver (`@PageableDefault(size=20)`) rather than manual `page`/`size` params. This integrates cleanly with Spring Data JPA's `Page<T>` return type and supports future sort params without code changes.

*Alternative considered*: manual `@RequestParam int page, int size` — more explicit but redundant given Spring's built-in support.

### 2. Response envelope: Spring's `Page<OwnerDto>` directly
Return `Page<OwnerDto>` from the controller. Spring serializes it to a JSON object with `content`, `totalElements`, `totalPages`, `number` (page index), `size`, and other metadata. No custom DTO needed — eliminates the `OwnerPageDto` schema in `openapi.yml` and the mapper method.

*Alternative considered*: custom `OwnerPageDto` in `openapi.yml` — rejected as unnecessary overhead; the extra Spring metadata fields in the response are harmless for this internal API.

### 3. Sorting: Spring Pageable `sort` param, allowlist enforced in controller
Spring's `Pageable` already accepts multiple `sort` params (e.g., `?sort=lastName,asc&sort=firstName,asc`). The controller SHALL validate that only `firstName`, `lastName`, and `city` are accepted sort fields and reject any other value with `400 Bad Request`. The Name column (which displays `firstName lastName`) uses a compound sort — `firstName` as primary, `lastName` as secondary — matching the visual display order. The frontend sends two `sort` params when the Name header is clicked: `?sort=firstName,dir&sort=lastName,dir`.

*Alternative considered*: no allowlist, trust clients — rejected because arbitrary sort fields can hit unindexed columns and degrade query performance at scale.

### 4. Repository: `findByLastNameStartingWith` + `Pageable` overload
Add a `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` method alongside `Page<Owner> findAll(Pageable pageable)`. Spring Data derives both queries automatically — no custom JPQL needed.

*Alternative*: single method with nullable `lastName` + `@Query` — more complex, not necessary here.

### 5. Breaking API change — no versioning
The response shape changes from `array` to `object`. Since this is an internal project with a single known consumer (the Angular frontend, updated in the same change), no API versioning is added.

### 6. Frontend: Angular Material `MatPaginator` + `MatSort`
The existing `owners.module.ts` uses Angular Material. Add `MatPaginatorModule` and `MatSortModule`. Wire `pageIndex`/`pageSize` events to re-fetch. Make Name and City `<th mat-sort-header>` columns; on sort change, send `?sort=lastName,asc` or `?sort=city,desc` to the API. Default page size: 20, options: [10, 20, 50].

## Risks / Trade-offs

- **Breaking change** → Mitigated by updating frontend in the same PR; no external consumers known.
- **`lastName` filter resets page to 0** → Handled by resetting `pageIndex` to 0 in the component on filter change.
- **OpenAPI codegen** → `mvn clean install` must be run after `openapi.yml` changes; DTO regeneration could break compilation temporarily.

## Migration Plan

1. Update `openapi.yml` — update `listOwners` operation (no custom DTO needed)
2. Run `mvn clean install` to regenerate DTOs
3. Add paginated repository methods + update controller
4. Update frontend service + component + template
5. Run backend tests (`./mvnw test`), then frontend tests (`npm test`)
