# Spec Delta

## Purpose

Lists the clinic's owners a page at a time, filtered by a last-name prefix and sorted by name or
city, so the list stays fast and usable as the clinic grows to ~100k owners.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
`GET /api/owners` SHALL return one page of owners, never the whole table: the owners on that page
plus `totalElements`, `totalPages`, the zero-based page `number` and the page `size`. Without
paging parameters it SHALL return the first page of 10 owners sorted by name.

#### Scenario: Default first page
- **WHEN** a client calls `GET /api/owners` on the 26 seeded owners
- **THEN** the response holds 10 owners, `totalElements` 26, `totalPages` 3, `number` 0 and `size` 10

#### Scenario: Last, partial page
- **WHEN** a client calls `GET /api/owners?page=2&size=10` on the 26 seeded owners
- **THEN** the response holds the 6 owners left after the first 20

#### Scenario: Page past the end
- **WHEN** a client asks for a page number beyond the last page
- **THEN** the response holds no owners and still reports the true `totalElements`

### Requirement: Page size is 5, 10 or 20
The page size SHALL be one of 5, 10 or 20. Any other size, including zero or a negative number,
SHALL be refused with HTTP 400 and a problem detail naming the allowed sizes.

#### Scenario: Allowed size
- **WHEN** a client calls `GET /api/owners?size=5`
- **THEN** the page holds at most 5 owners

#### Scenario: Size not allowed
- **WHEN** a client calls `GET /api/owners?size=50`
- **THEN** the response is 400 and lists 5, 10 and 20 as the allowed sizes

### Requirement: Owners sort by name or city only
Owners SHALL be sortable, ascending or descending, by name (last name, then first name) or by city
(city, then last name, then first name). Owners equal on every sort key SHALL keep a stable order by
id, so no owner appears on two pages. Sorting on any other field SHALL be refused with HTTP 400.

#### Scenario: Name sorts by last name, then first name
- **WHEN** a client lists owners sorted by name ascending
- **THEN** Beatrix Potter comes right before Harry Potter

#### Scenario: City descending
- **WHEN** a client lists owners sorted by city descending
- **THEN** the owners come in descending city order, and owners of the same city by last name, then first name

#### Scenario: Pages do not overlap
- **WHEN** a client walks every page of 5 owners sorted by city
- **THEN** every owner appears exactly once across the pages

#### Scenario: Unsortable field
- **WHEN** a client sorts by telephone, address or pets
- **THEN** the response is 400

### Requirement: The last-name filter pages and sorts too
The case-sensitive last-name prefix filter SHALL apply before paging: `totalElements` and the pages
SHALL count only the owners whose last name starts with the given prefix. An empty prefix matches
every owner.

#### Scenario: Filtered total
- **WHEN** a client calls `GET /api/owners?lastName=Potter&size=5`
- **THEN** the page holds Beatrix Potter and Harry Potter and `totalElements` is 2

#### Scenario: Nothing matches
- **WHEN** a client filters on a prefix no last name starts with
- **THEN** the response holds no owners and `totalElements` is 0

### Requirement: Each listed owner carries their pets
Every owner on a page SHALL carry their pets with each pet's type and visits, as before this change.

#### Scenario: Pets on a page
- **WHEN** Kevin McCallister is on the requested page
- **THEN** his entry lists his pets, each with its type and visits

### Requirement: The owners grid pages and sorts
The owners screen SHALL show one page at a time with a page-size choice of 5, 10 or 20 (default 10),
the total number of owners, and sort controls on the Name and City columns only.

#### Scenario: Paging through the grid
- **WHEN** a user picks 5 rows per page on the seeded owners and moves to the next page
- **THEN** the grid shows owners 6 to 10 of 26

#### Scenario: Sorting by city
- **WHEN** a user clicks the City header
- **THEN** the grid shows the first page sorted by city ascending, and a second click sorts it descending

#### Scenario: No sort on other columns
- **WHEN** a user looks at the Address, Telephone and Pets headers
- **THEN** none of them offers sorting

### Requirement: The grid's position survives navigation
The page, page size, sort and last-name filter SHALL be kept in the owners screen's URL. Coming back
to that URL SHALL restore the same page. A new last-name search SHALL return to the first page.

#### Scenario: Back from an owner's details
- **WHEN** a user on page 2 sorted by city opens an owner and goes Back
- **THEN** the grid shows page 2 sorted by city again

#### Scenario: New search resets the page
- **WHEN** a user on page 3 searches for a last name
- **THEN** the grid shows the first page of the matching owners
