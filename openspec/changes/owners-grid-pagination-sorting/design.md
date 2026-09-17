## Context

`GET /api/owners` currently returns `List<OwnerDto>` from `ownerRepository.findByLastNameStartingWith(lastName)`
with no `Pageable`, no sort, and no cap. The frontend (`OwnerListComponent`) fetches the whole list
and renders it in a plain Bootstrap `<table>`; there is no `MatTable`/`MatSort`/`MatPaginator`
anywhere in the app today (Angular Material is only used for `MatSelect`, `MatDatepicker`,
`MatSnackBar`). An orphaned `OwnerPage` interface (`{content, totalElements, totalPages, number,
size}`) already exists in the frontend but nothing imports it. See proposal.md for why this needs
to change now (~100k owners expected within a year).

Consumers of `GET /api/owners` today: the Owners grid, `OwnerTest`, `AddVisitSequenceTest`,
`BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`, cucumber `OwnerSteps`, the
Playwright E2E glue, and the `start-apps.ts` healthcheck. The chatbot and MCP server only call
`GET /api/owners/{id}` and are unaffected.

Database: `owners(id, first_name, last_name, address, city, telephone)`, all text columns nullable,
only index is `owners_pkey`, collation `en_US.UTF-8` (non-C). Under this collation a plain btree on
`last_name` serves `ORDER BY last_name` but not `LIKE 'Pot%'` (which needs `text_pattern_ops`,
which in turn doesn't serve `ORDER BY`) — the two cannot be covered by one index.

## Goals / Non-Goals

**Goals:**
- Move paging, sorting, and last-name filtering into the database, on the existing `GET
  /api/owners` endpoint.
- Keep the endpoint safe against unbounded requests: capped page size, allowlisted sort
  properties, both rejected with 400 rather than silently truncated or 500ing.
- Keep pagination deterministic even with many equal sort values (repeated cities, blank values
  in nullable sortable columns).
- Preserve the `#ownersTable` / `td.ownerFullName` E2E selectors the Playwright suite depends on.

**Non-Goals:**
- No `text_pattern_ops` index for `LIKE` search in this change — added only if profiling shows the
  prefix search needs it.
- No deep-linking of page/sort/filter state into the URL.
- No multi-column simultaneous sort in the UI (backend allows repeating `sort=`, but `MatSort`
  itself only drives one column at a time).
- No change to `city` indexing — it stays unindexed as a sortable column; `address` and
  `telephone` are excluded from sorting entirely (Decision 4), so their indexing isn't a concern
  here.

## Decisions

**1. Envelope on the existing endpoint (`PageDto<OwnerDto>`), not headers or a new endpoint.**
Alternatives considered: array + `X-Total-Count`/`Link` headers (preserves backward compatibility,
but nothing external depends on the old shape here, so paying for that ergonomics loss buys
nothing); a new endpoint leaving the old `GET /api/owners` unbounded in production (recreates the
exact problem being fixed). A hand-written `PageDto<T>` is used instead of serializing Spring's
`Page`/`PageImpl` directly — Spring Boot 3.3+ warns its JSON shape isn't a stable contract, and
`openapi.yaml` needs an explicit schema regardless.

**2. `page`/`size`/`sort` request parameters, bound via Spring's `Pageable` resolver.**
`listOwners(@RequestParam String lastName, Pageable pageable)` gets multi-value `sort` support and
zero hand-written parsing for free. A custom `sortBy`/`sortDir` pair was considered and rejected —
it would mean writing and testing a parser with no multi-sort support, for no benefit over the
built-in resolver. `sort=<property>,<direction>` follows Spring's convention (last token is
direction); multi-sort is expressed by repeating the parameter. `page` stays 0-based (Spring's
default, and `MatPaginator.pageIndex` is also 0-based) — `one-indexed-parameters` is left off since
turning it on would introduce an off-by-one translation neither side needs.

**3. Page size default 10 / cap 20, enforced locally, not via the global
`spring.data.web.pageable.max-page-size` property.**
That property is global (would affect any future `Pageable` endpoint) and — more importantly —
truncates an out-of-range `size` silently before the controller ever sees the request, so there's
no way to return a 400 for it. Instead: `@PageableDefault(size = 10, sort = "name")` on the
parameter (default visible at the endpoint, not three files away in `.properties`), plus an
explicit `size > 20` check in the controller that throws into the existing
`ExceptionControllerAdvice` (which already maps `ConstraintViolationException` → 400) for a real
400 response. Spring has no per-endpoint max-size annotation, so this local guard doesn't reinvent
anything — it's the only way to get a local, explicit cap.

