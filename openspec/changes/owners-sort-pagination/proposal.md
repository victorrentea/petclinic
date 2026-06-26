## Why

The Owners screen loads **every** owner into the client in one unpaginated `List<OwnerDto>`
(`GET /api/owners` → `findByLastNameStartingWith`). At the business target of ~1M owners this
exhausts memory and latency on both server and browser. We need server-side sorting, filtering,
and pagination so the client only ever transfers one page of rows. Issue #25.

## What Changes

- **`GET /api/owners` returns a page, not a list.** New `@RequestParam`s — `lastName`, `page`,
  `size`, `sort`, `direction` — drive a Spring `Page<Owner>`. **BREAKING**: response body changes
  from a JSON array to the stable Spring Data page envelope `{ content, page: { size, number,
  totalElements, totalPages } }`.
- **Stable page serialization.** Enable `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)`
  and return `PagedModel<OwnerDto>` so the runtime JSON, regenerated `openapi.yaml`, and generated
  Angular types stay in lock-step (CI fails on drift).
- **Server-side sort whitelist.** Four scalar columns sortable — Name (`last_name, first_name`),
  Address, City, Telephone. The Pets column is **not** sortable. Unknown sort key falls back to
  `name, asc` (never 500).
- **Name column displays surname-first.** The cell changes from `firstName lastName`
  ("George Franklin") to last-name-first ("Franklin, George") so the visible leading text *is* the
  sort key and a Name sort reads as sorted — consistent with the last-name search box. Confirmed
  with business.
- **No-N+1 page hydration.** Page owners scalar-only, then bulk-load each page's pets via
  `hibernate.default_batch_fetch_size`. Never `JOIN FETCH` the to-many with pagination.
- **Indexes for sort/filter at scale** — new `V9` migration adds `(last_name, first_name)`, `city`,
  `address`, `telephone`, plus a `text_pattern_ops` index so `last_name LIKE 'prefix%'` is index-backed.
- **Material grid, Bootstrap-themed.** Replace the static owners table with `mat-table` + `matSort`
  + `mat-paginator`, server-driven (`pageSizeOptions = [5,10,20]`), re-themed to match the existing
  Bootstrap screens pixel-for-pixel.
- **URL query params are the source of truth** — `?lastName=&page=&size=&sort=&direction=`; sort,
  page, and search all navigate with merged params so back/forward/refresh/deep-link work.
- **Reconcile concurrent work.** An existing `owner-page.ts` defines a *flat* `{content,
  totalElements, totalPages, number, size}` shape that contradicts the stable nested `page` envelope
  — it must be corrected, not extended.

## Capabilities

### New Capabilities
- `owners-listing`: Server-side paginated, sorted, and last-name-filtered listing of owners —
  the `GET /api/owners` contract (page envelope, sort whitelist, validation/caps, batch pet
  hydration) and the Material owners grid (server-driven paginator + sort, Bootstrap theming,
  URL-as-state).

### Modified Capabilities
<!-- None: no existing OpenSpec specs under openspec/specs/ define owners behavior yet. -->

## Impact

- **Backend:** `OwnerRestController.listOwners` (signature + return type), `OwnerRepository`
  (`Page<Owner> findByLastNameStartingWith(String, Pageable)`), `PetClinicApplication`
  (`@EnableSpringDataWebSupport`), `application.properties` (`hibernate.default_batch_fetch_size=20`),
  new `V9` Flyway migration, regenerated `openapi.yaml` (via `OpenApiExtractorTest`).
- **Frontend:** `owner-list.component.{ts,html,css}`, `owner.service.ts`, `owner-page.ts`
  (reconciled to nested `page` shape), generated API types, `owners.module.ts` (Material imports).
- **Tests:** backend MockMvc + `@DataJpaTest`; frontend component unit test; one Playwright e2e
  in `petclinic-ui-test/tests/owners.spec.ts`.
- **Contract consumers:** anything consuming the old `GET /api/owners` array response breaks and
  must move to the page envelope.
