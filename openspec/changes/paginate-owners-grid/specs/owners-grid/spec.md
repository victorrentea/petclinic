## Purpose

Defines how the clinic's owner collection is listed to a client: the server-side page,
sort and filter contract of `GET /api/owners`, and the grid behaviour a user sees on the
owners screen. The collection grows to ~100.000 rows, so every listed result is a bounded,
deterministically ordered slice — never the whole table.

## ADDED Requirements

### Requirement: Owners are listed one page at a time

The owners listing endpoint SHALL return a single page of owners, never the whole
collection. The response SHALL carry the page's rows plus the page metadata a client
needs to render a paginator: page size, zero-based page number, total number of matching
owners, and total number of pages.

The client SHALL NOT be able to request an unbounded page: no request form exists that
returns every owner in one response.

#### Scenario: Default page

- **WHEN** a client requests the owners listing with no page, size or sort parameters
- **THEN** the response contains at most 10 owners
- **AND** the page metadata reports size 10, page number 0, and the total count of owners in the clinic

#### Scenario: A later page

- **WHEN** a client requests page 1 with size 5
- **THEN** the response contains the 6th through 10th owners of the current order
- **AND** the page metadata reports size 5 and page number 1

#### Scenario: A page past the end

- **WHEN** a client requests a page number beyond the last page
- **THEN** the response is successful with an empty row list
- **AND** the page metadata still reports the correct total count and total pages

### Requirement: Only whitelisted page sizes are accepted

The listing endpoint SHALL accept page sizes of 5, 10 or 20 only. Any other requested
size SHALL be rejected with `400 Bad Request`, so no client can turn the endpoint into a
full-table export.

#### Scenario: An accepted size

- **WHEN** a client requests size 20
- **THEN** the response contains at most 20 owners

#### Scenario: An oversized page

- **WHEN** a client requests size 100000
- **THEN** the response is `400 Bad Request`

#### Scenario: An arbitrary size

- **WHEN** a client requests size 7
- **THEN** the response is `400 Bad Request`

### Requirement: Paging is stable across pages

Every ordering the endpoint serves SHALL be a total order: the sorted property is
followed by further tie-breakers ending in the owner's identifier. Consecutive pages of
one ordering SHALL therefore be disjoint and jointly cover the matching owners exactly
once.

#### Scenario: Ties do not duplicate or drop owners

- **WHEN** a client walks every page of an ordering whose sorted column has many equal values
- **THEN** no owner appears on two pages
- **AND** no owner is missing from all pages
- **AND** the union of the pages equals the full set of matching owners

#### Scenario: Repeating the same request

- **WHEN** the same page of the same ordering is requested twice with unchanged data
- **THEN** both responses list the same owners in the same order

### Requirement: Only whitelisted properties are sortable

The listing endpoint SHALL accept sorting by last name, first name or city, in ascending
or descending direction. A request to sort by any other property SHALL be rejected with
`400 Bad Request` — including properties reachable through related entities.

When no sort is requested, owners SHALL be ordered by last name ascending.

#### Scenario: Sorting by city

- **WHEN** a client requests the listing sorted by city ascending
- **THEN** the returned owners are ordered by city ascending

#### Scenario: Sorting by an unsupported column

- **WHEN** a client requests the listing sorted by address
- **THEN** the response is `400 Bad Request`

#### Scenario: Sorting through a relation

- **WHEN** a client requests the listing sorted by a property of a related entity, such as a pet's visit description
- **THEN** the response is `400 Bad Request`

#### Scenario: No sort requested

- **WHEN** a client requests the listing with no sort parameter
- **THEN** the returned owners are ordered by last name ascending

### Requirement: Filtering by last name applies before paging

The listing endpoint SHALL keep its case-sensitive last-name prefix filter. The filter
SHALL be applied by the server before paging, so the page metadata counts only matching
owners and the requested sort applies to the filtered set.

#### Scenario: Filtered listing counts only matches

- **WHEN** a client requests the listing filtered by the last-name prefix "Pot"
- **THEN** only owners whose last name starts with "Pot" are returned
- **AND** the page metadata's total count is the number of such owners, not the number of owners in the clinic

#### Scenario: A filter matching nothing

- **WHEN** a client requests the listing filtered by a last-name prefix no owner matches
- **THEN** the response is successful with an empty row list and a total count of zero

### Requirement: Listing a page costs a bounded number of queries

Listing a page of owners together with their pets SHALL issue a number of database
queries that does not grow with the page size. Rendering the pets of a page SHALL NOT
produce one query per owner.

#### Scenario: Pets of a page are loaded together

- **WHEN** a page of 10 owners with pets is listed
- **THEN** the pets of all owners on the page are loaded by a bounded number of queries, independent of how many owners the page holds

### Requirement: The owners grid is paged and sorted from the server

The owners screen SHALL show one server-returned page at a time, with a paginator
offering page sizes 5, 10 and 20 and reporting the total number of matching owners.
The Name column SHALL display an owner as family name first, followed by the given name, so
that the column's text reads in the order the column is sorted by. Name and City column
headers SHALL be sortable; Address, Telephone and Pets SHALL NOT be. Sorting by Name SHALL
order by family name, then given name.
Changing page, page size or sort SHALL fetch the corresponding page from the server
rather than re-slicing rows already in the browser.

#### Scenario: Opening the owners screen

- **WHEN** a user opens the owners screen
- **THEN** the first 10 owners ordered by last name ascending are listed
- **AND** the paginator reports the total number of owners in the clinic

#### Scenario: Changing page size

- **WHEN** a user selects a page size of 5
- **THEN** the grid shows 5 owners

#### Scenario: Navigating to the next page

- **WHEN** a user moves to the second page
- **THEN** the grid shows the following owners of the same ordering, and none of the owners from the first page

#### Scenario: Sorting by a sortable column

- **WHEN** a user clicks the City column header
- **THEN** the grid shows the first page of owners ordered by city

#### Scenario: Sorting by Name groups a family together

- **WHEN** a user sorts by Name and two owners share a family name
- **THEN** they appear consecutively, ordered by their given names

#### Scenario: How a name is displayed

- **WHEN** the grid lists an owner whose family name is Potter and whose given name is Harry
- **THEN** the Name cell reads "Potter, Harry"

#### Scenario: Non-sortable columns

- **WHEN** a user views the grid
- **THEN** the Address, Telephone and Pets headers offer no sorting affordance

### Requirement: Searching resets to the first page

Applying or changing the last-name search SHALL return the user to the first page while
keeping the current sort, so a search never lands on an empty page of a shorter result set.

#### Scenario: Searching from a later page

- **WHEN** a user is on page 5 of the unfiltered grid and searches for a last-name prefix matching only a few owners
- **THEN** the grid shows the first page of the matching owners
- **AND** the paginator reports the filtered total

#### Scenario: The sort survives the search

- **WHEN** a user sorts by city and then searches for a last-name prefix
- **THEN** the matching owners are still ordered by city

### Requirement: Grid state is addressable by URL

The grid's page number, page size, sort and last-name filter SHALL be reflected in the
owners screen's URL query parameters, so a grid view can be bookmarked, shared and
restored by reloading.

#### Scenario: Reloading a deep-linked grid

- **WHEN** a user opens an owners URL carrying a page number, page size, sort and last-name filter
- **THEN** the grid shows exactly that page, size, ordering and filter

#### Scenario: Interacting updates the URL

- **WHEN** a user changes the page, the page size or the sort
- **THEN** the URL's query parameters are updated to match
