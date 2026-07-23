## ADDED Requirements

### Requirement: Owners grid renders one server-provided page
The Owners list screen SHALL render only the page returned by the server and SHALL NOT fetch,
hold or sort the full owner collection in the browser.

#### Scenario: Page rendered
- **WHEN** the screen loads with the default parameters
- **THEN** it issues one `GET /api/owners?page=0&size=10&sort=...` request and renders the 10 rows
  from `content`

#### Scenario: No client-side sorting
- **WHEN** the user changes the sort
- **THEN** the component re-requests the page from the server rather than reordering rows it holds

### Requirement: Sortable column headers on Name and City
The Name and City column headers SHALL be clickable and SHALL toggle between ascending and
descending on that column. All other headers SHALL be visibly inert — no sort affordance, no hover
or cursor change — so they read as deliberately non-interactive rather than broken.

#### Scenario: Toggling a sort
- **WHEN** the user clicks the Name header while sorted by Name ascending
- **THEN** the grid re-requests page 0 sorted by Name descending and shows a descending indicator on
  that header

#### Scenario: Switching sort column
- **WHEN** the user clicks the City header while sorted by Name
- **THEN** the grid re-requests sorted by City ascending and the indicator moves to City

#### Scenario: Non-sortable headers
- **WHEN** the user clicks or hovers the Address, Telephone or Pets header
- **THEN** nothing happens and no sort affordance or pointer cursor is shown

### Requirement: Name column shows and sorts by last name first
The Name cell SHALL render `lastName firstName`, matching the last-name prefix search already
present on the screen, and its sort SHALL be the server's `lastName, firstName, id` chain.

#### Scenario: Name cell content
- **WHEN** an owner with first name `Harry` and last name `Potter` is rendered
- **THEN** the Name cell reads `Potter Harry`

### Requirement: Pager and page-size selector
The grid SHALL provide a pager to move between pages and a page-size selector offering exactly
`5`, `10` and `20` rows per page. The offered sizes SHALL match the server-side cap so the UI never
offers a size the server rejects.

#### Scenario: Navigating pages
- **WHEN** the user activates the next-page control on page 0 of 3
- **THEN** page 1 is requested and rendered, and the pager reflects the new position and total pages

#### Scenario: Changing page size
- **WHEN** the user selects 20 rows per page
- **THEN** the grid re-requests with `size=20` and returns to page 0

#### Scenario: Boundaries
- **WHEN** the user is on the first (or last) page
- **THEN** the previous (or next) control is disabled

### Requirement: List state lives in the URL
Page index, page size, sort column, sort direction and the `lastName` filter SHALL be the URL query
parameters `page`, `size`, `sort`, `direction` and `lastName`, and those parameters SHALL be the
component's source of truth. Every interaction SHALL navigate with merged query params rather than
mutating component state directly.

#### Scenario: Deep link restores state
- **WHEN** a user opens `/owners?page=2&size=20&sort=city&direction=desc&lastName=Po`
- **THEN** the grid renders page 2 of 20-row pages, sorted by City descending, filtered to `Po`

#### Scenario: Browser navigation
- **WHEN** the user sorts, pages, then presses the browser Back button
- **THEN** the grid returns to the previous sort/page state

#### Scenario: Interaction updates the URL
- **WHEN** the user changes page size
- **THEN** the component navigates with `size` replaced and the other query params preserved

### Requirement: Defaults are stated identically on both sides
The UI defaults SHALL be page 0, size 10 and Name ascending, matching the server defaults exactly.

#### Scenario: Bare URL
- **WHEN** the user opens `/owners` with no query parameters
- **THEN** the grid shows page 0, 10 rows per page, sorted by Name ascending, and the header
  indicator reflects that sort

### Requirement: Changing the search resets to the first page
Editing the `lastName` filter SHALL reset `page` to 0 while preserving `size` and `sort`, so a
narrowed result never lands the user on an empty page.

#### Scenario: Narrowing while on a later page
- **WHEN** the user is on page 4 and types a `lastName` filter matching 3 owners
- **THEN** the grid navigates to page 0 with the same size and sort, and shows the 3 matches

### Requirement: Empty result shows the no-owners message
When the page contains no owners, the grid SHALL show the existing "no owners with that last name"
message. The emptiness test SHALL be based on the result count, not on the truthiness of the list —
an empty `content` array is truthy and would silently suppress the message.

#### Scenario: Search with no matches
- **WHEN** the user filters by a last name that matches no owner
- **THEN** the no-owners message is displayed and no table rows are rendered

#### Scenario: Non-empty result
- **WHEN** the page contains at least one owner
- **THEN** the message is not displayed

### Requirement: Grid keeps the application's existing visual language
The grid SHALL remain the hand-rolled Bootstrap `table table-striped` used by the five sibling list
screens. Angular Material tables SHALL NOT be introduced. Columns SHALL have fixed widths
(`table-layout: fixed` plus an explicit width per column) so that sorting or paging never reflows
column boundaries.

#### Scenario: Visual consistency
- **WHEN** the Owners grid is compared with the other list screens
- **THEN** table, controls and buttons use the same Bootstrap classes and theme colours, with no
  `mat-table` in the rendered DOM

#### Scenario: No reflow on interaction
- **WHEN** the user sorts or pages and the new rows have different content lengths
- **THEN** column boundaries stay in place
