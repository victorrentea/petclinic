# owners-list-ui

## ADDED Requirements

### Requirement: Always-active single-column sort
The Owners table SHALL support single-column sorting via clickable headers on Name, Address, and City (Telephone and Pets are not sortable). Exactly one column is always active — there is no unsorted state. On first open the table is sorted by **Name ascending**. Clicking a new column sorts it ascending; clicking the active column flips asc↔desc. The active column shows an ↑/↓ arrow; other sortable headers hint affordance discreetly (e.g., on hover). The client sends only the single column + direction — chain expansion is the server's job.

#### Scenario: Default sort on open
- **WHEN** the user opens the Owners screen with no saved state
- **THEN** the table is sorted by Name ascending and the Name header shows the ascending arrow

#### Scenario: Click a new column
- **WHEN** the user clicks the City header while sorted by Name
- **THEN** the table reloads sorted by City ascending and the arrow moves to City

#### Scenario: Toggle the active column
- **WHEN** the user clicks the Name header while already sorted by Name ascending
- **THEN** the table reloads sorted by Name descending — never reverting to unsorted

#### Scenario: Non-sortable column
- **WHEN** the user clicks the Pets or Telephone header
- **THEN** nothing changes — the header is not interactive

### Requirement: Pagination controls
A paginator SHALL render below the table with: a page-size selector (5/10/20, default 10), a position counter in the format "11–20 of 53" (current range + filtered total), and first/previous/next/last arrows. Pagination is server-side only — the client never fetches more than one page. Sorting and search apply to the whole list; pagination slices the result.

#### Scenario: Navigate to next page
- **WHEN** the user clicks the next-page arrow
- **THEN** the next page of owners is fetched from the server and the counter updates

#### Scenario: Jump to last page
- **WHEN** the user clicks the last-page arrow
- **THEN** the final page is fetched and the counter shows the tail range (e.g., "51–53 of 53")

#### Scenario: Change page size
- **WHEN** the user selects page size 20
- **THEN** the list reloads from the server with 20 rows and resets to the first page

#### Scenario: Counter reflects filtered total
- **WHEN** a search filter is active
- **THEN** the counter total is the filtered count (e.g., "1–10 of 23")

### Requirement: Paginator hidden for small lists
When the (filtered) total is ≤ 5 — below the smallest page size — the pagination bar SHALL disappear entirely; header sorting stays active. At ≥ 6 results the bar is always shown. The threshold depends only on the total, so the bar never flickers when the user changes page size.

#### Scenario: Five or fewer results
- **WHEN** the current filter yields 5 owners
- **THEN** no pagination bar is shown and the headers still sort

#### Scenario: Six results
- **WHEN** the current filter yields 6 owners
- **THEN** the pagination bar is shown

### Requirement: URL-driven state that survives navigation
Sort, page, page size, and the search term SHALL be reflected in the route's query string: loading such a URL restores the exact view (bookmarkable/shareable), and browser back/forward navigates through previous states without a full page reload. Returning to the Owners screen after in-app navigation SHALL restore the last state; a fresh visit (new session) starts at the defaults (page 1, size 10, Name ascending). Page size is never persisted across visits.

#### Scenario: Deep link
- **WHEN** the user opens `/owners?page=2&size=5&sort=city,desc`
- **THEN** the table shows page 3 (0-based index 2) of 5 rows sorted by city descending, and the paginator/header indicators match

#### Scenario: Back button
- **WHEN** the user changes sort then presses the browser Back button
- **THEN** the previous sort/page state is restored and the matching data is re-displayed

#### Scenario: Return after in-app navigation
- **WHEN** the user is on page 4 sorted by City, opens an owner's detail page, then navigates back to Owners
- **THEN** the list shows page 4 sorted by City again

#### Scenario: Fresh visit starts clean
- **WHEN** the user opens the Owners screen in a new session without query params
- **THEN** the view shows page 1, size 10, sorted by Name ascending

### Requirement: Snap to first page
Any change of sort, page size, or search term SHALL reset to page 1 before fetching. If a new filter makes the current page invalid (fewer pages than before), the user lands on page 1.

#### Scenario: Sort change resets page
- **WHEN** the user is on page 4 and clicks a column header
- **THEN** the newly sorted list is shown from page 1

#### Scenario: Search change resets page
- **WHEN** the user is on page 4 and changes the search term
- **THEN** the filtered list is shown from page 1

### Requirement: Empty state
When zero owners match (empty clinic or fruitless search), the table area SHALL show one generic "No results" message — the same for both cases — and no pagination bar.

#### Scenario: Search with no matches
- **WHEN** the user searches for a term matching no owner
- **THEN** the generic "No results" message is shown, with no rows and no paginator

### Requirement: Loading overlay keeps stale rows
While a page fetch is in flight, the current rows SHALL remain visible but dimmed, with a spinner overlay. The table never collapses to empty during loading.

#### Scenario: Slow fetch
- **WHEN** the user changes page and the response takes noticeable time
- **THEN** the previous rows stay visible and dimmed under a spinner until the new rows replace them

### Requirement: Name column display
The Name column header SHALL be labeled and rendered consistently with the chosen sort order *(currently `firstName lastName` display with firstName-first sorting — pending business confirmation per issue #25 comment 2026-06-02)*. Display order and sort order MUST match so users see an alphabetically coherent column.

#### Scenario: Sorted name column looks alphabetical
- **WHEN** the user sorts by Name ascending
- **THEN** the visible text in the Name column reads in alphabetical order top-to-bottom
