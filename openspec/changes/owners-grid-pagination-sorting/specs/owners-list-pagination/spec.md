## Purpose

Lets the Owners grid serve a growing dataset (expected ~100,000 rows within a year) by paging,
sorting, and filtering owners in the database instead of loading the full table into the browser.

## ADDED Requirements

### Requirement: Paginated owner listing
`GET /api/owners` SHALL return owners as a page envelope containing `content` (the owners on this
page), `totalElements`, `totalPages`, `number` (0-based current page index), and `size` (page size
in effect), instead of a bare array.

#### Scenario: Default listing returns first page
- **WHEN** a client calls `GET /api/owners` with no `page` or `size` parameters
- **THEN** the response is a page envelope with `number = 0`, `size = 10`, and `content` holding at
  most 10 owners, along with the correct `totalElements` and `totalPages` for the full result set

#### Scenario: Requesting a specific page and size
- **WHEN** a client calls `GET /api/owners?page=2&size=20`
- **THEN** the response envelope has `number = 2`, `size = 20`, and `content` holding the owners
  that fall on the third 20-row page of the current sort order

#### Scenario: Page size above the cap is rejected
- **WHEN** a client calls `GET /api/owners?size=21` (or any value greater than 20)
- **THEN** the API responds with `400 Bad Request` and does not silently clamp the size down

### Requirement: Sortable owner listing with an explicit allowlist
`GET /api/owners` SHALL accept a `sort` parameter identifying one or more of the allowlisted owner
properties (`lastName`, `firstName`, `address`, `city`, `telephone`) and a direction (`asc`/`desc`),
and SHALL order `content` accordingly. Properties outside the allowlist, including `pets` and any
unrecognized name, SHALL be rejected rather than silently accepted or causing a server error.

#### Scenario: Sorting by an allowlisted column
- **WHEN** a client calls `GET /api/owners?sort=telephone,desc`
- **THEN** `content` is ordered by `telephone` descending, subject to the deterministic-ordering and
  null-handling requirements below

#### Scenario: Sorting by a non-allowlisted or unknown property is rejected
- **WHEN** a client calls `GET /api/owners?sort=pets,asc` or `GET /api/owners?sort=doesNotExist,asc`
- **THEN** the API responds with `400 Bad Request` instead of a `500` error or an unfiltered join

#### Scenario: No sort parameter uses the default order
- **WHEN** a client calls `GET /api/owners` without a `sort` parameter
- **THEN** owners are ordered by `lastName` ascending, then `firstName` ascending

### Requirement: Deterministic ordering across pages
Every applied sort SHALL append the owner's `id` ascending as a final tiebreaker, so that owners
with equal values in the requested sort column(s) still receive a total, stable order across pages.

#### Scenario: Owners with tied sort values keep a stable, non-overlapping order
- **WHEN** two or more owners share the same value for every requested sort column (for example,
  the same `city`)
- **THEN** repeated requests for the same page return the same owners in the same order, and no
  owner appears on more than one page or is skipped across consecutive pages

### Requirement: Consistent null handling in sort order
Regardless of sort direction, owners with a `null` value in the sorted column SHALL be ordered
after owners with a non-null value (`NULLS LAST` for both ascending and descending sorts).

#### Scenario: Sorting ascending places nulls last
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc`
- **THEN** owners with a non-null `telephone` appear before any owner with a null `telephone`

#### Scenario: Sorting descending also places nulls last
- **WHEN** a client calls `GET /api/owners?sort=telephone,desc`
- **THEN** owners with a non-null `telephone` still appear before any owner with a null
  `telephone`, rather than nulls moving to the front

### Requirement: Last-name filtering composes with paging and sorting
`GET /api/owners` SHALL continue to accept the existing `lastName` parameter (prefix match) and
apply it before paging and sorting, so the returned envelope reflects the filtered result set's own
`totalElements`/`totalPages`, not the full table's.

#### Scenario: Filtering narrows the paginated result set
- **WHEN** a client calls `GET /api/owners?lastName=Mc&page=0&size=10`
- **THEN** `content` only includes owners whose last name starts with "Mc", and `totalElements`
  reflects the count of matching owners, not all owners

### Requirement: Owners grid displays and controls paging and sorting
The Owners grid in the frontend SHALL let a user sort by any allowlisted column by interacting with
the column header, and navigate between pages and change the page size among 5, 10, and 20 rows,
issuing the corresponding server-side request rather than re-sorting or re-paging data already
loaded in the browser.

#### Scenario: Clicking a column header re-sorts server-side
- **WHEN** a user clicks the "Telephone" column header in the Owners grid
- **THEN** the grid requests the next page of owners sorted by `telephone` from the server and
  displays the returned page

#### Scenario: Changing page size re-fetches from the server
- **WHEN** a user selects a page size of 20 from the paginator
- **THEN** the grid requests page 0 with `size=20` from the server and displays the returned page

#### Scenario: Name column shows "Last, First" and sorts by last name then first name
- **WHEN** the Owners grid renders the "Name" column
- **THEN** each row displays the owner as "LastName, FirstName", and sorting by this column orders
  by `lastName` then `firstName`

#### Scenario: Searching by last name resets to the first page
- **WHEN** a user submits a last-name search from the Owners grid
- **THEN** the grid requests page 0 of the filtered results using the currently selected sort, and
  displays the returned page and updated total count
