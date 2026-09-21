## Purpose

Browsing the clinic's owners: filtering them by last name, ordering the result by the columns a
clinic user actually reads, and retrieving it one page at a time so neither the database nor the
browser ever handles the whole table.

## ADDED Requirements

### Requirement: The owner list is returned one page at a time

The owner list endpoint SHALL return a page envelope carrying `content` (the owners on the
requested page), `totalElements`, `totalPages`, `number` (zero-based page index) and `size`.
It SHALL accept `page` and `size` request parameters. When `page` is omitted it SHALL default to
`0`; when `size` is omitted it SHALL default to `10`. The database SHALL perform the limiting —
the response SHALL never contain more than `size` owners regardless of how many match.

#### Scenario: Default page
- **WHEN** the client requests the owner list with no `page` or `size`
- **THEN** it receives the first 10 matching owners in `content`, `number` is `0`, `size` is `10`
- **AND** `totalElements` is the full number of matching owners, not the number returned

#### Scenario: Explicit page and size
- **WHEN** the client requests `page=2&size=5` and 30 owners match
- **THEN** `content` holds owners 11–15 of the ordering, `number` is `2`, `totalPages` is `6`

#### Scenario: Page past the end
- **WHEN** the client requests a `page` beyond the last one
- **THEN** the response is 200 with an empty `content` and the unchanged `totalElements`

#### Scenario: A page or size outside the allowed range
- **WHEN** the client requests a negative page, a size below 1, or a size above the documented
  maximum
- **THEN** the response is HTTP 400 explaining the bound, not a server error

#### Scenario: Only the offered page sizes reach the user
- **WHEN** the user picks a rows-per-page value in the grid
- **THEN** the only values offered are 5, 10 and 20

### Requirement: The owner list is ordered by a whitelisted key

The endpoint SHALL accept a `sort` parameter of the form `<key>,<asc|desc>` where `<key>` is one
of exactly two values: `name` and `city`. `name` SHALL order by last name then first name.
Any other key — including a property of a related entity — SHALL be rejected with HTTP 400 and a
message naming the allowed keys. When `sort` is omitted the ordering SHALL be `name,asc`.

#### Scenario: Sorting by name
- **WHEN** the client requests `sort=name,asc`
- **THEN** owners are ordered by last name, then first name, ascending

#### Scenario: Sorting by city descending
- **WHEN** the client requests `sort=city,desc`
- **THEN** owners are ordered by city, descending

#### Scenario: A column that is not sortable
- **WHEN** the client requests `sort=address`, `sort=telephone` or `sort=pets.name`
- **THEN** the response is HTTP 400 and no query is executed against the owner table

#### Scenario: Only sortable columns are clickable
- **WHEN** the user looks at the owners grid header
- **THEN** only Name and City are clickable and carry a direction indicator; Address, Telephone
  and Pets are plain text

### Requirement: The name column reads in the order it is sorted

The owners grid SHALL render an owner's name surname first, separated from the given name, so
that the visible leading characters of the column follow the applied ordering. An individual
owner's own page SHALL keep rendering the given name first.

#### Scenario: Ordered by name, ascending
- **WHEN** the grid is ordered by name ascending
- **THEN** each row shows the surname first, followed by the given name
- **AND** reading the column top to bottom, the visible first letters are non-decreasing

#### Scenario: An owner's own page
- **WHEN** the user opens a single owner
- **THEN** that page shows the given name first, unchanged

### Requirement: Paging is stable across pages

Ordering SHALL be total: the identity of each owner SHALL act as the final ordering key after
the requested one. Requesting every page in turn SHALL therefore yield each matching owner
exactly once, including when the sorted-on value is shared by several owners.

#### Scenario: Duplicate last names split across a page boundary
- **WHEN** two owners share a last name and the page boundary falls between them
- **THEN** each appears on exactly one page, and repeating the same two requests returns the
  same two pages

#### Scenario: A city shared by many owners
- **WHEN** owners are sorted by a city held by more owners than fit on one page
- **THEN** walking every page returns each of those owners exactly once

### Requirement: The last-name filter combines with paging

The endpoint SHALL keep accepting a `lastName` parameter that matches owners whose last name
starts with the given value, and SHALL apply it before paging, so `totalElements` counts only
matching owners. Changing the filter in the grid SHALL reset the view to the first page.

#### Scenario: Filter narrows the total
- **WHEN** the client requests the list with a `lastName` prefix matching 3 owners
- **THEN** `totalElements` is `3` and `totalPages` is `1`

#### Scenario: Searching from a later page
- **WHEN** the user is on page 3 and types a new last name into the search box
- **THEN** the grid shows the first page of the new result, not an empty page 3

### Requirement: Changing what a page means returns to the first page

Any control that changes which owners a page index refers to — the last-name filter, the
ordering, or the page size — SHALL return the grid to the first page.

#### Scenario: Re-sorting from a later page
- **WHEN** the user is on page 3 and clicks a column header to re-order the grid
- **THEN** the grid shows the first page of the new ordering

#### Scenario: Enlarging the page from near the end
- **WHEN** the user is on the last page at 5 rows per page and switches to 20
- **THEN** the grid shows the first page at the new size, never a page past the end

### Requirement: Grid state is addressable

The owners grid SHALL keep its filter, page index, page size and sort in the page URL, and SHALL
restore all four when that URL is opened directly or reached with the browser's back button.

#### Scenario: Deep link
- **WHEN** a URL carrying a filter, page, size and sort is opened directly
- **THEN** the grid loads showing exactly that page, sorted that way, with the filter in the box

#### Scenario: Back from an owner
- **WHEN** the user opens an owner from page 3 and presses back
- **THEN** the grid is on page 3 with the same sort and search text as before

### Requirement: Listing owners does not scale queries with the page

Retrieving a page of owners together with each owner's pets SHALL issue a number of database
queries that does not grow with the number of owners on the page.

#### Scenario: A page of owners with pets
- **WHEN** a page of owners, each having pets, is retrieved
- **THEN** the number of queries issued is constant, not one per owner

### Requirement: Ordering matches the database's collation

The stored ordering used to serve a sorted page SHALL agree with the ordering the endpoint
returns, so that the same sort assertion holds on every environment. A deployment whose database
collates text differently from the one the ordering was defined against SHALL fail a check
rather than silently return a different page.

#### Scenario: A non-ASCII last name
- **WHEN** owners are sorted ascending by name and one last name begins with a non-ASCII letter
- **THEN** it appears at the position the database's declared collation places it
- **AND** a database initialised with a different collation makes that check fail
