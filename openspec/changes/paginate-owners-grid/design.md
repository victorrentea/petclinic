# Design

## Technical impact

- **Backend**: `OwnerRestController.listOwners`, `OwnerRepository`, `OwnerMapper`, a new
  `OwnerPageDto`, `ApiExamples.OWNERS`, and `ExceptionControllerAdvice` (a malformed `page` must
  get a 400, not the catch-all 500).
- **Database**: new versioned migration `V4__…` that sets the ICU collation on
  `owners.last_name`, `first_name` and `city`, and adds three indexes.
- **Contract**: the regenerated `openapi.yaml` (by `OpenApiExtractorTest`).
- **Frontend**:
  - `OwnerService`, `OwnerListComponent` (template and logic) and `OwnersModule` (Material table,
    sort and paginator modules).
  - The stale `owner-page.ts` is replaced to match the new envelope.
- **Tests that read the old array** and must change:
  - backend: `OwnerTest`, `AddVisitApiTest`, `OwnerSearchThroughLatencyProxyTest`,
    `BasicAuthenticationConfigTest`, and `owners.feature` with `OwnerSteps`
  - frontend: `owner.service.spec.ts`, `owner-list.component.spec.ts`
  - Playwright: `petclinic-test/src/owner-search.feature` (its "lists every owner" scenario)
- **No new dependencies.** Angular Material 16 is already installed.

## Context

- `GET /api/owners` calls `OwnerRepository.findByLastNameStartingWith(lastName)`, which returns
  every match. `OwnerMapper` then touches each owner's lazy `pets`, so the endpoint runs 1 + N
  queries. This works only because open-session-in-view is left at Spring's default (on).
- `owners` has a primary key and no other index. Every column is `TEXT` and inherits the database
  collation, `C.UTF-8`, which sorts by byte, so accented names land after "Z".
- The project's rule is hand-written DTOs and `openapi.yaml` generated from them.
  `petclinic-frontend/src/app/generated/api-types.ts` is generated from that file by
  `npm run generate:api`.
- `ExceptionControllerAdvice` maps `ConstraintViolationException`,
  `MethodArgumentNotValidException` and `jakarta.validation.ValidationException` to 400. Anything
  else, including `MethodArgumentTypeMismatchException` (`page=abc`), becomes a **500** today.
- `petclinic-frontend/src/app/owners/owner-page.ts` already declares an `OwnerPage` in Spring's
  `Page` shape (`totalPages`, `number`). Nothing imports it.
- Angular Material 16 is already a dependency (`MatSelectModule`, `MatDatepickerModule`), but no
  module imports table, sort or paginator yet.

## Goals / Non-Goals

**Goals:**
- One SQL query for a page of owners and one for the pets on that page. Plus one count.
- Every query that serves the grid is backed by an index.
- The URL is the single source of truth for the grid's state.

**Non-Goals:**
- Keyset (cursor) paging: Q&A #10.
- A reusable grid in `design-system/`: Q&A #15, deferred until a second grid exists.
- Changing `GET /api/owners/count` or any other owners endpoint.

## Decisions

### D1. Explicit `page`/`size`/`sort` parameters, not Spring's `Pageable` argument
The controller takes three `@RequestParam`s and builds the `PageRequest` itself.

- `sort` is parsed into an `OwnerSort` enum (`NAME_ASC`, `NAME_DESC`, `CITY_ASC`, `CITY_DESC`).
  Each value carries its full `Sort`, tie-breakers included, e.g. `city, lastName, firstName, id`.
- `size` is checked against `{5, 10, 20}`.
- `page` gets `@Min(0)`, with `@Validated` on the controller.
- An invalid value throws `jakarta.validation.ValidationException`, which already maps to a 400.

*Alternative rejected:* a `Pageable` resolved from the request. It accepts any entity property in
`sort`, such as `telephone` or `pets.name`, and any `size` up to its configured maximum. The
whitelist would then become a post-check on something Spring already parsed, and the generated
OpenAPI would describe Spring's generic parameters instead of ours.

### D2. Derived Spring Data query returning `Page<Owner>`
`Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` produces
`… WHERE last_name LIKE ?`, `ORDER BY …`, `LIMIT/OFFSET`, and a matching `COUNT(*)`.
`PageableExecutionUtils` skips the count when the first page is not full. The existing
`List`-returning method is removed if nothing else uses it.

### D3. Pets fetched for the page in one batch: `@BatchSize(size = 20)` on `Owner.pets`
When the mapper touches the first owner's pets, Hibernate loads the pets of up to 20 uninitialised
owners in the session with one `WHERE owner_id IN (…)`. 20 is the largest page size, so a page costs
exactly one pets query. `pets(owner_id)` is already indexed.

*Alternatives rejected:*
- `JOIN FETCH` + paging. Hibernate pages in memory over every row (HHH90003004).
- `@EntityGraph`. Same problem.
- A hand-written second query plus a manual merge. More code for the same SQL.

`@BatchSize` also speeds up every other place that touches several owners' pets, and never makes a
single-owner load worse.

