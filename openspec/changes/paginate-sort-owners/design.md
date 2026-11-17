# Design

## Context

See [proposal.md](proposal.md) for motivation and
[the browsing spec](specs/owners-browsing/spec.md) for acceptance behavior.
On 17 November 2026 the user approved adopting the previously unconfirmed
recommendations in [Q&A.md](../../../Q&A.md), including the breaking API migration.
After live database inspection, the user also required Romanian alphabetical
ordering rather than retaining the database's default character order.

Observed implementation:

- `OwnerRestController.listOwners` returns `List<OwnerDto>` from
  `OwnerRepository.findByLastNameStartingWith`. The repository extends the narrow
  Spring Data `Repository`, not `JpaRepository`.
- `OwnerMapper` delegates to `PetMapper`, which traverses pets, pet types, and visits.
  Paging only the outer query would leave lazy-loading/N+1 work in mapping.
- `OwnerListComponent` manages an initial subscription and manually cancels it for
  searches. It has no route-state handling; its template conflates missing data and no results.
- `OwnerService` returns arrays. The existing `OwnerPage` interface already declares
  `content`, `totalElements`, `totalPages`, `number`, and `size`.
  The shared HTTP handler logs and rethrows errors despite accepting a fallback parameter.
- `OwnersModule` uses template forms. The design system has `app-combo` for single
  selects but no general-purpose paginator.
- Migrations V1-V3 define nullable TEXT owner columns and an owner primary key,
  but no owner text indexes. Pets and visits have indexed foreign keys.
- No OpenSpec main specs currently exist. The deployment has not changed;
  chatbot tools use MCP repositories, not the REST owner collection.

### Live database verification

Read-only inspection through `db-cli` on 17 November 2026 confirmed the following
in the running `petclinic` database. These are development-data observations,
not assumptions about production or the future 100,000-owner register.

- There are 50 owners, 54 pets, and 37 visits. Three owners have no pets;
  the observed maxima are two pets per owner and three visits per pet.
- All five owner text columns permit NULL and inherit the database collation.
  The only owner index is `owners_pkey`.
- None of the five text fields currently contains NULL, an empty string, surrounding
  whitespace, or a literal `%`/`_`. NULL placement and wildcard escaping are defensive
  behavior, not fixes for observed rows.
- There are two duplicate full-name groups after case folding, so ID tie-breaking
  addresses an actual data case. Names, addresses, and cities contain mixed case.
- Non-ASCII values occur in first names (2), last names (3), addresses (2), and city (1).
  One owner has Romanian characters in their name.
- Database `datcollate` and `datctype` are both `C.UTF-8`. A synthetic ordering probe
  using `lower` put Romanian accented letters after `z`, not beside their base letters.
  Ignoring case does not provide Romanian dictionary ordering.
- The installed PostgreSQL 16.2 exposes deterministic ICU collation `ro-RO-x-icu`.
  A read-only probe of `lower(value) COLLATE "ro-RO-x-icu"` produced Romanian order
  `a, ă, â, b, i, î, j, s, ș, t, ț, z` and its exact reverse for descending order.
  This is the verified basis for the planned sort expressions below.
- A direct LIKE probe confirmed that a lowercase prefix does not match an uppercase
  initial. Preserve this existing search behavior unless separately changed.
- Eighteen telephone values start with zero; 21 do not match exactly ten ASCII digits.
  Preserve existing telephone strings and sort as text; do not clean or reject existing
  records as a side effect of this browsing change.

## Goals / Non-Goals

**Goals**

- Database-level ordering/paging before fetching collections, with no lazy SQL during mapping.
- One explicit API contract independent of framework page serialization.
- A single applied route state driving requests, with a separate unsubmitted search value.
- Focused change using existing controllers, repositories, mappers, error handling,
  design-system controls, and test runners.

**Non-Goals**

- No service layer, new grid framework, data reset, dataset migration, or chatbot change.
- No snapshot pagination under concurrent edits, cursor API, arbitrary multi-sort,
  full-text search, case-insensitive/accent-insensitive filtering, or transliteration.
