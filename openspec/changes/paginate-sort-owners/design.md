# Design

## Context

See [proposal.md](proposal.md) for motivation and [owner-list requirements](specs/owner-list/spec.md) for acceptance behavior.

Read-only inspection of `db27oct` found:

- `OwnerRestController.listOwners` returns `List<OwnerDto>` from `findByLastNameStartingWith`, with array-shaped OpenAPI annotations and examples.
- `OwnerRepository` exposes Spring Data `Repository`, not a full CRUD repository. Keep that narrow interface and add only needed query methods.
- Owners have lazy `Set<Pet>` collections, pets have lazy `Set<Visit>` collections, and `PetMapper` reads visits and pet types. Fetching only pets would still leave N+1 loads during mapping.
- `OwnerListComponent` unsubscribes the previous search request, but its initial `finalize` and separate load/search paths need consolidation to protect all page state.
- `OwnerPage` already exists but is unused and carries extra Spring-style metadata. `OwnerService` still returns arrays. The shared error handler logs and rethrows errors; its apparent fallback arguments do not actually turn errors into empty results.
- `OwnersModule` does not import paginator/sort modules; Material 16.2.1 is already installed.
- Migrations V1-V3 exist. V1 gives owners only a primary-key index and already indexes `pets.owner_id` and `visits.pet_id`; no existing owner prefix or sort index was found in the migration chain.
- Cucumber's empty-search scenario and glue currently assume one response lists every owner. `AddVisitApiTest` also searches the list response to discover fixture owners.

Q1-Q4 in the source Q&A are explicit decisions. Q5-Q15 remain adopted assumptions for review, not newly confirmed business decisions. Reported live collation and dataset statistics come from that document; this planning run inspected migration files, not a live database.

## Goals / Non-Goals

**Goals:** Apply pagination before association fetching; keep a bounded query count through serialization; expose a small application-owned wire contract; implement one coherent frontend request lifecycle.

**Non-Goals:** Introduce a service layer, change entity fetch defaults, retrofit unrelated grids, modify tracing/guardrail infrastructure, or claim a live performance result from planning alone.

## Decisions

### 1. Application-owned envelope and explicit request validation

Add `OwnerPageDto` as a record with only `List<OwnerDto> content` and `long totalElements`. Use a matching generated frontend type, reducing the existing `OwnerPage` to an alias or equivalent exact envelope rather than maintaining duplicate metadata.

Validate zero-based nonnegative integer pages, size membership, and the entire sort token before querying. Omitted parameters receive defaults; malformed or unsupported values produce the existing REST error style with HTTP 400. Keep authorization unchanged. Update the list operation's annotations and sample response, then regenerate rather than manually edit OpenAPI output.

Map business keys to explicit Spring `Sort` chains. Apply the requested direction to all chain members; this is a small adopted assumption resolving the Q&A's unspecified tie-direction detail. Reject arbitrary entity property names and multiple/malformed sort expressions. Configure the frontend sort controls to alternate asc/desc without emitting an unsupported unsorted state.

**Alternatives:** `PageImpl` serialization adds unwanted framework metadata; a parallel endpoint violates Q2; accepting field names exposes entity structure; mixed-direction tie breakers make the proposed ordering indexes less directly reusable.

### 2. Page first, fetch the selected graph second

Use a pageable prefix query returning a Spring `Page<Owner>` internally, with an owner-only count query. Preserve Spring Data's literal-prefix escaping and case-sensitive semantics.

For a non-empty page, run one separate unpaged query over its owner IDs with left fetch joins for pets, their visits, and their types. Both collection relationships are sets, avoiding multiple-bag fetching; distinct owner roots prevent duplicate DTOs. Do not put `Pageable`, LIMIT, or OFFSET on this collection-fetch query. Include owners without pets and pets without visits.

Build an ID-to-fetched-owner lookup and map in the original page order: an `IN` predicate does not preserve ordering. Map the explicitly fetched results, not detached page entities whose collections might still be lazy. Skip graph fetching when the page is empty. Do not silently drop a missing selected owner; surface an unexpected mapping inconsistency through normal error handling.

The budget is at most three SQL SELECTs for a full cold page: page selection, count, and graph fetch. Spring Data may legitimately avoid counting a partial first page. Test the upper bound rather than insisting that every request always uses exactly three statements. Include DTO serialization in measurement and disable caches/clear the persistence context after fixture setup. Enable the Hibernate collection-pagination fail-fast setting in the relevant tests so in-memory paging fails rather than merely logging a warning.

**Alternatives:** collection-fetch pagination can load the entire matching dataset; per-owner lazy loading causes N+1; a slim DTO would break nested-data compatibility. Do not add a new transactional service or blanket transaction merely for these reads.

### 3. New indexes, verified under representative conditions

Add `V4__owner_list_indexes.sql`, leaving V1-V3 and repeatable seed data unchanged:

- B-tree on `owners (last_name text_pattern_ops)` for selective prefix filtering under a non-C collation.
- B-tree on `owners (last_name, first_name, id)` for Name order.
- B-tree on `owners (city, last_name, first_name, id)` for City order.

Uniform ascending/descending chains permit forward/backward traversal of the ordering indexes. Prefix filtering and ordering use different indexes; do not assume the planner can satisfy every combined query using one index or that a broad prefix should force an index scan.

