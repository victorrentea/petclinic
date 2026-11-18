# Design

## Context

See `proposal.md` for the motivation and `specs/owner-list/spec.md` for the required behaviour.
This is the current state that shapes the approach:

- `OwnerRestController.listOwners` calls `OwnerRepository.findByLastNameStartingWith(String)`,
  which returns `List<Owner>`. `OwnerMapper.toOwnerDtoCollection` then touches each owner's
  `pets`, a LAZY `@OneToMany` with no batch size, so N owners cost 1 + N queries. The design
  rule is "no service layer": controllers call repositories and mappers directly, and DTOs
  are written by hand.
- `owners` has only its primary key index. The columns are `text`. The database collation is
  `C.UTF-8` (byte order), so `ORDER BY last_name` puts "Śliwiński" after "Wensleydale". The dev
  Postgres is 16.2, and the ICU collation `und-x-icu` is available there.
- Contract artefacts are generated and drift-checked: `openapi.yaml` (`OpenApiExtractorTest`
  plus a Spectral lint), `generated/api-types.ts` (`npm run generate:api` in pre-commit and CI),
  `docs/generated/DB.sql` (`DbSchemaExtractorTest`) and `DB.puml`.
- The frontend already uses Angular Material 16.2 (datepicker, select), but nothing yet imports
  `MatTableModule`, `MatSortModule` or `MatPaginatorModule`. `OwnerListComponent` keeps its
  state in fields, and the route `/owners` takes no query params.
- Tests start on an empty database (schema plus reference rows). The Playwright and Cucumber
  owner-search scenarios run on the `default` seed of 26 owners.

## Goals / Non-Goals

**Goals:**
- One request costs a bounded number of SQL statements, whatever the table size: the page, the
  count and one batch of pets.
- Every allowed sort is served by an index walk, with no full sort of the table.
- The API contract makes illegal requests impossible to express silently: bad size or sort →
  400.

**Non-Goals:**
- Keyset (cursor) paging, and caching of counts.
- A reusable grid component in `design-system/`: wait for a second paged grid.
- Changing how owners are created, edited or shown on their own page.

## Decisions

### D1. Offset paging with an exact `COUNT(*)`, not keyset
`LIMIT/OFFSET` over an index, plus a count with the same `WHERE`. The paginator shows "x of N"
and can jump to any page, which keyset paging can't do without extra machinery. At 100k rows
the deepest offset walks ~100k index entries, which takes milliseconds.
*Alternative:* keyset paging pays off at millions of rows, but its "next/prev only" navigation
doesn't match the spec.

### D2. Spring Data `Pageable` inside, our own DTO outside
The repository method becomes `Page<Owner> findByLastNameStartingWith(String, Pageable)`, so
Spring Data issues the `LIMIT/OFFSET` and the count query. The controller does **not** take a
raw `Pageable` from the request. It binds `page`, `size`, `sort` explicitly, validates them, and
builds the `PageRequest` itself, so that:
- the OpenAPI contract names exactly the three parameters, with their allowed values
  (Spectral-friendly);
- the client can't inject sort properties.

The response is a hand-written `OwnerPageDto { List<OwnerDto> content; int page; int size;
long totalElements; }` in `rest/dto/`.
*Alternative:* returning Spring's `Page` / `PagedModel` was rejected. `PageImpl` JSON is
officially unstable (Spring Data warns at runtime), it leaks a dozen fields into
`openapi.yaml`, and it breaks the project's hand-written-DTO rule.

### D3. Sort as a closed set, tie-breakers added on the server
`sort` is parsed as `<key>,<dir>`, with key ∈ {`name`, `city`} and dir ∈ {`asc`, `desc`};
anything else → 400. Each key maps to a fixed `Sort`:
- `name` → `lastName, firstName, id`;
- `city` → `city, lastName, firstName, id`.

The direction applies to the first key. `name` reverses as a whole, and `city,desc` keeps the
name tie-breakers ascending, as the spec says. `id` makes every order total, so pages don't
overlap or skip rows (spec: *Order is stable across pages*).
*Alternative:* passing the client's string through to `Sort.by(...)` was rejected, because
it turns any entity property, and through it any column, into a sort key.

### D4. Accent-aware order through column collation `und-x-icu`
A new versioned migration (`V4__owners_list_collation_and_indexes.sql`) alters `first_name`,
`last_name` and `city` to `COLLATE "und-x-icu"`. A plain `ORDER BY` then sorts as a reader
expects, with no `COLLATE` sprinkled through JPQL, and indexes built on those columns inherit
the collation automatically. ICU's root collation is deterministic, so equality and the
case-sensitive `LIKE 'Pot%'` keep their current meaning. The `owner-search.feature` examples stay
green.
*Alternatives:*
- `ORDER BY ... COLLATE` per query: a JPQL native function or a `@Query` per sort, and indexes
  that must repeat the exact expression.
- Changing the database collation: needs a re-created database, and every environment
  would differ until then.

