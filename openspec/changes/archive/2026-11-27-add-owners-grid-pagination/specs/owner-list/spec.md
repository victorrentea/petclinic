# Spec Delta

## Purpose

Lets clinic staff find an owner among tens of thousands by browsing a paged, sortable list and searching it by
last-name prefix, both through the REST API and in the Owners grid.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
`GET /api/owners` SHALL return a single page of owners, never the full set, as an object with `content` (the owners
of that page, each with their pets), `totalElements`, `totalPages`, `number` (0-based page index) and `size`.

#### Scenario: Defaults when no paging parameter is given
- **WHEN** a client calls `GET /api/owners` with 26 owners stored
- **THEN** the response holds the first 10 owners ordered by name, with `number` 0, `size` 10,
  `totalElements` 26 and `totalPages` 3

#### Scenario: Requesting a later page
- **WHEN** a client calls `GET /api/owners?page=2&size=10` with 26 owners stored
- **THEN** the response holds the last 6 owners and `number` 2

#### Scenario: Page past the end
- **WHEN** a client calls `GET /api/owners?page=99&size=10` with 26 owners stored
- **THEN** the response is 200 with an empty `content`, `totalElements` 26 and `totalPages` 3

### Requirement: Page size is bounded
The page size SHALL be between 1 and 20; any other value SHALL be rejected with 400 and a message naming the
allowed range, never silently clamped.

#### Scenario: Size above the maximum
- **WHEN** a client calls `GET /api/owners?size=500`
- **THEN** the response is 400 and its message says the size must be between 1 and 20

#### Scenario: Size of zero
- **WHEN** a client calls `GET /api/owners?size=0`
- **THEN** the response is 400

### Requirement: Owners sort by name or city only
The `sort` parameter SHALL accept `name` or `city`, optionally followed by `,asc` or `,desc` (default ascending).
Any other key SHALL be rejected with 400 naming the allowed keys. Without `sort`, owners SHALL be ordered by name.

#### Scenario: Sort by city descending
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners come ordered by city from Z to A

#### Scenario: Unsupported sort key
- **WHEN** a client calls `GET /api/owners?sort=telephone`
- **THEN** the response is 400 and its message lists `name` and `city` as the allowed keys

### Requirement: Sort order is total
Owners that tie on the sorted column SHALL still come in a fixed order: name sorts by last name, then first name,
then id; city sorts by city, then last name, then first name, then id. No owner SHALL appear on two pages or on
none while the data does not change.

#### Scenario: Identical owners across a page boundary
- **WHEN** 15 owners share the same first and last name and a client reads page 0 and page 1 with size 10
- **THEN** the two pages together hold each of those 15 owners exactly once

### Requirement: Alphabetical order follows human reading
Sorting by name or city SHALL follow linguistic alphabetical order, so letters with diacritics sort next to their
base letter rather than after Z.

#### Scenario: A Polish surname
- **WHEN** owners named Silver, Śliwiński and Tremaine are listed by name ascending
- **THEN** Śliwiński comes between Silver and Tremaine

### Requirement: Last-name search is paged too
The `lastName` parameter SHALL keep filtering owners whose last name starts with the given text (case-sensitive),
and the filtered result SHALL be paged and sorted exactly like the unfiltered list, with totals counting only the
matching owners.

#### Scenario: Search with totals
- **WHEN** a client calls `GET /api/owners?lastName=Po&size=1` with two owners named Potter
- **THEN** `content` holds one Potter, `totalElements` is 2 and `totalPages` is 2

### Requirement: Listing stays fast at production volume
Fetching any page, sorted by name or by city, with or without a last-name prefix, SHALL be answered from an index
(no full scan of the owners table) with 100,000 owners stored.

#### Scenario: Last page by city at 100,000 owners
- **WHEN** 100,000 owners are stored and the query for a page sorted by city is explained
- **THEN** the plan uses an index on the owners table, not a sequential scan

### Requirement: The Owners grid pages through owners
The Owners grid SHALL show one page of owners with a pager offering 5, 10 and 20 rows per page (10 by default),
first / previous / next / last buttons, and the range shown out of the total (e.g. "1 – 10 of 26").

#### Scenario: Changing the page size
- **WHEN** a user on the Owners grid picks 20 rows per page
- **THEN** the grid shows up to 20 owners starting from the first one

### Requirement: The Owners grid sorts by Name and City
The Name and City headers SHALL be clickable to sort, toggling between ascending and descending; Address,
Telephone and Pets headers SHALL NOT be sortable.

#### Scenario: Sorting by city
- **WHEN** a user clicks the City header once, then again
- **THEN** owners are first ordered by city A→Z, then Z→A

#### Scenario: Unsortable columns
- **WHEN** a user looks at the Address, Telephone and Pets headers
- **THEN** they show no sort control

### Requirement: Grid state survives navigation
The search text, page, page size and sort SHALL be kept in the page URL. Changing the search, the page size or the
sort SHALL return to the first page. Opening a URL whose page is past the end SHALL show the last page.

#### Scenario: Back from an owner's details
- **WHEN** a user on page 3 sorted by city opens an owner and presses the browser's Back button
- **THEN** the grid shows page 3 sorted by city again

#### Scenario: New search resets the page
- **WHEN** a user on page 3 searches for "Po"
- **THEN** the grid shows the first page of matching owners

#### Scenario: No match
- **WHEN** a user searches for a last-name prefix no owner has
- **THEN** the grid says no owners have a last name starting with that text and shows no pager

### Requirement: The Owners grid leads with what it sorts by
Each owner SHALL be named last name first ("Potter, Harry"), and each sortable header SHALL always show its
arrow: gray while another column is the sort, bright white on the sort column. Columns SHALL keep their width
whatever page or sort is shown.

#### Scenario: Reading the grid
- **WHEN** a user opens the Owners grid sorted by name
- **THEN** owners read "Potter, Harry" and the Name arrow is white while the City arrow is gray

#### Scenario: Changing the sort
- **WHEN** a user sorts by City
- **THEN** no column header moves sideways

### Requirement: Long values stay on one line
A name, address or city too long for its column SHALL be cut with an ellipsis on a single line, and hovering it
SHALL show the whole value.

#### Scenario: A very long Welsh city
- **WHEN** an owner lives in Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch
- **THEN** the City cell shows the beginning followed by "…", and hovering it shows the full name

### Requirement: Pets show their type
Each pet in the grid SHALL be preceded by an emoji of its type, and hovering the emoji SHALL name the type.

#### Scenario: A cat
- **WHEN** an owner has a cat named Leo
- **THEN** the Pets cell reads "🐱 Leo"

