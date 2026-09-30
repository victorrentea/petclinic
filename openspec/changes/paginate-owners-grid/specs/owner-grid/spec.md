# Spec Delta

## Purpose

Lets clinic staff browse and find owners one page at a time, in a predictable order, however
many owners the clinic has — through the REST API and on the Owners screen.

## ADDED Requirements

### Requirement: The owners list is served one page at a time
`GET /api/owners` SHALL return a single page of owners and never the full list. The response
SHALL carry the owners of the requested page (`content`) and the number of owners matching the
filter across all pages (`totalElements`). Pages are numbered from 0.

#### Scenario: Default page
- **WHEN** a client calls `GET /api/owners` with no paging or sorting parameters
- **THEN** the response holds at most 10 owners, sorted by name ascending, starting with the first
- **AND** `totalElements` equals the number of owners in the clinic

#### Scenario: A later page continues the previous one
- **WHEN** a client requests `page=0` and then `page=1` with the same `size`, `sort`, `dir` and filter
- **THEN** page 1 starts with the owner that follows the last owner of page 0 in that order
- **AND** no owner appears on both pages

#### Scenario: Page past the end
- **WHEN** a client requests a page number beyond the last page
- **THEN** the response is 200 with an empty `content`
- **AND** `totalElements` still reports the number of matching owners

### Requirement: Page size is 5, 10 or 20
The page size SHALL be one of 5, 10 or 20. Any other size SHALL be rejected with a 400 and a
problem description, so no client can pull the whole table in one request.

#### Scenario: Allowed size
- **WHEN** a client requests `size=5`
- **THEN** the response holds at most 5 owners

#### Scenario: Size outside the allowed set
- **WHEN** a client requests `size=1000`
- **THEN** the response is 400 and names the allowed sizes

### Requirement: Owners sort by name or by city
The list SHALL sort by `name` (last name, then first name) or by `city` (city, then last name,
then first name), ascending or descending. Owners that tie on every sort value SHALL keep one
stable relative order across requests, so paging never shows an owner twice or skips one.
Sorting by address, telephone or pets SHALL NOT be offered. An unknown sort key or direction
SHALL be rejected with a 400 and a problem description.

#### Scenario: Sort by name
- **WHEN** a client requests `sort=name&dir=asc`
- **THEN** owners are ordered by last name, and owners sharing a last name by first name

#### Scenario: Sort by city, descending
- **WHEN** a client requests `sort=city&dir=desc`
- **THEN** owners are ordered by city from Z to A, and owners in the same city by last name, then first name

#### Scenario: Names with diacritics sort among their letters
- **WHEN** the list is sorted by name ascending
- **THEN** "Śliwiński" sorts among the names starting with S, not after Z

#### Scenario: Unsupported sort key
- **WHEN** a client requests `sort=telephone`
- **THEN** the response is 400 and names the supported keys

### Requirement: The last-name filter combines with paging and sorting
The existing `lastName` filter (owners whose last name starts with the given text, matched as
today) SHALL apply before paging, so `totalElements` and every page count only matching owners.

#### Scenario: Filtered page
- **WHEN** a client requests `lastName=Da&size=5`
- **THEN** every owner on the page has a last name starting with "Da"
- **AND** `totalElements` equals the number of owners whose last name starts with "Da"

### Requirement: The Owners screen pages and sorts the grid
The Owners screen SHALL show one page of owners with a paginator offering 5, 10 and 20 rows per
page, and SHALL let the user sort by clicking the Name or City header; clicking the active header
again SHALL flip the direction between ascending and descending. The screen SHALL open sorted by
Name ascending with 10 rows. The paginator SHALL show the range on screen and the total number
of matching owners. Changing the search text, the sort or the page size SHALL return to the first
page.

#### Scenario: Screen opens on the first page
- **WHEN** a user opens the Owners screen
- **THEN** it shows the first 10 owners sorted by name ascending and the total number of owners

#### Scenario: Sort by city from the header
- **WHEN** the user clicks the City header
- **THEN** the grid shows the first page sorted by city ascending
- **AND** clicking City again sorts it descending

#### Scenario: Change page size
- **WHEN** the user on page 2 picks 5 rows per page
- **THEN** the grid shows the first 5 owners in the current order

#### Scenario: Search returns to page 1
- **WHEN** the user on page 2 searches for a last name
- **THEN** the grid shows the first page of the matching owners

#### Scenario: Next page
- **WHEN** the user moves to the next page
- **THEN** the grid shows the owners that follow the last owner of the previous page, in the same order

#### Scenario: Only Name and City are sortable
- **WHEN** the user looks at the Address, Telephone and Pets headers
- **THEN** they offer no sorting
