## ADDED Requirements

### Requirement: Configurable page size
The owner grid SHALL offer page size options [5, 10, 25] with 10 as the default.

#### Scenario: Default page size on first load
- **WHEN** user navigates to the owner list without a `size` URL param
- **THEN** the grid displays 10 records per page

#### Scenario: User changes page size
- **WHEN** user selects a different page size from the dropdown
- **THEN** the grid reloads with the new page size and resets to page 0

### Requirement: Pagination controls
The owner grid SHALL display: First, Previous, a sliding window of 5 page numbers centered on the current page, Next, Last.

#### Scenario: Sliding window centered on current page
- **WHEN** user is on page 5 (1-based display) out of 10
- **THEN** page buttons 3, 4, [5], 6, 7 are shown; current page is highlighted

#### Scenario: Window clamps at start
- **WHEN** user is on page 1
- **THEN** page buttons [1], 2, 3, 4, 5 are shown

#### Scenario: Window clamps at end
- **WHEN** user is on the last page (e.g., page 10)
- **THEN** page buttons 6, 7, 8, 9, [10] are shown

#### Scenario: First and Previous disabled at page 1
- **WHEN** user is on the first page
- **THEN** First and Previous buttons are disabled

#### Scenario: Last and Next disabled at last page
- **WHEN** user is on the last page
- **THEN** Last and Next buttons are disabled

### Requirement: Records info display
The grid SHALL display "Records X-Y of Z" below the table (e.g., "Records 11-20 of 43").

#### Scenario: Correct range on middle page
- **WHEN** user is on page 1 (0-based) with page size 10 and totalElements 43
- **THEN** the display reads "Records 11-20 of 43"

#### Scenario: Last page partial range
- **WHEN** user is on the last page and fewer records remain than page size
- **THEN** Y equals totalElements (e.g., "Records 41-43 of 43")

### Requirement: Search resets page
The owner grid SHALL reset to page 0 whenever the search query changes.

#### Scenario: Page resets on new search
- **WHEN** user types in the search field while on page 5
- **THEN** the grid reloads from page 0 with the new search term

### Requirement: Backend paginated API
The `GET /api/owners` endpoint SHALL accept `page` (0-based), `size`, `sort`, and `direction` query params and return a paginated response with `totalElements`.

#### Scenario: Default pagination params
- **WHEN** client calls `GET /api/owners` with no pagination params
- **THEN** server returns page 0 with size 10 sorted by name ASC

#### Scenario: Explicit pagination
- **WHEN** client calls `GET /api/owners?page=2&size=5`
- **THEN** server returns records 10-14 (0-based) and `totalElements`

### Requirement: Sortable columns
The owner grid SHALL support sorting by full name (firstName + ' ' + lastName as displayed) and city. Sorting SHALL be performed in the database.

#### Scenario: Default sort on first load
- **WHEN** user navigates to the owner list without a `sort` URL param
- **THEN** the grid is sorted by name ascending

#### Scenario: Sort by name descending
- **WHEN** user clicks the Name column header while it is sorted ascending
- **THEN** the sort direction toggles to descending and the grid reloads

#### Scenario: Sort by city
- **WHEN** user clicks the City column header
- **THEN** the grid reloads sorted by city ascending

### Requirement: Sort indicator icons
Each sortable column header SHALL display 🔼 when sorted ascending, 🔽 when sorted descending, and no icon when not sorted.

#### Scenario: Active sort column shows icon
- **WHEN** the grid is sorted by city descending
- **THEN** the City header shows 🔽 and the Name header shows no icon

#### Scenario: Clicking sorted column toggles direction
- **WHEN** Name column shows 🔼 and user clicks it
- **THEN** Name column shows 🔽 and the data reloads in descending order

### Requirement: Full-name sort order matches display
The backend SHALL sort by `CONCAT(first_name, ' ', last_name)` so sort order matches alphabetical order of the displayed name string.

#### Scenario: Full name sort is consistent with display
- **WHEN** sorting by name ascending
- **THEN** "George Franklin" appears before "Jean Coleman" (G < J)

### Requirement: URL reflects all grid state
The owner list page SHALL persist search term, page number, page size, sort column, and sort direction as URL query params so the URL is shareable.

#### Scenario: URL updates on search
- **WHEN** user types "Ana" in the search box
- **THEN** the URL updates to include `?search=Ana&page=0`

#### Scenario: URL updates on page navigation
- **WHEN** user navigates to page 3
- **THEN** the URL updates to include `page=3`

#### Scenario: URL updates on sort change
- **WHEN** user sorts by city descending
- **THEN** the URL includes `sort=city&direction=desc`

### Requirement: State restored from URL on load
The owner grid SHALL read initial state from URL query params on component initialization.

#### Scenario: Shareable URL restores state
- **WHEN** user opens the URL `?search=Ana&page=2&size=5&sort=city&direction=desc`
- **THEN** the grid loads page 2, size 5, sorted by city descending, filtered by "Ana"

#### Scenario: Missing params use defaults
- **WHEN** user opens the URL with no query params
- **THEN** the grid loads page 0, size 10, sorted by name ascending, no filter

### Requirement: Race condition prevention
The owner grid SHALL cancel in-flight API requests when a new search/page/sort event fires before the previous response arrives.

#### Scenario: Rapid typing cancels previous request
- **WHEN** user types quickly and triggers multiple API calls in succession
- **THEN** only the response for the last request is applied to the grid
