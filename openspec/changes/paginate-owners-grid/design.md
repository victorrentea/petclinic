# Design

## Context

- `OwnerRestController.listOwners` calls `OwnerRepository.findByLastNameStartingWith(lastName)` and
  maps every owner through `OwnerMapper` → `PetMapper` → `VisitMapper`. `Owner.pets` is `LAZY` and
  nothing batches it, so today the list costs 1 + N (pets) + M (visits) queries.
- The schema (V1–V3) has no index on `owners`. The dev database, however, already holds
  `owners_name_idx (last_name, first_name, id)` and `owners_city_idx (city, last_name, first_name, id)`
  and a `V4__owner_list_sorting` row in `flyway_schema_history` from earlier paging work that is no
  longer in this branch. The database collation is `C.UTF-8`.
- `petclinic-frontend/src/app/owners/owner-page.ts` already declares the page shape the spec asks for
  and is unused. The app is Angular 16 with Angular Material available (`MatDatepicker` is in use).
- Consumers of `GET /api/owners`: `OwnerService.getOwners/searchOwners` (grid only),
  `OwnerSearchThroughLatencyProxyTest`, and the `owner-search.feature` glue. The MCP and the chatbot
  do not call it.

## Goals / Non-Goals

**Goals:**
- Every page is answered by one indexed query plus one count, and a bounded number of batched
  queries for pets and visits, whatever the table size.
- The API vocabulary (`sort=name|city`) is decoupled from entity field names.

**Non-Goals:**
- Keyset (cursor) pagination; offset paging is fine at 100k with 20-row pages.
- Case-insensitive or accent-insensitive search; the filter stays a case-sensitive prefix.

## Decisions

1. **Explicit `page`/`size`/`sort` request params, not Spring's `Pageable` resolver.** The resolver
   silently clamps sizes and passes any `sort` property through, so `sort=telephone` would sort and
   `sort=foo` would surface as a 500 (`PropertyReferenceException`). An `OwnerSort` enum (`NAME`, `CITY`)
   parses `sort=<field>[,asc|desc]` and expands to the full order: `NAME` → `lastName, firstName, id`;
   `CITY` → `city, lastName, firstName, id`, all in the requested direction. The controller builds the
   `PageRequest` from it.

2. **400 through the existing handler.** Size outside {5, 10, 20} and an unknown sort field throw
   `jakarta.validation.ValidationException`, which `ExceptionControllerAdvice` already turns into a 400
   `ProblemDetail` with `errors[0]` = the message (added by the issue #40 fix; add it here if that fix
   is not merged first). Alternative `ResponseStatusException` was rejected: it bypasses the
   `errors` array the frontend already reads.

3. **A hand-written `OwnerPageDto` record** `{content, totalElements, totalPages, number, size}` built
   from the `Page<Owner>`. Serializing `PageImpl` directly makes Spring Boot 3.5 log a warning, and the
   `VIA_DTO` mode produces a nested `page` object that does not match `owner-page.ts`.

4. **Repository:** `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`
   replaces the `List` variant (whose only other caller, `OwnerCreateTest`, moves to the paged one).
   Spring Data derives the count query.

5. **Batch fetching, not fetch joins.** `spring.jpa.properties.hibernate.default_batch_fetch_size=20`
   loads the pets of a page in one `IN (...)` query, and their visits in another. A `JOIN FETCH` or
   `@EntityGraph` on a collection together with a `Pageable` makes Hibernate page in memory
   (HHH90003004), which is the very thing this change exists to avoid. The global setting also helps
   every other lazy collection; per-association `@BatchSize` was the narrower alternative.

6. **Indexes in `V5__owner_list_indexes.sql`** with `CREATE INDEX IF NOT EXISTS owners_name_idx ...`
   and `owners_city_idx ...` on the columns above. `IF NOT EXISTS` makes it a no-op on the dev DB that
   already has them; `V5` avoids colliding with the orphan `V4` row there. Under `C.UTF-8` the btree on
   `last_name` also serves the `LIKE 'prefix%'` filter.

7. **Frontend state in the URL.** `OwnerListComponent` reads `lastName`, `page`, `size`, `sort` from
   `ActivatedRoute.queryParamMap` and loads on every change; paginator, sort header and search only
   `router.navigate([], {queryParams, replaceUrl: true})`. `replaceUrl` keeps Back meaning "leave the
   grid", not "undo the last page click". `MatPaginator` (`[pageSizeOptions]="[5, 10, 20]"`, `length`
   = `totalElements`) and `MatSort` with `mat-sort-header` on Name and City only; a search resets
   `page` to 0.

## Risks / Trade-offs

- [The orphan `V4` in the dev DB's Flyway history makes validation fail at boot] → reset the dev DB
  with `./start-database.sh` (wipes runtime rows; the seed comes back).
- [Non-ASCII order depends on the platform's collation: the dev DB on macOS puts Śliwiński between
  Silver and Tremaine, but the Linux CI database may sort by code point] → tests assert order on ASCII
  names only; an explicit ICU collation is a separate change if Bizu objects.
- [Offset paging degrades on very deep pages] → irrelevant at 100k / 20 rows (≤ 20k pages, offset scan
  on an index); keyset pagination is the escape hatch.
- [BREAKING response shape] → both consumers change in the same commit; no external client exists.

## Migration Plan

Single deploy: backend and frontend ship together (the frontend can't read the old list, the old
frontend can't read a page). Rollback = revert the commit; `V5` stays applied, its indexes are harmless.
