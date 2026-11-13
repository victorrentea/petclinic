# Spec Delta

## Purpose

Lets clinic staff browse a clinic's owners one page at a time, ordered by name or city and
narrowed by last name, at volumes of tens of thousands of owners.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
The owner list SHALL return one page of owners together with the total number of matching
owners and the total number of pages. It SHALL never return every owner in one response.

#### Scenario: First page by default
- **GIVEN** 27 owners exist
- **WHEN** the owner list is requested with no paging parameters
- **THEN** it returns the first 10 owners in name order
- **AND** it reports 27 matching owners on 3 pages

#### Scenario: A later page
- **GIVEN** 27 owners exist
- **WHEN** page 3 of size 10 is requested
- **THEN** it returns the last 7 owners in name order

### Requirement: Page size is 5, 10 or 20
The owner list SHALL accept a page size of 5, 10 or 20 and default to 10. Any other size
SHALL be rejected as a bad request, so no client can load the whole list in one call.

#### Scenario: An allowed page size
- **WHEN** the owner list is requested with size 20
- **THEN** each page holds at most 20 owners

#### Scenario: A page size that is not offered
- **WHEN** the owner list is requested with size 50000
- **THEN** the request is rejected as a bad request

### Requirement: Owners sort by name or by city
The owner list SHALL sort by name (last name, then first name) or by city, each ascending or
descending, defaulting to name ascending. Address, telephone and pets SHALL NOT be sort
keys; any other sort key SHALL be rejected as a bad request.

#### Scenario: Sorting by name
- **GIVEN** owners Wendy Darling and George Darling
- **WHEN** the owner list is sorted by name ascending
- **THEN** George Darling comes before Wendy Darling

#### Scenario: Sorting by city, reversed
- **WHEN** the owner list is sorted by city descending
- **THEN** owners from Wigan come before owners from Vienna

#### Scenario: An unsupported sort key
- **WHEN** the owner list is sorted by telephone
- **THEN** the request is rejected as a bad request

### Requirement: Accented names sort where a reader expects them
Sorting by name or by city SHALL follow linguistic order, not byte order: a letter with a
diacritic sorts next to its base letter.

#### Scenario: A Polish surname among English ones
- **GIVEN** owners named Silver, Śliwiński, Tremaine and Wensleydale
- **WHEN** the owner list is sorted by name ascending
- **THEN** the order is Silver, Śliwiński, Tremaine, Wensleydale

### Requirement: Paging is stable across equal rows
Owners that are equal on the sort key SHALL keep one fixed order between requests, so that
no owner appears on two pages or on none.

#### Scenario: Identical owners spread over several pages
- **GIVEN** 15 owners with the same first name, last name and city
- **WHEN** pages 1, 2 and 3 of size 5 are requested by name
- **THEN** together they hold each of the 15 owners exactly once

### Requirement: Paging combines with the last-name search
Paging and sorting SHALL apply to the owners whose last name starts with the searched text.
The search stays a case-sensitive prefix match, as before.

#### Scenario: Searching, then paging
- **GIVEN** 2 owners whose last name starts with "Pot"
- **WHEN** the owner list is searched for "Pot" with size 5
- **THEN** it returns those 2 owners on 1 page

### Requirement: The grid offers paging and sorting
The owners grid SHALL show a paginator offering 5, 10 and 20 rows per page, and SHALL let
the user sort by clicking the Name and City headers. The Address, Telephone and Pets
headers SHALL NOT be clickable.

#### Scenario: Reversing a sort from the header
- **WHEN** the user clicks the City header twice
- **THEN** the grid is sorted by city descending

#### Scenario: Changing rows per page
- **WHEN** the user chooses 20 rows per page
- **THEN** the grid shows up to 20 owners and starts again at page 1

### Requirement: The grid's state is in its address
The owners grid SHALL keep the searched text, page, page size and sort in its URL, with
pages counted from 1. Opening that URL SHALL show the same grid state.

#### Scenario: Back from an owner's details
- **GIVEN** the user is on page 3 of the grid sorted by city
- **WHEN** they open an owner and go back
- **THEN** the grid shows page 3 sorted by city

#### Scenario: A shared link
- **WHEN** a user opens `/owners?page=2&size=5&sort=city,asc`
- **THEN** the grid shows owners 6 to 10 by city

### Requirement: The grid returns to page 1 when the result set changes
A new search, a new sort or a new page size SHALL show page 1.

#### Scenario: Searching from a later page
- **GIVEN** the user is on page 3
- **WHEN** they search for "Pot"
- **THEN** the grid shows page 1 of the matching owners

### Requirement: A page past the end shows the last page
When the requested page lies past the last page (a stale link, or owners deleted
meanwhile), the grid SHALL show the last page and correct its URL. With no matching owners,
it SHALL show the "no owners" message and no paginator.

#### Scenario: A link past the end
- **GIVEN** 27 owners exist
- **WHEN** a user opens `/owners?page=99&size=10`
- **THEN** the grid shows page 3 and the URL says page 3

#### Scenario: No matching owners
- **WHEN** the user searches for "Zzzz"
- **THEN** the grid shows the "no owners" message and no paginator
