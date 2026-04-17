## ADDED Requirements

### Requirement: Dynamic page size from viewport
The frontend SHALL calculate the number of rows per page based on the available table body height divided by a fixed row height constant. The minimum page size SHALL be 5.

#### Scenario: Page size calculated on init
- **WHEN** the owners list component initialises
- **THEN** page size is computed from viewport before the first API request is made

#### Scenario: Resize triggers recalculation
- **WHEN** the browser window is resized
- **THEN** the resize event is debounced (1000 ms), after which page size is recalculated, the cache is cleared, and the list resets to page 0 with the new size

#### Scenario: Pre-fetch triggered after resize reset
- **WHEN** a resize causes reset to page 0
- **THEN** after page 0 is loaded and displayed, the frontend immediately pre-fetches page 1 in the background (page −1 does not exist, so only next is pre-fetched)

#### Scenario: Very small viewport clamped
- **WHEN** the available height would yield fewer than 5 rows
- **THEN** page size is set to 5

### Requirement: Adjacent page pre-fetching
After displaying a page, the frontend SHALL immediately request the next page and the previous page in the background if they are within bounds and not already cached.

#### Scenario: Pre-fetch next page
- **WHEN** page N is displayed and page N+1 exists
- **THEN** the frontend fires a background request for page N+1 without waiting for user action

#### Scenario: Pre-fetch previous page
- **WHEN** page N is displayed, N > 0, and page N-1 is not in cache
- **THEN** the frontend fires a background request for page N-1

#### Scenario: No pre-fetch beyond bounds
- **WHEN** the current page is the last page
- **THEN** no request is fired for a next page

#### Scenario: Pre-fetch respects saveData hint
- **WHEN** `navigator.connection.saveData` is true
- **THEN** the frontend skips pre-fetching

### Requirement: Page cache eviction
The frontend cache SHALL retain only the current page and its two adjacent pages (current−1, current, current+1). All other cached pages SHALL be evicted on each navigation.

#### Scenario: Evict distant pages
- **WHEN** user navigates from page 3 to page 5
- **THEN** pages 0, 1, 2 are removed from the cache; pages 4, 5, 6 may be retained or fetched

### Requirement: Cache invalidation on parameter change
The cache SHALL be completely cleared whenever sort, search text, or page size changes.

#### Scenario: Cache cleared on sort change
- **WHEN** user clicks a column header to change sort
- **THEN** all cached pages are discarded and the list resets to page 0

#### Scenario: Cache cleared on search change
- **WHEN** user types in the search box
- **THEN** all cached pages are discarded and the list resets to page 0

### Requirement: Stale response discard on resize
The frontend SHALL discard in-flight pre-fetch responses that were initiated before the most recent resize event.

#### Scenario: Stale pre-fetch ignored
- **WHEN** a pre-fetch request is in-flight and a resize event fires
- **THEN** the response of the in-flight request is ignored and the cache is not updated with stale data

### Requirement: Pagination controls displayed
The owners list SHALL display: a First-page button, a Prev button, the current page number (1-based) and total pages, a Next button, and a Last-page button. First and Last buttons SHALL always be visible so the user can jump directly to either end.

#### Scenario: First page disables First and Prev buttons
- **WHEN** user is on page 1 (index 0)
- **THEN** both the First and Prev buttons are disabled

#### Scenario: Last page disables Next and Last buttons
- **WHEN** user is on the last page
- **THEN** both the Next and Last buttons are disabled

#### Scenario: Page indicator shows correct values
- **WHEN** viewing page 3 of 7
- **THEN** pagination control shows "Page 3 of 7"

#### Scenario: First button jumps to page 1
- **WHEN** user is on any page other than the first and clicks First
- **THEN** the list navigates to page 1

#### Scenario: Last button jumps to final page
- **WHEN** user is on any page other than the last and clicks Last
- **THEN** the list navigates to the last page
