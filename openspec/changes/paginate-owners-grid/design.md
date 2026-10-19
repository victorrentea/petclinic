# Design

## Context

- **Backend today.** `GET /api/owners` calls `OwnerRepository.findByLastNameStartingWith(lastName)`
  and maps every owner to `OwnerDto`, nesting pets and their visits. `Owner.pets` and `Pet.visits`
  are lazy, so mapping N owners costs about 1 + N + (pets) queries.
- **Frontend today.** The grid (`OwnerListComponent`) is a plain Bootstrap table with no Material
  table, sort or paginator in the app yet. It shows a name as "First Last".
- **Error handling.** `ExceptionControllerAdvice` turns bean validation into a 400 ProblemDetail.
  Its catch-all `Exception` handler would answer a non-numeric `page` with a 500.
- **Database.** The dev database collation is `en_US.UTF-8` (Postgres 16), checked on 2026-10-19:
  "Łukasz" sorts after "Long" and "Ștefan" after "Sherlock". Tests run on zonky embedded Postgres,
  whose collation has not been checked.
- **Volume.** Today the seed holds 28 owners; the target is 10,000 (`VOLUMETRY.md`).

## Goals / Non-Goals

**Goals:**
- A page costs a fixed number of SQL statements, whatever the page size or the number of pets.
- The order is decided in SQL, under the database collation. The browser never re-sorts.

**Non-Goals:**
- A slimmer list DTO (rows still carry pets with visits).
- Indexes, and a cursor/keyset API.
- A Material table rewrite of the grid markup beyond what sorting needs.

## API Contract

**BREAKING:** `GET /api/owners` returns one page instead of a bare array of every owner.

- **Response:** `{content, totalElements}`.
- **Parameters**, next to the existing `lastName` prefix filter:

  | Parameter | Values | Default |
  |---|---|---|
  | `page` | 0-based | 0 |
  | `size` | 5, 10 or 20 | 10 |
  | `sort` | `name\|city`, optionally `,asc\|desc` | `name,asc` |

- **Any other value** is a 400 ProblemDetail naming the parameter. A bad value is never silently
  corrected.
- **A page past the end** returns an empty `content` with the real `totalElements`.
- **Every order ends on `id`,** so consecutive pages never repeat or skip an owner.
- **Grid state** (`page`, `size`, `sort`, `lastName`) lives in the browser URL's query string, with
  defaults left out.

## Decisions

1. **Change `GET /api/owners` in place, without a new endpoint.** Its only production caller is the
   grid. The other callers are three e2e glue files and `OwnerTest`, which all move to the new shape
   in this change.
   - *Alternative:* keep the bare array and add `/owners/page`. Rejected: it leaves an endpoint that
     returns 10,000 owners for anyone to call.

2. **Our own `OwnerPageDto(List<OwnerDto> content, long totalElements)`, not Spring's `Page` JSON.**
   The paginator needs exactly these two fields. Spring Data warns that `PageImpl` serialization is
   not a stable format, and its JSON drags in `pageable`, `sort` and other unused fields that would
   then leak into `openapi.yaml` and `api-types.ts`.

3. **A fixed whitelist maps the `sort` parameter to a `Sort`; the client never names a column.**
   - `name` sorts by `lastName, firstName, id`; the grid shows "Last, First" to match.
   - `city` sorts by `city, lastName, firstName, id`.
   - The direction applies to the first property only, so a descending city keeps names ascending
     (spec: "reverse only the chosen field").

   Repository: `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` builds
   both the page query and the count query.
   - *Alternative:* Spring's `?sort=lastName,desc` binding. Rejected: it accepts any entity
     property, which would make Telephone sortable again through the API and expose field names.

4. **Validation answers 400, never a fallback.** `page`, `size` and `sort` bind to a validated
   record, `OwnerListQuery` in `rest.dto` (`@ParameterObject @Validated`).
   - `@Min(0)` checks the page; `@Pattern` checks `size` (`5|10|20`) and `sort`
     (`(name|city)(,(asc|desc))?`).
   - The record's `toPageable()` maps the checked values to a `PageRequest`.
   - Errors reach the existing `MethodArgumentNotValidException` handler. That includes binding
     errors such as `page=abc`, so `ExceptionControllerAdvice` doesn't change.
   - *Alternative:* hand-parse the parameters and throw a dedicated exception. Rejected during
     apply: `docs/packages.puml` allows neither `rest → rest.error` nor `rest.error → rest`, so that
     exception would have needed a new dependency arrow.

