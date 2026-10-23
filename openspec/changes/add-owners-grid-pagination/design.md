# Design

## Context

See [proposal.md](proposal.md) for the motivation and [specs/owner-listing/spec.md](specs/owner-listing/spec.md)
for the required behavior. Current state:

- `OwnerRestController.listOwners` calls `OwnerRepository.findByLastNameStartingWith(lastName)`
  (returns a `List`) and maps every owner to `OwnerDto`.
- `OwnerDto` → `PetDto` → `VisitDto`. Both `Owner.pets` and `Pet.visits` are LAZY, so listing
  N owners runs 1 + N + (number of pets) queries. `Pet.type` and `Visit`'s `@ManyToOne` are
  EAGER, but they point to few distinct rows, which the persistence context caches.
- `owners` has only its primary key and uses the database default collation `C`.
- `ExceptionControllerAdvice` maps `MethodArgumentNotValidException` and
  `ConstraintViolationException` to 400. Everything else, including
  `MethodArgumentTypeMismatchException` and `ResponseStatusException`, falls into the
  catch-all `Exception` handler and becomes **500**.
- Springdoc builds `openapi.yaml`. `OpenApiExtractorTest` writes it, and the frontend's
  `npm run generate:api` turns it into `api-types.ts`.
- The frontend grid is a Bootstrap `<table>` with `*ngFor`. Playwright and the e2e glue
  find it by `#ownersTable` and `td.ownerFullName`. `owner-page.ts` is unused and has a Spring
  `Page` shape.
- The "No owners…" message is shown on `!owners`, which happens only when the request fails.
  An empty result shows an empty table.

## API Contract

**BREAKING:** `GET /api/owners` changes in place. It returns a page instead of an array:

```json
{ "content": [ /* OwnerDto, with pets and their visits, as before */ ], "totalElements": 26 }
```

| Parameter  | Values                          | Default | Notes                                    |
|------------|---------------------------------|---------|------------------------------------------|
| `page`     | integer ≥ 0                     | `0`     | 0-based; past the end → empty `content`  |
| `size`     | `5`, `10`, `20`                 | `10`    | anything else → 400                      |
| `sort`     | `name`, `city`                  | `name`  | a sort key, not a column name; else 400  |
| `dir`      | `asc`, `desc`                   | `asc`   | else 400                                 |
| `lastName` | any string                      | `""`    | case-sensitive prefix, applied before paging |

- No unpaged variant is kept, because it would allow fetching all 50k owners at once (Q2).
  Every caller of the listing is in this repo: the Angular grid, the backend tests, and
  `petclinic-test` (`start-apps.ts` only checks for HTTP 200). The chatbot calls only
  `/api/owners/{id}`.
- Sort order: `name` → `first_name, last_name, id`; `city` → `city, id`.
  `id` breaks ties, so pages stay stable.
- Not sortable: `address` (production data is too dirty for any order to make sense),
  `telephone` (mixed formats; normalizing to E.164 is a separate topic) and `pets`
  (sorting by it needs an unindexed `count()` per page).

## Goals / Non-Goals

**Goals:**
- Every invalid parameter returns 400 and never 500, using the existing `ProblemDetail` shape.
- A fixed number of SQL queries per page, whatever the page size.
- The grid keeps the DOM hooks that the e2e tests use today.

**Non-Goals:**
- Keyset paging, caching the total count, and an index on `city` (only if the
  50k-row `EXPLAIN ANALYZE` shows they are needed).
- A shared grid component in `design-system/`.
- Changing the collation of other tables or of the whole database.

## Decisions

### D1. Bind the query to one validated `@ParameterObject` record
`listOwners(@ParameterObject @Validated OwnerListQuery query)` with
`record OwnerListQuery(String lastName, @Min(0) Integer page, Integer size, OwnerSortKey sort, SortDirection dir)`.
Defaults (`""`, 0, 10, `name`, `asc`) are filled in by the record's compact constructor. The
allowed sizes are checked by an `@AssertTrue isAllowedSize()` against `Set.of(5, 10, 20)`.
- Binding errors on a `@ModelAttribute` (an unknown enum value, a non-numeric page) and
  constraint violations both end up as `MethodArgumentNotValidException`. The advice already
  maps that to a 400 that lists the bad fields, so no new handler is needed for this endpoint.
- `@ParameterObject` makes springdoc document each field as its own query parameter, so
  `api-types.ts` gets typed `page`/`size`/`sort`/`dir`.
- *Alternative:* separate `@RequestParam` arguments plus `@Validated` on the controller. Rejected:
  an enum mismatch on a `@RequestParam` throws `MethodArgumentTypeMismatchException`, which
  becomes 500 today. That would need a new handler and an extra validation path.
