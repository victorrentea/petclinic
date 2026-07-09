## ADDED Requirements

### Requirement: Paginated owners listing
`GET /api/owners` SHALL return a single page of owners as a `Page<OwnerDto>` envelope containing `content`, `totalElements`, `totalPages`, `number`, and `size`. It SHALL NOT return the full table. The page index defaults to `0` and the page size defaults to `10`.

#### Scenario: Default paging parameters
- **WHEN** a client requests `GET /api/owners` with no `page` or `size`
- **THEN** the response is a page envelope with `number = 0`, `size = 10`, at most 10 items in `content`, and `totalElements` equal to the number of owners matching the (empty) filter

#### Scenario: Explicit page and size
- **WHEN** a client requests `GET /api/owners?page=1&size=5`
- **THEN** the response contains `content` holding the 6th–10th matching owners, `number = 1`, and `size = 5`

#### Scenario: Page beyond the last
- **WHEN** a client requests a `page` index past the last page
- **THEN** the response has an empty `content` array while `totalElements` still reflects the full match count

### Requirement: Page size is whitelisted
The `size` parameter SHALL be restricted to the set {5, 10, 20}. Any other value SHALL be rejected.

#### Scenario: Allowed size
- **WHEN** a client requests `size` equal to 5, 10, or 20
- **THEN** the request succeeds with that page size

#### Scenario: Disallowed size
- **WHEN** a client requests a `size` outside {5, 10, 20} (e.g. `size=1000000`)
- **THEN** the API responds with `400 Bad Request` and does not execute the query

### Requirement: Sort column is whitelisted with a default
The `sort` parameter SHALL be restricted to {`name`, `city`} and `dir` to {`asc`, `desc`}. When absent, sorting SHALL default to `name` ascending. The columns Address, Telephone, and Pets SHALL NOT be sortable.

#### Scenario: Default sort
- **WHEN** a client requests `GET /api/owners` with no `sort`
- **THEN** owners are ordered by name ascending

#### Scenario: Sort by city descending
- **WHEN** a client requests `GET /api/owners?sort=city&dir=desc`
- **THEN** owners are ordered by city descending

#### Scenario: Disallowed sort key
- **WHEN** a client requests a `sort` value outside {`name`, `city`} (e.g. `sort=address`)
- **THEN** the API responds with `400 Bad Request`

### Requirement: Name column sorts by last name and renders "Last, First"
Sorting by `name` SHALL order rows by last name, then first name, as the primary and secondary keys. The grid's Name column SHALL render each owner as `lastName, firstName` (directory style) so the displayed text matches the sort order.

#### Scenario: Composite name ordering
- **WHEN** two owners share the same last name
- **THEN** they are ordered relative to each other by first name

#### Scenario: Name column display
- **WHEN** the grid renders an owner in the Name column
- **THEN** the cell shows `lastName, firstName` (e.g. `McCallister, Kevin`), not `firstName lastName`

### Requirement: Case-insensitive ordering with deterministic tiebreaker
Ordering by `name` and `city` SHALL be case-insensitive (comparing lowercased values). Every ordering SHALL append the owner `id` as a final tiebreaker so a row occupies a stable position across pages.

#### Scenario: Case-insensitive order
- **WHEN** owners include mixed-case values such as `van der Berg` and `Van Halen`
- **THEN** they are ordered as if compared in lowercase, not by raw byte order

#### Scenario: Stable order on equal keys
- **WHEN** multiple owners share the same sort key value
- **THEN** they are returned in ascending `id` order, and no owner appears on two different pages of the same query

### Requirement: Case-insensitive last-name search combined with pagination
The existing `lastName` filter SHALL match owners whose last name starts with the given value, case-insensitively, and SHALL be applied before pagination and sorting.

#### Scenario: Filtered page
- **WHEN** a client requests `GET /api/owners?lastName=pot&page=0&size=10`
- **THEN** only owners whose last name starts with `pot` (any case) are counted and returned, paged and sorted per the other parameters

#### Scenario: Empty filter
- **WHEN** the `lastName` filter is empty or absent
- **THEN** all owners are eligible, returned one page at a time

### Requirement: Owners grid presents paging and sorting controls
The Owners grid SHALL render owners in an Angular Material table with a paginator offering page sizes 5, 10, and 20, and sortable Name and City column headers. Changing the sort or the search SHALL reset the grid to the first page.

#### Scenario: Change page
- **WHEN** the user selects a different page or page size in the paginator
- **THEN** the grid requests and displays the corresponding server page

#### Scenario: Sort by a column
- **WHEN** the user clicks the Name or City header
- **THEN** the grid requests that server-side sort and resets to the first page

#### Scenario: Non-sortable columns
- **WHEN** the grid renders the Address, Telephone, and Pets columns
- **THEN** those headers expose no sort control
