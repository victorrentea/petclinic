# Spec Delta

## Purpose

Lets staff browse a large owner list efficiently: filter by last name, page through results, and sort them, through the REST API and the Owners grid.

## ADDED Requirements

### Requirement: Owner list is returned one page at a time
`GET /api/owners` SHALL return a page object with `content` (the owners on that page), `totalElements`, `totalPages`, `number` (0-based page index) and `size`. It SHALL never return all owners in one unbounded response.

#### Scenario: Default page
- **WHEN** a client calls `GET /api/owners` without `page`, `size` or `sort`
- **THEN** the response contains page `0` with at most 10 owners sorted by name ascending, plus the total count of owners

#### Scenario: Requested page
- **WHEN** 12 owners exist and a client calls `GET /api/owners?page=1&size=5`
- **THEN** `content` holds owners 6–10 in name order, `number` is 1, `size` is 5, `totalElements` is 12 and `totalPages` is 3

#### Scenario: Page beyond the end
- **WHEN** 12 owners exist and a client calls `GET /api/owners?page=7&size=5`
- **THEN** the response is 200 with empty `content`, `totalElements` 12 and `totalPages` 3

### Requirement: Paging parameters are validated
The `size` parameter SHALL accept only 5, 10 or 20. The `page` parameter SHALL be zero or positive. Any other value SHALL be rejected with 400 and a problem detail naming the parameter.

#### Scenario: Allowed size
- **WHEN** a client calls `GET /api/owners?size=20`
- **THEN** the response contains at most 20 owners and `size` is 20

#### Scenario: Disallowed size
- **WHEN** a client calls `GET /api/owners?size=7` or `size=1000`
- **THEN** the response is 400 with a problem detail naming the `size` parameter

#### Scenario: Negative page
- **WHEN** a client calls `GET /api/owners?page=-1`
- **THEN** the response is 400 with a problem detail naming the `page` parameter

### Requirement: Owners are sortable by name or city only
The `sort` parameter SHALL have the form `<key>,<direction>`, where the key is `name` or `city` and the direction is `asc` or `desc` (default `asc`). Any other key or direction SHALL be rejected with 400.

#### Scenario: Sort by city descending
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners are ordered by city from Z to A

#### Scenario: Unsupported sort key
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc`
- **THEN** the response is 400 with a problem detail naming the `sort` parameter

### Requirement: Sort order is total and stable across pages
Sorting by `name` SHALL order by first name, then last name, then owner id. Sorting by `city` SHALL order by city and break ties in the same name order. The direction SHALL apply to every key in the order. Consecutive pages SHALL never repeat or skip an owner while the data does not change.

#### Scenario: Owners sharing a full name
- **WHEN** several owners are named "Kevin McCallister" and a client pages through them sorted by `name,asc` with size 5
- **THEN** every one of them appears exactly once across the pages, in ascending id order

#### Scenario: Ties on city
- **WHEN** several owners live in "Winnetka" and a client sorts by `city,asc`
- **THEN** the Winnetka owners appear together, ordered by first name, last name, id

### Requirement: Name and city sort linguistically
Sorting SHALL treat letters with diacritics as variants of their base letter, and SHALL NOT move a value to the end of the list only because of its case or accents.

#### Scenario: Diacritics sort near their base letter
- **WHEN** owners with first names "Ștefan" and "Tom" exist and a client sorts by `name,asc`
- **THEN** "Ștefan" appears before "Tom"

#### Scenario: Lowercase does not push a value to the end
- **WHEN** owners live in "de Panne" and "Dublin" and "Edinburgh" and a client sorts by `city,asc`
- **THEN** "de Panne" and "Dublin" both appear before "Edinburgh"

### Requirement: Last-name filter combines with paging and sorting
The `lastName` parameter SHALL keep filtering owners whose last name starts with the given prefix. Paging, sorting and the totals SHALL apply to the filtered set.

#### Scenario: Filtered and paged
- **WHEN** 7 owners have a last name starting with "Mc" and a client calls `GET /api/owners?lastName=Mc&size=5&page=1`
- **THEN** `content` holds the last 2 of them, `totalElements` is 7 and `totalPages` is 2

### Requirement: Owners grid pages and sorts on the server
The Owners grid SHALL show one page at a time, with a page-size choice of 5, 10 or 20 (default 10), and SHALL show the total number of owners. Clicking the Name or City header SHALL sort by that column; clicking again SHALL reverse the direction. Address, Telephone and Pets headers SHALL NOT be sortable.

#### Scenario: Change page size
- **WHEN** the user selects 20 rows per page
- **THEN** the grid shows up to 20 owners and returns to the first page

#### Scenario: Sort by clicking a header
- **WHEN** the user clicks the City header twice
- **THEN** the grid shows owners sorted by city descending, starting from the first page

#### Scenario: New search starts from the first page
- **WHEN** the user is on page 3 and searches for a last name
- **THEN** the grid shows the first page of matching owners

### Requirement: Grid state survives refresh and navigation
The Owners grid SHALL keep page, size, sort and last-name filter in the URL query parameters, and SHALL restore them on load.

#### Scenario: Refresh keeps the page
- **WHEN** the user is on page 2, sorted by city descending, and reloads the browser
- **THEN** the grid shows page 2 sorted by city descending

#### Scenario: Back returns to the previous page
- **WHEN** the user opens an owner from page 2 and presses Back
- **THEN** the grid shows page 2 again

#### Scenario: URL points beyond the last page
- **WHEN** the URL asks for a page past the last one (e.g. after owners were deleted)
- **THEN** the grid shows the last existing page and updates the URL
