# Design

## Context

See [proposal.md](proposal.md) for motivation and the interview decision provenance.

Observed implementation:

- OwnerRestController.listOwners returns List<OwnerDto> through
  OwnerRepository.findByLastNameStartingWith; there is no paging API.
- OwnerListComponent loads the array and separately subscribes to searches, cancelling the prior
  subscription to prevent stale initial results. The table displays firstName + space + lastName.
- OwnerPage already describes the required envelope but is unused by this component/service.
- OwnerMapper traverses pets, and PetMapper traverses visits. Reusing the detail response for the
  grid would fetch and transfer data the grid never displays.
- The existing Cucumber owner-search feature explicitly tests case-sensitive prefix search and
  currently expects every owner on one screen. Its multi-page expectation must change.
- Architecture requires controllers to call repositories/mappers directly, not a pass-through service.

Live database inspected during this discussion: 27 owners, including compound and accented names;
owners has integer primary key and nullable text fields, with only owners_pkey indexed.
The English ICU collations en-x-icu and en-US-x-icu are available. These are observations of the
current local database, not guarantees about every environment.

## Goals / Non-Goals

**Goals:** Define one canonical server order, bounded row materialization, a compatible API addition,
and a single route-driven frontend state flow. Keep query implementation in the repository layer.

**Non-Goals:** A reusable grid framework, a new service layer, cursor pagination, cross-request
snapshot isolation, changing existing detail DTOs, or speculative indexing of every column.

## Decisions

### 1. Add an explicit endpoint rather than changing the array contract

Add GET /api/owners/page under the existing controller and OWNER_ADMIN authorization.
Keep GET /api/owners and its consumers unchanged.

| Parameter | Default | Accepted values |
| --- | --- | --- |
| page | 0 | Nonnegative integer with safely computed offset |
| size | 10 | 5, 10, 20 |
| lastName | empty | Existing literal, case-sensitive prefix semantics |
| sort | name | name, address, city, telephone |
| direction | asc | asc, desc |

Use an explicit handwritten page DTO, not Spring's internal Page serialization. Return content,
totalElements, totalPages, number and size, matching the existing frontend OwnerPage envelope.
Each grid row contains id, firstName, lastName, address, city, telephone and pets containing only
id/name. Add a narrow row type and adapt OwnerPage to that type; preserve the detail Owner model.
This keeps pet names available without recursively loading visits.

Return empty content and current totals for an out-of-range nonnegative page; the UI recovers
using those totals. Do not silently clamp invalid inputs. Use checked offset arithmetic and
reject values outside the supported numeric range explicitly.

Bind and validate inputs explicitly. Extend the existing scoped REST advice only as needed so
bad enum/type/range inputs produce logged HTTP 400 ProblemDetail responses rather than falling
through its broad 500 handler. Do not alter unrelated exception behavior.

Alternative rejected: overloading /api/owners to return different JSON shapes based on parameters
would complicate existing consumers and generated contracts.

### 2. Compare the displayed full name with English ICU collation

For name ordering compare the same first-name-space-last-name string displayed in the table;
never split names on spaces or infer a surname from the last token. Use PostgreSQL's verified
"en-x-icu" collation for name/address/city/telephone in both directions. Preserve case and accents;
do not apply unaccent or lower as substitutes for language collation.

Treat null/empty sort values as missing, placed last in either direction. A name with both parts
missing is missing; otherwise coalesce missing parts to empty text consistently in rendering and
sorting. Keep owner ID ascending as the final tie-breaker even for descending primary order.

Resolve sort keys and directions from fixed server-owned allowlists; user text never becomes an
SQL expression. Parameterize all values and escape prefix LIKE metacharacters to retain literal
Spring Data StartingWith behavior. Prefix matching remains case-sensitive and does not inherit
sorting's locale rules.

Do not silently substitute database-default collation on environments missing English ICU.
Add an embedded-Postgres integration assertion for its availability and report an unsupported
environment explicitly if absent. Existing ICU support means no collation migration or extension
is currently needed.

Alternatives rejected: sorting only the visible page, separate surname ordering behind a full-name
header, raw code-point ordering, and downloading the full list for browser Intl.Collator.

### 3. Use bounded projection queries in a custom owner-repository fragment

There is no existing paging/JDBC helper in the backend to reuse. Add a focused custom fragment
to OwnerRepository, using Spring's named-parameter JDBC support for PostgreSQL projection SQL.
Keep orchestration inside that repository fragment; the controller validates/delegates.

For a nonempty page, use at most three SQL statements:

1. Count owners matching the literal prefix.
2. Select the owner scalar fields with the selected allowlisted order, LIMIT and OFFSET.
3. Fetch pet id/name/owner_id for only the returned owner IDs, in the existing case-insensitive
   alphabetical display order, and attach them to rows in the selected owner order.

