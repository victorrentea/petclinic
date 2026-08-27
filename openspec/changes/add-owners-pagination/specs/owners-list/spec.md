## Purpose

Listing owners for the Owners grid: how a page of owners is requested, filtered, sorted and
addressed by URL, so that the grid stays correct and fast at 100,000 owners instead of shipping
the whole table to the browser.

## ADDED Requirements

### Requirement: Owners are listed one page at a time

The owners listing endpoint SHALL return a single page of owners together with the total number
of matching owners, the total number of pages, the current page number and the page size. It SHALL
accept a zero-based page number and a page size, and SHALL apply both in the database — never by
loading all owners and slicing them in memory or in the browser.

The endpoint SHALL default to page 0 with a page size of 10 when the caller supplies neither.

#### Scenario: First page with the default size
- **WHEN** a client requests the owners list without a page or size
- **THEN** the response contains the first 10 owners of the default sort order
- **AND** it reports the total number of owners, the total number of pages, page number 0 and size 10

#### Scenario: An explicit page and size
- **WHEN** a client requests page 2 with size 5
- **THEN** the response contains owners 11 through 15 of the sort order
- **AND** it reports page number 2 and size 5

#### Scenario: A page past the end
- **WHEN** a client requests a page number beyond the last page
- **THEN** the response is an empty page that still reports the correct total number of owners and pages

#### Scenario: The database does the paging
- **WHEN** a page of owners is served
- **THEN** the query that fetches the rows is limited to that page's rows in the database

### Requirement: The grid offers page sizes of 5, 10 and 20

The owners grid SHALL let the user choose a page size of 5, 10 or 20 rows, and SHALL default to 10.
Changing the page size SHALL re-request the list at the new size. The chosen size SHALL NOT be
persisted across browser sessions.

#### Scenario: Switching the page size
- **WHEN** the user selects a page size of 20
- **THEN** the grid requests and displays up to 20 owners per page

#### Scenario: Only the three offered sizes
- **WHEN** the user opens the page-size control
- **THEN** the only options are 5, 10 and 20

### Requirement: Owners are sortable by name and by city only

The listing SHALL accept a logical sort key of `name` or `city`, in ascending or descending
direction, and SHALL default to `name` ascending. `name` SHALL order by last name then first name;
`city` SHALL order by city. Any other sort key SHALL be rejected with HTTP 400 — the client's sort
input is never applied to arbitrary fields of the owner or of its associations.

The grid SHALL show a sort control only on the Name and City columns. Address, Telephone and Pets
SHALL NOT be sortable.

#### Scenario: Default sort
- **WHEN** a client requests the owners list without a sort
- **THEN** the owners are ordered by last name ascending, then first name ascending

#### Scenario: Sorting by city descending
- **WHEN** a client requests the list sorted by `city` descending
- **THEN** the owners are ordered by city descending

#### Scenario: An unknown sort key is rejected
- **WHEN** a client requests the list sorted by `pets.visits.description`
- **THEN** the response is HTTP 400 and no owners are returned

#### Scenario: Unsortable columns carry no control
- **WHEN** the user views the owners grid
- **THEN** the Address, Telephone and Pets column headers offer no sort control

### Requirement: Paging is deterministic across pages

Every sort SHALL be made total by an unconditional tiebreaker on the owner's id, so that owners
sharing a sort value (several owners live in London) keep a stable relative order between requests.
Walking every page of a listing SHALL yield each matching owner exactly once.

#### Scenario: No owner is duplicated or skipped
- **WHEN** a client sorted by city walks from the first page to the last
- **THEN** every matching owner appears exactly once across the collected pages
- **AND** the number of collected owners equals the reported total

#### Scenario: Ties keep a stable order
- **WHEN** the same page of a city-sorted listing is requested twice
- **THEN** both responses contain the same owners in the same order

### Requirement: The last-name filter combines with paging

The listing SHALL keep filtering owners by a last-name prefix, with the existing case sensitivity
unchanged, and SHALL apply the
filter before paging so that the reported total counts only matching owners. Submitting a search in
the grid SHALL reset the listing to page 0 and SHALL keep the current sort and page size.

When a listing responds with no owners for a page number greater than 0, the grid SHALL re-request
page 0 rather than display an empty table.

#### Scenario: Filtered total
- **WHEN** a client requests owners whose last name starts with a prefix matching 3 owners, with size 10
- **THEN** the page contains those 3 owners and reports a total of 3

#### Scenario: Searching resets to the first page
- **WHEN** the user is on page 3 and submits a new last-name search
- **THEN** the grid displays page 0 of the filtered results with the previous sort and page size unchanged

#### Scenario: A deep link the filter shrank away
- **WHEN** the grid loads a page number that the current filter no longer reaches, and the response is empty
- **THEN** the grid re-requests page 0 and displays it

### Requirement: The grid shows the name as "Lastname, Firstname"

The owners grid SHALL render an owner's name as the last name, a comma, then the first name, so the
displayed value is the same value the Name column sorts on and the search box filters on.

#### Scenario: Name rendering
- **WHEN** the grid displays an owner whose first name is Harry and last name is Potter
- **THEN** the Name cell reads `Potter, Harry`

#### Scenario: Sorted by name reads in order
- **WHEN** the grid is sorted by Name ascending
- **THEN** the Name column reads in ascending alphabetical order as displayed

### Requirement: Grid state is addressable by URL

The owners grid SHALL keep its last-name filter, page number, page size and sort in the page URL,
and SHALL restore all four when the URL is opened directly or reached with the browser's Back
button. Navigating to an owner and back SHALL return the user to the page, sort and size they left.

#### Scenario: Sharing a link
- **WHEN** a user copies the grid URL while on page 4 sorted by city descending, and another user opens it
- **THEN** that user sees page 4 of the same listing, sorted by city descending

#### Scenario: Back from an owner's details
- **WHEN** the user opens an owner from page 3 and presses Back
- **THEN** the grid is shown at page 3 with the same filter, sort and page size