5. **Fixed query count via `@BatchSize(size = 20)` on `Owner.pets` and `Pet.visits`.** A page of up
   to 20 owners then loads in about 4 statements: page, count, pets batch, visits batch.
   - *Alternative:* `JOIN FETCH` in the page query. Rejected: fetching a collection while paging
     makes Hibernate page in memory (HHH90003004).
   - *Alternative:* a slimmer DTO. Rejected: out of scope (Non-Goals).

6. **Frontend: `MatSortModule` on the existing `<table>` plus a standalone `MatPaginator`; no
   `MatTableDataSource`.** The server sorts and pages, so the component only listens to
   `matSortChange` and `page` events and re-queries.
   - `mat-sort-header` goes on Name and City only.
   - `matSortDisableClear` removes the unsorted state.
   - `matSortStart="asc"` makes the first click ascending.

7. **The URL query string is the single source of the grid state.** `page`, `size`, `sort` and
   `lastName` live in `ActivatedRoute.queryParams`, with defaults omitted.
   - Every user action calls `router.navigate([], {queryParams})`.
   - The component loads only from the `queryParams` stream, which gives Back, refresh and shared
     links for free.
   - A search, a sort change or a size change drops `page`.
   - `switchMap` cancels a stale request, replacing today's manual unsubscribe (the race that comment
     guards against).

8. **One service call, `OwnerService.listOwners(query)`, returning `OwnerPage`.** It replaces both
   `getOwners()` and `searchOwners()`, which differ only by the filter. Errors propagate to the
   component (no `catchError` default to `[]`), so a failure can be shown rather than mistaken for
   an empty result.

9. **e2e glue stops scanning the owner list.**
   - `add-visit.dsl.ts` and `visit-date-range.feature.glue.ts` look the pet up through `GET /api/pets`,
     which lists pets with `ownerId` and `birthDate`.
   - `owner-search.feature.glue.ts` no longer collects every owner name. The "lists every owner"
     scenario becomes "shows the first page": 10 rows and the total in the paginator.

## Risks / Trade-offs

- **Collation differs between environments.** zonky, CI or Docker Postgres may not use the dev
  collation, so the accented-name order could differ. → The first backend test asserts the
  Silver/Śliwiński/Tremaine order. If zonky runs under `C` collation, set its locale explicitly
  (`initdb --locale`) rather than weakening the scenario.
- **Breaking API change.** An external client of `GET /api/owners` would break. → There is none in
  the repo besides those listed above; the chatbot calls only `/api/owners/{id}` and the MCP uses
  repositories.
- **The count query on every page.** One `count(*)` per request. → It's negligible at 10,000 rows;
  revisit if `VOLUMETRY.md` grows by orders of magnitude.
- **The `lastName` filter is case-sensitive, and stays that way.** `LIKE 'x%'` is unchanged, and
  `owner-search.feature` already pins it as case-sensitive.
- **The count of 10,000 is an unconfirmed reading of "users".** → Recorded in `VOLUMETRY.md`. The
  design holds whether the number counts owners or accounts.

## Impact

- **Backend:**
  - `OwnerRestController.listOwners` and `OwnerRepository`.
  - A new `OwnerPageDto`.
  - `@BatchSize` on `Owner.pets` and `Pet.visits`.
  - The query parameters bind to a new `OwnerListQuery`.
  - The test-only `config/application.properties` pins zonky's collation.
  - `ApiExamples.OWNERS`, and the tests that read the bare array: `OwnerTest`, `AddVisitApiTest`,
    the functional `OwnerSteps`/`owners.feature`, and `OwnerSearchThroughLatencyProxyTest`.
  - The regenerated `openapi.yaml` and `DomainModel.puml`.
- **Frontend:**
  - `OwnerService` and `OwnerListComponent` (template, spec).
  - `MatPaginatorModule` and `MatSortModule` in `OwnersModule`.
  - The regenerated `api-types.ts`.
- **e2e:**
  - `owner-search.feature`'s "lists every owner" scenario.
  - A new `owners-grid.feature`.
  - The glue in `add-visit.dsl.ts`, `owner-search.feature.glue.ts` and
    `visit-date-range.feature.glue.ts`.
- **Docs:**
  - `user-manual/` (owners text and screenshot).
  - `VOLUMETRY.md` (new; linked from `AGENTS.md`).
- **Out of scope:**
  - An index on `owners`; none until a measurement asks for one.
  - The "Ada Acceptance…" owners that `add-owner.spec.ts` leaves behind; a separate issue.

## Migration Plan

- There is no data migration and no schema change.
- Frontend and backend ship together from one branch.
- Rollback is a revert of the merge.

## Open Questions

- Does the business's "10,000 users" count owners or login accounts? This doesn't change the
  approach; it only affects whether `VOLUMETRY.md` should get a second row.
