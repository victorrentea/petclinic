# Requirements Document

## Introduction

Add server-side pagination, sorting, and a client-side page cache to the Owners list screen. The backend already returns `Page<Owner>` via Spring Data `Pageable`, but the frontend currently discards page metadata. This feature introduces a dedicated list DTO (`OwnerSummaryDto`) with a server-built display name, a 7-slot pagination toolbar, page size selection, column sorting, and a sliding-window prefetch cache — all scoped to component lifecycle with no URL state.

## Glossary

- **Owner_List_Component**: The Angular component responsible for rendering the owners grid, pagination toolbar, page size selector, and sort controls.
- **Pagination_Toolbar**: A UI control below the grid displaying up to 7 page-number slots with cardinal labels and chevron-decorated first/last buttons.
- **Page_Size_Selector**: A dropdown control allowing the user to choose how many owners appear per page (10, 25, or 50).
- **Owner_API**: The `GET /api/owners` REST endpoint returning a paginated, sorted list of owner summaries.
- **OwnerSummaryDto**: A backend DTO optimized for the list endpoint, containing `id`, `displayName`, `address`, `city`, `telephone`, and a trimmed `pets` list (id + name only, no visits).
- **Display_Name**: A server-built string produced by `CONCAT(firstName, ' ', lastName)` in the repository query, used for both display and sort ordering.
- **Page_Cache**: A client-side in-memory cache holding up to 5 pages in a sliding window around the current page.
- **Sort_Indicator**: A visual arrow (`▲` for ascending, `▼` for descending) shown in the active column header.

## Requirements

### Requirement 1: Paginated Owner List API

**User Story:** As a frontend consumer, I want the owner list endpoint to return paginated results with a lightweight summary DTO, so that the grid loads quickly without fetching unnecessary visit data.

#### Acceptance Criteria

1. WHEN a request is made to the Owner_API, THE Owner_API SHALL return a page of OwnerSummaryDto objects containing `id`, `displayName`, `address`, `city`, `telephone`, and `pets` (each pet containing only `id` and `name`).
2. WHEN no `page` parameter is provided, THE Owner_API SHALL default to page 0 with a size of 10.
3. WHEN a `sort=name,asc` parameter is provided, THE Owner_API SHALL order results by `CONCAT(firstName, ' ', lastName)` in ascending order.
4. WHEN a `sort=name,desc` parameter is provided, THE Owner_API SHALL order results by `CONCAT(firstName, ' ', lastName)` in descending order.
5. WHEN a `sort=city,asc` or `sort=city,desc` parameter is provided, THE Owner_API SHALL order results by the `city` field in the specified direction.
6. WHEN no `sort` parameter is provided, THE Owner_API SHALL default to sorting by name ascending.
7. THE Owner_API SHALL include `totalElements`, `totalPages`, `number`, and `size` metadata in the page response.

### Requirement 2: Server-Built Display Name

**User Story:** As a developer, I want the backend to produce the concatenated owner name, so that the frontend never performs name concatenation and display/sort ordering cannot drift.

#### Acceptance Criteria

1. THE Owner_API SHALL produce the `displayName` field using a JPQL `CONCAT(firstName, ' ', lastName)` projection in the repository query.
2. WHEN sorting by name, THE Owner_API SHALL translate the `name` sort key to the same `CONCAT(firstName, ' ', lastName)` expression in the `ORDER BY` clause.
3. THE Owner_API SHALL leave the `Owner` JPA entity unchanged (no `@Formula` annotation).

### Requirement 3: Pagination Toolbar

**User Story:** As a clinic receptionist, I want a compact page navigator below the owners grid, so that I can jump to any page without excessive scrolling or clicking.

#### Acceptance Criteria

1. THE Pagination_Toolbar SHALL render at most 7 page-number slots: `first | current-2 | current-1 | [current] | current+1 | current+2 | last`.
2. THE Pagination_Toolbar SHALL label each slot with its cardinal page number.
3. THE Pagination_Toolbar SHALL prefix the first-page slot with a `«` chevron character.
4. THE Pagination_Toolbar SHALL suffix the last-page slot with a `»` chevron character.
5. THE Pagination_Toolbar SHALL visually distinguish the current page slot (bold or boxed).
6. WHEN the first-page cardinal equals one of the middle five slots, THE Pagination_Toolbar SHALL render that page number only once (no duplicates).
7. WHEN the last-page cardinal equals one of the middle five slots, THE Pagination_Toolbar SHALL render that page number only once (no duplicates).
8. WHEN a slot would reference a page number outside the valid range [1, totalPages], THE Pagination_Toolbar SHALL hide that slot entirely (not disable it).
9. WHEN `totalElements` equals 0, THE Pagination_Toolbar SHALL be hidden.

### Requirement 4: Page Size Selector

**User Story:** As a clinic receptionist, I want to choose how many owners appear per page, so that I can balance between fewer pages and less scrolling.

#### Acceptance Criteria

