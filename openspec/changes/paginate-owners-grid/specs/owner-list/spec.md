# Spec Delta

## Purpose

Lets clinic staff browse the clinic's owners a page at a time — sorted by name or city and
filtered by last name — without the screen or the server ever handling every owner at once.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
`GET /api/owners` SHALL return a single page of owners together with the total number of
matching owners, the total number of pages, the zero-based page number and the page size.
No request SHALL return every owner unpaged.

#### Scenario: First page with the defaults
- **GIVEN** the seed dataset: 27 owners, including Ana Șerban of Brașov added by this change
- **WHEN** a client calls `GET /api/owners` with no parameters
- **THEN** the response holds the first 10 owners by name, Baskerville Henry to Hagrid Rubeus
- **AND** it reports 27 owners in total, 3 pages, page number 0 and page size 10

#### Scenario: Last, partial page
- **WHEN** a client asks for page 2 with size 10
- **THEN** the response holds 7 owners, Scamander Newt to Wensleydale Wallace

#### Scenario: A page past the end
- **WHEN** a client asks for page 5 with size 10
- **THEN** the response holds no owners and still reports 27 owners in total and 3 pages

### Requirement: Listed owners carry only what the grid shows
Each owner in a page SHALL carry its id, first and last name, address, city, telephone, and
its pets as id and name only. A listed owner SHALL NOT carry visits; the owner's own page
still shows them.

#### Scenario: No visits in the list
- **WHEN** a client lists owners and Kevin McCallister is on the page
- **THEN** his entry lists his pet Axel by id and name, with no visits

#### Scenario: The owner's page is unchanged
- **WHEN** a client calls `GET /api/owners/1`
- **THEN** Kevin McCallister's pet Axel still carries its visits

### Requirement: Page size is 5, 10 or 20 in the grid
The grid SHALL offer page sizes of 5, 10 and 20 rows, defaulting to 10. The API SHALL accept
any size from 1 to 100.

#### Scenario: Choosing a page size
- **WHEN** a user picks 20 rows per page
- **THEN** the grid shows owners 1–20 by name and offers 2 pages

#### Scenario: Size within the API's range
- **WHEN** a client asks for size 100
- **THEN** the response holds all 27 owners on page 0

### Requirement: Invalid paging is refused, never adjusted
The API SHALL answer 400, naming the offending parameter, when the page is negative or the
size is outside 1–100. It SHALL NOT clamp a value to the nearest valid one.

#### Scenario: Size too large
- **WHEN** a client asks for size 101
- **THEN** the response is 400 and names `size`

#### Scenario: Size zero
- **WHEN** a client asks for size 0
- **THEN** the response is 400 and names `size`

#### Scenario: Negative page
- **WHEN** a client asks for page -1
- **THEN** the response is 400 and names `page`

### Requirement: Owners sort by name or by city only
Owners SHALL be sortable by name or by city, ascending or descending, and by nothing else.
An unknown sort key or direction SHALL be answered with 400 listing the allowed keys. The
default order SHALL be name ascending.

#### Scenario: Unknown sort key
- **WHEN** a client asks to sort by `telephone`
- **THEN** the response is 400 and lists `name` and `city` as the allowed keys

#### Scenario: Only Name and City headers are sortable
- **WHEN** a user opens the Owners grid
- **THEN** the Name and City headers can be clicked to sort
- **AND** the Address, Telephone and Pets headers cannot

### Requirement: Name sorts by last name, then first name
Sorting by name SHALL order owners by last name, then first name. Descending SHALL be the
exact reverse of ascending. The grid SHALL display each name as "Last, First".

#### Scenario: Same last name
- **WHEN** a client lists owners by name ascending with size 20
- **THEN** Potter Beatrix is row 15 and Potter Harry is row 16

#### Scenario: Name descending
- **WHEN** a client lists owners by name descending
- **THEN** the page starts Wensleydale Wallace, Tremaine Lady, Șerban Ana, Śliwiński Łukasz

#### Scenario: Name cell
- **WHEN** Kevin McCallister appears in the grid
- **THEN** his Name cell reads "McCallister, Kevin"

