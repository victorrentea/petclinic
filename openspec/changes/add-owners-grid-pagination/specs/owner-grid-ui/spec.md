## ADDED Requirements

### Requirement: The owners grid is paginated

The owners grid SHALL show one page of owners at a time, with a page-size selector offering
**5, 10 and 20** rows and a default of 10, plus controls to move between pages and an indication of
the total number of owners.

The grid SHALL NOT fetch more owners than it displays.

#### Scenario: Initial load shows the first page
- **WHEN** the user opens the owners screen
- **THEN** at most 10 owners are shown
- **AND** the paginator reports the total number of owners

#### Scenario: Changing page size
- **WHEN** the user selects a page size of 20
- **THEN** the grid reloads showing at most 20 owners, starting from the first page

#### Scenario: Navigating to the next page
- **WHEN** the user clicks the next-page control
- **THEN** the grid shows the following set of owners, and no owner from the previous page reappears

### Requirement: Name and City columns are sortable

The grid SHALL offer sorting on the **Name** and **City** columns only, with a visible sort indicator
on the active column. Address, Telephone and Pets SHALL NOT be sortable.

#### Scenario: Sorting by city
- **WHEN** the user clicks the City header
- **THEN** the grid reloads sorted by city ascending and the City header shows an ascending indicator
- **WHEN** the user clicks it again
- **THEN** the grid reloads sorted by city descending

#### Scenario: Non-sortable headers do not respond
- **WHEN** the user clicks the Address, Telephone or Pets header
- **THEN** the grid does not re-sort and no sort indicator appears

### Requirement: The Name column renders "Last, First"

Because the Name column sorts by last name then first name, the cell SHALL render
`Last, First` (e.g. `Darling, Wendy`), so the visible text matches the key the column is ordered by
and the *Last name* search box above the grid.

#### Scenario: Name cell format
- **GIVEN** an owner with first name `Wendy` and last name `Darling`
- **WHEN** the owners grid renders that row
- **THEN** the Name cell reads `Darling, Wendy`

### Requirement: List state lives in the URL

The current page, page size, sort key/direction and last-name filter SHALL be reflected in the URL
query string, and the grid SHALL initialise itself from that URL. Sorting, paging and filtering
SHALL navigate with merged query parameters rather than mutating component state only.

#### Scenario: Deep link restores the grid state
- **WHEN** the user opens `/owners?page=2&size=10&sort=city,asc&lastName=Da`
- **THEN** the grid shows page 3 of owners whose last name starts with `Da`, sorted by city, 10 per page

#### Scenario: Browser back returns to the previous view
- **GIVEN** the user has sorted by city and moved to page 2
- **WHEN** the user presses the browser Back button
- **THEN** the grid returns to the previous page/sort combination

### Requirement: Filter and sort/page interactions

Changing the page size or the sort SHALL preserve the active last-name filter. Changing the filter
SHALL reset the grid to the first page.

#### Scenario: Changing the filter resets paging
- **GIVEN** the user is on page 3
- **WHEN** the user submits a new last-name filter
- **THEN** the grid shows page 1 of the filtered results

#### Scenario: Sorting preserves the filter
- **GIVEN** a last-name filter is active
- **WHEN** the user sorts by city
- **THEN** the filter remains applied and the results stay restricted to matching owners

### Requirement: The grid stays visually consistent with the rest of the application

The owners grid SHALL be visually indistinguishable from the other list screens (e.g. Vets): the same
header treatment, zebra striping, cell borders and button styling, regardless of the UI component
library used to implement it. Framework default styling SHALL NOT ship as-is.

Column widths SHALL be fixed rather than content-derived, so column boundaries do not shift when the
user sorts or pages.

#### Scenario: Grid matches the Vets screen
- **WHEN** the user compares the Owners grid with the Vets grid
- **THEN** header style, row striping, borders and buttons are the same

#### Scenario: Column widths are stable across sorts
- **WHEN** the user sorts by a column or moves to another page
- **THEN** the column boundaries stay in the same horizontal positions