1. THE Page_Size_Selector SHALL offer the values 10, 25, and 50.
2. THE Page_Size_Selector SHALL default to 10 on initial load.
3. WHEN the user changes the page size, THE Owner_List_Component SHALL reset to page 1.
4. WHEN the user changes the page size, THE Owner_List_Component SHALL request data from the Owner_API with the new size parameter.

### Requirement 5: Pagination Layout

**User Story:** As a clinic receptionist, I want to see how many total results exist alongside the pager, so that I understand the scope of the data set.

#### Acceptance Criteria

1. THE Owner_List_Component SHALL display a total-results summary on the left below the grid, formatted as `Showing {start}–{end} of {totalElements} owners`.
2. THE Owner_List_Component SHALL display the Pagination_Toolbar on the right below the grid.
3. WHEN `totalElements` equals 0, THE Owner_List_Component SHALL display an empty-state message and hide both the total-results summary and the Pagination_Toolbar.

### Requirement 6: Column Sorting

**User Story:** As a clinic receptionist, I want to sort the owners grid by Name or City, so that I can quickly find owners alphabetically or by location.

#### Acceptance Criteria

1. THE Owner_List_Component SHALL allow sorting on the Name and City columns only.
2. WHEN the user clicks a sortable column header, THE Owner_List_Component SHALL toggle the sort direction between ascending and descending for that column.
3. WHEN the user clicks a different sortable column header, THE Owner_List_Component SHALL clear the previous column's sort and apply ascending sort to the newly clicked column.
4. THE Owner_List_Component SHALL display a Sort_Indicator (`▲` for ascending, `▼` for descending) next to the active sort column's label.
5. THE Owner_List_Component SHALL default to Name ascending on initial load, displaying the `▲` indicator on the Name column header.
6. WHEN the sort column or direction changes, THE Owner_List_Component SHALL reset to page 1.

### Requirement 7: Search and Pagination Interaction

**User Story:** As a clinic receptionist, I want the grid to reset to page 1 when I change my search, so that I always see the most relevant results first.

#### Acceptance Criteria

1. WHEN the search input value changes (after debounce), THE Owner_List_Component SHALL reset to page 1.
2. WHEN the search input value changes, THE Owner_List_Component SHALL retain the current sort column and direction.
3. THE Owner_List_Component SHALL continue to debounce search input at 400ms before issuing a request.

### Requirement 8: Client-Side Page Cache

**User Story:** As a clinic receptionist, I want previously loaded pages to appear instantly when I navigate back, so that browsing the list feels responsive.

#### Acceptance Criteria

1. THE Page_Cache SHALL store up to 5 pages in memory at any time.
2. THE Page_Cache SHALL maintain a sliding window of pages `[current-2, current+2]` around the current page.
3. WHEN the user navigates to a new page, THE Page_Cache SHALL evict pages outside the new `[current-2, current+2]` window.
4. WHEN the current page response is received, THE Page_Cache SHALL prefetch pages at `current-1`, `current+1`, `current-2`, and `current+2` (where valid).
5. WHEN the user navigates to a cached page, THE Owner_List_Component SHALL display the cached data immediately without a network request.
6. WHEN the user is near the edges of the page range, THE Page_Cache SHALL cache fewer pages (no synthetic extra prefetch to fill to 5).

### Requirement 9: Cache Lifecycle and State Reset

**User Story:** As a developer, I want the cache to be scoped to the component lifecycle, so that stale data from owner edits on other screens is never displayed.

#### Acceptance Criteria

1. THE Page_Cache SHALL be destroyed when the user navigates away from the Owner_List_Component route.
2. WHEN the user returns to the Owner_List_Component, THE Owner_List_Component SHALL start fresh with page 1, default sort (Name ascending), empty search, and an empty cache.
3. THE Owner_List_Component SHALL NOT persist pagination state in the URL.
4. WHEN the browser is reloaded, THE Owner_List_Component SHALL reset to default state (page 1, size 10, Name ascending, empty search).

### Requirement 10: Loading State During Navigation

**User Story:** As a clinic receptionist, I want visual feedback when a page is loading, so that I know the system is responding to my action.

#### Acceptance Criteria

1. WHEN the user navigates to a page that is not in the Page_Cache, THE Owner_List_Component SHALL display a loading indicator.
2. WHEN the page data arrives, THE Owner_List_Component SHALL replace the loading indicator with the grid content.
3. WHILE a page request is in flight, IF the user navigates to a different page, THEN THE Owner_List_Component SHALL cancel the previous in-flight request and issue a new one for the latest requested page.

### Requirement 11: Detail Endpoint Preservation

**User Story:** As a developer, I want the owner detail endpoint to remain unchanged, so that the edit form continues to receive separate `firstName` and `lastName` fields.

#### Acceptance Criteria

1. THE Owner_API SHALL continue to return the existing `OwnerDto` (with `firstName`, `lastName`, and full pet/visit data) from `GET /api/owners/{id}`.
2. THE Owner_API SHALL use `OwnerSummaryDto` exclusively for the paginated list endpoint `GET /api/owners`.
