# Spec Delta

## Purpose

Lets clinic staff browse the clinic's owners one page at a time — filtered by last name and
sorted by name or city — without any client ever loading the full owner table.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
`GET /api/owners` SHALL return a single page of owners as
`{content, totalElements, totalPages, number, size}`, where `number` is zero-based. Without
paging parameters it SHALL return page 0 of size 10, sorted by name ascending. Each owner in
`content` keeps its current shape, pets included.

#### Scenario: Default page
- **WHEN** a client calls `GET /api/owners` with no parameters and 26 owners exist
- **THEN** the response holds the first 10 owners by name, `totalElements` 26, `totalPages` 3, `number` 0, `size` 10

#### Scenario: Last partial page
- **WHEN** a client calls `GET /api/owners?page=2&size=10` and 26 owners exist
- **THEN** `content` holds 6 owners and `number` is 2

#### Scenario: Page past the end
- **WHEN** a client calls `GET /api/owners?page=50&size=10` and 26 owners exist
- **THEN** the response is 200 with an empty `content`, `totalElements` 26 and `totalPages` 3

### Requirement: Page size is bounded
The API SHALL accept a `size` from 1 to 100 and SHALL reject any other value, and any
negative `page`, with 400 and a message naming the parameter. It SHALL NOT silently adjust
the value.

#### Scenario: Size above the cap
- **WHEN** a client calls `GET /api/owners?size=101`
- **THEN** the response is 400 and its message names `size`

#### Scenario: Size at the cap
- **WHEN** a client calls `GET /api/owners?size=100`
- **THEN** the response is 200 with at most 100 owners

#### Scenario: Negative page
- **WHEN** a client calls `GET /api/owners?page=-1`
- **THEN** the response is 400 and its message names `page`

### Requirement: Owners sort by name or by city only
The API SHALL accept `sort` as `name` or `city`, optionally followed by `,asc` or `,desc`
(default `asc`). `name` orders by first name, then last name; `city` orders by city, then
first name, then last name. Any other value SHALL be rejected with 400.

#### Scenario: Sort by name puts first names first
- **WHEN** a client calls `GET /api/owners?sort=name,asc` and owners Harry Potter and Beatrix Potter exist
- **THEN** Beatrix Potter is listed before Harry Potter

#### Scenario: Sort by city descending
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners from Wigan are listed before owners from Vienna, and owners within one city are ordered by first name, then last name

#### Scenario: Unsupported sort key
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc`
- **THEN** the response is 400 and its message lists `name` and `city` as the allowed keys

#### Scenario: Accented names sort alphabetically
- **WHEN** owners sort by name and Long Silver, Łukasz Śliwiński and Mister Geppetto exist
- **THEN** Łukasz Śliwiński is listed between Long Silver and Mister Geppetto, not after every unaccented name

### Requirement: Paging is stable across ties
Every sort order SHALL end with the owner id, so that walking all pages of one query
returns each matching owner exactly once, even when owners share every sorted field.

#### Scenario: Owners with the same name on a page boundary
- **WHEN** 11 owners are all named "Ada Lovelace" from London and a client reads pages 0 and 1 with `size=10&sort=city`
- **THEN** the two pages together contain all 11 owners, each exactly once, in ascending id order

### Requirement: Last-name filter applies before paging
The `lastName` parameter SHALL keep its current meaning, a case-sensitive prefix of the last
name, and `totalElements` SHALL count only the owners that match it.

#### Scenario: Filtered total
- **WHEN** a client calls `GET /api/owners?lastName=Pot&size=5` and only Harry and Beatrix Potter match
- **THEN** `content` holds both, ordered Beatrix then Harry, and `totalElements` is 2

#### Scenario: Case still matters
- **WHEN** a client calls `GET /api/owners?lastName=pot`
- **THEN** `content` is empty and `totalElements` is 0

### Requirement: The Owners grid pages through owners
The Owners grid SHALL show one page at a time, offer 5, 10 and 20 rows per page (default
10), and show the total number of matching owners with controls to move between pages.

#### Scenario: Choosing a page size
- **WHEN** the user picks 5 rows per page while 26 owners exist
- **THEN** the grid shows 5 owners and indicates 26 in total

#### Scenario: Moving to the next page
- **WHEN** the user moves to the next page
- **THEN** the grid shows the next owners in the current sort order

### Requirement: The Owners grid sorts by Name and City headers
The Name and City column headers SHALL be clickable to sort ascending, then descending. The
Address, Telephone and Pets headers SHALL NOT be sortable.

#### Scenario: Sorting by city
- **WHEN** the user clicks the City header
- **THEN** the grid shows the first page of owners ordered by city ascending

#### Scenario: Non-sortable header
- **WHEN** the user clicks the Telephone header
- **THEN** the order of the rows does not change

### Requirement: Changing the query returns to the first page
Searching by last name, changing the page size, or changing the sort SHALL show the first
page of the new result.

#### Scenario: Search from a later page
- **WHEN** the user is on page 3 and searches for "Pot"
- **THEN** the grid shows page 1 of the owners whose last name starts with "Pot"

### Requirement: The grid's position survives navigation
The current page, page size, sort and last-name filter SHALL be kept in the page URL, so
that a browser refresh, or returning with Back from an owner's page, shows the same
results. Parameters equal to their defaults SHALL be left out of the URL.

#### Scenario: Back from an owner's page
- **WHEN** the user on page 3 sorted by city opens an owner and then presses Back
- **THEN** the grid shows page 3 sorted by city again

#### Scenario: Defaults leave the URL clean
- **WHEN** the user opens the Owners grid without changing anything
- **THEN** the URL is `/owners` with no query parameters

### Requirement: Empty results are told apart from failures
The grid SHALL show "No owners with last name starting with …" only when the request
succeeded and matched no owner. A failed request SHALL NOT show that message.

#### Scenario: No match
- **WHEN** the user searches for "Zzzz" and no owner matches
- **THEN** the grid shows the no-owners message and no paginator

#### Scenario: Request fails
- **WHEN** the owners request fails
- **THEN** the grid shows an error, not the no-owners message
