# Spec Delta

## Purpose

Lets clinic staff browse, filter, sort and page through the list of owners without the
clinic ever loading every owner at once, so the screen stays fast at 100,000 owners.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
The owners list SHALL return a single page of owners together with the total number of
matching owners, the total number of pages, the current page number (zero-based) and the
page size. The page size SHALL be exactly 5, 10 or 20, defaulting to 10. The page number
SHALL default to 0.

#### Scenario: Default page
- **WHEN** the owners list is requested with no paging parameters
- **THEN** at most 10 owners are returned, from page 0, sorted by Name ascending
- **AND** the response states the total number of owners and the total number of pages

#### Scenario: Each allowed page size
- **WHEN** the owners list is requested with a page size of 5, 10 or 20
- **THEN** at most that many owners are returned

#### Scenario: Paging visits every owner exactly once
- **GIVEN** more owners than fit on one page, some sharing the same last and first name
- **WHEN** every page is requested in turn with the same filter and sort
- **THEN** every matching owner appears on exactly one page

### Requirement: Invalid list parameters are rejected
The owners list SHALL reject a negative page number, a page size other than 5, 10 or 20,
an unknown sort key or an unknown sort direction with a 400 Bad Request problem response,
without querying owners. It SHALL NOT clamp or silently replace an invalid value.

#### Scenario: Page size outside the allowed set
- **WHEN** the owners list is requested with a page size of 7
- **THEN** the response is 400 Bad Request

#### Scenario: Unknown sort key
- **WHEN** the owners list is requested sorted by "telephone"
- **THEN** the response is 400 Bad Request

#### Scenario: Negative page
- **WHEN** the owners list is requested for page -1
- **THEN** the response is 400 Bad Request

### Requirement: Owners can be sorted by Name or City
The owners list SHALL sort by Name (last name, then first name) or by City (city, then last
name, then first name), ascending or descending, defaulting to Name ascending. Owners that tie
on every visible sort key SHALL keep one fixed relative order across all pages. Address,
Telephone and Pets SHALL NOT be sortable.

#### Scenario: Sort by City descending
- **WHEN** the owners list is requested sorted by City descending
- **THEN** owners are returned in descending city order, ties broken by last name then first name, also descending

#### Scenario: Ties across a page boundary
- **GIVEN** two owners with the same last and first name land either side of a page boundary
- **WHEN** both pages are requested
- **THEN** each of the two owners appears exactly once

### Requirement: Last-name filter composes with paging and sorting
The owners list SHALL keep filtering by a case-sensitive prefix of the last name (empty
meaning all owners), and SHALL page and sort only the owners that match the filter.

#### Scenario: Filter then page
- **WHEN** the owners list is requested with last name "Pot", page size 5
- **THEN** only owners whose last name starts with "Pot" are counted and returned

### Requirement: Each listed owner carries only what the grid shows
Each owner in a page SHALL carry its id, first name, last name, address, city, telephone and
the names of its pets — and SHALL NOT carry pet types, birth dates or visits. The single-owner
view SHALL keep returning the full owner with pets and visits.

#### Scenario: Slim row
- **WHEN** a page of owners is returned
- **THEN** each owner lists its pet names and nothing about visits

### Requirement: The grid state lives in the page address
The Owners screen SHALL keep the last-name filter, page, page size, sort key and direction in
the browser address, omitting values equal to their defaults. Opening, refreshing, or going
Back/Forward to such an address SHALL show the same list.

#### Scenario: Shared link
- **WHEN** a user opens the Owners screen at an address naming page 2, size 5, sort by City descending
- **THEN** the grid shows that page, with that size and that sort

#### Scenario: Back button
- **WHEN** a user moves from page 1 to page 2 and presses the browser Back button
- **THEN** the grid shows page 1 again

### Requirement: Changing what is listed goes back to the first page
The Owners screen SHALL return to the first page when the filter, the sort key, the sort
direction or the page size changes. Clicking the header of the active sort column SHALL
toggle between ascending and descending; the grid SHALL never be unsorted.

#### Scenario: New search resets the page
- **GIVEN** the user is on page 3
- **WHEN** the user searches for another last name
- **THEN** the grid shows page 1 of the new results

### Requirement: A page past the end is corrected
When the Owners screen asks for a page past the last one, it SHALL move once to the last
page that has owners, or to the first page when nothing matches.

#### Scenario: Stale link past the end
- **WHEN** a user opens the Owners screen at page 50 and only 3 pages exist
- **THEN** the grid shows page 3

### Requirement: Loading, error and empty states are distinct
The Owners screen SHALL show only the answer to the latest request, keep the table's size
while a page loads, disable previous/next where they cannot move, show an error message when
loading fails, and show a "no owners match" message only when the list really is empty.

#### Scenario: A slow earlier answer arrives last
- **WHEN** the user searches twice and the first answer arrives after the second
- **THEN** the grid shows the results of the second search

#### Scenario: Loading fails
- **WHEN** the owners list cannot be loaded
- **THEN** the screen shows an error message, not "no owners match"

### Requirement: Names in the grid read last-name first
The Owners grid SHALL render each owner as "LastName, FirstName", matching the Name sort.
The single-owner screen SHALL keep "FirstName LastName".

#### Scenario: Grid name format
- **WHEN** Harry Potter is listed in the grid
- **THEN** the Name cell reads "Potter, Harry"

## Gherkin sketch

Extends `petclinic-test/src/owner-search.feature`, reusing its existing steps
(`the clinic has these owners`, `I open the owners page`, `I search owners for`,
`exactly these owners are listed`); new steps are marked `# new`.

```gherkin
Scenario: Page through the owners
  When I open the owners page
  And I choose 5 owners per page                           # new
  Then 5 owners are listed                                 # new
  When I go to the next page                               # new
  Then page 2 is shown                                     # new

Scenario: Sort by city descending
  When I open the owners page
  And I sort owners by "City" descending                   # new
  Then the owners are listed in descending city order      # new

Scenario: Searching resets to the first page
  When I open the owners page
  And I go to the next page                                # new
  And I search owners for "Pot"
  Then exactly these owners are listed: "Potter, Beatrix; Potter, Harry"
```

The "Last, First" display puts a comma inside each name, so `exactly these owners are listed`
switches its list separator from `,` to `;`, and the existing Examples table is rewritten
to match.
