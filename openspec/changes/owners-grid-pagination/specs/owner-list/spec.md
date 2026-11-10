# Spec Delta

## Purpose

Lets clinic staff browse the clinic's owners — filtered by last name, one page at a time, in a
chosen order — both over the REST API and in the Owners grid, at a volume of tens of thousands.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
`GET /api/owners` SHALL return a single page of owners, never the whole table. The response SHALL
carry the owners on that page under `content` and, under `page`, the page `number` (0-based), its
`size`, the `totalElements` matching the request and the `totalPages`. Each owner keeps its pets.

#### Scenario: First page by default
- **WHEN** a client calls `GET /api/owners` with no paging parameters and 26 owners exist
- **THEN** the response holds the first 10 owners
- **AND** `page` reports `number` 0, `size` 10, `totalElements` 26, `totalPages` 3

#### Scenario: A later page
- **WHEN** a client calls `GET /api/owners?page=2&size=10` and 26 owners exist
- **THEN** the response holds the last 6 owners and `page.number` is 2

#### Scenario: Owners keep their pets
- **WHEN** a page includes an owner who has two pets
- **THEN** that owner is returned with both pets

### Requirement: Page size is bounded
The page size SHALL default to 10 and SHALL never exceed 20 owners, whatever size is requested.

#### Scenario: Oversized page request
- **WHEN** a client calls `GET /api/owners?size=50000`
- **THEN** the response holds at most 20 owners and `page.size` is 20

#### Scenario: Allowed sizes
- **WHEN** a client asks for a size of 5, 10 or 20
- **THEN** the page holds up to that many owners

### Requirement: Owners can be ordered by name or city
A client SHALL be able to order the list with `sort=name` (last name, then first name) or `sort=city`,
each `asc` or `desc`. With no order requested, owners SHALL be ordered by name ascending. Owners
that tie on the requested order SHALL be ordered by their id, so no owner appears on two pages.

#### Scenario: Default order is by name
- **WHEN** a client lists owners without a `sort` parameter
- **THEN** owners are ordered by last name, then first name, ascending

#### Scenario: Two owners with the same last name
- **WHEN** owners "George Darling" and "Wendy Darling" are listed by name
- **THEN** "George Darling" comes before "Wendy Darling"

#### Scenario: Order by city, descending
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners are ordered by city from Z to A

#### Scenario: Stable across pages
- **WHEN** four owners live in London and the list is ordered by city with a page size of 5
- **THEN** walking every page returns each owner exactly once

### Requirement: Only name and city are sortable
The API SHALL reject a `sort` key other than `name` or `city` with HTTP 400 and a problem response
naming the key. Address, telephone and pets SHALL NOT be sortable.

#### Scenario: Sorting by telephone is rejected
- **WHEN** a client calls `GET /api/owners?sort=telephone`
- **THEN** the response is 400 and names `telephone` as not sortable

#### Scenario: Sorting by pets is rejected
- **WHEN** a client calls `GET /api/owners?sort=pets`
- **THEN** the response is 400

### Requirement: Names and cities sort by locale-aware rules
Ordering by name or city SHALL follow linguistic rules, not byte order: a letter with a diacritic
SHALL sort next to its base letter, and upper and lower case SHALL NOT split the list in two.

#### Scenario: Polish last name among S names
- **WHEN** owners "Long Silver", "Łukasz Śliwiński" and "Tom Thumb" are listed by name ascending
- **THEN** the order is Silver, Śliwiński, Thumb (byte order would put Śliwiński last)

#### Scenario: City starting with a letter outside ASCII
- **WHEN** owners from "Lyon", "Łódź" and "Madrid" are listed by city ascending
- **THEN** "Łódź" comes after "Lyon" and before "Madrid" (byte order would put it after "Madrid")

#### Scenario: Lower-case particle
- **WHEN** owners "Rafael de la Cruz" and "Ana Diaz" are listed by name ascending
- **THEN** "de la Cruz" comes before "Diaz", not after every capitalised name

