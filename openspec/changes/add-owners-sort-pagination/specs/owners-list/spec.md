## ADDED Requirements

### Requirement: Paginated owners endpoint
The system SHALL return owners one page at a time from the database (DB-side `LIMIT`/`OFFSET`), never loading all matching owners into memory. The response SHALL be a `PagedModel<OwnerDto>` envelope whose pagination metadata (total elements, total pages, current page number, page size) is nested under a `page` object.

#### Scenario: Request a page of owners
- **WHEN** a client calls `GET /api/owners?page=0&size=10`
- **THEN** the response contains at most 10 `OwnerDto` entries
- **AND** `page.totalElements` reflects the total count of matching owners
- **AND** `page.size` is 10 and `page.number` is 0

#### Scenario: Default page state on initial load
- **WHEN** a client calls `GET /api/owners` with no paging or sort parameters
- **THEN** the server returns page 0, size 10, sorted by Name ascending

### Requirement: Whitelisted sortable columns
The system SHALL allow sorting only by the logical keys `name` and `city`. A `SortMapper` SHALL translate each logical key into an entity `ORDER BY` chain with a stable tiebreaker: `name` → `lastName, firstName, city, id`; `city` → `city, lastName, firstName, id`. Any sort key not in the whitelist SHALL be rejected rather than passed through to the query.

#### Scenario: Sort by name ascending
- **WHEN** a client calls `GET /api/owners?sort=name,asc`
- **THEN** results are ordered by `lastName ASC, firstName ASC, city ASC, id ASC`

#### Scenario: Sort by city ascending
- **WHEN** a client calls `GET /api/owners?sort=city,asc`
- **THEN** results are ordered by `city ASC, lastName ASC, firstName ASC, id ASC`

#### Scenario: Reject an unknown sort key
- **WHEN** a client calls `GET /api/owners?sort=password,asc`
- **THEN** the unknown key is rejected and not used to build the `ORDER BY` clause

### Requirement: Tiebreakers stay ascending on descending toggle
When a sortable column is sorted descending, only the clicked column SHALL flip to `DESC`; all tiebreaker columns SHALL remain `ASC`.

#### Scenario: City sorted descending
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** results are ordered by `city DESC, lastName ASC, firstName ASC, id ASC`

### Requirement: Page-size cap
The system SHALL enforce a maximum page size of 20. A request for a larger size SHALL be silently capped to 20. The UI SHALL offer only the page sizes 5, 10 (default), and 20.

#### Scenario: Oversized page request is capped
- **WHEN** a client calls `GET /api/owners?size=500`
- **THEN** the server returns at most 20 entries and `page.size` is 20

### Requirement: Search resets paging and clamps to a valid page
A new last-name search SHALL reset the page to 0 while keeping the chosen sort and page size. The existing case-sensitive last-name prefix match is preserved (no fuzzy/ILIKE expansion). When a filter shrinks the result set below the requested page, the server SHALL clamp to the last valid page.

#### Scenario: Searching resets to first page
- **WHEN** the user enters a last-name filter while viewing page 3
- **THEN** the request is issued with `page=0`
- **AND** the previously chosen sort and size are retained

#### Scenario: Filter shrinks results below the current page
- **WHEN** a filter leaves fewer results than `page * size`
- **THEN** the server returns the last valid (non-empty) page rather than an empty page

### Requirement: Pets loaded without N+1 or in-memory pagination
The system SHALL page owners without fetching their pets in the same query, then batch-load pets for the owners on that page (e.g. `@BatchSize` or `findPetsByOwnerIdIn`). The system SHALL NOT `JOIN FETCH` pets while paging (which triggers HHH000104 in-memory pagination and breaks DB paging at scale).

#### Scenario: Loading a page of owners with pets
- **WHEN** a page of owners is requested
- **THEN** owners are fetched with a paged query that does not join pets
- **AND** pets for the page's owners are loaded in a single batch query
- **AND** no per-owner pet query is issued (no N+1)

### Requirement: Sortable, paginated owners table UI
The Owners screen SHALL render owners in an Angular Material `mat-table` with `matSort` on the Name and City headers, a `mat-paginator` below the table, and a page-size selector offering 5/10/20. Address, Telephone, and Pets columns SHALL NOT be sortable. Pet names SHALL be shown inline (comma-separated) in a single cell.

#### Scenario: Toggle a sortable header
- **WHEN** the user clicks the Name header repeatedly
- **THEN** the sort toggles ascending ⇄ descending only (no third unsorted state)
- **AND** the table reloads from the server with the new sort

#### Scenario: Non-sortable headers
- **WHEN** the user views the table headers
- **THEN** Address, Telephone, and Pets headers offer no sort affordance

### Requirement: Name column displayed as "lastName, firstName"
The Name cell SHALL display owners as `lastName, firstName` so the visible order matches the Name sort key.

#### Scenario: Owner name rendering
- **WHEN** an owner named George Franklin is rendered
- **THEN** the Name cell reads `Franklin, George`

### Requirement: Table state persisted in URL query parameters
The Owners screen SHALL sync `page`, `size`, `sort`, and `lastName` to the URL query parameters, treating the URL as the source of truth; the table SHALL react to `queryParamMap` changes. State SHALL survive page refresh, browser back/forward, and link sharing.

#### Scenario: State survives a refresh
- **WHEN** the user sorts by City desc, moves to page 2 at size 20, then refreshes
- **THEN** the URL reflects `sort=city,desc&page=2&size=20`
- **AND** after refresh the table shows the same page, size, and sort

#### Scenario: Back button restores prior state
- **WHEN** the user changes the sort and then presses the browser back button
- **THEN** the table returns to the previous sort/page/size from the URL

### Requirement: Loading and empty states
The Owners screen SHALL show a `mat-progress-bar` while a page is loading and a "No owners found" row when the result set is empty.

#### Scenario: Loading indicator
- **WHEN** a page request is in flight
- **THEN** a progress bar is visible until the response arrives

#### Scenario: Empty result
- **WHEN** a search matches no owners
- **THEN** a "No owners found" row is displayed