- No database-wide collation replacement or column collation change; Romanian
  collation applies only to the Owners list's text-order expressions.
- No speculative indexes or performance SLA invented from the 100,000-owner estimate.

## Technical Impact

Technical scope for engineering review:

- **BREAKING**: `GET /api/owners` changes from an array to a page envelope, without
  a separate unpaginated compatibility endpoint. Known clients migrate together;
  unknown external consumers, if any, must adapt.
- Backend changes cover `OwnerRestController`, owner repository queries, list mapping,
  hand-written page DTOs, OpenAPI annotations/examples, and related integration tests.
  Pagination and sorting run on the server across all matching owners.
- Frontend changes cover the Owners service, list component/template/styles/module,
  existing `OwnerPage` type, route state, and tests. Applied criteria live in URL parameters.
  Reuse `app-combo` for page size rather than adding a new selection widget.
- Prevent N+1 retrieval and materialization of the entire register; fetch only selected
  owners and their related data as detailed below.
- Regenerate root `openapi.yaml` via `OpenApiExtractorTest` and then the generated
  TypeScript API types. Preserve owner detail/write/count and MCP contracts.
- Update backend functional collection assertions, Playwright/Cucumber setup, and
  the optional owner latency-proxy performance test.
- Update only the affected Owners user-manual section; retain Q&A as decision provenance.
- No new runtime dependency, service layer, deployment connection, or generic grid framework.
  Use the installed Romanian ICU collation in query expressions; no schema migration
  or speculative index is required by this choice.
- The chatbot uses `/mcp` and repository-backed tools, not this REST list.

## Decisions

### 1. Explicit, breaking page envelope on the existing endpoint

Use `GET /api/owners?page=0&size=10&sort=lastName,asc&lastName=Dav`.
Absent parameters use defaults; explicitly malformed values return 400.
Accept only one sort expression from `lastName`, `address`, `city`, `telephone`,
with direction `asc` or `desc`. No free-form property paths or `firstName`-only sort.
Page is a nonnegative integer within the supported database offset range;
size is exactly 5, 10, or 20. Reject duplicate scalar parameters rather than choosing
one silently. Use the existing REST advice/error format for validation.

Introduce a hand-written page DTO matching the existing frontend `OwnerPage`:
`content: OwnerDto[]`, `totalElements: long`, `totalPages: integer`,
`number: integer`, `size: integer`. Preserve `OwnerDto` and all nested fields.
Keep operation ID `listOwners`, list permission checks, and detail/write/count/MCP
contracts unchanged. Missing `page` does not mean "return everything".

Alternative: versioned endpoint or an opt-in page mode. Rejected because known
runtime consumers can migrate together; no compatibility requirement was found
for an unpaginated endpoint. Unknown consumers remain an explicit rollout risk.
Alternative: serialize Spring's page directly. Rejected to avoid exposing framework metadata.

### 2. Page root IDs first, then fetch the complete selected graph

Keep query logic in the repository layer and coordination in the existing controller.
Add a small repository query implementation/fragment for an ID page plus count.
Use PostgreSQL-native SQL for these two scalar queries so explicit `COLLATE` is
unambiguous; keep graph fetching and DTO mapping in the existing JPA path.
Choose ordering fragments only from a fixed internal allow-list, and bind all
filter, limit, and offset values. Never interpolate caller-provided SQL or identifiers.

1. Select at most `size` owner IDs using database offset/limit, the escaped literal
   last-name prefix predicate, and the complete deterministic ordering.
2. Count matching roots without collection joins or entity materialization.
3. If the ID page is nonempty, bulk-fetch those owners with left fetch joins for
   pets, pet type, and visits. Do not apply pagination to this collection-fetch query.
   Deduplicate roots and restore the ID-page order before passing them to the
   existing mapper. All mapper-reachable data must already be initialized.

Target at most three SELECT statements for a nonempty page, independent of related
entity count, and at most two for an empty page. Avoid adding broad eager mappings
or relying on Open Session in View to complete the graph. The bulk-fetch query must
load nested data in its own result, not depend on entities from the ID query staying managed.
Use Hibernate's fail-on-pagination-over-collection-fetch setting in the focused test.

