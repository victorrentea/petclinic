## ADDED Requirements

### Requirement: Paginated owner list endpoint

`GET /api/owners` SHALL return a paginated result page rather than the full owner list. The
response SHALL use the Spring `Page` JSON shape with at least the fields `content` (the owners
on this page), `totalElements`, `totalPages`, `number` (0-based current page index), and
`size`. Pagination SHALL be applied at the database level — the server MUST NOT load all
owners into memory.

#### Scenario: Default page request
- **WHEN** a client calls `GET /api/owners` with no pagination params
- **THEN** the server returns the first page (`number` = 0) of at most 10 owners
- **AND** `totalElements` reflects the full count of matching owners, not just the page size

#### Scenario: Explicit page and size
- **WHEN** a client calls `GET /api/owners?page=2&size=5`
- **THEN** the response `content` contains the owners ranked 11–15 of the result set
- **AND** `number` is 2 and `size` is 5

#### Scenario: Page beyond the last
- **WHEN** a client requests a `page` index past the last page
- **THEN** the response `content` is empty
- **AND** `totalElements` and `totalPages` still describe the full result set

### Requirement: Sorting by column

The endpoint SHALL accept a `sort` parameter in `field,direction` form (e.g. `city,asc`)
and order results in the database accordingly. The only sortable columns SHALL be Name and
City. Sorting by Name SHALL order by `firstName` then `lastName`, matching the on-screen
"First Last" display. Address, Telephone, and the Pets column SHALL NOT be sortable. An absent
or invalid `sort` value SHALL fall back to a stable default order (by `firstName`, then
`lastName`) rather than raising an error.

#### Scenario: Ascending sort by a column
- **WHEN** a client calls `GET /api/owners?sort=city,asc`
- **THEN** owners are returned ordered by `city` ascending across the whole result set before paging

#### Scenario: Descending sort toggles order
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners are returned ordered by `city` descending

#### Scenario: Default order when sort omitted
- **WHEN** a client calls `GET /api/owners` with no `sort` param
- **THEN** owners are returned ordered by `firstName` then `lastName` ascending

#### Scenario: Non-sortable column falls back
- **WHEN** a client requests sorting on a non-sortable field (address, telephone, or the pets collection)
- **THEN** the server does not fail and falls back to the default order

### Requirement: Sorting and pagination compose with search

Sorting and pagination SHALL apply to the result of the existing cross-column `q` search, not
to the full table, so that a search result set can itself be sorted and paged.

#### Scenario: Search then page
- **WHEN** a client calls `GET /api/owners?q=madison&page=0&size=10&sort=lastName,asc`
- **THEN** only owners matching `madison` are considered
- **AND** that matching set is ordered by `lastName` ascending and the first 10 are returned
- **AND** `totalElements` equals the count of matching owners

### Requirement: Sortable column headers in the Owners UI

The Owners list screen SHALL render the Name and City column headers as controls that, when
clicked, sort the list by that column. Clicking a header SHALL request the data sorted
ascending; clicking the same header again SHALL toggle to descending. The currently sorted
column and its direction SHALL be visually indicated. The Address, Telephone, and Pets headers
SHALL NOT be sortable.

#### Scenario: Click a header to sort ascending
- **WHEN** the user clicks the "City" column header
- **THEN** the list reloads sorted by city ascending
- **AND** the City header shows an ascending indicator

#### Scenario: Click again to reverse
- **WHEN** the user clicks the "City" header a second time
- **THEN** the list reloads sorted by city descending
- **AND** the City header shows a descending indicator

### Requirement: Pagination controls and page-size selector in the UI

The Owners list screen SHALL display pagination navigation controls below the table and a
page-size selector offering 5, 10, and 20 rows per page, defaulting to 10. Changing the page
size or navigating pages SHALL fetch the corresponding server page without loading the full
list.

#### Scenario: Navigate to the next page
- **WHEN** the user activates the next-page control
- **THEN** the screen requests and displays the next server page of owners

#### Scenario: Change page size
- **WHEN** the user selects a page size of 20
- **THEN** the screen reloads showing up to 20 owners per page
- **AND** the selector reflects 20 as the active page size

#### Scenario: Default page size
- **WHEN** the Owners screen first loads
- **THEN** the page-size selector shows 10 and at most 10 owners are displayed
