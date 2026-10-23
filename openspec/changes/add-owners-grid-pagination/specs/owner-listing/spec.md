# Spec Delta

## Purpose

How clinic staff browse owners: the `GET /api/owners` listing and the Owners grid. The listing
is filtered by last-name prefix, paged on the server, and sorted in a stable order, so it stays
usable at tens of thousands of owners.

## ADDED Requirements

### Requirement: Owner listing returns one page
`GET /api/owners` SHALL return a JSON object `{ content, totalElements }`, not an array.
`content` holds the owners of the requested page, each with its pets as before. `totalElements`
is the number of owners that match the filter across all pages.

#### Scenario: First page of a larger list
- **GIVEN** 12 owners exist
- **WHEN** a client calls `GET /api/owners?page=0&size=10`
- **THEN** the response is 200 with 10 owners in `content` and `totalElements` = 12

#### Scenario: Last partial page
- **GIVEN** 12 owners exist
- **WHEN** a client calls `GET /api/owners?page=1&size=10`
- **THEN** `content` holds the remaining 2 owners and `totalElements` = 12

#### Scenario: Page past the end
- **GIVEN** 12 owners exist
- **WHEN** a client calls `GET /api/owners?page=5&size=10`
- **THEN** the response is 200 with an empty `content` and `totalElements` = 12

#### Scenario: Each owner still carries its pets
- **GIVEN** an owner with pets "Leo" and "Basil"
- **WHEN** that owner appears in a page
- **THEN** its entry lists both pets, as `GET /api/owners/{id}` does

### Requirement: Paging defaults
If a parameter is omitted, the listing SHALL use `page=0`, `size=10`, `sort=name` and `dir=asc`.

#### Scenario: No parameters
- **GIVEN** 25 owners exist
- **WHEN** a client calls `GET /api/owners`
- **THEN** the response holds the first 10 owners in ascending name order and `totalElements` = 25

### Requirement: Page size is limited to 5, 10 or 20
The listing SHALL accept only `size` 5, 10 or 20, and SHALL reject any other value with 400.
A client therefore cannot fetch every owner in one request.

#### Scenario: Allowed size
- **WHEN** a client calls `GET /api/owners?size=20`
- **THEN** the response is 200 with at most 20 owners in `content`

#### Scenario: Oversized page rejected
- **WHEN** a client calls `GET /api/owners?size=50000`
- **THEN** the response is 400

#### Scenario: Size not in the allowed set
- **WHEN** a client calls `GET /api/owners?size=7`
- **THEN** the response is 400

### Requirement: Page index is zero-based and non-negative
`page` SHALL count from 0. A negative or non-numeric `page` SHALL be rejected with 400.

#### Scenario: Negative page rejected
- **WHEN** a client calls `GET /api/owners?page=-1`
- **THEN** the response is 400

### Requirement: Only Name and City are sort keys
`sort` SHALL accept only `name` or `city`, and `dir` only `asc` or `desc`. Any other value,
including `address`, `telephone`, `pets` or a raw column name, SHALL be rejected with 400.

#### Scenario: Unknown sort key rejected
- **WHEN** a client calls `GET /api/owners?sort=telephone`
- **THEN** the response is 400

#### Scenario: Address is not a sort key
- **WHEN** a client calls `GET /api/owners?sort=address`
- **THEN** the response is 400

#### Scenario: Column name is not a sort key
- **WHEN** a client calls `GET /api/owners?sort=first_name`
- **THEN** the response is 400

#### Scenario: Unknown direction rejected
- **WHEN** a client calls `GET /api/owners?sort=city&dir=up`
- **THEN** the response is 400

### Requirement: Name sorts by first name, then last name
`sort=name` SHALL order owners by first name, then last name, then a unique tie-breaker. Owners
with the same full name therefore keep the same order on every request.

#### Scenario: Ascending by first name
- **GIVEN** owners "Harry Potter", "Beatrix Potter" and "Albus Dumbledore"
- **WHEN** a client lists them with `sort=name&dir=asc`
- **THEN** they come in the order "Albus Dumbledore", "Beatrix Potter", "Harry Potter"

#### Scenario: Owners with the same full name stay apart across pages
- **GIVEN** 6 owners all named "Wendy Darling"
- **WHEN** a client reads `page=0&size=5`, then `page=1&size=5`, sorted by name
- **THEN** the two pages together contain each of the 6 owners exactly once

