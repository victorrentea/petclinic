## Purpose

Defines how clients (the Owners grid and any other API consumer) retrieve the list of owners: server-side pagination, restricted sorting, and the existing last-name filter, so the endpoint keeps working correctly as the owner base grows toward ~10,000 records within a year.

## ADDED Requirements

### Requirement: Paginated owner listing
The `GET /api/owners` endpoint SHALL return a paginated result set instead of the full collection, so response size and query cost stay bounded regardless of how many owners exist.

#### Scenario: Default pagination when no parameters given
- **WHEN** a client calls `GET /api/owners` with no `page` or `size` parameter
- **THEN** the system returns page `0` containing at most `10` owners, along with the total element count and total page count

#### Scenario: Requesting a specific page and size
- **WHEN** a client calls `GET /api/owners?page=2&size=5`
- **THEN** the system returns the third page (zero-indexed) containing at most `5` owners

#### Scenario: Page beyond available data
- **WHEN** a client requests a page number beyond the last available page
- **THEN** the system returns an empty content list with the correct total element and page counts, not an error

#### Scenario: Negative page number rejected
- **WHEN** a client calls `GET /api/owners?page=-1`
- **THEN** the system responds with `400 Bad Request` and does not return owner data

### Requirement: Restricted page size
The system SHALL only accept page sizes from the fixed set `{5, 10, 20}`, to prevent clients from requesting unbounded or excessively large pages.

#### Scenario: Allowed page size
- **WHEN** a client calls `GET /api/owners?size=20`
- **THEN** the system returns a page with at most `20` owners

#### Scenario: Disallowed page size rejected
- **WHEN** a client calls `GET /api/owners?size=7`
- **THEN** the system responds with `400 Bad Request` and does not return owner data

### Requirement: Restricted sortable columns
The system SHALL only allow sorting by `name` (owner last name, then first name as tiebreak) and `city`. All other sort keys SHALL be rejected.

#### Scenario: Sorting by name ascending
- **WHEN** a client calls `GET /api/owners?sort=name,asc`
- **THEN** the system returns owners ordered by last name ascending, using first name ascending as a tiebreak for owners sharing the same last name

#### Scenario: Sorting by name descending
- **WHEN** a client calls `GET /api/owners?sort=name,desc`
- **THEN** the system returns owners ordered by last name descending, using first name descending as a tiebreak for owners sharing the same last name

#### Scenario: Sorting by city
- **WHEN** a client calls `GET /api/owners?sort=city,asc`
- **THEN** the system returns owners ordered by city ascending

#### Scenario: Sorting by a disallowed column rejected
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc` or any sort key outside `{name, city}`
- **THEN** the system responds with `400 Bad Request` and does not return owner data

### Requirement: Default sort order
When no `sort` parameter is supplied, the system SHALL order owners by last name ascending, then first name ascending.

#### Scenario: No sort parameter given
- **WHEN** a client calls `GET /api/owners` without a `sort` parameter
- **THEN** the returned owners are ordered by last name ascending, with first name ascending as tiebreak

### Requirement: Last name filter combined with pagination and sorting
The existing `lastName` prefix filter SHALL remain available on `GET /api/owners` and SHALL apply together with pagination and sorting.

#### Scenario: Filtering and paginating together
- **WHEN** a client calls `GET /api/owners?lastName=Sm&page=0&size=5&sort=name,asc`
- **THEN** the system returns at most 5 owners whose last name starts with "Sm", ordered by last name then first name ascending, along with the total count of matching owners

#### Scenario: Empty last name filter matches all owners
- **WHEN** a client calls `GET /api/owners` with `lastName` omitted or empty
- **THEN** the system treats it as no filter and returns owners from the full data set, paginated and sorted as requested

### Requirement: Owners grid pagination controls
The Owners grid SHALL provide pagination controls that let the user navigate between pages of owners and choose a page size from the allowed set.

#### Scenario: Navigating to the next page
- **WHEN** the user is viewing a page of the Owners grid and clicks to go to the next page
- **THEN** the grid requests and displays the next page of owners from the server

#### Scenario: Changing page size
- **WHEN** the user selects a different allowed page size in the Owners grid
- **THEN** the grid requests and displays the first page of owners using the newly selected page size

### Requirement: Owners grid sortable columns
The Owners grid SHALL let the user sort by clicking the **Name** or **City** column headers, and SHALL NOT offer sorting on Address or Telephone.

#### Scenario: Sorting by Name column
- **WHEN** the user clicks the **Name** column header
- **THEN** the grid requests owners sorted by name (last name, then first name) and re-renders the table in that order

#### Scenario: Sorting by City column
- **WHEN** the user clicks the **City** column header
- **THEN** the grid requests owners sorted by city and re-renders the table in that order

#### Scenario: Toggling sort direction on the active column
- **WHEN** the user clicks a column header that the grid is already sorted by
- **THEN** the grid reverses the sort direction for that column (ascending becomes descending, descending becomes ascending) and re-renders the table in the new order

#### Scenario: Switching to a different sort column
- **WHEN** the grid is sorted by one column and the user clicks the other sortable column header
- **THEN** the grid sorts by the newly clicked column in ascending order

### Requirement: Owners grid search resets pagination
When the user runs a new last-name search, the Owners grid SHALL return to the first page of results so the user is not left on a page number that no longer applies to the narrowed result set.

#### Scenario: New search returns to first page
- **WHEN** the user is on a page other than the first and submits a new last-name search
- **THEN** the grid requests and displays the first page of results matching the new search, keeping the currently selected page size and sort order

### Requirement: Owners grid Name column display order
The Owners grid SHALL display the Name column as the owner's last name followed by a space and the owner's first name (for example "Smith John"), to match the sort key used for the Name column.

#### Scenario: Name column rendering
- **WHEN** the Owners grid renders a row for an owner with first name "John" and last name "Smith"
- **THEN** the Name cell displays "Smith John"
