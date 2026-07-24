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

A sortable header SHALL carry a visible affordance **at all times**, not only while it is the active
sort. The active column SHALL show its real direction at full strength; an idle sortable column
SHALL show the same triangle greyed out, pointing ascending — the direction a click would apply.
Without a persistent affordance the column is indistinguishable from plain text and users do not
discover that it sorts at all.

#### Scenario: Idle sortable column advertises itself
- **WHEN** the grid is sorted by City and the user looks at the Name header
- **THEN** Name shows a greyed ascending triangle, visibly pressable but clearly subordinate to the
  full-strength indicator on City

#### Scenario: Idle affordance does not claim a sort order
- **WHEN** an idle sortable column shows its greyed triangle
- **THEN** the triangle points ascending, matching what clicking it would do, so it never suggests
  the column is already sorted in some direction

#### Scenario: Toggling a sort
- **WHEN** the user clicks the Name header while sorted by Name ascending
- **THEN** the grid re-requests page 0 sorted by Name descending and shows a descending indicator on
  that header

#### Scenario: Switching sort column
- **WHEN** the user clicks the City header while sorted by Name
- **THEN** the grid re-requests page 0 sorted by City ascending and the indicator moves to City

#### Scenario: Non-sortable headers
- **WHEN** the user clicks or hovers the Address, Telephone or Pets header
- **THEN** nothing happens and no sort affordance or pointer cursor is shown

### Requirement: Name column shows and sorts by last name first
The Name cell SHALL render `lastName, firstName` — last name, comma, space, first name — matching
the last-name prefix search already present on the screen, and its sort SHALL be the server's
`lastName, firstName, id` chain.

#### Scenario: Name cell content
- **WHEN** an owner with first name `Harry` and last name `Potter` is rendered
- **THEN** the Name cell reads `Potter, Harry`

#### Scenario: Sort order is unaffected by the separator
- **WHEN** the grid is sorted by Name ascending
- **THEN** ordering is by last name then first name — the comma is presentation only and is not
  part of any sorted or searched value

### Requirement: Pager and page-size selector
The grid SHALL provide a pager to move between pages and a page-size selector offering exactly
`5`, `10` and `20` rows per page. The offered sizes SHALL match the server-side cap so the UI never
offers a size the server rejects.

Both controls SHALL sit **below** the table, on one control bar with the Add Owner button: Add Owner
on the left, page size and pager on the right. They act on the rows the user has just read, so they
belong after them. Add Owner SHALL remain visible even when the page has no rows — a search that
matches nothing is precisely when adding an owner is wanted.

#### Scenario: Controls sit under the grid
- **WHEN** the Owners screen is rendered
- **THEN** the page-size selector and pager appear below the table, on the same row as Add Owner

#### Scenario: Add Owner survives an empty result
- **WHEN** a search matches no owners
- **THEN** the no-owners message is shown, the pager and page-size selector are hidden, and the
  Add Owner button is still available

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

### Requirement: Any change to the shape of the result returns to the first page
Changing the `lastName` filter, the sort column, the sort direction or the page size SHALL reset
`page` to 0, while preserving every other parameter. Only the pager itself SHALL change `page`.
After any of these changes the row that was previously at a given page position is no longer there,
so the current page index is meaningless — and in the filter case it may not exist at all.

#### Scenario: Narrowing the search while on a later page
- **WHEN** the user is on page 4 and types a `lastName` filter matching 3 owners
- **THEN** the grid navigates to page 0 with the same size and sort, and shows the 3 matches

#### Scenario: Sorting while on a later page
- **WHEN** the user is on page 4 and clicks the City header
- **THEN** the grid navigates to page 0 sorted by City ascending, with the same size and filter

#### Scenario: Reversing the sort direction while on a later page
- **WHEN** the user is on page 4 sorted by Name ascending and clicks the Name header again
- **THEN** the grid navigates to page 0 sorted by Name descending

#### Scenario: Changing page size while on a later page
- **WHEN** the user is on page 4 with 10 rows per page and selects 20 rows per page
- **THEN** the grid navigates to page 0 with 20 rows per page, with the same sort and filter

#### Scenario: Paging does not reset itself
- **WHEN** the user activates the next-page control
- **THEN** `page` advances by one and the sort, size and filter are unchanged

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

#### Scenario: A page past the end is not mistaken for an empty result
- **WHEN** the requested page is past the last page but the result set is non-empty (e.g. a
  deep-linked `?page=99`, or the last page's rows were deleted)
- **THEN** the no-owners message is NOT shown, and the pager remains visible so the user can page
  back — the current page index alone SHALL NOT hide the only control that escapes it

#### Scenario: A load failure is shown as a failure
- **WHEN** the request to load a page fails (e.g. a 500)
- **THEN** a distinct error message is shown and the no-owners message is NOT — a failed load SHALL
  NOT be indistinguishable from a genuinely empty result

### Requirement: List state is sanitised to values the UI can honour
Page index and page size read from the URL SHALL be constrained to values the grid can represent: a
page index to a whole number `≥ 0`, and a page size to one of the offered options. Otherwise the
page-size selector, bound to the current size, would match no option and silently disagree with the
rows the server actually returned for a value it clamped.

#### Scenario: Out-of-range size falls back
- **WHEN** the URL carries `?size=0` or `?size=99999`
- **THEN** the grid uses the default size, and the page-size selector reflects that same size

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

#### Scenario: Search row reads as one control
- **WHEN** the Owners screen is rendered
- **THEN** the "Last name" label, its input and the Find Owner button sit on a single line, with the
  button to the right of the input — a button stacked underneath reads as a second, unrelated control

#### Scenario: One left edge
- **WHEN** the Owners screen is rendered
- **THEN** the heading, the "Last name" label, the table and the Add Owner button all start at the
  same left edge (Bootstrap's `.form-group` negative margin must not pull the search row out of
  alignment with the grid)
