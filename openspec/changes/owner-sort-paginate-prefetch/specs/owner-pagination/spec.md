## ADDED Requirements

### Requirement: Paginated owner list endpoint
The `GET /owners` endpoint SHALL accept `page` (0-based integer), `size` (positive integer), and `sort` (Spring-style multi-value, e.g., `firstName,asc`) query parameters and return a page object instead of a flat array. The response SHALL include `content` (array of `OwnerDto`), `totalElements`, `totalPages`, `number` (current page, 0-based), and `size`.

#### Scenario: Fetch first page
- **WHEN** client requests `GET /owners?page=0&size=10&sort=firstName,asc&sort=lastName,asc`
- **THEN** system returns HTTP 200 with a page object containing at most 10 owners sorted by firstName then lastName ascending, plus pagination metadata

#### Scenario: Fetch a middle page
- **WHEN** client requests `GET /owners?page=2&size=10`
- **THEN** system returns owners at offset 20–29 and correct `number=2`, `totalPages`, `totalElements`

#### Scenario: Last page may have fewer items
- **WHEN** `totalElements` is not divisible by `size`
- **THEN** the last page's `content` array length equals `totalElements mod size`

#### Scenario: Page beyond total returns empty content
- **WHEN** client requests a page number >= `totalPages`
- **THEN** system returns HTTP 200 with empty `content` array and correct metadata

### Requirement: Pagination combined with search
The pagination endpoint SHALL apply the `q` search filter before paginating.

#### Scenario: Search with pagination
- **WHEN** client requests `GET /owners?q=smith&page=0&size=5`
- **THEN** only owners matching "smith" are paginated; `totalElements` reflects the filtered count

### Requirement: Sort field validation
The endpoint SHALL reject sort requests on fields other than `firstName`, `lastName`, and `city`.

#### Scenario: Invalid sort field rejected
- **WHEN** client requests `GET /owners?sort=telephone,asc`
- **THEN** system returns HTTP 400 Bad Request

#### Scenario: Valid sort fields accepted
- **WHEN** client requests `GET /owners?sort=city,desc`
- **THEN** system returns HTTP 200 with owners sorted by city descending