#### Scenario: Descending
- **GIVEN** owners "Albus Dumbledore" and "Harry Potter"
- **WHEN** a client lists them with `sort=name&dir=desc`
- **THEN** "Harry Potter" comes before "Albus Dumbledore"

### Requirement: City sorts as text with a stable tie-breaker
`sort=city` SHALL order owners by city as text, then by a unique tie-breaker.

#### Scenario: Many owners in one city
- **GIVEN** 5 owners in "London" and 1 in "Bath"
- **WHEN** a client lists them with `sort=city&dir=asc&size=5`
- **THEN** page 0 starts with the "Bath" owner, and pages 0 and 1 together hold each "London" owner exactly once

### Requirement: Text sorting respects letters with diacritics
Names and cities SHALL sort by language-aware rules: a letter with a diacritic sorts
next to its base letter, not after all unaccented letters.

#### Scenario: Accented last name
- **GIVEN** owners with first name "Ann" and last names "Śliwiński", "Smith" and "Wensleydale"
- **WHEN** a client lists them with `sort=name&dir=asc`
- **THEN** "Ann Śliwiński" comes before "Ann Wensleydale"

### Requirement: Last-name filter applies before paging
The optional `lastName` parameter SHALL keep only owners whose last name starts with it,
case-sensitive. Paging, sorting and `totalElements` SHALL apply to the filtered owners only.

#### Scenario: Filtered total
- **GIVEN** owners "George Franklin", "Betty Davis" and "Harold Davis"
- **WHEN** a client calls `GET /api/owners?lastName=Dav&size=5`
- **THEN** `content` holds exactly the two Davis owners and `totalElements` = 2

#### Scenario: Filter matching nothing
- **WHEN** a client calls `GET /api/owners?lastName=Zzzz`
- **THEN** the response is 200 with an empty `content` and `totalElements` = 0

### Requirement: Grid pages and sorts on the server
The Owners grid SHALL show one page at a time with page sizes 5, 10 or 20 (default 10). It SHALL
show the total count and fetch every page and sort order from the server. Only the Name and
City headers SHALL be sortable.

#### Scenario: Moving to the next page
- **GIVEN** 25 owners and the grid on page 1 with size 10
- **WHEN** the user goes to the next page
- **THEN** the grid requests page 1 (0-based) from the server and shows owners 11–20

#### Scenario: Non-sortable columns
- **WHEN** the user clicks the Address, Telephone or Pets header
- **THEN** the order does not change and no request is sent

### Requirement: Grid returns to the first page when the result set changes
The grid SHALL go back to the first page when the user starts a new search, changes the page
size, or changes the sort. A new search and a page-size change SHALL keep the current sort.

#### Scenario: New search
- **GIVEN** the grid on page 3 sorted by City descending
- **WHEN** the user searches for last name "Dav"
- **THEN** the grid shows page 1 of the "Dav" results, still sorted by City descending

#### Scenario: Page size change
- **GIVEN** the grid on page 2 with size 10
- **WHEN** the user picks size 20
- **THEN** the grid shows page 1 with up to 20 owners

### Requirement: Grid shows only the latest answer
If the user triggers a new request while an earlier one is still pending, the grid SHALL show
only the latest request's result, even if the earlier response arrives later.

#### Scenario: Slow earlier response
- **GIVEN** a request for page 1 still in flight
- **WHEN** the user moves to page 2 and the page-1 response arrives after the page-2 response
- **THEN** the grid shows page 2

### Requirement: Grid reports an empty result
The grid SHALL show the message "No owners…" when the server reports `totalElements` = 0.

#### Scenario: Search with no matches
- **WHEN** the user searches for a last name no owner has
- **THEN** the grid shows the "No owners…" message instead of an empty table

### Requirement: Grid state survives refresh and Back
The grid SHALL mirror its page, size, sort and direction in the URL query
(`?page=&size=&sort=&dir=`) and SHALL restore them from the URL when the page opens.

#### Scenario: Refresh keeps the page
- **GIVEN** the grid on page 3, size 20, sorted by City descending
- **WHEN** the user reloads the browser tab
- **THEN** the grid shows page 3, size 20, sorted by City descending

#### Scenario: Back from an owner's details
- **GIVEN** the grid on page 2
- **WHEN** the user opens an owner and then presses Back
- **THEN** the grid shows page 2 again
