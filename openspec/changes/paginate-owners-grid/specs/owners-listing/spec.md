## Purpose

Listing owners for the clinic's owners grid: filtering by last-name prefix, returning one
bounded page at a time in a stable, meaningful order, so the list stays usable and cheap at
the 100.000-owner target the business is aiming for.

## ADDED Requirements

### Requirement: Paged owners listing

`GET /api/owners` SHALL return one page of owners, never the whole table. The response body
SHALL carry the page's rows under `content` and its metadata under a nested `page` object with
`size`, `number`, `totalElements` and `totalPages`.

#### Scenario: Default page

- **WHEN** a client calls `GET /api/owners` with no parameters
- **THEN** the response contains at most 10 rows under `content`
- **AND** `page.number` is `0`, `page.size` is `10`, and `page.totalElements` is the number of
  owners matching the (absent) filter

#### Scenario: Explicit page and size

- **WHEN** a client calls `GET /api/owners?page=1&size=5` against the 28 seeded owners
- **THEN** the response contains rows 6–10 of the ordering under `content`
- **AND** `page.number` is `1`, `page.size` is `5`, `page.totalElements` is `28` and
  `page.totalPages` is `6`

#### Scenario: Page past the end

- **WHEN** a client requests a page number beyond the last page
- **THEN** the response status is `200` with an empty `content` array
- **AND** `page.totalElements` and `page.totalPages` still describe the full result set

### Requirement: Owner row content

Each row in `content` SHALL carry exactly the owner's `id`, `firstName`, `lastName`,
`address`, `city` and `telephone`. Rows SHALL NOT carry the owner's pets.

#### Scenario: Row shape

- **WHEN** a client reads any row from `content`
- **THEN** the row exposes `id`, `firstName`, `lastName`, `address`, `city` and `telephone`
- **AND** the row exposes no `pets` field

### Requirement: Page size bounds

`size` SHALL default to `10` and SHALL be capped at `20` server-side, independently of what
the user interface offers.

#### Scenario: Size at the cap

- **WHEN** a client calls `GET /api/owners?size=20`
- **THEN** the response status is `200` and `page.size` is `20`

#### Scenario: Size above the cap

- **WHEN** a client calls `GET /api/owners?size=21`
- **THEN** the response status is `400` and no owner data is returned

### Requirement: Sortable fields

Owners SHALL be sortable by `NAME` and by `CITY` only, in either direction, selected with the
`sort` and `dir` parameters. `sort` SHALL default to `NAME` and `dir` to `ASC`. Address and
telephone SHALL NOT be sortable.

#### Scenario: Sort by name descending

- **WHEN** a client calls `GET /api/owners?sort=NAME&dir=DESC`
- **THEN** the rows are ordered by last name descending, ties broken by first name descending

#### Scenario: Sort by city

- **WHEN** a client calls `GET /api/owners?sort=CITY&dir=ASC`
- **THEN** the rows are ordered by city ascending

#### Scenario: Unsupported sort field

- **WHEN** a client calls `GET /api/owners?sort=TELEPHONE` or any value outside `NAME` / `CITY`
- **THEN** the response status is `400` as a problem detail, not `500`

#### Scenario: Unsupported direction

- **WHEN** a client calls `GET /api/owners?dir=SIDEWAYS`
- **THEN** the response status is `400` as a problem detail, not `500`

### Requirement: Stable ordering across pages

Every ordering SHALL end in a unique tie-breaker, so that walking the pages of an unchanged
result set visits each owner exactly once.

#### Scenario: Walking every page with duplicate last names

- **GIVEN** the seeded owners, which include two `Darling` and two `Potter`
- **WHEN** a client walks all pages of `GET /api/owners?size=5` in order
- **THEN** the 28 owners are seen exactly once each, with no repeat and no gap

### Requirement: Culture-correct alphabetical ordering

Ordering by name SHALL follow the natural alphabetical order of the deployed database, not
byte order.

#### Scenario: Diacritics sort in place

- **WHEN** owners are listed sorted by `NAME` ascending
- **THEN** `Śliwiński` appears immediately after `Silver`, not after `Z`

### Requirement: Last-name filter composes with paging

The existing `lastName` filter SHALL remain a case-sensitive prefix match, and SHALL apply
before paging and sorting so that page metadata describes the filtered result set.

#### Scenario: Filtered and paged

- **WHEN** a client calls `GET /api/owners?lastName=Pot&size=1&page=0`
- **THEN** `content` holds one owner whose last name starts with `Pot`
- **AND** `page.totalElements` counts only owners matching the prefix

#### Scenario: Filter stays case-sensitive

- **WHEN** a client calls `GET /api/owners?lastName=potter`
- **THEN** `content` is empty and `page.totalElements` is `0`

### Requirement: Grid presentation and deep-linking

The owners grid SHALL show a page-size selector offering 5, 10 and 20 rows, next/previous
navigation, and sortable `Name` and `City` headers. The name SHALL be rendered as
`Last, First`. The filter, page, size, sort field and direction SHALL live in the page URL.

#### Scenario: Deep link restores the grid

- **WHEN** a user opens a URL carrying `lastName`, `page`, `size`, `sort` and `dir`
- **THEN** the grid shows exactly that filtered, sorted page

#### Scenario: Changing the query resets the page

- **WHEN** a user changes the search text, the sort, or the page size
- **THEN** the grid returns to the first page

#### Scenario: Name column format

- **WHEN** the grid lists Harry Potter
- **THEN** the name cell reads `Potter, Harry`