### Requirement: City sorts by city, then by name
Sorting by city SHALL order owners by city, then by last name, then first name. Descending
SHALL reverse the cities only; owners within the same city SHALL stay in name order.

#### Scenario: City ascending
- **WHEN** a client lists owners by city ascending
- **THEN** the page starts with Brașov (Șerban Ana), then Bristol (Silver Long), then Brussels
  (Reporter Tintin)

#### Scenario: Owners within one city
- **WHEN** a client lists owners by city ascending with size 20
- **THEN** the five London owners appear in the order Darling George, Darling Wendy,
  Holmes Sherlock, Radcliff Roger, Scamander Newt

#### Scenario: City descending keeps names ascending
- **WHEN** a client lists owners by city descending
- **THEN** the page starts Yorkshire, Winnetka, Wiltshire, Wigan, then Vienna with Mureșan Ștefan
  before Schroedinger Erwin

### Requirement: Names and cities sort by Romanian rules
Names and cities SHALL sort by Romanian collation rules in every environment: Ș after S,
Ț after T, Ă and Â after A, Î after I; other accented letters sort with their base letter.

#### Scenario: Ș comes after every S
- **WHEN** a client lists owners by name ascending
- **THEN** Șerban Ana comes after Silver Long and Śliwiński Łukasz, and before Tremaine Lady

#### Scenario: Accented initials do not sink to the end
- **WHEN** a client lists owners by name ascending
- **THEN** Śliwiński Łukasz comes right after Silver Long, not after Wensleydale Wallace

### Requirement: Search by last name combines with paging
The last-name filter SHALL keep today's meaning — a case-sensitive prefix of the last name —
and the totals SHALL count only matching owners.

#### Scenario: Prefix match, paged
- **WHEN** a client lists owners with `lastName=Pot`
- **THEN** the page holds Potter Beatrix and Potter Harry, with 2 owners and 1 page in total

#### Scenario: Case-sensitive
- **WHEN** a client lists owners with `lastName=pot`
- **THEN** the page is empty and reports 0 owners

### Requirement: The grid searches as the user types
The grid SHALL search by last name once the user stops typing for 300 ms, with no button to
press. The search box SHALL span the grid's width and say "Last name" inside it while empty.

#### Scenario: Typing a prefix
- **WHEN** a user types "Pot" into the search box and pauses
- **THEN** the grid shows Potter Beatrix and Potter Harry, without a Find Owner button

#### Scenario: One search per pause
- **WHEN** a user types "P", then "Pot" within 300 ms
- **THEN** the grid searches once, for "Pot"

### Requirement: Changing what is listed returns to page 1
In the grid, a new search, a new page size or a new sort SHALL show the first page.

#### Scenario: Search from a later page
- **WHEN** a user on page 3 searches for "Pot"
- **THEN** the grid shows page 1 of the matches

#### Scenario: New sort from a later page
- **WHEN** a user on page 2 sorts by City
- **THEN** the grid shows page 1 sorted by city

### Requirement: The grid keeps its place
The grid's page, page size, sort and search SHALL be part of the page address, leaving out
any value that equals its default. Refreshing, the browser's Back button, or the owner page's
Back button SHALL return to the same view.

#### Scenario: Back from an owner
- **WHEN** a user on page 2, sorted by City descending, opens an owner and presses Back
- **THEN** the grid shows page 2 sorted by City descending again

#### Scenario: Refresh
- **WHEN** a user on page 3 with 5 rows per page refreshes the browser
- **THEN** the grid shows page 3 with 5 rows per page

#### Scenario: Defaults stay out of the address
- **WHEN** a user opens the Owners grid without changing anything
- **THEN** the address is `/owners`, with no query parameters

### Requirement: "No owners found" means no match
The grid SHALL say that no owners were found only when a request succeeded and matched no
owner. A failed request SHALL show an error instead.

#### Scenario: No match
- **WHEN** a user searches for "Zzzz"
- **THEN** the grid says no owners were found

#### Scenario: Server failure
- **WHEN** the owner list request fails
- **THEN** the grid shows an error, not "no owners found"
