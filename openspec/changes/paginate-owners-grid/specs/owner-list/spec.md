# Spec Delta

## Purpose

Lets clinic staff browse owners one page at a time, in a chosen order, at a volume where loading
every owner at once is not an option.

## ADDED Requirements

### Requirement: The owner list is always paged
The system SHALL answer `GET /api/owners` with exactly one page of owners, and SHALL NOT offer any way to retrieve all owners in one response. A page SHALL state its `content`, `totalElements`, `totalPages`, zero-based `number` and `size`.

#### Scenario: No parameters
- **WHEN** a client calls `GET /api/owners` and 28 owners exist
- **THEN** the response holds the first 10 owners sorted by name ascending
- **AND** it states `totalElements` 28, `totalPages` 3, `number` 0 and `size` 10

#### Scenario: A later page
- **WHEN** a client requests `page=2&size=10` and 28 owners exist
- **THEN** the response holds the last 8 owners and `number` 2

### Requirement: Page sizes are limited to 5, 10 and 20
The system SHALL accept only 5, 10 and 20 as page size, and SHALL refuse any other size, or a negative page, with a 400 problem response.

#### Scenario: Allowed size
- **WHEN** a client requests `size=20`
- **THEN** the response holds at most 20 owners

#### Scenario: Refused size
- **WHEN** a client requests `size=1000`
- **THEN** the system answers 400 and returns no owners

#### Scenario: Negative page
- **WHEN** a client requests `page=-1`
- **THEN** the system answers 400

### Requirement: A page carries only what the grid displays
The system SHALL answer each owner in a page with name, address, city, telephone and id, plus each pet's name and type, and SHALL NOT include visits or any other pet detail.

#### Scenario: An owner with a visited pet
- **WHEN** a client lists owners and an owner's pet has visits
- **THEN** the row holds the pet's name and type, with no visits, birth date or pet id

### Requirement: A page past the end is empty
The system SHALL answer a page beyond the last one with empty `content` and correct totals.

#### Scenario: Requesting beyond the last page
- **WHEN** a client requests `page=50` and 28 owners exist
- **THEN** the response has empty `content`, `totalElements` 28 and `totalPages` 3

### Requirement: Owners sort by name or city only
The system SHALL sort owners by `name` or `city`, ascending or descending, through `sort=<key>,<direction>`, and SHALL refuse any other key or direction with a 400 problem response.

#### Scenario: Sort by city descending
- **WHEN** a client requests `sort=city,desc`
- **THEN** owners are returned from the last city to the first

#### Scenario: Unsortable column
- **WHEN** a client requests `sort=telephone,asc`
- **THEN** the system answers 400

### Requirement: Name order follows what the grid displays
The system SHALL order by first name, then last name, matching the displayed `First Last`.

#### Scenario: Same first name
- **WHEN** owners `Ada Lovelace` and `Ada Byron` are sorted by name ascending
- **THEN** `Ada Byron` comes first

### Requirement: Sorting is alphabetical across languages
The system SHALL sort names and cities alphabetically, so letters with diacritics sit next to their base letter rather than after Z.

#### Scenario: Diacritics in a first name
- **WHEN** owners `Ștefan Mureșan`, `Tom Riddle` and `Sam Carraclough` are sorted by name ascending
- **THEN** the order is `Sam Carraclough`, `Ștefan Mureșan`, `Tom Riddle`

### Requirement: Page order is stable
The system SHALL give every owner one fixed position for a given sort, so that owners with equal sort values neither repeat nor disappear across pages. City ties SHALL be broken by name.

#### Scenario: Owners with identical names
- **WHEN** 12 owners share the same name and a client walks every page with `size=5`
- **THEN** each owner appears exactly once

#### Scenario: Owners in the same city
- **WHEN** several owners live in London and a client sorts by city ascending
- **THEN** the London owners appear ordered by name

### Requirement: The grid pages and sorts on the server
The Owners grid SHALL offer page sizes 5, 10 and 20 and show the total number of owners. Name and City headers SHALL be sortable; Address, Telephone and Pets headers SHALL NOT be.

#### Scenario: Changing page
- **WHEN** a user moves to the next page
- **THEN** the grid shows the next owners, requested from the server

#### Scenario: Clicking a sortable header
- **WHEN** a user clicks the City header
- **THEN** the grid shows the first page sorted by city

#### Scenario: Unsortable headers
- **WHEN** a user clicks the Telephone header
- **THEN** the order of the grid does not change

### Requirement: The grid returns to its first page when the result set changes
The grid SHALL return to the first page when the search, the sort or the page size changes.

#### Scenario: Changing page size
- **WHEN** a user on page 3 selects a page size of 20
- **THEN** the grid shows the first page with up to 20 owners

### Requirement: The grid's position survives navigation
The grid SHALL keep page, size, sort and search in the URL, so that a refresh, the Back button and a shared link show the same owners.

#### Scenario: Back from an owner
- **WHEN** a user on page 2 sorted by city opens an owner and presses Back
- **THEN** the grid shows page 2 sorted by city

#### Scenario: Opening a link
- **WHEN** a user opens `/owners?page=1&size=5&sort=city,desc`
- **THEN** the grid shows that page in that order

### Requirement: The grid recovers from a page that no longer exists
The grid SHALL move to the last existing page when the page it requested is empty but owners exist.

#### Scenario: The last page was emptied
- **WHEN** a user opens page 9 and only 3 pages exist
- **THEN** the grid shows page 3
