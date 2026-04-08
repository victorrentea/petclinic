## ADDED Requirements

### Requirement: Paginated owner list API
The `GET /api/owners` endpoint SHALL accept `page` (0-based integer, default 0) and `size` (positive integer, default 20) query parameters and return a paginated envelope instead of a flat array. The `lastName` filter SHALL be applied at the database level before pagination.

#### Scenario: First page with default size
- **WHEN** client calls `GET /api/owners` with no query params
- **THEN** response is `200 OK` with a JSON object containing `content` (array of up to 20 owners), `totalElements`, `totalPages`, `page: 0`, `size: 20`

#### Scenario: Explicit page and size
- **WHEN** client calls `GET /api/owners?page=2&size=10`
- **THEN** response contains the 21st–30th owners and correct `page: 2`, `size: 10` metadata

#### Scenario: Last page has fewer items
- **WHEN** client requests a page beyond the last full page
- **THEN** `content` contains the remaining owners (fewer than `size`) and `page` equals `totalPages - 1`

#### Scenario: Empty result
- **WHEN** client filters by a `lastName` that matches no owner
- **THEN** response is `200 OK` with `content: []`, `totalElements: 0`, `totalPages: 0`

#### Scenario: Filter with pagination
- **WHEN** client calls `GET /api/owners?lastName=Smith&page=0&size=5`
- **THEN** only owners whose last name starts with "Smith" are returned, limited to 5 per page, with correct total counts

#### Scenario: Invalid page parameters
- **WHEN** client sends a negative `page` or zero/negative `size`
- **THEN** response is `400 Bad Request`

### Requirement: Sortable owner list API
The `GET /api/owners` endpoint SHALL accept one or more `sort` query parameters. Allowed sort fields are `firstName`, `lastName`, and `city`. Sort direction SHALL be `asc` or `desc`. The endpoint SHALL reject any other sort field with `400 Bad Request`. Multiple `sort` params may be combined for compound ordering (e.g., `?sort=lastName,asc&sort=firstName,asc`).

#### Scenario: Sort by Name column ascending (compound sort)
- **WHEN** client calls `GET /api/owners?sort=firstName,asc&sort=lastName,asc`
- **THEN** owners in `content` are ordered by first name A→Z, with last name A→Z as tiebreaker (matching the "firstName lastName" display order)

#### Scenario: Sort by city descending
- **WHEN** client calls `GET /api/owners?sort=city,desc`
- **THEN** owners in `content` are ordered by city Z→A

#### Scenario: Sort combined with filter and pagination
- **WHEN** client calls `GET /api/owners?lastName=S&sort=city,asc&page=0&size=10`
- **THEN** only owners with lastName starting with "S" are returned, sorted by city ascending, paginated

#### Scenario: Unsupported sort field rejected
- **WHEN** client calls `GET /api/owners?sort=telephone,asc`
- **THEN** response is `400 Bad Request`

### Requirement: Frontend owner table pagination
The frontend owners table SHALL use Angular Material `MatPaginator` to navigate pages and `MatSort` to sort by Name and City columns, sending `page`, `size`, and `sort` to the API on each change. The `lastName` search field SHALL reset the paginator to page 0 on each new search. Changing sort SHALL also reset to page 0.

#### Scenario: User navigates to next page
- **WHEN** user clicks "next page" in the paginator
- **THEN** the table fetches the next page from the API and displays new owners without full page reload

#### Scenario: User changes page size
- **WHEN** user selects a different page size (e.g., 50) from the paginator dropdown
- **THEN** the table refetches with `size=50` and resets to `page=0`

#### Scenario: User searches by last name
- **WHEN** user types in the lastName filter and submits
- **THEN** paginator resets to page 0 and table shows first page of filtered results with updated total count

#### Scenario: User clicks Name column header to sort
- **WHEN** user clicks the "Name" column header
- **THEN** table refetches with `sort=firstName,asc&sort=lastName,asc`, resets to page 0, and the header shows an ascending sort indicator

#### Scenario: User toggles sort direction
- **WHEN** user clicks the same sortable column header a second time
- **THEN** table refetches with `sort=firstName,desc&sort=lastName,desc` and the indicator flips to descending

#### Scenario: User clicks City column header to sort
- **WHEN** user clicks the "City" column header
- **THEN** table refetches with `sort=city,asc` and resets to page 0