For names, addresses, and cities, use `lower(column) COLLATE "ro-RO-x-icu"`.
For Name, apply this to both last_name and first_name, with the selected direction
for both keys; append ID ascending. Use explicit `NULLS LAST` on nullable sort keys
in both directions. Telephone remains text-ordered under its existing collation.
Apply the collation before LIMIT/OFFSET, not in Java or the browser after selecting a page.

The collation is a fixed query expression, not a request option or a global database
setting. Keep deterministic ICU behavior and case-fold explicitly: a new nondeterministic
collation is unnecessary and must not change PostgreSQL LIKE behavior.
Use the same escaped literal prefix predicate for ID and count queries, under the
existing column collation; escape `%`, `_`, and the escape character. Do not silently
trim, case-fold, or accent-fold the filter.

Require `ro-RO-x-icu` on every target database, including embedded test Postgres.
Verify its availability and alphabet behavior in focused integration tests; absence
is an explicit deployment/test failure, never a fallback to `C.UTF-8`.
The observed dev installation already has it, so do not issue DDL against that database.

Alternative: collection fetch join with Pageable. Rejected because ORM in-memory
pagination could load the register and corrupt the scalability promise.
Alternative: per-owner fetching or global eager mapping. Rejected due to N+1 or
unrelated read-path changes. Alternative: slim list-only item DTO. Rejected here
to preserve existing item data and limit the breaking change to the page envelope.
Alternative: changing the entire database/column collation. Rejected because it
would affect unrelated queries and filtering. Alternative: only `lower` under
`C.UTF-8`. Rejected after the verified Romanian-letter ordering failure.
Native scalar SQL is chosen over provider-specific Criteria collation extensions
to keep the actual PostgreSQL ordering explicit without adding a dependency.

### 3. URL state is the request source of truth

Use `page`, `size`, `sort`, `lastName` consistently in the frontend and API; page is
zero-based in URLs/API and row ranges are one-based in the UI.
Missing values resolve to defaults without requiring verbose default parameters.
Malformed URL fields are independently replaced by defaults, preserving valid fields,
then corrected with `replaceUrl`. Duplicate known fields normalize to their defaults.
Only navigate for normalization when the URL actually differs.

Subscribe to applied query-parameter state, normalize it, then use `switchMap` to
one typed paginated service call. Do not also call the API directly from button handlers.
Handlers update the route: submit/clear filter, size change, and sort change reset page;
page navigation retains the other applied values.
Normal actions add history entries; corrections and out-of-range recovery replace them.
Keep local search-box text separate from the applied route filter.

Represent loading/success/error inside the switched stream so cancellation of an old
request cannot finalize a newer request's loading indicator. Catch failures inside the
request branch, retaining the route subscription and the standard logged error.
Retry triggers the same applied state without creating another history entry.
Unsubscribe at component destruction using existing Angular/RxJS facilities.

Alternative: local-only state or browser storage. Rejected because refresh, shared
links, and Back/Forward must restore the list. Alternative: imperative overlapping
subscriptions. Rejected because history and request races would have multiple owners.

### 4. Minimal grid controls, existing design-system select

Keep the current table and owner-detail links. Add accessible header buttons for the
four sortable columns, visible direction markers and `aria-sort`; Pets stays plain text.
Use `app-combo` with numeric options 5/10/20, importing `DesignSystemModule`.
Use existing button styling for first/previous/next/last and disable impossible actions.
No raw form select or new generic paginator component.

Render names as `lastName + ', ' + firstName`. Derive the row range from page metadata;
show 0-0 of 0 when empty. Render only current successful data, not stale rows under
new criteria. Provide a loading state, a retryable error state, and distinct empty
messages based on whether an applied filter exists. Keep Add Owner outside result-only
conditional blocks. Preserve draft filter text during paging; route restoration updates
the field when the applied filter itself changes.

