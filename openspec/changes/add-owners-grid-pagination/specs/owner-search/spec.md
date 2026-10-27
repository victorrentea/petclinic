# Spec Delta

## Purpose

Lets clinic staff find owners among a large population by filtering on last name and browsing the
results page by page in a chosen order, through the REST API and the Owners screen.

## ADDED Requirements

### Requirement: Filter owners by last-name prefix
The owner list SHALL contain only owners whose last name starts with the given text, compared
case-sensitively. An empty or missing filter SHALL match every owner.

#### Scenario: Prefix matches
- **WHEN** owners "Harry Potter", "Beatrix Potter" and "George Franklin" exist and the list is requested with lastName "Pot"
- **THEN** the result contains exactly "Harry Potter" and "Beatrix Potter"

#### Scenario: Matching is case-sensitive
- **WHEN** the list is requested with lastName "potter"
- **THEN** "Harry Potter" is not in the result

#### Scenario: No filter matches everyone
- **WHEN** the list is requested without lastName
- **THEN** `totalElements` equals the number of owners in the clinic

### Requirement: Owner list is returned one page at a time
`GET /api/owners` SHALL return a single page as a JSON object with `content` (the owners on that page),
`totalElements`, `totalPages`, `number` (0-based page index) and `size`. It SHALL never return all
owners in one unbounded response.

#### Scenario: First page by default
- **WHEN** 27 owners exist and the list is requested without paging parameters
- **THEN** the response has 10 owners in `content`, `totalElements` 27, `totalPages` 3, `number` 0 and `size` 10

#### Scenario: Last partial page
- **WHEN** 27 owners exist and page 2 of size 10 is requested
- **THEN** `content` holds the remaining 7 owners

#### Scenario: Page past the end
- **WHEN** 27 owners exist and page 5 of size 10 is requested
- **THEN** the response is 200 with an empty `content` and `totalElements` 27

### Requirement: Page size is limited to 5, 10 or 20
The page size SHALL be one of 5, 10 or 20, defaulting to 10. Any other size, or a negative page index,
SHALL be rejected with HTTP 400 and a problem-detail body.

#### Scenario: Allowed size
- **WHEN** the list is requested with size 20
- **THEN** the response is 200 and `content` holds at most 20 owners

#### Scenario: Disallowed size
- **WHEN** the list is requested with size 100000
- **THEN** the response is 400

#### Scenario: Negative page
- **WHEN** the list is requested with page -1
- **THEN** the response is 400

### Requirement: Owners can be sorted by name or city
The list SHALL be sortable by `name` or `city`, ascending or descending, defaulting to `name`
ascending. Sorting by `name` SHALL order by last name, then first name. Any other sort key or
direction SHALL be rejected with HTTP 400.

#### Scenario: Default order is by name
- **WHEN** owners "Harry Potter", "Beatrix Potter" and "Sherlock Holmes" exist and the list is requested without sort
- **THEN** they are listed as "Sherlock Holmes", "Beatrix Potter", "Harry Potter"

#### Scenario: Sort by city descending
- **WHEN** owners in "Vienna", "London" and "Madrid" exist and the list is requested with sort "city,desc"
- **THEN** they are listed in the order Vienna, Madrid, London

#### Scenario: Unsupported sort key
- **WHEN** the list is requested with sort "telephone"
- **THEN** the response is 400

### Requirement: Paging is stable across equal sort values
Owners with equal sort values SHALL keep the same relative order on every request, so that walking
through all pages lists every matching owner exactly once.

#### Scenario: Walking all pages
- **WHEN** 12 owners share the city "London" and all pages of size 5 sorted by city are requested in turn
- **THEN** each of the 12 owners appears exactly once across the pages

### Requirement: Alphabetical order respects accented letters
Sorting by name or city SHALL follow language-neutral Unicode alphabetical order: accented letters
sort next to their base letter and letter case does not push a name to the end of the list.

#### Scenario: Accented initial
- **WHEN** owners with last names "Silver", "Śliwiński" and "Wensleydale" exist and the list is sorted by name
- **THEN** they are listed in the order "Silver", "Śliwiński", "Wensleydale"

### Requirement: Owners screen pages and sorts the list
The Owners screen SHALL show one page of owners with a paginator offering 5, 10 and 20 rows per page,
and sort controls on the Name and City columns only. Changing the search, the sort or the page size
SHALL return to the first page.

#### Scenario: Choosing a page size
- **WHEN** a user picks 5 rows per page on the Owners screen
- **THEN** 5 owners are shown and the paginator reports the total number of matching owners

#### Scenario: Only Name and City are sortable
- **WHEN** a user opens the Owners screen
- **THEN** the Name and City headers offer sorting and the Address, Telephone and Pets headers do not

#### Scenario: New search starts at page one
- **WHEN** a user on page 3 searches for another last name
- **THEN** the first page of the new results is shown

### Requirement: Owners screen state survives navigation
The current search term, page, page size and sort SHALL be kept in the Owners screen URL, so that
refreshing the page or returning to it from an owner's details restores the same view.

#### Scenario: Back from owner details
- **WHEN** a user on page 2 sorted by city opens an owner and navigates back
- **THEN** page 2 sorted by city is shown again

### Requirement: Empty result is distinguished from a failure
The Owners screen SHALL state that no owners match only when the search succeeded with zero results,
and SHALL NOT show that message when loading the owners failed.

#### Scenario: No match
- **WHEN** a user searches for a last name no owner has
- **THEN** a "no owners found" message is shown instead of the table

#### Scenario: Server error
- **WHEN** loading the owners fails with a server error
- **THEN** the "no owners found" message is not shown
