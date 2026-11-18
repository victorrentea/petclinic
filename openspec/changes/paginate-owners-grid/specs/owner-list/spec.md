# Spec Delta

## Purpose

Lets clinic staff find an owner among ~100,000 by browsing a sorted, paged list of owners,
optionally narrowed to a last-name prefix, without the client ever receiving every owner at once.

## ADDED Requirements

### Requirement: Filter by last-name prefix
The owner list SHALL contain only owners whose last name starts with the given text, matched
case-sensitively. An empty or missing filter SHALL match every owner.

#### Scenario: Prefix matches
- **WHEN** the list is requested with last name `Pot`
- **THEN** it contains Harry Potter and Beatrix Potter, and no other owner

#### Scenario: Match is case-sensitive and anchored at the start
- **WHEN** the list is requested with last name `potter`, or with `otter`
- **THEN** it contains no owners

### Requirement: The list is returned one page at a time
The system SHALL return at most one page of owners per request. Along with the page it SHALL
return the 0-based page number, the page size, and the total number of owners matching the filter
across all pages. A page number past the last page SHALL return an empty page with the correct
total, not an error.

#### Scenario: First page and total
- **WHEN** 26 owners exist and page 0 of size 10 is requested
- **THEN** 10 owners are returned, with page 0, size 10 and total 26

#### Scenario: Last, partial page
- **WHEN** 26 owners exist and page 2 of size 10 is requested
- **THEN** 6 owners are returned, with total 26

#### Scenario: Past the last page
- **WHEN** 26 owners exist and page 9 of size 10 is requested
- **THEN** no owners are returned, the total is 26, and the request succeeds

#### Scenario: Paging applies after the filter
- **WHEN** the list is requested with last name `Pot` and page size 5
- **THEN** the total is 2 and both Potters are on page 0

### Requirement: Page size is 5, 10 or 20
The page size SHALL be one of 5, 10 or 20, and SHALL default to 10 when not given. Any other size
SHALL be rejected as a bad request (HTTP 400), with nothing listed.

#### Scenario: Default size
- **WHEN** the list is requested without a size
- **THEN** at most 10 owners are returned and the size reported is 10

#### Scenario: Size outside the allowed set
- **WHEN** the list is requested with size 0, 7, 21 or 100000
- **THEN** the request is rejected with HTTP 400

#### Scenario: Negative page
- **WHEN** the list is requested with page -1
- **THEN** the request is rejected with HTTP 400

### Requirement: Sortable by name or by city only
The list SHALL be sortable by `name` or `city`, ascending or descending, and SHALL default to name
ascending. Sorting by name SHALL order by last name, then first name. Sorting by city SHALL order
by city, then last name, then first name. Any other sort key or direction SHALL be rejected
with HTTP 400.

#### Scenario: Default order is by name
- **WHEN** the list is requested without a sort
- **THEN** owners are ordered by last name, so Wendy Darling comes before Harry Potter even though
  H precedes W, and owners sharing a last name are ordered by first name (George Darling before
  Wendy Darling)

#### Scenario: Sort by city, descending
- **WHEN** the list is requested sorted by city descending
- **THEN** owners are ordered from the last city alphabetically to the first, and owners in the
  same city are ordered by name ascending

#### Scenario: Unsupported sort key
- **WHEN** the list is requested sorted by `telephone`, `address`, `pets` or `id`
- **THEN** the request is rejected with HTTP 400

### Requirement: Order is stable across pages
For any sort, the order SHALL be total: two owners that tie on every sort key SHALL still have a
fixed relative order. Walking every page of a listing that doesn't change SHALL return each
matching owner exactly once.

#### Scenario: Ties split across a page boundary
- **WHEN** 4 owners live in London and the list sorted by city is walked page by page with size 5
- **THEN** every owner appears exactly once over all pages, and repeating the walk gives the same
  pages

### Requirement: Accent-aware alphabetical order
Names and cities SHALL be ordered alphabetically as a reader expects. Accented and special Latin
letters SHALL sort next to their base letter, not after `Z`.

#### Scenario: Polish surname among English ones
- **WHEN** owners Scamander, Schroedinger, Silver, Śliwiński and Tremaine are sorted by name
  ascending
- **THEN** Śliwiński comes after Silver and before Tremaine

### Requirement: Each listed owner carries their pets
Each owner on a page SHALL include their pets' names, as the full list does today. The cost of
loading pets SHALL NOT grow with the number of owners on the page.

#### Scenario: Owner with two pets
- **WHEN** a page includes an owner with two pets
- **THEN** both pet names are listed for that owner

### Requirement: Owners screen pages and sorts through the list
The Owners screen SHALL show one page at a time with a paginator offering 5, 10 and 20 rows
(default 10), and the total. Only the Name and City headers SHALL be sortable, each toggling
ascending and descending. Address, Telephone and Pets SHALL NOT be sortable.

#### Scenario: Sort by clicking a header
- **WHEN** the user clicks the City header
- **THEN** the grid shows the first page sorted by city ascending, and a second click sorts it
  descending

#### Scenario: Non-sortable headers
- **WHEN** the user clicks the Telephone header
- **THEN** the order does not change

### Requirement: Screen state lives in the URL
The search text, page, page size and sort SHALL be reflected in the Owners screen's URL.
Opening that URL SHALL show the same page, and the browser back button SHALL return to the
previous page or sort.

#### Scenario: Refresh keeps the position
- **WHEN** the user is on page 3 sorted by city with size 20, and reloads the browser
- **THEN** the same page, sort and size are shown

#### Scenario: Shared link
- **WHEN** a user opens `/owners?lastName=Pot&page=0&size=5&sort=name,desc`
- **THEN** the search box shows `Pot`, and Harry Potter is listed before Beatrix Potter

### Requirement: New query starts at the first page
A new search or a sort change SHALL show the first page. Changing the page size SHALL show the
page that contains the first owner previously on screen.

#### Scenario: Search from a later page
- **WHEN** the user is on page 4 and searches for `Pot`
- **THEN** page 0 of the matching owners is shown

#### Scenario: Page size change keeps the first visible owner
- **WHEN** the user is on page 2 with size 5 (owners 11–15) and switches to size 10
- **THEN** page 1 is shown (owners 11–20)

### Requirement: Empty result is explained
When no owner matches, the Owners screen SHALL say that no owners have a last name starting with
the searched text, and SHALL hide the paginator.

#### Scenario: Search with no match
- **WHEN** the user searches for `Zzzz`
- **THEN** the screen says no owners have a last name starting with "Zzzz", and shows no paginator