### D5. Indexes
In the same migration:
- `(last_name, first_name, id)` for the `name` sort, in either direction (btree walks backward).
- `(city, last_name, first_name, id)` for the `city` sort.
- `(last_name text_pattern_ops)` for the prefix filter. Under a non-C collation the planner
  can't use a regular btree for `LIKE 'x%'`. `text_pattern_ops` compares bytewise, which is what
  a case-sensitive prefix match needs.

`city,desc` with ascending tie-breakers can't walk the `city` index backward in mixed
directions. The planner then reads the index and runs an incremental sort over each city's
ties, which is cheap because city groups are small. No extra index is added for it.

### D6. Pets per page in one extra query
The pets must not cost N queries. Annotate `Owner.pets` with
`@BatchSize(size = 20)` (Hibernate), matching the maximum page size, so mapping a page of up
to 20 owners triggers one `SELECT ... WHERE owner_id IN (...)`, served by the existing
`pets_owner_id_idx`.
*Alternatives:*
- `JOIN FETCH` with a `Pageable`: Hibernate applies the limit in memory over every joined row
  (HHH90003004), so it's a full table read.
- An `@EntityGraph`: the same problem.
- A second repository call wired by hand: more code for the same SQL.

### D7. Validation and errors
`page` (default 0), `size` (default 10) and `sort` (default `name,asc`) are checked by a small
parser the controller calls: `page ≥ 0`, `size` ∈ {5, 10, 20}, and `sort` per D3. A violation
throws `jakarta.validation.ValidationException`, which the handler added in #40
(`ExceptionControllerAdvice.handleDomainValidation`) already turns into a `ProblemDetail` 400.
No new handler is needed.
*Alternative:* `@Min`/`@Max` on the `@RequestParam`s was rejected. `OwnerRestController` isn't
`@Validated` at class level, so Spring 6.1's built-in method validation would throw
`HandlerMethodValidationException`, which nothing maps, and the request would fail with a 500.
Also, "one of 5, 10, 20" isn't a single standard constraint.

### D8. Frontend: Material table, state in the URL
`OwnerListComponent` swaps the Bootstrap `<table>` for `mat-table` with `matSort`. Only the Name
and City columns get `mat-sort-header`, and `mat-paginator` uses `[pageSizeOptions]="[5,10,20]"`.
The component reads `lastName`, `page`, `size` and `sort` from `ActivatedRoute.queryParamMap`
and loads on every emission (`switchMap`, which also keeps today's "only the latest query
answers" guarantee). Search, sort and page events only call `router.navigate([], {queryParams,
queryParamsHandling: 'merge'})`. The URL is the single source of truth, and back/refresh/shared
links work for free.
- A search or a sort change navigates with `page: 0`.
- A page-size change uses the `pageIndex` that `MatPaginator` computes, which keeps the first
  visible owner on screen.

`OwnerService` returns `Observable<OwnerPage>`, typed from `generated/api-types.ts`.
`getOwners()` and `searchOwners()` merge into one `listOwners(query)`. Row CSS hooks
(`#ownersTable`, `td.ownerFullName`) stay, so the existing e2e locators keep working. The
"no owners" message is shown when `totalElements === 0`.

## Risks / Trade-offs

- **[CI's embedded Postgres may lack ICU]**: the Zonky binaries used by tests must have
  `und-x-icu`, or `V4` fails at boot. → Mitigation: the first task proves the migration on the
  test DB (`JpaMatchesDBSchemaTest` / `DbSchemaExtractorTest`) before any other work. If ICU is
  missing, fall back to a non-ICU libc collation such as `"en_US.utf8"` and re-check the
  Śliwiński scenario.
- **[Breaking API change]**: any client outside this repo that reads `GET /api/owners` as an
  array breaks. → None is known: the MCP server and the chatbot don't list owners. The
  change is called out as **BREAKING** in the proposal and release notes.
- **[Deep offsets degrade linearly]**: page 9,999 of size 10 walks 100k index entries. →
  Acceptable at this volume. Revisit with keyset paging if the volume grows another 10×.
- **[COUNT(*) on every request]**: one index-only scan per request. → Cheap at 100k. Measured in
  the `EXPLAIN ANALYZE` task below.
- **[Seed-based scenario no longer true]**: "Searching with an empty last name lists every owner"
  can't hold with 26 seeded owners and a maximum page of 20. → It's rewritten as "lists the first
  page and reports all 26 owners in the total", and its sequence diagram (`@generate_sequence`)
  is regenerated.
- **[Collation change rewrites the three columns]**: `ALTER COLUMN ... TYPE text COLLATE` rewrites
  the table. → It takes milliseconds at today's size. Running it before the table grows is
  part of why this is done now.

## Migration Plan

1. Ship `V4__owners_list_collation_and_indexes.sql` with the backend. Flyway applies it on boot.
   It's DDL only and changes no data.
2. The backend and frontend deploy together: the response shape changes, and there is no
   compatibility window.
3. Rollback: redeploy the previous backend and frontend. `V4` can stay, because the collation
   and indexes are harmless to the old code (the old list simply sorts nothing).