For this change, verify database-level pagination and the bounded query count with small functional fixtures. Large-dataset measurements and load testing are deferred until budget is available; they are not merge requirements or evidence of validated performance today. A future measurement can use 100,000 representative owners in an isolated database and inspect query plans for filtering, sorting, counts, and late pages. Never reset the shared development database for that experiment.

**Alternatives:** a plain last-name B-tree does not support this locale's prefix LIKE pattern as needed; adding indexes to old migrations breaks Flyway history; keyset pagination conflicts with numbered pages and the selected API.

### 4. One frontend page-loading path

Keep the Bootstrap table and add `MatSort` with Name/City header keys plus `MatPaginator` in `OwnersModule`. Configure size options `[5,10,20]`, size 10, page index 0, and initial Name ascending. A new reusable design-system paginator is not warranted for one grid.

Use `HttpParams` in the service, returning the exact page type for initial and filtered reads. Have existing list/search entry points delegate to one query-building path if retaining both; every actual caller and spy must receive the same envelope.

Keep separate draft and submitted prefixes. Centralize initial load, submitted search, pagination, size changes, and sorting in one method carrying submitted prefix, page index, size, key, and direction. Each UI action updates state and starts exactly one request. Use one form submit handler rather than competing click/submit paths.

Cancel the previous subscription before setting the new request's loading state; use a request identity guard for success, error, and completion if cancellation alone cannot protect all callbacks. Unsubscribe on destruction. Do not let an earlier `finalize` mark a newer request as complete.

Render rows from `content` and length from `totalElements`. Show the no-results message only after a successful zero-total result, using the submitted prefix; keep errors separate and explicitly visible. A nonzero-total empty page must leave navigation available rather than showing no matches. Preserve Add Owner access and existing owner links across loading/empty/error layouts.

**Alternatives:** client-side slicing still downloads all owners; rebuilding as a Material table is unnecessary; URL state and a shared pagination abstraction are outside this change.

### 5. Migrate consumers according to their actual usage

- Adapt `OwnerTest`, `OwnerSteps`/`owners.feature`, owner-list-dependent visit test setup, and the latency-proxy response assertion to `content` and `totalElements`.
- Tests that need an owner anywhere in the dataset must use a selective filter or traverse pages, not assume that default-page membership includes their fixture.
- Preserve authentication tests; only adjust body assertions if they depend on the old envelope.
- Update owner service/component tests and any list fixtures/mocks found by a focused consumer search.
- Change the traced empty-search scenario to assert the first page and total, and add a page-traversal scenario that proves all owners are reachable without duplicates. Update its API fixture-loading glue to collect pages and its order-insensitive helper with ordered assertions where sorting is under test.
- Audit Playwright specs and the JMeter plan. The inspected JMeter owner paths are CRUD requests, not an evident list consumer: change it only if a sampler/assertion actually depends on the list contract.
- Regenerate contracts and existing sequence outputs. Leave trace generation, guardrail code, and `human-review.json` unchanged; the project's tooling-on-main rule applies if a tooling change becomes genuinely necessary.

**Alternatives:** changing every file named by the Q&A indiscriminately would introduce unrelated edits; merely updating JSON paths would leave tests that wrongly expect all owners on the default page.

## Risks / Trade-offs

- [Concurrent writes can change offset pages or counts between statements] -> Stable ordering guarantees traversal for an unchanged dataset, not a cross-request snapshot; keep snapshot/keyset work out of scope.
- [A selected owner has many visits, inflating fetched association rows] -> Restrict graph fetching to page IDs and preserve current DTO compatibility; a slim list DTO would need a separate contract decision.
- [Cold-query tests accidentally benefit from fixture persistence/caches] -> Flush and clear setup state, disable caches, count through HTTP serialization, and compare populated sizes 5 and 20.
- [Indexes do not eliminate large offsets or broad counts, and performance at 100,000 owners remains unverified] -> Verify bounded retrieval now; defer large-dataset and load measurements until budget is available. Preserve the existing proxy test's thresholds, but do not run it as part of today's validation.
- [Clearing sort or duplicate paginator/form events sends invalid or redundant requests] -> Disable sort clearing, centralize state transitions, and assert one HTTP call per event.
- [Breaking deployment temporarily mixes array and page consumers] -> Ship backend and frontend atomically and roll back both together.

## Migration Plan

1. Write failing contract, query-budget, and UI tests before implementation.
2. Implement the new envelope, validation, database queries/index migration, and frontend controls; migrate actual list consumers.
3. Regenerate OpenAPI/types and affected traced diagrams using existing commands. Run focused functional tests, strict frontend build, API lint/drift checks, and migration validation. Exclude load/performance tests from test selectors; defer 100,000-row measurements and explicitly report performance as unverified.
4. Update #25 with the corrected implementation status and Name/City scope; notify Bizu through the project's available issue channel. Update `AGENTS.md` only for actual knowledge drift. Keep the chatbot deployment-diagram correction separate.
5. Deploy backend and frontend together. Roll back application versions together if needed; the additive indexes can remain because the old application is compatible with them. Do not edit or delete a migration already applied to a persistent environment.