- *Fallback:* if `@ParameterObject` on a record does not render the enums as `enum:` in
  `openapi.yaml`, add `@Schema(allowableValues=…)`. The spec does not change.

### D2. Lower-case enums are the sort-key whitelist
`enum OwnerSortKey { name, city }` and `enum SortDirection { asc, desc }`.
Spring's default String→Enum conversion is case-sensitive `valueOf`, so the wire values are the
constants themselves and anything else fails to bind (→ 400). Each `OwnerSortKey` owns its
property list: `name` → `firstName, lastName, id`; `city` → `city, id`. These lists build a Spring Data `Sort` with the requested direction on
every property, `id` included.
- *Alternative:* `UPPER_CASE` constants plus a custom `Converter`. Rejected: it adds code only
  to satisfy Java naming habits, and it would make the OpenAPI enum differ from the wire values.
- `Sort.Direction` is not reused because its default enum binding expects `ASC`/`DESC`.

### D3. Hand-written `OwnerPageDto`, repository returns `Page<Owner>`
`OwnerRepository.findByLastNameStartingWith(String, Pageable)` returns `Page<Owner>`; Spring
Data derives the count query. The controller maps it to
`OwnerPageDto(List<OwnerDto> content, long totalElements)`. `Page` stays inside the backend;
the API contract does not depend on `PageImpl`'s JSON (see Q&A Q3). The `List` overload is
deleted, and `OwnerCreateTest` moves to the paged method.

### D4. Batch-fetch pets **and** their visits
`@BatchSize(size = 20)` on `Owner.pets` (as decided in Q14) **and** `@BatchSize(size = 100)` on
`Pet.visits`. Q14 only covered pets. In the code, `OwnerDto` also serializes every pet's visits,
so batching only pets would still run one query per pet. Visits get a larger batch because a full
page of 20 owners usually has more than 20 pets; with a batch of 20, those visits would load in
two queries. Measured: 17 → 62 queries for 5 vs 20 owners before, and the same count for both
after (`OwnerListingQueryCountTest`). With both annotations, a page runs a bounded number of
queries: page + count + pets + visits, with no per-row queries.
- *Alternative:* `JOIN FETCH` / `@EntityGraph` with a `Pageable`. Rejected: Hibernate then
  pages in memory (HHH90003004) over all owners.
- *Alternative:* the global `hibernate.default_batch_fetch_size`. Rejected for now: it changes
  how every other association fetches, which this change does not need.

### D5. ICU collation per column and two indexes in one migration
`V4__owners_icu_collation_and_indexes.sql`:
```sql
ALTER TABLE owners
  ALTER COLUMN first_name TYPE text COLLATE "und-x-icu",
  ALTER COLUMN last_name  TYPE text COLLATE "und-x-icu",
  ALTER COLUMN city       TYPE text COLLATE "und-x-icu";
CREATE INDEX owners_name_sort_idx      ON owners (first_name, last_name, id);
CREATE INDEX owners_last_name_like_idx ON owners (last_name text_pattern_ops);
```
- `und-x-icu` is deterministic, so `=` and `LIKE` keep their exact, case-sensitive meaning. Only
  the order changes. The sort index inherits the column collation, so the default
  `ORDER BY … LIMIT` can be served by an index scan in either direction.
- A prefix `LIKE` cannot use an index under a non-C collation. The `text_pattern_ops` index
  covers it.
- `address` keeps collation `C`: it is not sortable, so changing its collation would only cost
  a table rewrite and gain nothing.
- The migration is versioned because it changes the schema. `db/reference` and `db/seed` stay
  as they are.
- *Alternative:* `COLLATE` only in `ORDER BY`. Rejected: every query must repeat it, and an
  index only helps a query that uses the same collation.

### D6. Frontend: one query stream, `switchMap`, Material table
- `OwnerPage` becomes `{ content: Owner[]; totalElements: number }`. `OwnerService.getOwners(query)`
  builds `HttpParams` from `{ lastName, page, size, sort, dir }`. `searchOwners` disappears
  because the filter is now one of the parameters. `HttpErrorHandler` logs and rethrows, so the
  empty-page fallback lives in the component: `catchError` *inside* the `switchMap`, so that one
  failed request does not end the stream for good.
- `OwnerListComponent` keeps a `BehaviorSubject<OwnerListQuery>`. A search, `matSortChange` and
  the paginator's `page` event each push the next query: a search or sort change resets `page`
  to 0, and a size change resets it to 0 as well. The pipe is `query$ → switchMap(getOwners)`,
  so only the latest response is rendered. This replaces the manual `unsubscribe()` it already
  does.
