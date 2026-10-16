# Spec Delta

## Purpose

Lets clinic staff browse the owners of the clinic one page at a time, sorted and filtered, at a
size (~10,000 owners) where the full list can no longer be loaded at once.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
The owners list SHALL return one page of owners together with the total number of owners matching
the filter. A request names a 0-based page and a page size of 5, 10 or 20; without them it gets
page 0 with 10 owners.

#### Scenario: First page by default
- **WHEN** a client lists owners without paging parameters
- **THEN** it receives at most 10 owners, the first ones in the default order
- **AND** the total number of matching owners

#### Scenario: A chosen page and size
- **WHEN** a client asks for page 1 with size 5 out of 26 owners
- **THEN** it receives owners 6 to 10 of the sorted list and a total of 26

#### Scenario: A page past the end
- **WHEN** a client asks for a page beyond the last one
- **THEN** the request succeeds with no owners and the real total

### Requirement: Page sizes outside 5, 10 and 20 are rejected
The owners list SHALL refuse any page size other than 5, 10 or 20, and any negative page, with a
400 problem response naming the offending parameter, so that no request can return an unbounded
list.

#### Scenario: An oversized page
- **WHEN** a client asks for size 10000
- **THEN** it receives 400 and no owners

### Requirement: Owners are sortable by name or city
The owners list SHALL sort by `name` or `city`, ascending or descending, given as
`sort=<key>,<direction>`. Without a sort it SHALL order by name, ascending. Name means first name,
then last name. Any other key or direction SHALL be rejected with 400.

#### Scenario: Default order
- **WHEN** a client lists owners without a sort
- **THEN** owners come ordered by first name, then last name, ascending

#### Scenario: By city, descending
- **WHEN** a client sorts by `city,desc`
- **THEN** owners come in descending order of city

#### Scenario: Unsortable column
- **WHEN** a client sorts by `telephone`
- **THEN** it receives 400

### Requirement: Paging never repeats or skips an owner
For every sort, owners that tie on the sorted value SHALL keep one fixed order, so that walking
through all pages returns every matching owner exactly once.

#### Scenario: Ties across a page boundary
- **WHEN** a client walks every page of size 5 sorted by city, where 5 owners live in London
- **THEN** every owner appears exactly once across the pages

### Requirement: Paging applies within the last-name filter
When the list is filtered by last-name prefix, paging, sorting and the total SHALL apply to the
matching owners only.

#### Scenario: Filtered total
- **WHEN** a client lists owners whose last name starts with `Potter` with size 5
- **THEN** the total is the number of Potters, not of all owners

### Requirement: The Owners grid pages and sorts
The Owners grid SHALL let the user choose 5, 10 or 20 rows per page, move between pages, and sort
by clicking the Name or City header, which toggles ascending and descending and shows an arrow on
the active column. Address, Telephone and Pets headers SHALL NOT be sortable.

#### Scenario: Changing the page size
- **WHEN** the user picks 5 rows per page
- **THEN** the grid shows 5 owners and the paginator reports the total

#### Scenario: Sorting by city
- **WHEN** the user clicks the City header twice
- **THEN** the grid shows owners in descending order of city, with a descending arrow on City

### Requirement: The Owners grid remembers where the user is
The grid SHALL keep page, size, sort and last-name filter in the page address, so that refreshing,
going back, or returning from an owner's page shows the same rows. A new search SHALL return to the
first page and keep the sort.

#### Scenario: Back from an owner
- **WHEN** the user on page 3 sorted by city opens an owner and goes back
- **THEN** the grid is on page 3, still sorted by city

#### Scenario: A new search
- **WHEN** the user on page 3 searches for a last name
- **THEN** the grid shows the first page of matches in the same sort

### Requirement: An empty result still lets the user add an owner
When no owner matches, the grid SHALL say that no owner matched and SHALL still offer "Add Owner".

#### Scenario: No match
- **WHEN** the user searches for a last name nobody has
- **THEN** the grid shows the no-match message and the Add Owner button
