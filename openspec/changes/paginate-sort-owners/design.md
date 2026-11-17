# Design

## Context

See [proposal.md](proposal.md) for motivation and
[the browsing spec](specs/owners-browsing/spec.md) for acceptance behavior.
On 17 November 2026 the user approved adopting the previously unconfirmed
recommendations in [Q&A.md](../../../Q&A.md), including the breaking API migration.

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
  full-text search, case-insensitive filtering, or accent/transliteration policy.
- No speculative indexes or performance SLA invented from the 100,000-owner estimate.

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
Add a small repository query implementation/fragment for an ID page plus count,
using JPA Criteria with fixed allow-listed sort expressions:

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

Construct case-insensitive sort expressions with `lower` for text fields except telephone.
Apply the direction to the selected field, and to firstName for Name sorting;
append ID ascending. Explicit null discriminators place nulls last in both directions
because schema columns are nullable. Use the same filtering predicate for ID and count
queries; escape `%`, `_`, and the escape character to preserve literal prefix semantics.
Do not silently trim or case-fold the filter.

Alternative: collection fetch join with Pageable. Rejected because ORM in-memory
pagination could load the register and corrupt the scalability promise.
Alternative: per-owner fetching or global eager mapping. Rejected due to N+1 or
unrelated read-path changes. Alternative: slim list-only item DTO. Rejected here
to preserve existing item data and limit the breaking change to the page envelope.

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
- [Nullable text and locale collation] -> Explicit null placement and lower-case ordering;
  PostgreSQL collation defines accent behavior, with no new locale promise.
- [Shared dirty worktree] -> Touch only scoped implementation files when apply is requested;
  integrate rather than discard parallel owner/visit/manual changes.

## Migration Plan

1. Implement and verify backend page/retrieval behavior and its focused tests.
2. Regenerate the API contract/types and migrate UI plus dependent test clients as one change.
3. Run focused integration/frontend/browser/scale checks and existing relevant contract gates.
4. Release backend and frontend together; no data migration or backfill is required.
5. If rollback is needed, roll back both application sides and generated contracts together.
   Existing rows and MCP clients require no rollback action.
