# GH #25: Owners Grid Pagination - Design Q&A

## Grounded facts

- GitHub issue #25 requires the Owners grid to be sortable and paginated with page sizes 5, 10, or 20.
- The target is about 100,000 owners.
- `GET /api/owners` currently accepts an optional `lastName` prefix and returns an unbounded `List<OwnerDto>`.
- The embedded `mxGraphModel` in `petclinic-backend/docs/Deployment.drawio.png` proves the Frontend is the Backend's only inbound consumer: `e-fe-be` is `frontend -> backend`; the database and notification-service edges are outbound.
- The current list payload is deep: `OwnerDto -> PetDto -> VisitDto`, even though the grid only renders pet names.
- The real schema has no owner search/sort indexes. It already has `pets(owner_id)`.
- OpenAPI flows from Java to generated `openapi.yaml`, then to generated frontend `api-types.ts`.

## Interview decisions

### Q1. What scale must the design support?

**Answer:** About 100,000 owners. Filtering, sorting, and pagination execute in PostgreSQL; the browser never downloads the whole table.

### Q2. Which columns are sortable?

**Answer:** Name and City only. Address, Telephone, and Pets remain display-only because their useful ordering semantics do not justify query and index complexity. This intentionally narrows the issue's phrase "any column."

### Q3. What does Find Owner match?

**Answer:** Preserve the existing last-name-prefix behavior. The filter composes with paging and sorting.

### Q4. How does the API evolve?

**Answer:** Change `GET /api/owners` in place. There is no compatibility endpoint or API version because the deployment model proves the Frontend is the only consumer, and retaining an unbounded endpoint would remain unsafe.

### Q5. What is the page response contract?

**Answer:** An application-owned `OwnerPageDto`, not raw `Page`/`PageImpl` serialization. Fields: `content`, `totalElements`, `totalPages`, `number`, and `size`.

### Q6. What does each page row contain?

**Answer:** A slim list DTO with `id`, `firstName`, `lastName`, `address`, `city`, `telephone`, and `petNames`. Full pets, types, and visits remain on `GET /api/owners/{id}`.

### Q7. How are pet names loaded?

**Answer:** User-selected override: Hibernate `@BatchSize(20)` on `Owner.pets`. Do not use `JOIN FETCH` with pagination. A query-count test must prove a full page does not regress to N+1 queries.

**Original recommendation:** One explicit second query for pet names. The selected batch-fetch approach is acceptable because page size has a hard maximum of 20 and `pets(owner_id)` already exists.

### Q8. Which page sizes does the API accept?

**Answer:** Exactly 5, 10, or 20; default 10. This is a backend invariant, not merely a UI menu.

## Remaining decisions resolved with recommended answers

### Q9. What are the request parameters and defaults?

**Answer:** `lastName` defaults to empty, `page` is zero-based and defaults to 0, `size` defaults to 10, `sort` accepts `name` or `city` and defaults to `name`, and `direction` accepts `asc` or `desc` and defaults to `asc`. Use an application-owned validated request model rather than exposing raw `Pageable`.

### Q10. What happens on invalid query parameters?

**Answer:** Return HTTP 400 before querying. Reject negative pages, sizes outside `{5,10,20}`, unknown sort keys, and unknown directions through the existing `ExceptionControllerAdvice`; never clamp or silently fall back.

### Q11. How is ordering made stable across pages?

**Answer:** Expand sort keys server-side. Name is `(lastName, firstName, id)`; City is `(city, lastName, firstName, id)`. Apply the requested direction to the whole chain. The unique `id` suffix prevents duplicates and omissions where names or cities tie.

### Q12. How should Name be displayed?

**Answer:** Render `LastName, FirstName` in the grid so the visible sequence matches last-name-first sorting. Owner detail remains `FirstName LastName`.

### Q13. Which indexes are required?

**Answer:** Add a versioned migration with three explicit indexes: `(last_name, first_name, id)` for Name sorting, `(city, last_name, first_name, id)` for City sorting, and `(last_name text_pattern_ops)` for prefix filtering under non-C collations. PostgreSQL can scan the sort indexes backward for descending order. Verify plans with `EXPLAIN`; do not modify seed data.

### Q14. Should GH #25 standardize linguistic collation?

**Answer:** No. Preserve the database's configured collation and document that boundary. The `id` tie-breaker guarantees stable pagination within an environment. A cross-environment linguistic-order contract requires a separately specified ICU migration and is outside this issue.

### Q15. Where does frontend state live?

**Answer:** The URL query string is the source of truth for `lastName`, `page`, `size`, `sort`, and `direction`. Omit default-valued parameters. Reload, browser Back/Forward, and shared URLs reproduce the same grid.

### Q16. When does page reset to zero?

**Answer:** Reset to page 0 when filter, sort, direction, or page size changes. Paginator next/previous changes only `page`. Sorting never enters an unsorted state; clicking the active header toggles ascending/descending.

### Q17. Which frontend table technology is used?

**Answer:** Keep the existing Bootstrap table and its stable selectors. Add accessible sortable Name/City headers and bounded paginator controls; do not migrate to `mat-table`. Use existing project controls/styles, with a 5/10/20 page-size selector and icon buttons for previous/next.

### Q18. How are concurrent loads, loading, errors, and empty results handled?

**Answer:** Derive requests from route query parameters and use `switchMap` so stale responses cannot overwrite newer state. Preserve the table dimensions while loading, disable navigation that cannot run, show a real error banner on failure, and distinguish errors from an empty filtered result.

### Q19. What happens when the URL names a page past the end?

**Answer:** After a successful response, redirect once to the last valid page when `page >= totalPages` and results exist; use page 0 for an empty result set. Sanitize malformed UI state through the same validated defaults before requesting.

### Q20. What happens to existing callers and generated contracts?

**Answer:** Update all in-repo array consumers atomically, including backend REST/functional/performance tests, frontend service/component tests, and PetClinic UI helpers. Regenerate `openapi.yaml` using `OpenApiExtractorTest`, then regenerate `petclinic-frontend/src/app/generated/api-types.ts`; never hand-edit either generated artifact.

### Q21. What acceptance evidence is required?

**Answer:** Tests must cover defaults, all three sizes, both sort keys and directions, filter-plus-page composition, 400 validation, duplicate sort values crossing a page boundary, every owner visited exactly once while paging, slim payload shape, bounded query count, URL deep links, Back/Forward behavior, page resets, stale-request cancellation, loading/error/empty states, and out-of-range correction. Validate the three indexes with `EXPLAIN` against representative volume.

### Q22. What is deliberately out of scope?

**Answer:** Sorting Address/Telephone/Pets, generalized full-text search, keyset pagination, API versioning, owner-detail payload changes, custom ICU collation, and pagination of other grids.
