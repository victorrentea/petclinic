## ADDED Requirements

### Requirement: Paged owners listing endpoint

`GET /api/owners` SHALL return a paged envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) rather than a bare list, with paging and sorting applied server-side at the database level. It SHALL accept `page` (0-based), `size`, `sort`, and `lastName` query parameters.

#### Scenario: Default page request
- **WHEN** a client calls `GET /api/owners` with no parameters
- **THEN** the response is a page of at most 10 owners (`size=10`, `number=0`) sorted by last name ascending
- **AND** `totalElements` reflects the full count of matching owners in the database

#### Scenario: Explicit page and size
- **WHEN** a client calls `GET /api/owners?page=2&size=5`
- **THEN** the response contains the third page of 5 owners
- **AND** `number=2`, `size=5`, and `totalPages` is derived from `totalElements`

#### Scenario: Listing never loads the full table into memory
- **WHEN** the `owners` table holds hundreds of thousands of rows
- **THEN** the root query selects only the rows for the requested page (no full-table fetch)
- **AND** the paged root query contains no collection joins

### Requirement: Last-name prefix search combined with paging

The listing SHALL support filtering by a `lastName` prefix, applied at the database level and combined with the requested paging and sorting.

#### Scenario: Search by last-name prefix
- **WHEN** a client calls `GET /api/owners?lastName=Ca`
- **THEN** only owners whose last name starts with "Ca" are returned, paged and sorted per the other parameters
- **AND** `totalElements` reflects the count of matching owners, not the whole table

#### Scenario: Empty search returns all owners
- **WHEN** `lastName` is empty or omitted
- **THEN** all owners are eligible, paged and sorted normally

### Requirement: Server-side sorting with a whitelist and stable tiebreaker

Sorting SHALL be restricted to the logical-column whitelist `{name, city}`, where `name` expands server-side to `lastName, firstName`. A stable `id` tiebreaker SHALL always be appended so paging is deterministic. The default sort SHALL be by name ascending (i.e. last name, then first name). An invalid or unrecognized sort field SHALL fall back to name ascending and MUST NOT produce a 500 error.

#### Scenario: Default sort
- **WHEN** no `sort` parameter is supplied
- **THEN** owners are ordered by `lastName` ascending, then by `id` ascending

#### Scenario: Sort by city descending
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners are ordered by `city` descending, then by `id` ascending

#### Scenario: Name sort uses last name then first name
- **WHEN** a client calls `GET /api/owners?sort=name,asc`
- **THEN** owners are ordered by `lastName` then `firstName` ascending, then by `id`

#### Scenario: Invalid sort field falls back safely
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc`
- **THEN** the unrecognized field is ignored and results are ordered by name (last name) ascending
- **AND** the response status is 200, not 500

### Requirement: Page size bounds

The endpoint SHALL apply a default page size of 10 and SHALL cap the page size at a maximum of 20. A larger requested `size` SHALL be clamped to the maximum.

#### Scenario: Oversized page size is clamped
- **WHEN** a client calls `GET /api/owners?size=500`
- **THEN** at most 20 owners are returned and `size` reflects the applied cap

### Requirement: Pets loaded lazily and batched

The owners page SHALL expose each owner's pets in the response while keeping the paged root query collection-free. Pets SHALL be loaded lazily and batched (`@BatchSize`) so rendering a page does not trigger an unbounded number of per-owner queries, and mapping SHALL run inside the request transaction.

#### Scenario: Pets present without breaking paging
- **WHEN** a page of owners is returned
- **THEN** each `OwnerDto` includes its pets
- **AND** the number of pet-loading queries is bounded by batching, not one query per owner

### Requirement: Owners screen displays sortable columns and Name last-name-first

The Owners screen SHALL render sortable column headers for Name and City only; Address, Telephone, and Pets SHALL be display-only. The Name column SHALL display the last name first ("Carter Adam") so the visible order matches the sort key.

#### Scenario: Only Name and City are sortable
- **WHEN** the user views the owners table
- **THEN** the Name and City headers are clickable to sort
- **AND** the Address, Telephone, and Pets headers are not sortable

#### Scenario: Name displays last name first
- **WHEN** an owner named Adam Carter is listed
- **THEN** the Name cell shows "Carter Adam"

#### Scenario: Two-state sort toggle on a single column
- **WHEN** the user clicks a sortable header repeatedly
- **THEN** the sort toggles between ascending and descending for that single column only
- **AND** the default state on load is last name ascending

### Requirement: Pagination controls with range label and page-size selector

The Owners screen SHALL provide pagination controls (first / previous / next / last) with a "Showing X–Y of Z" range label, using an Angular Material paginator without numbered page buttons. A page-size selector SHALL offer 5, 10 (default), and 20 rows per page.

#### Scenario: Navigate between pages
- **WHEN** the user clicks next / previous / first / last
- **THEN** the corresponding page of owners is requested from the server and rendered
- **AND** the "Showing X–Y of Z" label updates to match the visible range and total

#### Scenario: Change page size
- **WHEN** the user selects a page size of 20
- **THEN** the list reloads with up to 20 rows per page

### Requirement: View state synced to URL query parameters

The Owners screen SHALL reflect `page`, `size`, `sort`, and `lastName` in the URL query parameters so that refresh, browser Back, and shared links restore the same view.

#### Scenario: Refresh preserves the view
- **WHEN** the user has navigated to page 3 sorted by city descending and refreshes the browser
- **THEN** the same page, size, sort, and search are restored from the URL

#### Scenario: Shared link restores the view
- **WHEN** another user opens a link containing `page`, `size`, `sort`, and `lastName` params
- **THEN** they see the same paged, sorted, filtered view

### Requirement: Edge-case behavior for paging and empty results

Changing the search, sort, or page size SHALL reset to page 0. An out-of-range page SHALL clamp to the last valid page. When there are no results, the screen SHALL show "No owners found" and SHALL NOT render the pagination controls (nothing to page through).

#### Scenario: Changing sort resets to first page
- **WHEN** the user is on page 4 and changes the sort column
- **THEN** the list returns to page 0 with the new sort applied

#### Scenario: Out-of-range page clamps
- **WHEN** a requested page is beyond the last available page (e.g. after the result set shrinks)
- **THEN** the view clamps to the last valid page rather than showing an empty page

#### Scenario: Zero results
- **WHEN** a search matches no owners
- **THEN** the table shows "No owners found"
- **AND** the pagination controls are not rendered