### D4. Response envelope: hand-written `OwnerPageDto`
`{ content: OwnerDto[], page: int, size: int, totalElements: long }`, built in `OwnerMapper` from
the `Page<Owner>`. Spring's `PageImpl` JSON is not used: Spring logs that its shape is not stable,
and it would add `pageable`, `sort` and `empty` noise to `openapi.yaml`. The frontend computes the
number of pages itself, which `MatPaginator` does anyway. The stale `owner-page.ts` is replaced by
the type generated into `api-types.ts`.

### D5. Collation: one versioned migration, `V4__owners_paging.sql`
`ALTER TABLE owners ALTER COLUMN last_name TYPE TEXT COLLATE "und-x-icu"`, and the same for
`first_name` and `city`. Then:

- `CREATE INDEX owners_name_idx ON owners (last_name, first_name, id)`
- `CREATE INDEX owners_city_idx ON owners (city, last_name, first_name, id)`
- `CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops)`

`und-x-icu` is ICU's root locale. It is deterministic, so equality and uniqueness stay unchanged,
and a letter with a diacritic sorts beside its base letter.

The prefix search needs its own `text_pattern_ops` index. Under a non-C collation, PostgreSQL
cannot turn `LIKE 'Pot%'` into a range scan on a regular B-tree. The `_pattern_ops` operator class
compares by byte and allows it.

The descending sorts use the same indexes, scanned backwards: every column runs in the same
direction.

*Alternatives rejected:*
- `ORDER BY … COLLATE` in the query, with expression indexes. It leaks SQL into the repository,
  and Spring Data cannot express it.
- Changing the database collation. That needs `initdb` and affects every table.

### D6. Frontend: the URL drives the grid
`OwnerListComponent` subscribes to `ActivatedRoute.queryParamMap` and uses `switchMap` to call
`OwnerService.getOwners({lastName, page, size, sort})`. `switchMap` replaces the hand-made
`unsubscribe` that keeps only the latest query. User actions never load data directly; each one
calls `router.navigate([], {queryParams, queryParamsHandling: 'merge'})`:

- Search sets `lastName` and `page: 0`.
- `matSortChange` sets `sort` and `page: 0`.
- `page` (paginator) sets `page` and `size`.

Back, refresh and shared links then work without extra code. Unknown `size` or `sort` values in the
URL are replaced by the defaults before the request, so a hand-edited link shows the grid instead of
a 400.

Page-size change (Q&A #13): `MatPaginator` already recomputes `pageIndex` as
`floor(previousIndex × previousSize / newSize)`, which keeps the first visible owner on screen. The
component just forwards the event.

Widgets:
- `mat-table`.
- `matSort` with `matSortDisableClear`, so a header toggles only between asc and desc.
- `mat-sort-header` on Name and City only.
- `mat-paginator` with `[pageSizeOptions]="[5, 10, 20]"` and `showFirstLastButtons`.

Imported in `OwnersModule`: `MatTableModule`, `MatSortModule`, `MatPaginatorModule`. The Pets cell
lists pet names inline. The nested `<tr>` inside a `<td>` is invalid HTML and goes away.

The empty message keys on `totalElements === 0` after a successful load. A failed load shows the
error, not "No owners…". The "Add Owner" button moves outside the table, so it stays visible on an
empty result.

### D7. 400 for a malformed `page`
`ExceptionControllerAdvice` gets a `MethodArgumentTypeMismatchException` handler that returns the
same 400 `ProblemDetail` shape as the other validation errors. Today any endpoint with a numeric
parameter returns a 500 for `abc`, so this improves them all.

## Risks / Trade-offs

- **The embedded PostgreSQL binaries may lack ICU, so `und-x-icu` would not exist.** The migration
  would fail at boot, in dev and in every test.
  → Task 1.1 checks `pg_collation` on Zonky (tests) and on `petclinic-database` (dev) before
  anything else. If ICU is missing, stop and revisit D5 with Victor, since it changes the migration.
- **The planner may ignore `text_pattern_ops` when `lastName` is empty** (`LIKE '%'`). That case
  is meant to use `owners_name_idx` or `owners_city_idx`.
  → Run `EXPLAIN ANALYZE` on 100k generated owners for each sort, with and without a prefix
  (Q&A #17). The output is attached to the PR, not run in CI.
- **Deep offsets.** `OFFSET 99_980` walks the index, a few milliseconds at 100k.
  → Accepted (Q&A #10). Revisit keyset paging at millions.
- **Breaking contract.** Any caller outside this repo that reads `/api/owners` as an array breaks.
  → Accepted (Q&A #7). The repository search finds only the frontend and our own tests. JMeter never
  lists owners.
- **`@BatchSize` relies on open-session-in-view** for the mapper to reach lazy pets, exactly as
  today. → No change in risk. A later move to OSIV off must fetch pets explicitly.
- **Most decisions are 💡 recommendations, not yet confirmed.** → Each one maps to a spec
  requirement, so whatever the Three Amigos change shows up as a spec edit before implementation.

## Migration Plan

- Deploy backend and frontend together. The API change is breaking and has a single consumer.
- `V4` is additive apart from the collation change, which rewrites no data.
- Rollback: redeploy the previous backend and frontend. `V4` can stay: the old code works on the
  new collation and indexes.
