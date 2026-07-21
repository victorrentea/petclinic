## ADDED Requirements

### Requirement: Paginated owners listing endpoint

The `GET /api/owners` endpoint SHALL return a single page of owners using server-side pagination. It MUST accept a zero-based `page` parameter and a `size` parameter, and MUST return a page envelope containing `content` (the owners on the page), `totalElements`, `page`, `size`, and `totalPages`. When `page` and `size` are omitted, the endpoint MUST default to `page=0` and `size=10`. The supported page sizes exposed by the UI are 5, 10, and 20.

#### Scenario: Default page returned when no paging params given
- **WHEN** a client calls `GET /api/owners` with no `page`/`size`
- **THEN** the response contains the first 10 owners in `content` and `totalElements` equal to the total number of owners

#### Scenario: Explicit page and size honored
- **WHEN** a client calls `GET /api/owners?page=1&size=5`
- **THEN** the response contains owners 6–10 of the sorted result and `size` is 5 and `page` is 1

#### Scenario: Page beyond the end is empty
- **WHEN** a client requests a `page` index past the last page
- **THEN** `content` is empty and `totalElements` still reflects the true total

### Requirement: Server-side sorting by logical grid column

The endpoint SHALL accept a **single** sort criterion made of a **grid column name** and a direction. The only accepted column names MUST be `name` and `city`; any other value — including a raw entity field name like `lastName` — MUST be rejected rather than passed through. The backend MUST own the mapping from column to entity fields: `name` orders by last name then first name; `city` orders by city. When no sort is supplied, results MUST default to `name` ascending. The client MUST send only the grid column name, never entity field names, and never more than one criterion.

#### Scenario: Default sort is Name ascending
- **WHEN** a client requests owners with no sort criterion
- **THEN** owners are ordered ascending by last name, ties broken by first name

#### Scenario: Sort by the city column
- **WHEN** a client requests `sort=city,asc`
- **THEN** owners are ordered ascending by city

#### Scenario: Sort by the name column expands to two fields
- **WHEN** a client requests `sort=name,desc`
- **THEN** owners are ordered descending by last name, ties broken by first name

#### Scenario: Non-column sort value rejected
- **WHEN** a client requests a sort whose column is not `name` or `city` (e.g. `telephone`, or a raw field like `lastName`)
- **THEN** the request is rejected and the arbitrary sort is not applied

### Requirement: Last-name filter composes with paging and sorting

The endpoint SHALL keep the existing `lastName` prefix filter and MUST compose it with pagination and sorting in the same request. `totalElements` MUST reflect the filtered result set, not the whole table.

#### Scenario: Filter narrows the total
- **WHEN** a client calls `GET /api/owners?lastName=Pot&page=0&size=10`
- **THEN** only owners whose last name starts with "Pot" appear and `totalElements` equals the count of such owners

#### Scenario: New search resets to first page
- **WHEN** the user changes the last-name filter in the grid
- **THEN** the grid navigates to `page=0` for the new filter

### Requirement: Owners grid rendering and sortable columns

The Owners grid SHALL render owners in an Angular Material table with a paginator (page-size options 5/10/20, default 10) and sort headers. Only the **Name** and **City** columns MUST be sortable; Address, Telephone, and Pets MUST NOT expose sorting. The **Name** column MUST display the owner as last name followed by first name (e.g., "Franklin, George"). The grid MUST visually match the surrounding Bootstrap screens.

#### Scenario: Only Name and City are sortable
- **WHEN** the user views the Owners grid
- **THEN** sort affordances appear only on the Name and City column headers, not on Address, Telephone, or Pets

#### Scenario: Name shown last-name-first
- **WHEN** an owner named George Franklin is displayed
- **THEN** the Name cell reads "Franklin, George"

#### Scenario: Toggling sort does not reflow columns
- **WHEN** the user toggles a column's sort direction
- **THEN** column widths stay fixed (no horizontal jump)

### Requirement: List state carried in the URL

The Owners grid SHALL treat the URL query parameters `page`, `size`, `sort`, and `lastName` as the source of truth for its state. Every paging, sorting, or filtering action MUST navigate by merging these query params, and the grid MUST rebuild its request from the URL so refresh, back/forward, and deep-linking reproduce the same view.

#### Scenario: Deep link reproduces the view
- **WHEN** a user opens `/owners?page=2&size=20&sort=city,asc&lastName=Da`
- **THEN** the grid loads page 2, size 20, sorted by city ascending, filtered by last name "Da"

#### Scenario: Refresh preserves paging and sort
- **WHEN** the user pages/sorts and then refreshes the browser
- **THEN** the same page, size, sort, and filter are restored from the URL
