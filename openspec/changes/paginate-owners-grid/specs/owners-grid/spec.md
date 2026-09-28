# Spec Delta

## Purpose

Lets clinic staff browse a large owners list one page at a time, sorted by name or city and filtered by last name, without any client ever loading every owner.

## ADDED Requirements

### Requirement: Owners list is always paginated
`GET /api/owners` SHALL return one page of owners as `{ content: Owner[], totalElements: number }`, where `totalElements` counts every owner matching the filter. Pages are addressed by `page` (0-based) and `size`. The endpoint SHALL never return all owners in one response.

#### Scenario: Default request
- **WHEN** a client calls `GET /api/owners` with no parameters
- **THEN** the response holds at most 10 owners, sorted by name ascending, and `totalElements` equals the number of owners in the clinic

#### Scenario: Page past the end
- **WHEN** a client asks for a page number beyond the last page
- **THEN** the response is 200 with an empty `content` and the real `totalElements`

### Requirement: Only 5, 10 or 20 owners per page
The `size` parameter SHALL accept only 5, 10 or 20; any other value SHALL be rejected with 400 and a problem-detail body.

#### Scenario: Allowed size
- **WHEN** a client requests `size=5`
- **THEN** at most 5 owners are returned

#### Scenario: Oversized page refused
- **WHEN** a client requests `size=1000`
- **THEN** the response is 400 and no owners are returned

### Requirement: Owners sort by name or by city
The list SHALL sort by `sort=name` or `sort=city`, with `dir=asc` or `dir=desc`; the default is `name` ascending. Name order SHALL follow the displayed name: first name, then last name. City order SHALL break ties by name. Owners with identical sort values SHALL keep the same relative order on every request, so consecutive pages neither repeat nor skip an owner. Any other `sort` or `dir` value SHALL be rejected with 400 and a problem-detail body.

#### Scenario: Name follows the displayed "First Last"
- **WHEN** owners "Kevin Smith" and "Kevin McCallister" are listed sorted by name ascending
- **THEN** "Kevin McCallister" comes before "Kevin Smith"

#### Scenario: Consecutive pages continue one order
- **WHEN** a client reads page 0 and then page 1, sorted by city, 5 per page, while many owners share one city
- **THEN** the 10 owners are in city order, and none appears on both pages

#### Scenario: Descending
- **WHEN** a client requests `sort=city&dir=desc`
- **THEN** owners are listed from the last city to the first

#### Scenario: Unsupported column refused
- **WHEN** a client requests `sort=telephone`
- **THEN** the response is 400

### Requirement: Last-name search combines with paging and sorting
The `lastName` filter SHALL keep its current meaning — owners whose last name starts with the given text, case-sensitive — and apply before paging and sorting; `totalElements` SHALL count only matching owners.

#### Scenario: Filtered and paged
- **WHEN** a client requests `lastName=Potter&size=5`
- **THEN** only owners whose last name starts with "Potter" are returned, and `totalElements` is the number of such owners

#### Scenario: Case-sensitive prefix
- **WHEN** a client requests `lastName=potter`
- **THEN** no owner named "Potter" is returned

### Requirement: Owners screen pages and sorts
The Owners screen SHALL show a paginator offering 5, 10 and 20 rows per page (10 by default) and the total number of matching owners. The Name and City column headers SHALL be clickable to sort, toggling between ascending and descending with no unsorted state; the other columns SHALL not be sortable. Each row SHALL still show the owner's pets.

#### Scenario: First visit
- **WHEN** a user opens the Owners screen
- **THEN** 10 owners are shown, sorted by name ascending, with the total count visible

#### Scenario: Sort by City, 5 per page, next page
- **WHEN** the user sorts by City, picks 5 rows per page, then moves to the next page
- **THEN** page 2 shows 5 more owners whose cities continue page 1's order

### Requirement: Changing the question returns to page 1
The Owners screen SHALL return to the first page whenever the last-name search, the sort or the page size changes.

#### Scenario: New search from a later page
- **WHEN** the user is on page 3 and searches a new last name
- **THEN** the first page of matching owners is shown

### Requirement: Grid state lives in the address bar
The Owners screen SHALL reflect the page, page size, sort, direction and last-name search in its URL, and SHALL restore them from the URL when opened.

#### Scenario: Shared link
- **WHEN** a user opens a link to the Owners screen carrying page 2, 5 rows, sorted by city descending
- **THEN** the screen shows exactly that page with those settings

#### Scenario: Back button
- **WHEN** the user moves from page 1 to page 2 and presses Back
- **THEN** page 1 is shown again