**4. Sort keys are two opaque, UI-facing names — `{name, city}` — not raw JPA entity properties.**
`lastName` and `firstName` are deliberately *not* independently sortable. The grid has exactly one
sortable identity column (Decision 6), so accepting `lastName`/`firstName` as separate sort keys
would let a client ask for combinations the UI can never produce — sort by first name alone, or
`sort=lastName,asc&sort=firstName,desc` with mismatched directions — none of which correspond to
anything meaningful to show. `name` is resolved server-side into `Sort.Order`s on `lastName` then
`firstName`, both carrying the direction the client requested; `city` maps directly to the `city`
column. `pets` is excluded because it's a collection, not a sortable scalar. `address` and
`telephone` are excluded on evidence, not by default: querying the database showed 27 of 28 seeded
owners have a distinct `address` and a distinct `telephone` value each (vs. only 20 distinct `city`
values), so an alphabetical/numeric sort on either produces an order with no grouping value —
sorting by `telephone` in particular just orders by country-code prefix. Any name outside `{name,
city}` — including raw entity property names like `lastName`, `firstName`, or `id` — is rejected
with 400. Without this validation, an unrecognized Spring Data property throws a runtime exception
that surfaces as 500, and a property like `pets.name` would let a client force an arbitrary join
across a 100k-row table; keeping the vocabulary opaque also means the API never leaks the entity's
actual field names.

**5. Every sort gets an `id ASC` tiebreaker plus `NULLS LAST` in both directions.**
Needed because ties are common (many owners share a city) and nullable sortable columns exist in
the schema even where the current seed has no nulls; Postgres's own default (`NULLS LAST` on ASC,
`NULLS FIRST` on DESC) would otherwise make a second click on a nullable column dump every blank row
to the top, reading as broken. Implemented by adding an explicit `Sort.Order` with `id` ascending
after the requested sort, and applying `.nullsLast()` to each requested `Sort.Order`. Collation is
left as the database default (`en_US.UTF-8`), so sorting stays case-sensitive, consistent with the
already case-sensitive `lastName` prefix search.

**6. `Name` stays one column ("LastName, FirstName"), sorted by the composite `name` key.**
Considered splitting into separate `First name`/`Last name` columns so "any column" sortable is
literally true per-column; rejected in favor of keeping the grid width unchanged, since a single
combined column sorted primarily by last name already reads as sorted. Clicking the header sends
`sort=name,<direction>`; the server expands this into `lastName` then `firstName`, both in that
same direction (Decision 4), so reversing the column reverses the tiebreak too and the compound key
stays coherent in both directions.

**7. `Owner.pets` gets `@BatchSize`.**
A collection `JOIN FETCH` alongside `Pageable` triggers Hibernate's `HHH000104` warning and
pagination happens in memory; leaving the collection lazy without `@BatchSize` means N+1 queries
per page. `@BatchSize` gets one extra query per page instead of either problem.

**8. `owners(last_name, first_name, id)` composite index; no `text_pattern_ops` yet.**
Backs the default and most common explicit sort. `city` — the one other allowlisted sort column —
stays unindexed: adding an index "just in case" isn't justified without evidence, and it's the
real, visible cost of keeping `city` sortable at this scale. `address` and `telephone` need no
indexing decision at all, since Decision 4 excludes them from sorting outright. `text_pattern_ops`
(needed for the `LIKE 'Pot%'` prefix search under the non-C collation) is deferred until profiling
shows it's needed; it can't be combined with the plain btree in one index.

**9. `totalElements` computed via `COUNT(*)` per request.**
An alternative (`Slice` instead of `Page`) would drop the total from the response entirely and
remove the count query, but `MatPaginator` expects a total length to render page numbers /
last-page state; the count query is accepted as the cost of that UX.

## Risks / Trade-offs

- **[Risk]** Response shape change is breaking for any external consumer of `GET /api/owners`.
  → **Mitigation:** confirmed only in-repo consumers exist (grid, tests, E2E, healthcheck); all are
  updated as part of this change.
- **[Risk]** `COUNT(*)` per request adds cost at 100k rows. → **Mitigation:** backed by the new
  index; revisit with `Slice`-based "next page exists" UX if COUNT proves to be the bottleneck.
- **[Risk]** Allowlist must be kept in sync if new sortable owner fields are added later.
  → **Mitigation:** allowlist lives next to the endpoint, single place to update; validated by a
  test that asserts unknown/`pets`/`address`/`telephone` sort properties are rejected.
- **[Risk]** `city` remains unindexed, so sorting by it at 100k rows does a full sort without index
  support. → **Mitigation:** explicitly accepted trade-off (see Decision 8), revisit only if
  profiling shows it matters.

## Migration Plan

- Add the `owners(last_name, first_name, id)` index and `@BatchSize` via a new versioned Flyway
  migration in `db/migration/` (schema-only, no seed rows per project convention).
- Update `OwnerRestController#listOwners`, add `PageDto<T>`, and regenerate `openapi.yaml` via
  `OpenApiExtractorTest` (never hand-edit it).
- Update `OwnerService`/`OwnerListComponent` together with the backend change so the frontend never
  points at an endpoint whose new shape it doesn't understand yet.
- Update or rewrite the affected backend and E2E tests (see proposal.md - Impact) in the same
  change; no separate rollout step, no feature flag — this is a single coordinated deploy of
  backend + frontend + tests.
- Rollback: revert the commit; the new index and `@BatchSize` change are additive/backwards
  compatible on their own, so no separate down-migration is required for those.
