# Design

## Context

See [proposal.md](proposal.md) for the motivation and the user-visible behavior, and [qa.md](../../../qa.md) for the approved decisions.

### API contract (BREAKING)
`GET /api/owners` returns a page object `{content, totalElements, totalPages, number, size}` instead of a JSON array. Query parameters:

| Param | Values | Default | Invalid → |
|---|---|---|---|
| `page` | ≥ 0 (0-based) | `0` | 400 |
| `size` | `5`, `10`, `20` | `10` | 400 |
| `sort` | `name` or `city`, then `,asc`/`,desc` | `name,asc` | 400 |
| `lastName` | last-name prefix | `""` (all) | — |

A page past the end returns 200 with empty `content` and correct totals. A 400 is a `ProblemDetail` that names the offending parameter.

### Affected code
- **Backend**: `OwnerRestController.listOwners`, `OwnerRepository`, new `OwnerPageDto`, `ExceptionControllerAdvice` (already maps `ValidationException` → 400), new Flyway migration `V4`, `application.properties` (batch fetch).
- **Contract**: regenerate `openapi.yaml` and `petclinic-frontend/src/app/generated/api-types.ts` via `OpenApiExtractorTest`.
- **Frontend**: `OwnerService`, `OwnerListComponent` (+ template), `OwnersModule` (Material paginator + sort); `owner-page.ts` already has the page shape.
- **Callers of the old array to adapt**: backend tests `OwnerTest`, `AddVisitApiTest`, `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`, `OwnerCreateTest`, `owners.feature`/`OwnerSteps`; e2e in `petclinic-test`: `add-visit.dsl.ts`, `db-fixture.spec.ts`, `owner-search.feature.glue.ts`, `add-owner.spec.ts`.
- **Not affected**: `GET /api/owners/{id}`, `/api/owners/count`, the chatbot (reads `/api/owners/{id}` only), MCP tools.

### Current state
- `OwnerRestController.listOwners` calls `OwnerRepository.findByLastNameStartingWith(lastName)` and maps the whole `List<Owner>` to DTOs.
- `OwnerDto` includes pets, and each pet includes its visits. `Owner.pets` and `Pet.visits` are `LAZY`, so today one list call already runs 1 + N + N·M queries.
- `owners.first_name`, `last_name` and `city` are `TEXT` in a database whose collation is `C.UTF-8`, and these columns have no indexes.
- `ExceptionControllerAdvice` already turns `jakarta.validation.ValidationException` into a 400 `ProblemDetail`.
- On the frontend, `owner-page.ts` already declares `OwnerPage` (unused). `OwnersModule` imports no Angular Material modules.
- Dev and tests run Zonky embedded Postgres 16.2. On macOS it has ICU (785 ICU collations, including `und-x-icu`). CI runs on Linux binaries, which have not been checked yet.

## Goals / Non-Goals

**Goals:**
- One bounded SQL page query plus one count query per request, and a bounded number of batch queries for pets and visits, whatever the table size.
- An index that can serve each supported sort and the last-name prefix filter.

**Non-Goals:**
- Keyset/cursor pagination. At about 100k rows a year, offset paging on an index is acceptable for years. Revisit if the deep pages that users actually reach become slow.
- Sorting by address, telephone or pets.
- Changing other owner endpoints, the chatbot, or the MCP tools.

## Decisions

### D1. Keep validation explicit in the controller rather than binding a Spring `Pageable`
The endpoint takes `@RequestParam int page`, `int size` and `String sort`. A small `OwnerSort` enum maps the API key (`NAME`, `CITY`) to its `Sort` (`firstName, lastName, id` / `city, firstName, lastName, id`), applying the direction to every property. An invalid `size` (not 5/10/20), a negative `page`, or an unknown sort key or direction throws `ValidationException`, which the existing advice turns into a 400.
- *Alternative*: bind `Pageable` with `@PageableDefault`. Rejected: it accepts any entity property in `sort` (and leaks the entity model into the API), clamps `size` silently instead of returning 400, and cannot express "`name` means three columns".

### D2. Return a hand-written `OwnerPageDto`
`record OwnerPageDto(List<OwnerDto> content, long totalElements, int totalPages, int number, int size)` lives in `rest/dto/`, following the convention of hand-written DTOs. It matches the existing frontend `OwnerPage`.
- *Alternative*: serialize Spring's `PageImpl`. Rejected: Spring Data warns that its JSON is unstable, it exposes `pageable`/`sort` internals, and it breaks the hand-written-DTO convention.

