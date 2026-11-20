# Spec Delta

## Purpose

The Owners screen in the browser lets clinic staff find an owner among ~100,000 by filtering,
sorting and paging through a grid whose state is kept in the URL.

## ADDED Requirements

### Requirement: Grid shows one page with a paginator
The Owners grid SHALL show one page of owners, plus a paginator that offers page sizes 5, 10 and 20
(default 10). The paginator SHALL show the range of owners on screen and the total count, and let the
user move to the next, previous, first or last page.

#### Scenario: First visit
- **WHEN** a user opens `/owners` with no query parameters
- **THEN** the grid shows the first 10 owners sorted by name A→Z, and the paginator shows the total
  number of owners

#### Scenario: Next page
- **WHEN** the user clicks the paginator's "next page"
- **THEN** the grid shows the following owners and the URL holds `page=1`

### Requirement: Only Name and City headers sort
Clicking the Name or City column header SHALL toggle that column's sort between ascending and
descending. The Address, Telephone and Pets headers SHALL not be sortable.

#### Scenario: Sort by city
- **WHEN** the user clicks the City header
- **THEN** the grid is sorted by city A→Z and the URL holds `sort=city,asc`

#### Scenario: Plain header
- **WHEN** the user clicks the Telephone header
- **THEN** the order of the grid does not change

### Requirement: Search and sort changes reset to the first page
A new last-name search or a change of sort SHALL show the first page of the new result.

#### Scenario: Search from page 3
- **WHEN** the user is on page 3 and searches for last name "Pot"
- **THEN** the grid shows the first page of the owners whose last name starts with "Pot"

#### Scenario: Sort from page 3
- **WHEN** the user is on page 3 and clicks the City header
- **THEN** the grid shows the first page sorted by city

### Requirement: Changing page size keeps the first visible owner on screen
When the page size changes, the grid SHALL show the page that contains the owner who was first on
screen before the change.

#### Scenario: From 5 to 20
- **WHEN** the user is on page index 5 with size 5 (owners 26–30) and switches the size to 20
- **THEN** the grid shows page index 1 with size 20 (owners 21–40), which contains owner 26

### Requirement: Grid state lives in the URL
The grid's `lastName`, `page`, `size` and `sort` SHALL be reflected in the URL query string, and
opening such a URL SHALL restore that exact grid. The browser's Back button SHALL return to the
previous grid state.

#### Scenario: Shared link
- **WHEN** a user opens `/owners?lastName=Pot&page=0&size=5&sort=city,desc`
- **THEN** the search box shows "Pot", the grid shows the matching owners sorted by city Z→A with
  page size 5

#### Scenario: Back button
- **WHEN** the user moves from page 1 to page 2 and presses Back
- **THEN** the grid shows page 1 again

#### Scenario: Refresh
- **WHEN** the user refreshes the browser on page 2 sorted by city
- **THEN** the same page and sort are shown

### Requirement: Empty result shows a message
When no owner matches, the grid SHALL hide the table and the paginator and show
`No owners with last name starting with "<lastName>"`.

#### Scenario: No match
- **WHEN** the user searches for "Zzzz"
- **THEN** the message `No owners with last name starting with "Zzzz"` is shown and no paginator
  is visible

### Requirement: A failed load does not show the empty-result message
When loading owners fails, the grid SHALL not claim that no owners match.

#### Scenario: Backend down
- **WHEN** the owners request fails
- **THEN** the "No owners with last name…" message is not shown