### Requirement: Filtering by last name combines with paging and order
The existing `lastName` filter (a case-sensitive prefix of the last name) SHALL apply before paging:
the totals SHALL count only matching owners, and the requested order SHALL apply to them.

#### Scenario: Filtered totals
- **WHEN** a client calls `GET /api/owners?lastName=Potter&size=5`
- **THEN** `page.totalElements` is the number of owners whose last name starts with "Potter"

#### Scenario: No match
- **WHEN** no owner's last name starts with "Zzzz"
- **THEN** the response has empty `content` and `page.totalElements` 0

### Requirement: A page past the end is empty, not an error
A request for a page beyond the last one SHALL succeed with empty `content` and the correct totals.

#### Scenario: Page 99 of 3
- **WHEN** 26 owners exist and a client calls `GET /api/owners?page=99`
- **THEN** the response is 200 with empty `content`, `totalElements` 26 and `totalPages` 3

### Requirement: The Owners grid pages and sorts on the server
The Owners grid SHALL show one page at a time with a paginator offering 5, 10 and 20 rows per page
and the total number of owners, and SHALL fetch every page and order from the server.

#### Scenario: Changing page size
- **WHEN** the user picks 20 rows per page
- **THEN** the grid shows up to 20 owners and the paginator reports the total, e.g. "1 – 20 of 26"

#### Scenario: Next page
- **WHEN** the user moves to the next page
- **THEN** the grid shows the next owners in the current order

### Requirement: The grid shows names last name first
The grid SHALL show each owner's name as "Last, First" (e.g. "McCallister, Kevin") in a single Name
column that links to the owner's details, so the visible text follows the name order.

#### Scenario: Name column text
- **WHEN** the grid lists Kevin McCallister
- **THEN** his row shows "McCallister, Kevin", linking to his details page

### Requirement: Only Name and City headers sort the grid
In the grid, only the Name and City column headers SHALL be sortable; clicking one SHALL toggle
between ascending and descending, never back to unsorted. Address, Telephone and Pets headers SHALL
NOT react to clicks.

#### Scenario: Sorting by city in the grid
- **WHEN** the user clicks the City header
- **THEN** the grid reloads the first page ordered by city ascending, and a second click orders it descending

#### Scenario: Telephone header
- **WHEN** the user clicks the Telephone header
- **THEN** nothing changes

### Requirement: The grid keeps its place in the URL
The grid SHALL reflect its page, page size and order in the URL, and SHALL restore them when opened
from such a URL, on refresh, or on navigating back from an owner's details.

#### Scenario: Back from details
- **WHEN** the user is on page 3 ordered by city, opens an owner, then goes back
- **THEN** the grid shows page 3 ordered by city again

#### Scenario: Shared link
- **WHEN** someone opens `/owners?page=1&size=5&sort=city,desc`
- **THEN** the grid shows the second page of 5 owners ordered by city descending

### Requirement: A new search restarts from the first page
Searching by last name in the grid SHALL show the first page of the matching owners and SHALL keep
the chosen order and page size.

#### Scenario: Search while on a later page
- **WHEN** the user is on page 4 ordered by city and searches for "Potter"
- **THEN** the grid shows page 1 of the owners named Potter, still ordered by city

### Requirement: The grid recovers from a page past the end
When the grid lands on a page past the last one (e.g. an old link, or owners deleted meanwhile), it
SHALL move to the last page that has owners.

#### Scenario: Stale link
- **WHEN** 26 owners exist and someone opens `/owners?page=9&size=10`
- **THEN** the grid shows page 3, with the last 6 owners

### Requirement: The grid says when nothing matches
When the server reports zero matching owners, the grid SHALL say that no owner's last name starts
with the searched text, instead of an empty table.

#### Scenario: Search with no match
- **WHEN** the user searches for "Zzzz"
- **THEN** the grid shows "No owners with LastName starting with "Zzzz""
