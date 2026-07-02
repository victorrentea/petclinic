## ADDED Requirements

### Requirement: Paginated owners response

`GET /api/owners` SHALL return a paged body containing the current page of owners and pagination metadata. The body MUST expose `content` (the owners on the current page) and a nested `page` object with `size`, `number` (zero-based), `totalElements`, and `totalPages`. It MUST NOT return a bare top-level JSON array.

#### Scenario: Default request returns first page
- **WHEN** a client calls `GET /api/owners` with no paging parameters
- **THEN** the response contains at most the default page size of owners in `content`
- **AND** `page.number` is `0` and `page.totalElements` reflects the total matching owners

#### Scenario: Second page requested
- **WHEN** a client calls `GET /api/owners?page=1&size=10`
- **THEN** `content` holds owners 11–20 of the ordered result
- **AND** `page.number` is `1` and `page.size` is `10`

### Requirement: Page size options and cap

The endpoint SHALL accept a `size` parameter and default to `10` when it is absent. The frontend grid SHALL offer page sizes of 5, 10, and 20. The server MUST cap the effective page size at 100 so a client cannot retrieve the entire table in one request.

#### Scenario: Requested size above the cap is clamped
- **WHEN** a client calls `GET /api/owners?size=1000000`
- **THEN** the server returns at most 100 owners in `content`

#### Scenario: Missing size uses default
- **WHEN** a client calls `GET /api/owners` with no `size`
- **THEN** `page.size` is `10`

### Requirement: Sortable columns restricted to Name and City

The endpoint SHALL support sorting by exactly two logical keys: `name` (which orders by `lastName` then `firstName`) and `city`. The default order, when no valid sort is provided, MUST be `name` ascending. Any requested sort key other than `name` or `city` MUST be ignored and MUST NOT produce an error, falling back to the default sort.

#### Scenario: Sort by name descending
- **WHEN** a client calls `GET /api/owners?sort=name,desc`
- **THEN** owners are ordered by `lastName` then `firstName` descending

#### Scenario: Sort by city
- **WHEN** a client calls `GET /api/owners?sort=city,asc`
- **THEN** owners are ordered by `city` ascending

#### Scenario: Unsupported sort key is ignored
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc`
- **THEN** the request succeeds and owners are ordered by the default `name` ascending

### Requirement: Last-name prefix filter composes with paging and sorting

The existing `lastName` prefix filter SHALL be preserved and MUST combine with paging and sorting. `page.totalElements` MUST reflect the count of owners matching the filter, not the whole table.

#### Scenario: Filter plus paging
- **WHEN** a client calls `GET /api/owners?lastName=Fra&page=0&size=5&sort=city,asc`
- **THEN** `content` holds only owners whose last name starts with `Fra`, ordered by city ascending, at most 5 rows
- **AND** `page.totalElements` equals the number of owners whose last name starts with `Fra`

### Requirement: Efficient querying at scale

Owner listing queries MUST remain index-backed at ~1 million rows. Btree indexes SHALL exist on `(last_name, first_name)` and on `(city)` so that filtered and sorted queries avoid a full-table scan. Pets displayed per owner MUST be loaded via batch fetching and MUST NOT be loaded with a collection `JOIN FETCH` combined with a `Pageable`, which would force Hibernate to paginate in memory.

#### Scenario: Pets loaded without in-memory pagination
- **WHEN** a page of owners is fetched and their pets are shown
- **THEN** pets are loaded via batched `IN` queries for the page's owners
- **AND** no query applies pagination in memory over a fetched pets collection

### Requirement: Grid pagination and sorting behavior

The Owners grid SHALL render only the current page and provide sort handles for the Name and City columns and a page-size selector (5 / 10 / 20). Changing the search term MUST reset paging to the first page. The active sort and page size MUST persist when navigating between pages. The Name column SHALL display the owner's last name followed by the first name (e.g. "Smith, John") so the displayed order matches the sort key.

#### Scenario: Name shown surname-first
- **WHEN** the Owners grid renders an owner named John Smith
- **THEN** the Name cell shows "Smith, John"
- **AND** sorting by Name ascending lists this owner in alphabetical order by last name at a glance

#### Scenario: New search resets to first page
- **WHEN** the user is on page 3 and enters a new last-name search
- **THEN** the grid requests page 0 with the search applied
- **AND** the current sort and page size are retained

#### Scenario: Changing page keeps sort
- **WHEN** the user has sorted by City and moves to the next page
- **THEN** the next page is requested with the City sort still applied

### Requirement: Authorization unchanged

The paginated listing SHALL remain guarded by the existing `OWNER_ADMIN` role authorization; this change MUST NOT alter who can access the owners list.

#### Scenario: Authorization still enforced
- **WHEN** security is enabled and a caller lacks the `OWNER_ADMIN` role
- **THEN** `GET /api/owners` is rejected as before
