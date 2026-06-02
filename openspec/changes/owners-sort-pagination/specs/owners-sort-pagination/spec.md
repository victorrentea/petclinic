## ADDED Requirements

### Requirement: Paginated owner search
The system SHALL return a paginated result when listing owners. The response SHALL include `content` (array of owners), `totalElements`, `totalPages`, `number` (0-based page index), and `size`.

#### Scenario: Default pagination on first load
- **WHEN** `GET /api/owners` is called with no query params
- **THEN** the response returns the first page of 10 owners sorted by `firstName` ascending

#### Scenario: Page navigation
- **WHEN** `GET /api/owners?page=1&size=5` is called
- **THEN** the response returns the second page with up to 5 owners, and `totalElements` reflects the full count

#### Scenario: lastName filter with pagination
- **WHEN** `GET /api/owners?lastName=Davis&page=0&size=10` is called
- **THEN** only owners whose last name starts with "Davis" are returned, with correct `totalElements`

### Requirement: Server-side sorting by firstName and city
The system SHALL support sorting the owner list by `firstName` (ascending or descending) and `city` (ascending or descending) via a `sort` query parameter.

#### Scenario: Sort by firstName ascending (default)
- **WHEN** `GET /api/owners?sort=firstName,asc` is called
- **THEN** owners in the response are ordered alphabetically by first name A→Z

#### Scenario: Sort by city descending
- **WHEN** `GET /api/owners?sort=city,desc` is called
- **THEN** owners in the response are ordered by city Z→A

### Requirement: URL-driven sort and page state in the frontend
The frontend SHALL synchronise `lastName`, `page`, `size`, and `sort` (field + direction) as URL query parameters. Navigating to a URL with these params SHALL restore the corresponding table state.

#### Scenario: Sort column change updates URL
- **WHEN** the user clicks a sortable column header in the owners table
- **THEN** the URL query params are updated with the new `sort` value and `page` is reset to 0

#### Scenario: Page change updates URL
- **WHEN** the user selects a different page via the paginator
- **THEN** the URL query params are updated with the new `page` (and `size` if changed)

#### Scenario: Search resets to page 0
- **WHEN** the user submits a new last-name search
- **THEN** the URL query param `page` is set to 0 and `lastName` is updated

#### Scenario: Initial sort indicator shown on load
- **WHEN** the owners list component loads with no explicit sort query param
- **THEN** the Name column header shows the ascending sort indicator (▲)