### D3. Repository: `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`
This replaces the `List` variant. Its only other caller is `OwnerCreateTest`, which switches to `Pageable.unpaged()`. Spring Data derives the count query. `lastName=""` matches every owner, so a single method serves both the filtered and the unfiltered list.

### D4. Load pets and visits with `hibernate.default_batch_fetch_size`
Set `spring.jpa.properties.hibernate.default_batch_fetch_size=100`. A page has at most 20 owners, and each owner has a few pets, so loading a page takes one query for its pets and one for their visits. (A value of 20 was tried first: 20 owners with 2 pets each need two visit queries, so the count grew with the page size.)
- *Alternative*: `LEFT JOIN FETCH o.pets` combined with `Pageable`. Rejected: Hibernate warns HHH90003004 and pages in memory, which defeats the point of paging.
- *Alternative*: `@EntityGraph`. Rejected for the same reason when it fetches a collection.

### D5. ICU collation on the columns, in a new versioned migration
`V4__owner_listing_collation_and_indexes.sql`:
- `ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu"` (and the same for `last_name` and `city`)
- `CREATE INDEX owners_name_idx ON owners (first_name, last_name, id)`
- `CREATE INDEX owners_city_idx ON owners (city, first_name, last_name, id)`
- `CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops)`

`und-x-icu` is deterministic, so `=` and `LIKE` keep their current semantics. Its default strength still orders `ș` next to `s` and lowercase next to uppercase. A b-tree index on a non-C collation cannot serve `LIKE 'x%'`, which is why the prefix filter gets its own `text_pattern_ops` index.
- *Alternative*: `ORDER BY ... COLLATE` only in the query. Rejected: that needs native SQL, and the index would not match the ORDER BY.
- *Alternative*: change the collation of the whole database. Rejected: larger blast radius, and it cannot be done through Flyway on an existing database.

### D6. The frontend keeps grid state in the URL
`OwnerListComponent` reads `page`, `size`, `sort` and `lastName` from `ActivatedRoute.queryParamMap`, and calls `OwnerService.getOwners(query): Observable<OwnerPage>`. Paginator, sort and search events only call `router.navigate([], {queryParams, queryParamsHandling: 'merge'})`, so the URL is the single source of truth and Back/refresh work without extra code. `page` in the URL is 1-based (a link people share reads `page=1`, never `page=0`) and is turned into the API's 0-based index on the way out. A change of sort, size or search resets `page` to 1. When `number >= totalPages > 0`, the component navigates to `totalPages` with `replaceUrl: true`. `switchMap` keeps only the latest request, which replaces today's manual `unsubscribe`. `searchOwners` is folded into `getOwners`.
- The grid stays a Bootstrap table with `matSort`/`mat-sort-header` on the Name and City `<th>`, plus a `<mat-paginator [pageSizeOptions]="[5,10,20]" [length]="totalElements">`. `MatSortModule` and `MatPaginatorModule` are added to `OwnersModule`. A full `mat-table` rewrite is not needed.

## Risks / Trade-offs

- [Zonky Linux binaries might lack ICU → V4 fails in CI] → Mitigation: task 1 is a spike that runs the migration in CI before building on it. Fallback: sort and index on `lower(unaccent(...))` expressions instead, which means revisiting Q8 with Victor.
- [BREAKING contract: an external consumer of `GET /api/owners` breaks] → Mitigation: in-repo callers are listed in the proposal and updated in the same change. No external consumer is known (the chatbot reads only `/api/owners/{id}`).
- [Offset paging slows on deep pages] → Accepted (see Non-Goals). The indexes keep it at index-scan cost.
- [`ALTER COLUMN TYPE ... COLLATE` rewrites the table and its indexes] → Negligible at today's size. Run it before data grows.
- [Tests that read seeded owners assumed all owners in one array] → They switch to `content`, or ask for `size=20` and page when needed.

## Migration Plan

1. Deploy the backend with V4. Flyway applies the collation and the indexes. Then deploy the frontend. Both live in this repo and ship together, so there is no compatibility window.
2. Rollback: revert the commit and add `V5` to restore the default collation (Flyway does not undo migrations). The indexes are harmless if left in place.
