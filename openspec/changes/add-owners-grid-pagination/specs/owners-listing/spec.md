## Purpose

Browsing the clinic's owners: the paged, sorted and filtered listing contract that
`GET /api/owners` serves, and the grid that renders it. The listing must stay usable and
bounded in cost as the clinic grows towards the ~100,000 owners the business expects within
a year, so the page, the sort and the filter are all resolved by the server.

## ADDED Requirements

### Requirement: Owner listing is served one page at a time

The owner listing endpoint SHALL return a single page of owners together with the totals
needed to render a pager, never the whole table. The response envelope SHALL carry
`content` (the owners on this page), `totalElements` (matching owners across all pages),
`totalPages`, `number` (the zero-based index of this page) and `size` (the page size in
effect).

Requesting a page SHALL NOT require the client to receive, count or discard owners outside
that page.

#### Scenario: A bare request returns the first page with the defaults applied

- **WHEN** a client requests the owner listing with no `page`, `size` or `sort` parameter
- **THEN** the response contains at most 10 owners, `number` is 0 and `size` is 10
- **AND** `totalElements` is the number of owners in the clinic
- **AND** `totalPages` is `ceil(totalElements / 10)`

#### Scenario: A later page returns the next slice

- **WHEN** a client requests page 1 at size 10 of a clinic holding 28 owners
- **THEN** `content` holds the 11th through 20th owner in the effective sort order
- **AND** `number` is 1, `size` is 10, `totalElements` is 28 and `totalPages` is 3

#### Scenario: The last page is short

- **WHEN** a client requests page 2 at size 10 of a clinic holding 28 owners
- **THEN** `content` holds exactly 8 owners

#### Scenario: A page beyond the end is empty, not an error

- **WHEN** a client requests page 99 at size 10 of a clinic holding 28 owners
- **THEN** the response succeeds with an empty `content`
- **AND** `totalElements` is still 28 and `totalPages` is still 3

#### Scenario: Every owner on a page carries its pets

- **WHEN** a client requests any page of the owner listing
- **THEN** each owner in `content` carries its pets, ordered by pet name
- **AND** the number of database round trips does not grow with the page size

### Requirement: Page size is chosen by the client from a fixed set

The listing SHALL accept a page size of 5, 10 or 20. A size outside that set SHALL be
rejected rather than silently clamped, so a client never believes it received a page it
did not ask for.

#### Scenario: An offered page size is honoured

- **WHEN** a client requests the listing with a size of 5, 10 or 20
- **THEN** `content` holds at most that many owners and `size` echoes the requested value

#### Scenario: An unsupported page size is refused

- **WHEN** a client requests the listing with a size of 1000
- **THEN** the request fails with **400 Bad Request**

### Requirement: Owner listing is sorted by the server on an allowed column

The listing SHALL be sorted server-side. Sorting SHALL be offered on **name** and **city**
only. Address, telephone and pets SHALL NOT be sortable: telephone is free text of mixed
formats and holds nulls, so its order would be arbitrary, and pets is a collection.

Sorting by name SHALL order by last name, then first name, so owners who share a last name
stay adjacent and in a predictable order.

Any sort property outside the allowed set SHALL be refused with a client error, and the
error SHALL NOT disclose internal property or type names.

#### Scenario: Default sort is by name ascending

- **WHEN** a client requests the listing with no `sort` parameter
- **THEN** the owners are ordered by last name ascending, then first name ascending

#### Scenario: Owners sharing a last name are ordered by first name

- **WHEN** the clinic holds `Harry Potter` and `Beatrix Potter` and the listing is sorted by
  name ascending
- **THEN** `Beatrix Potter` precedes `Harry Potter`, with no other owner between them

#### Scenario: Sorting by city

- **WHEN** a client requests the listing sorted by city descending
- **THEN** the owners are ordered by city descending

#### Scenario: An unknown sort property is refused

- **WHEN** a client requests the listing sorted by `telephone`, `password` or any property
  outside the allowed set
- **THEN** the request fails with **400 Bad Request**
- **AND** the response body names neither the entity nor the offending internal property type

### Requirement: Paging is stable across pages

Consecutive pages of one listing SHALL together contain each matching owner exactly once.
Owners whose sort values are equal SHALL be ordered by a stable, unique tiebreak, so no
owner is repeated on two pages or skipped between them.

#### Scenario: Duplicate sort values do not shuffle between pages

- **WHEN** the clinic holds owners with duplicate last names, and a client walks every page
  of the listing at a size that puts a duplicated last name across a page boundary
- **THEN** the concatenation of all pages contains every owner exactly once
- **AND** repeating the walk returns the owners in the same order

### Requirement: Filtering by last name composes with paging and sorting

The listing SHALL keep its existing case-sensitive last-name prefix filter. `totalElements`
and `totalPages` SHALL describe the **filtered** result set, not the whole table.

#### Scenario: The filter narrows the totals

- **WHEN** a client requests the listing filtered by last-name prefix `Pot`, matching two
  owners
- **THEN** `totalElements` is 2 and `totalPages` is 1
- **AND** `content` holds only owners whose last name starts with `Pot`

#### Scenario: An empty filter matches every owner

- **WHEN** a client requests the listing with an empty last-name filter
- **THEN** `totalElements` is the number of owners in the clinic

### Requirement: The grid presents the current page and lets the user move through it

The Owners page SHALL show one page of owners at a time, with a pager offering page sizes
5, 10 and 20 and navigation between pages, and with sortable column headers on Name and
City that indicate the active sort and its direction.

The Name cell SHALL render as `LastName, FirstName`, so the column's sort key is what the
reader sees.

#### Scenario: Landing on the Owners page

- **WHEN** a user opens the Owners page with no parameters
- **THEN** at most 10 owners are listed, sorted by name ascending
- **AND** the pager reports the total number of owners

#### Scenario: Changing the page size

- **WHEN** a user selects a page size of 5
- **THEN** the grid shows at most 5 owners and the pager recomputes the number of pages

#### Scenario: Sorting from a column header

- **WHEN** a user clicks the City header
- **THEN** the grid reloads sorted by city, and the header shows the active sort direction

#### Scenario: The name is shown in sort order

- **WHEN** the grid lists the owner whose first name is `Harry` and last name is `Potter`
- **THEN** the Name cell reads `Potter, Harry`

#### Scenario: An empty result is announced

- **WHEN** a search matches no owner
- **THEN** the grid shows the "no owners" message instead of an empty table

### Requirement: Grid state lives in the URL

The Owners page SHALL keep the last-name filter, the page number, the page size and the sort
in the URL query string, so that reloading, sharing or navigating Back reproduces exactly
the listing the user was looking at.

Starting a new search SHALL return the user to the first page while keeping the current sort,
so a narrow result is never hidden behind a page number left over from the previous search.

#### Scenario: Reloading keeps the place

- **WHEN** a user is on page 2 at size 20 sorted by city, and reloads the browser
- **THEN** the same page, size and sort are shown again

#### Scenario: Sharing a search

- **WHEN** a user copies the URL of a filtered, sorted listing and opens it in a fresh session
- **THEN** the same filter, sort and page are applied

#### Scenario: A new search returns to the first page

- **WHEN** a user on page 3 sorted by city searches for a different last name
- **THEN** the grid shows page 0 of the new result, still sorted by city