Skip pet lookup for an empty page. Never collection-fetch-join a paged owner query: it risks
in-memory pagination, duplicate rows and incorrect limits. A narrow projection also avoids
OwnerMapper/PetMapper's visits traversal. Reuse existing mapper conventions where suitable,
without expanding detail mapping or modifying entity fetch modes.

Inspect EXPLAIN (ANALYZE, BUFFERS) for first/middle/last pages, each sort and selective prefix
queries on an isolated 50,000-owner fixture. Do not add indexes merely because only the primary
key exists: add a matching expression/prefix index via a new versioned schema migration only if
the measured plan warrants it. Never edit frozen migrations or populate the shared live database.

Offset pagination is deliberate at this scale: it supports first/last and exact totals.
Cursor pagination would not fit the agreed navigation model.

### 4. Drive requests from route query parameters

Use page, size, lastName, sort and direction in the Owners route. Defaults apply only to omitted
parameters. Keep the search input's draft distinct from the submitted URL filter.
User actions update the route; one distinct route-state stream uses switchMap for HTTP requests.
Cancel on destruction, and ensure cancellation/finalization of an older request cannot clear a
newer request's loading indicator.

Initial order is name ascending. New-column clicks start ascending; same-column clicks toggle.
Search, sort and size changes reset page to zero, retaining all other applicable state.
Browser Back/refresh restores submitted state. Existing detail links remain usable; browser
Back restores the previous list URL.

For invalid URL state, show the bad-parameter error and a Reset grid action that explicitly
replaces it with defaults. For a successful out-of-range page, replace the URL with the last
valid page (zero if empty) and load it; if concurrent changes repeatedly invalidate that recovery,
show an explicit retryable message instead of looping indefinitely.

Alternative rejected: independently mutating local state plus URL plus HTTP subscriptions creates
duplicate requests and restoration races.

### 5. Keep controls local and reuse the design-system single-select

Use the existing table/Bootstrap styling, header buttons with aria-sort on the appropriate th,
visible focus, and first/previous/next/last buttons plus current/total page and row range.
Pets stays a plain header. Integrate DesignSystemModule and app-combo for labelled page size;
do not introduce raw form selects or a generic pagination component for this one screen.

Display distinct loading, success, empty and error states. Hide stale rows while loading so
old data is never labelled with new criteria. Errors include Retry for the current route state;
use the existing HttpErrorHandler logging/propagation, which already throws rather than returning
the fallback argument. Keep Add Owner and search outside the rows-only conditional.
Announce status with an accessible live region. Show zero results rather than "page 1 of 0".

### 6. Verify behavior and scale without inventing a latency SLA

Extend focused backend owner tests for metadata, cross-page ordering, Unicode/compound names,
ties, null/empty keys, all sorts/directions, literal prefixes, validation, compatibility and auth.
Use embedded Postgres, not an in-memory SQL substitute, for collation and pagination behavior.
Assert no visit histories in the new contract and no page-size-dependent query growth.

Extend the existing owner-service/list Angular tests for parameter encoding, state transitions,
Back/restore, errors/retry, out-of-range recovery, cancellation and accessible controls.
Update the existing Cucumber empty-search expectation to traverse pages and verify the complete
set; add a focused browser scenario for sorting, paging and return navigation.

Run an isolated 50,000-owner integration experiment: all four sort keys in both directions at
first/middle/last positions, plus selective prefix searches and size 5/10/20 boundaries.
Record timings/plans but do not claim a product latency SLA the user never provided.
Measurable acceptance is bounded rows, correct totals/order, no visits and at most three data
statements per page, independent of size. Performance tuning follows the measured evidence.

## Risks / Trade-offs

- [Concurrent inserts/deletes can shift offsets and counts between requests] -> Stable ID ties and
  bounded recovery prevent deterministic-order bugs, but do not promise a browsing snapshot.
- [ICU collation varies across PostgreSQL builds/versions] -> Verify English ICU in embedded tests
  and deployment; never silently degrade to code-point order.
- [Count and deep-offset work can grow] -> Measure on the target volume before choosing indexes;
  bounded application row materialization does not imply the database avoids scanning rows.
- [Existing legacy array API remains unbounded] -> Preserve compatibility while the grid uses only
  the new endpoint; migrating other consumers is explicitly outside this change.
- [Pets per owner are not capped] -> Fetch only pet names/IDs for the selected owners, never visits;
  avoid claiming a fixed byte bound independent of an owner's number of pets.

## Migration Plan

1. Ship the additive API and focused tests first; existing array clients continue to work.
2. Regenerate openapi.yaml through OpenApiExtractorTest and frontend types with existing tooling.
3. Switch the Owners grid to the new API and update affected browser acceptance expectations.
4. Update the user manual's Owners section and record the agreed Pets sorting exception in the
   implementation PR/issue discussion; no remote issue changes are part of this planning step.
5. If measured tuning requires an index, add only a new schema migration; no seed changes.
6. Roll back the frontend switch independently if required. Leave the additive endpoint compatible;
   remove it only once no deployed consumer depends on it. Do not roll back data or rewrite migrations.
