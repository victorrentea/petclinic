## Context

The current owner list flow is split across the backend `GET /api/owners` endpoint and the Angular owner search screen. The backend returns the full matching owner collection as `OwnerDto[]`, while the frontend debounces the search box and replaces the entire table with the returned array. The frontend already contains an `OwnerPage` interface with page metadata fields, which suggests the codebase is ready to consume a paginated response shape but does not yet use it.

This change crosses the REST contract, persistence queries, frontend state handling, router query parameters, and automated tests. The design needs to define one coherent owner browsing model so search, pagination, sorting, and sharable URLs behave consistently across the API and UI. Backend guidance indicates production has roughly 10,000 owners, so full-list loading is not an acceptable long-term approach.

## Goals / Non-Goals

**Goals:**
- Add server-side pagination for owner listing requests.
- Add server-side sorting for the supported owner search screen columns Name and City.
- Keep the existing free-text owner search and make it compose with pagination and sorting.
- Return enough metadata for the frontend to render a numbered pagination control reliably.
- Let users switch between 10 and 20 rows per page.
- Preserve query, sort, page, and page size in the URL so the owner search screen state survives refresh and browser navigation.
- Preserve a stable, deterministic row order across repeated requests.

**Non-Goals:**
- Changing owner detail, add, edit, or delete flows.
- Introducing client-side pagination over a full dataset fetch.
- Adding new filtering dimensions beyond the existing free-text query.
- Making the Pets column sortable in this change.

## Decisions

### Use server-side pagination and sorting on `GET /api/owners`
- **Decision:** Extend the existing endpoint with query parameters for `page`, `size`, `sort`, and the existing `query`, and return a page object instead of a raw array.
- **Rationale:** The current endpoint becomes the single source of truth for the owner grid and avoids loading the full result set into the browser. Returning metadata alongside content is required for reliable pagination controls.
- **Alternatives considered:**
  - Keep returning the full list and paginate client-side: rejected because it does not scale and makes sorting/search semantics depend on what the browser already loaded.
  - Add a second paginated endpoint: rejected because it duplicates owner-listing behavior and forces the frontend to choose between overlapping APIs.

### Implement pagination with Spring Data `Pageable`
- **Decision:** Change the repository and controller flow to build queries around `Pageable` and `Page<Owner>`, including the filtered search path.
- **Rationale:** Spring Data already models page metadata and sorting in a way that maps naturally to the frontend `OwnerPage` shape and OpenAPI documentation.
- **Alternatives considered:**
  - Manual `LIMIT/OFFSET` handling in custom queries: rejected because it adds boilerplate and duplicates framework behavior.
  - Paginate only the unfiltered path and keep filtered search unpaged: rejected because the UI would behave inconsistently depending on whether a query is active.

### Restrict sorting to grid-backed fields with a stable secondary order
- **Decision:** Support sort keys only for Name and City. Map the Name column to a compound backend order of `lastName`, then `firstName`, and always append `id` as a stable tie-breaker.
- **Rationale:** These are the only user-confirmed sortable columns for the owner search screen. A stable secondary sort prevents rows from moving unpredictably between page requests.
- **Alternatives considered:**
  - Allow arbitrary property names through to the repository: rejected because it leaks persistence details into the API and makes the contract harder to validate.
  - Expose Address and Telephone sorting because those columns are visible: rejected because they were not part of the agreed interaction model for this screen.
  - Sort the Name column by a concatenated full-name expression: rejected because it is less portable and less explicit than ordering by last name then first name.

### Keep the owner search state in URL query parameters
- **Decision:** Treat the router query parameters as the source of truth for `query`, `sort`, `page`, and `size`, and derive data loading from those parameters.
- **Rationale:** URL-driven state makes refresh, back/forward navigation, and sharable links work naturally without adding hidden client-only state.
- **Alternatives considered:**
  - Keep state only in component fields: rejected because the current screen state would be lost on refresh and could not be shared.
  - Persist state in local storage: rejected because it does not support browser history semantics or sharable links.

### Reset paging when the result set definition changes
- **Decision:** When the search query or selected sort changes, the frontend resets to page 0 before requesting data again.
- **Rationale:** A different search or sort can invalidate the currently selected page. Resetting avoids empty or confusing intermediate states.
- **Alternatives considered:**
  - Keep the current page when search or sort changes: rejected because a previously valid page index may exceed the new total pages or hide the top of a newly sorted result set.

### Keep the UI implementation lightweight and Bootstrap-based
- **Decision:** Render sortable column headers and a custom numbered pagination control in the existing owner-list template instead of introducing a new table or paginator dependency.
- **Rationale:** The current screen is already a Bootstrap table. Reusing the existing stack keeps the change focused and allows the pager to match the agreed behavior: always showing first, last, current, previous, next, and the midpoints toward the beginning and end of the result set, while adding a small rows-per-page selector without refactoring the table stack.
- **Alternatives considered:**
  - Introduce Angular Material table, paginator, and sort directives: rejected because it is a larger refactor than the requested behavior change.
  - Use only previous/next navigation: rejected because the agreed UX requires numbered pages with key anchors visible at all times.

### Support a constrained page size selector
- **Decision:** Default owner listing requests to a page size of 10 and allow users to switch only between page sizes 10 and 20. Persist the selected page size in the URL and reset to the first page when it changes.
- **Rationale:** This keeps the screen simple while satisfying the need to browse a larger slice of results, and the constrained option set makes backend validation and UI behavior predictable.
- **Alternatives considered:**
  - Keep a fixed page size of 10: rejected because the user explicitly wants control over rows per page.
  - Allow arbitrary page sizes: rejected because this adds unnecessary scope and looser validation than the agreed 10/20 options.

## Risks / Trade-offs

- **API response shape changes for `/api/owners`** → Mitigation: update frontend service, OpenAPI contract, and automated tests in the same change so the application stays consistent.
- **Custom search query may become harder to maintain with pageable sorting** → Mitigation: keep allowed sort mapping explicit in the controller/service layer and use repository methods that accept `Pageable`.
- **Row order could drift between requests when multiple owners share the same value** → Mitigation: append `id` as a deterministic secondary sort.
- **Pagination controls can create extra request churn while typing in the search box** → Mitigation: retain the existing debounced search behavior and only request after the debounce interval.
- **Custom numbered pager can become hard to reason about near the edges** → Mitigation: extract pager-number calculation into a small pure helper and cover first, middle, and last-page cases with focused tests.
- **Page size changes can leave the user on an invalid page number** → Mitigation: reset to page 0 whenever the selected page size changes.

## Migration Plan

Deploy the backend and frontend changes together because the owner list API contract changes from an array response to a paginated object. Rollback is straightforward by reverting the owner list endpoint, frontend service/component bindings, and the matching tests in the same release unit.

## Open Questions

None currently. The change can proceed with server-driven pagination and sorting, URL-driven state, page size options of 10 and 20 with a default of 10, and the supported sort set defined above.