- `<table mat-table matSort id="ownersTable">`. The `mat-sort-header` attribute is only on
  name/city. The name cell keeps `class="ownerFullName"`, so Playwright selectors still
  work. A `mat-paginator` has `[pageSizeOptions]="[5,10,20]"`, `[length]="totalElements"`, and
  is not in client-side mode (no `MatTableDataSource.paginator`).
- The empty message shows when `totalElements === 0`. Its wording stays the same.
- Material modules (`MatTableModule`, `MatSortModule`, `MatPaginatorModule`) go into
  `OwnersModule`. The `design-system` rule about `<app-combo>` covers form selects, not the
  paginator's built-in size select.

### D7. URL state (cuttable)
On each query change: `router.navigate([], { queryParams, replaceUrl: true })`. On init, the
first query is read from `ActivatedRoute.snapshot.queryParamMap`, and missing or invalid values
fall back to the defaults. `replaceUrl` keeps page flips out of history, so Back from an owner
lands on the last grid state. A non-empty `lastName` goes into the URL too: without it, a
refresh during a search would restore page N of the *unfiltered* list. The browser's Back keeps the
grid state through the URL; the owner page's own "Back" button navigates instead, so the grid
also keeps its last query in a root-provided `OwnerListState` that this button restores from
(`Location.back()` was rejected: after an owner → edit → save round trip it would return to the
edit form). The code is isolated in two helpers (`toQueryParams` /
`fromQueryParams`) so that cutting it means deleting them and the spec requirement
"Grid state survives refresh and Back".

## Affected Code

- **Backend**: `OwnerRestController.listOwners`, `OwnerRepository` (paged method plus its
  derived count), new `OwnerPageDto`, `OwnerListQuery`, `OwnerSortKey` and `SortDirection`,
  `@BatchSize` on `Owner.pets` and `Pet.visits`, and `ApiExamples.OWNERS`.
  `ExceptionControllerAdvice` stays unchanged (D1).
- **Database**: new `db/migration/V4__owners_icu_collation_and_indexes.sql` (D5).
- **API contract**: `/openapi.yaml` (regenerated by `OpenApiExtractorTest`) and
  `petclinic-frontend/src/app/generated/api-types.ts` (regenerated by `npm run generate:api`).
- **Frontend**: `OwnerService`, `owner-page.ts`, `OwnerListComponent` (template, spec) and
  `OwnersModule` (Material imports).
- **Tests**: `OwnerTest`, `OwnerCreateTest`, `owners.feature` + `OwnerSteps`,
  `OwnerSearchThroughLatencyProxyTest`, the owner-list and owner-service Angular specs, and
  `petclinic-test/src/owner-search.feature` ("every owner is listed" assumes no pages).
- **Docs**: the API Endpoints section of `AGENTS.md`, and the Owners section of
  `user-manual/manual.md` with its screenshot.

## Risks / Trade-offs

- **ICU missing from the embedded Postgres binaries** (zonky 16.2.0 in tests, `petclinic-database`
  in dev) → Flyway fails at boot. → Mitigation: task 1.1 checks
  `SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu'` on both before anything else. If it is
  missing, stop and go back to Q10; do not fall back to `C` silently.
- **Breaking API**: an external client that expects an array breaks. → The deployment diagram
  and Q2 list only the Frontend and the Chatbot (which uses `/{id}`). The PR description and
  the comment on #25 state the break.
- **The two `ownerFullName` scenarios in `petclinic-test`** assume one unpaged list. → The
  "every owner is listed" step is rewritten to check the first page and the total count.
- **Name sorts by first name, but the search is by last name** (Q&A "still open"). → This is
  accepted. Searching "Potter" shows Potters ordered by first name.
- **Offset paging cost grows with deep pages** (`OFFSET 49990`). → Acceptable at 50k (Q15).
  Measured in task 6.

## Migration Plan

1. Merge the backend, migration and frontend together: the API change breaks the old frontend,
   so they cannot ship separately.
2. Flyway applies V4 on startup. `ALTER COLUMN … TYPE … COLLATE` rewrites the table and takes an
   `ACCESS EXCLUSIVE` lock; at 26 rows, or even 50k, that is sub-second.
3. Rollback: revert the commit and add `V5` that sets the three columns back to `COLLATE "C"`
   and drops both indexes. Flyway does not run down-migrations.

## Open Questions

- Latency target per page: business has not set one. The existing
  `OwnerSearchThroughLatencyProxyTest` (p95 ≤ 200 ms) stays as the working threshold until they do.