If `number >= totalPages` on a nonempty result, replace page with `totalPages - 1`
and request again. If total is zero and page is not zero, normalize to page 0 once;
an empty page-0 response is terminal. Do not alter the API's out-of-range semantics.

### 5. Migrate dependent consumers and generated contracts together

- Update list API annotations and `ApiExamples` to describe the envelope.
  Regenerate `openapi.yaml` through `OpenApiExtractorTest`, then run frontend
  `npm run generate:api`; do not hand-edit generated files.
- Consolidate frontend collection calls around the paginated service method and
  existing `OwnerPage`. Preserve individual-owner read/write behavior.
- Adapt `OwnerTest` and functional owner steps/features from arrays to page content
  and accurate totals. Adjust array-dependent visit setup and tests.
- Do not merely replace `data.find(...)` with `data.content.find(...)` in
  `add-visit.dsl.ts` or owner-search setup: a needed owner may not be on page one.
  Prefer declared fixtures or explicitly create/read the required owner by ID;
  if a scenario intentionally searches the register, navigate pages explicitly.
- Update the optional latency-proxy test to assert the envelope without loosening
  its existing latency/throughput requirements.
- Update the Owners section of the user manual after implementation is browser-verified.
  Do not overwrite concurrent unrelated manual changes.

### 6. Verify data shape, global behavior, and query bounds separately

Use existing backend integration tests with per-test fixtures for metadata, cross-page
ordering, duplicate/case/null keys, literal prefix search, and parameter rejection.
Assert the Romanian letter sequence and its reverse across page boundaries for
Name (including the first-name secondary key), Address, and City; retain case-only
tie tests and prove that prefix search semantics have not changed.
Use focused component/service tests for serialization, route state, Enter submission,
sort/page controls, cancellation, retry, and empty/out-of-range states.
Use a small browser journey for deep-link -> sort/size/search -> details -> Back/refresh.

Add a focused SQL-count assertion with the persistence context cleared before requests:
at most three SELECTs including nested serialization, with repeated pets and visits,
and compare against a larger related-data fixture to detect N+1 growth.
Run a separate opt-in scale check against a disposable test Postgres with 100,000 owners,
including first/deep/final pages and filtered/sorted requests. Assert exact totals, page
bounds and SQL statement limits; record timings without declaring an unagreed SLA.
Never populate/reset the running dev database for this check.

## Risks / Trade-offs

- [Breaking array contract] -> Deploy frontend/backend together and migrate all known
  test/setup clients. Document that unknown external clients need updating.
- [Offset and exact count cost grows at depth] -> Measure the 100,000-owner scale case;
  root materialization stays bounded, but scans/sorts are not claimed constant-time.
  Do not prescribe an index without measured plans and a separate justified decision.
- [Large pet/visit histories inflate the page graph] -> Preserve compatibility for now;
  bounded root count is not a fixed byte bound. A future slim list contract would be
  an explicit behavior change, not a hidden shortcut here.
- [Rows/count can change between queries] -> Deterministic ordering is guaranteed on
  unchanged data, not a snapshot. Empty-page recovery handles a disappearing last page.
- [Nullable text] -> The live schema permits NULL but current text data contains
  none. Keep explicit null placement as defensive behavior.
- [ICU availability and version differences] -> Require the verified Romanian
  collation on target databases and test representative alphabet ordering.
  Do not silently substitute the default collation. Recheck collation versions
  and relevant indexes when PostgreSQL/ICU is upgraded.
- [Shared dirty worktree] -> Touch only scoped implementation files when apply is requested;
  integrate rather than discard parallel owner/visit/manual changes.

## Migration Plan

1. Verify Romanian ICU collation availability on target databases; implement and
   verify backend page/retrieval behavior and its focused tests. No database or
   column collation is altered, so there is no collation data migration or rollback.
2. Regenerate the API contract/types and migrate UI plus dependent test clients as one change.
3. Run focused integration/frontend/browser/scale checks and existing relevant contract gates.
4. Release backend and frontend together; no data migration or backfill is required.
5. If rollback is needed, roll back both application sides and generated contracts together.
   Existing rows and MCP clients require no rollback action.
