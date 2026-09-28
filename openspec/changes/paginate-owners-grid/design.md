# Design

Decisions below come from `QA.md` (GH #25). ✅ = decided by Victor; 💡 = Claude's recommendation, adopted here pending review.

## Context

- `GET /api/owners?lastName=` returns `List<OwnerDto>` via `OwnerRepository.findByLastNameStartingWith` — whole table, no order.
- `Owner.pets` is `LAZY`; the mapper touches it per owner → N+1 today.
- Frontend: `OwnerListComponent` loads everything, plain `<table>`; `owner-page.ts` is an unused leftover shaped like Spring's `Page`.
- Dev DB (checked 2026-09-28): 32 owners, 21 cities, collation `en_US.UTF-8`. `flyway_schema_history` already has **V4 "owner list indexes"** from branch `rabo26oct`, with indexes `owners_name_sort_idx (last_name, first_name, id)`, `owners_city_sort_idx (city, last_name, first_name, id)`, `owners_last_name_prefix_idx`.
- `openapi.yaml` is extracted from code and drift-checked in CI; `api-types.ts` is regenerated from it.

## Goals / Non-Goals

**Goals:** DB-side paging, sorting and filtering on indexed columns; a stable, hand-written JSON contract; bounded query count per page.

**Non-Goals:** full-text / case-insensitive search; a design-system paginator widget; sorting by address, telephone or pets; cleaning up "Ada Acceptance…" owners.

## Decisions

1. ✅ **Same endpoint, always paged.** `GET /api/owners?lastName=&sort=name|city&dir=asc|desc&page=0&size=10`. No full-list variant — it is what 100k owners rule out.
2. ✅ **Response = `OwnerPageDto { content: OwnerDto[], totalElements: long }`**, not Spring `Page`/`PagedModel`: those serialize `pageable`/`sort` internals into `openapi.yaml` and change shape between Spring versions. Replace `owner-page.ts` with the generated type.
3. ✅ **Opaque sort keys** mapped server-side to `Sort` (💡 tie-breakers):
   - `name` → `firstName, lastName, id`
   - `city` → `city, firstName, lastName, id`

   The trailing `id` makes the order total, so `LIMIT/OFFSET` pages never repeat/skip (8 owners in London). Parse into an enum; unknown key → 400. Alternative (raw `sort=firstName,asc` Spring style) rejected: exposes column names and lets clients sort by meaningless columns.
4. ✅ **`size` ∈ {5,10,20}**, validated in the controller; `page ≥ 0`. 💡 Bad `size`/`sort`/`dir` → 400 `ProblemDetail` through `ExceptionControllerAdvice` (add a handler for the enum-conversion / validation exception it does not cover yet).
5. 💡 **Repository:** `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` — derived query, `count(*)` kept (21): ms at 100k, and the paginator needs the total. Page past the end → empty content, real total (15).
6. 💡 **Pets: `@BatchSize(size = 20)` on `Owner.pets`** → 1 extra `IN (...)` query per page. Rejected: `JOIN FETCH` + paging (HHH90003004, pages in memory); `@EntityGraph` — same problem for a collection.
7. 💡 **Migration `V4__owner_grid_indexes.sql`**: `(first_name, last_name, id)`, `(city, first_name, last_name, id)`, `(last_name text_pattern_ops)`. The last one is needed because under `en_US.UTF-8` a plain btree does not serve `LIKE 'Mc%'`. Rejected: numbering it V5 to dodge the dev-DB clash — `main`/CI have no V4, so a gap would be confusing and the foreign V4 exists only on local DBs that visited `rabo26oct`.
8. 💡 **Frontend:** `MatPaginatorModule` (`[5,10,20]`) + `MatSortModule` on the existing table, `mat-sort-header` only on Name and City, `matSortDisableClear`. Grid state ↔ query params (`page,size,sort,dir,lastName`) via `Router.navigate({queryParams})`; the component reacts to `ActivatedRoute.queryParamMap` → one `switchMap` to `OwnerService.getOwners(query)` (also cancels stale responses, replacing the manual `load.unsubscribe()`). Changing filter/sort/size resets `page` to 0. The design system gets a paginator only when a second grid needs one.
9. 💡 **Callers of the full list** (18):
   - Playwright `owner-search.feature` glue: "every owner is listed" → the paginator total equals `totalElements`; Background lookup uses `lastName=` filter instead of scanning all owners.
   - `add-visit.dsl.ts`, `visit-date-range.feature.glue.ts`: find the pet via `GET /api/pets` (`PetDto.ownerId`).
   - Backend: `OwnerTest`, `OwnerSteps`/`owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest` read `$.content`; `ApiExamples.OWNERS` becomes a page example; JMeter plan checked.
   - MCP/chatbot untouched — they only use `findByIdFetchingPets` (19).

## Risks / Trade-offs

- [Dev DB's foreign V4 fails Flyway validation on boot] → reset once with `./start-database.sh` (wipes runtime rows); note it in the PR.
- [**BREAKING** response shape for any external client] → none known besides our tests; `openapi.yaml` diff goes through tech-lead CODEOWNERS review.
- [OFFSET cost grows with page number] → acceptable: humans don't page to 10,000; keyset paging if it ever matters.
- [Acceptance test flakiness: suites share one DB and add owners in parallel] → assert order and counts, never specific names (17).
- ["Ada Acceptance…" owners appear on page 1 of the dev DB] → separate issue (20).

## Migration Plan

1. Merge to `blip26` only; `main` stays the unpaginated exercise start (1).
2. Local: `./start-database.sh` once, then `./start-backend.sh`.
3. Rollback: revert the commits; the V4 indexes are harmless to the old code.
