# Owners grid pagination and sorting design

## Problem

The owners grid currently loads the full result set in one request and renders it without pagination. Sorting is also fixed by backend owner ID, so users cannot reorder the list by relevant business fields. The requested behavior is:

- server-side pagination for the owners grid
- sorting by clicking the `Name` and `City` column headers
- dynamic page size computed from the available viewport height so the page does not require vertical scrolling
- page-size recalculation after browser resize with a 1-second debounce
- coverage across the testing pyramid: backend tests, frontend isolated tests, and one Playwright headless test

## Scope

This change affects the owners listing flow end-to-end:

1. backend API contract for listing owners
2. backend querying and paging/sorting behavior
3. frontend owners grid state management and rendering
4. frontend viewport-based page-size calculation
5. isolated frontend and backend tests
6. one end-to-end Playwright test under `petclinic-ui-test/`

It does not include URL query param synchronization, additional sortable columns, or any other owners-screen redesign.

## Proposed approach

### Backend API

Extend `GET /api/owners` so it accepts:

- `query: string`
- `page: number`
- `size: number`
- `sortField: name | city`
- `sortDirection: asc | desc`

The endpoint returns a paged response object:

- `content`
- `totalElements`
- `totalPages`
- `number`
- `size`

This keeps filtering, sorting, and pagination on the server, which avoids fetching the full owners list into the browser and gives stable behavior as data grows.

### Backend data access

Replace the current list-returning repository query with a pageable query that preserves the existing search semantics:

- search against owner full name, address, city, telephone, and pet name
- keep pets loaded for the displayed owners
- translate UI sort fields to stable backend sorts:
  - `name` -> `lastName`, then `firstName`, then `id`
  - `city` -> `city`, then `lastName`, then `firstName`, then `id`

Stable secondary sorting matters so records do not jump unpredictably between pages.

### Frontend grid behavior

The owners page keeps local state for:

- `searchTerm`
- `page`
- `pageSize`
- `sortField`
- `sortDirection`
- current `OwnerPage`

The grid behavior is:

1. initial load computes `pageSize` from the viewport, then loads page 0
2. changing the search term resets to page 0 and reloads
3. clicking `Name` or `City` sets that field as active sorting
4. clicking the active sortable header toggles direction
5. `Previous` and `Next` navigate pages within bounds
6. the active header shows the current direction with a lightweight visual indicator

### Dynamic page size

The frontend calculates how many owner rows fit vertically without causing vertical page scrolling.

The calculation uses the available space between the top content area and the viewport bottom, subtracting the heights of:

- page title and surrounding spacing
- search form
- table header
- pagination controls / action row

Then it divides the remaining space by the measured owner row height and floors the result. The computed page size is clamped to a minimum of 1 row.

Behavior details:

- on initial render, measure and load using the current viewport
- subscribe to browser resize and debounce by 1 second
- after resize, recalculate `pageSize`
- if `pageSize` changes, reload owners using the new size
- if the previously selected page is no longer valid, clamp to the last valid page before requesting data

This preserves the user intent as much as possible while ensuring the current viewport still displays a full page without vertical scrolling.

### Error handling

The owners screen should preserve its current error handling pattern:

- backend validation errors propagate through the existing API error flow
- frontend uses the existing `OwnerService` / `HttpErrorHandler` pattern
- if a request fails, show the current error message behavior and avoid stale inconsistent page data

### Testing strategy

#### Backend isolated tests

Add backend coverage for:

1. pagination metadata and sliced content
2. sorting by name ascending/descending
3. sorting by city ascending/descending
4. filtering combined with pagination and sorting

#### Frontend isolated tests

Add frontend coverage for:

1. resetting to the first page when search changes
2. toggling sort direction on repeated header clicks
3. changing sort field from one header to another
4. computing / reacting to `pageSize` changes after resize debounce

#### End-to-end test

Add one headless Playwright test in `petclinic-ui-test/` that exercises a realistic user flow across pagination and sorting. The test should prove the integrated behavior, not replace the isolated tests.

At delivery time, also provide three additional Playwright scenario ideas in the style of `Add Visit.feature`.

## Trade-offs considered

### Recommended: server-side paging + server-side sorting + dynamic page size

This is the selected approach. It matches the requested behavior, scales correctly, and keeps the frontend focused on state and rendering.

### Rejected: frontend-only pagination

This conflicts with the requested server-side direction and still requires loading all owners into the browser.

### Rejected: fixed page size

This is simpler, but it does not satisfy the requirement to fit the current viewport and adapt after resize.

### Deferred: syncing state into the URL

Useful for deep links and refresh persistence, but intentionally excluded to keep this change focused on pagination, sorting, and responsive page sizing.

## Implementation outline

1. extend backend contract and owner query support
2. adapt frontend owner service and list component to paged state
3. add sortable table headers and pagination controls
4. implement viewport-based page-size measurement and resize debounce
5. add backend tests
6. add frontend isolated tests
7. add Playwright test

