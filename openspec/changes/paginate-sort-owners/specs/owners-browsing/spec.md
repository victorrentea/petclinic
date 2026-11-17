# Spec Delta

## Purpose

Let clinic staff browse large owner registers through bounded pages, globally sorted
and filtered results, and shareable navigation state without losing their working context.

## ADDED Requirements

### Requirement: Paginated owners API

`GET /api/owners` SHALL return `{content, totalElements, totalPages, number, size}`.
It SHALL accept zero-based `page`, `size` in 5/10/20, optional `lastName`,
and `sort=<field>,<asc|desc>`. Defaults SHALL be page 0, size 10, empty filter,
and `lastName,asc`. Each content item SHALL retain the existing owner DTO shape,
including pets. Totals SHALL describe the complete filtered result.

#### Scenario: Default request
- **WHEN** an authorized client requests `/api/owners` with 23 owners registered
- **THEN** the response is an object containing 10 owners, totalElements 23,
  totalPages 3, number 0, and size 10
- **AND** the response is not the former top-level array

#### Scenario: Partial last page and empty result
- **WHEN** a client requests page 2 with size 10 from 23 matching owners
- **THEN** content contains 3 owners and totalElements remains 23
- **WHEN** no owners match
- **THEN** content is empty, totalElements and totalPages are 0

### Requirement: Global deterministic sorting

The API and grid SHALL support sorting by Name (`lastName`), Address (`address`),
City (`city`), and Telephone (`telephone`) in either direction before pagination.
Names, addresses, and cities SHALL use Romanian alphabetical order ignoring case;
diacritics SHALL retain their Romanian alphabet positions. Telephone SHALL sort as text.
Name SHALL order by last name then first name in the selected direction.
ID ascending SHALL break remaining ties. Null values SHALL sort last.
Pets SHALL not be sortable.

#### Scenario: Name sorting spans page boundaries
- **WHEN** owners with mixed-case and duplicate last names span multiple pages
  and Name descending is selected
- **THEN** all matches are ordered by case-insensitive last name descending,
  then case-insensitive first name descending, then ID ascending before pages are selected

#### Scenario: Other columns and telephone
- **WHEN** Address, City, or Telephone is selected for sorting
- **THEN** the selected field determines global order, with ID ascending for ties
- **AND** telephone prefixes and leading zeroes are retained and compared as text

#### Scenario: Romanian letters across page boundaries
- **WHEN** a sortable name, address, or city includes the letters
  `a`, `ă`, `â`, `b`, `i`, `î`, `j`, `s`, `ș`, `t`, `ț`, `z`
- **THEN** ascending sorting follows that Romanian alphabet sequence before pagination
- **AND** descending sorting reverses that sequence, with the same rules for both parts of Name
- **AND** case-only differences are resolved by the remaining name key, then ID,
  rather than an uppercase/lowercase preference

#### Scenario: Unsortable pets
- **WHEN** the grid is rendered
- **THEN** Pets has no sorting control
- **AND** requesting API sort field `pets` returns HTTP 400

### Requirement: Explicit prefix search

The grid SHALL submit last-name prefix search through Find Owner or Enter.
Search SHALL retain the existing case-sensitive prefix semantics, with literal
wildcard characters treated as text. Applying or clearing a filter SHALL select
page 0 and preserve sort and page size. Editing an unsubmitted search SHALL NOT
change the currently applied results.

#### Scenario: Applying and clearing a filter
- **WHEN** a user on page 3 with size 20 and City descending submits prefix `Dav`
- **THEN** the result contains only last names starting with `Dav`, on page 0,
  with size 20 and City descending retained
- **WHEN** the user submits an empty filter
- **THEN** all owners are eligible again, on page 0 with the same size and sort

#### Scenario: Unsubmitted text
- **WHEN** the user edits the search field without submitting and changes page
- **THEN** the request still uses the previously applied filter

### Requirement: Names and sorting interaction

The grid SHALL display owner names as "Last name, First name" linked to existing
owner details. A newly selected sort column SHALL start ascending; repeated activation
SHALL toggle ascending/descending without an unsorted state.
Changing sort or page size SHALL reset the page to 0 and preserve the applied filter.
The active sort direction SHALL be visible and keyboard/screen-reader accessible.

#### Scenario: Name display and toggling
- **WHEN** George Franklin appears in the grid
- **THEN** the link text is `Franklin, George` and still opens his owner details
- **WHEN** a user activates the City header twice starting from Name sort
- **THEN** the first result is City ascending and the second is City descending,
  both on page 0

### Requirement: Paging controls and result range

The grid SHALL offer first, previous, next, and last navigation, page sizes 5/10/20,
and the displayed row range with filtered total. Boundary controls SHALL be disabled
when no move is possible. Add Owner SHALL remain available, including on empty
results and request errors.

#### Scenario: Controls at boundaries
- **WHEN** page 1 of size 10 is displayed for 23 matches
- **THEN** the range is 11-20 of 23
- **WHEN** the last page is displayed
- **THEN** the range is 21-23 of 23 and next/last are disabled
- **WHEN** no results exist
- **THEN** the range is 0-0 of 0 and all page navigation is disabled

### Requirement: Restorable browsing URLs

The grid SHALL encode applied page, size, sort, and lastName in URL query parameters,
using the same values as the API. Refresh and browser Back/Forward SHALL restore
that state. Normal user state changes SHALL create navigable history entries;
normalization SHALL replace the current entry.
Invalid URL parameters SHALL be replaced with valid defaults without an API error loop.

#### Scenario: Restoring a shared list
- **WHEN** `/owners?page=2&size=5&sort=city,desc&lastName=Dav` is opened or refreshed
- **THEN** the grid requests and displays that exact applied state
- **WHEN** the user opens owner details and returns with browser Back
- **THEN** that list state is restored

#### Scenario: Malformed URL
- **WHEN** a URL contains page -1, size 7, or an unsupported sort
- **THEN** each invalid value is replaced by its default, valid values are preserved,
  and the URL is corrected using history replacement

### Requirement: API input validation

The API SHALL reject malformed, negative, or unsupported paging/sort parameters
with HTTP 400 and the application's standard error response.
Only one sort field and direction SHALL be accepted.
Valid pages beyond the result SHALL return empty content and accurate totals,
without silently changing the requested page.

#### Scenario: Invalid request
- **WHEN** an authorized client supplies page -1, page `abc`, size 100,
  sort `pets,asc`, direction `up`, or multiple sort expressions
- **THEN** the API responds HTTP 400 rather than defaulting or issuing an unsafe sort

#### Scenario: Valid page beyond the result
- **WHEN** page 9 is requested for 23 matches with size 10
- **THEN** the response has empty content, number 9, totalElements 23, and totalPages 3

### Requirement: Recovery from disappearing pages

When a valid requested page exceeds the last available page, the grid SHALL replace
its URL page with the last available page and load it using the same filter, sort,
and size. With zero matches it SHALL use page 0 without repeated recovery requests.

#### Scenario: A formerly valid last page disappears
- **WHEN** deletions reduce 21 matches to 20 while the user requests page 2 with size 10
- **THEN** the grid changes to page 1 and displays owners 11-20

### Requirement: Explicit loading and error feedback

The grid SHALL show loading feedback and only render results for the latest applied
request. Older responses SHALL NOT overwrite newer state. Failures SHALL show an
explicit error and retry action preserving criteria, not an empty-results message.
Zero results SHALL distinguish an empty register from no match for an applied filter.

#### Scenario: Competing requests
- **WHEN** a search is submitted before an earlier request finishes
- **THEN** only the latest request can update the results or clear its loading state
- **AND** old rows are not presented as matching the new criteria

#### Scenario: Failure and retry
- **WHEN** the current request fails
- **THEN** an error and retry action are shown without a no-results message
- **WHEN** Retry is activated
- **THEN** the same applied criteria are requested again

### Requirement: Bounded retrieval at expected scale

At 100,000 owners, the system SHALL retrieve at most the requested page of root
owners for a list response, not materialize the full matching register.
Related owner data SHALL be retrieved in a bounded number of SQL statements
independent of the number of owners, pets, and visits on the page.
Exact counts SHALL NOT require loading matching owner entities.

#### Scenario: Large register and related data
- **WHEN** a size-20 page is requested from a 100,000-owner test register
  with multiple pets and visits per selected owner
- **THEN** at most 20 root owners are returned and totalElements is accurate
- **AND** SQL uses database-level page boundaries before loading collections
- **AND** increasing pets or visits does not introduce per-entity SQL queries

### Requirement: Existing access and detail contracts

List access SHALL retain the existing owner-administrator authorization.
Owner detail/write endpoints, owner count, and MCP owner-profile behavior SHALL
retain their contracts. The list response SHALL retain complete existing owner
item data while replacing only the top-level collection contract.

#### Scenario: Unaffected owner profile and details
- **WHEN** an authorized consumer reads owner details or the authenticated MCP profile
- **THEN** pagination does not change those response contracts
- **WHEN** a caller without the required list permission requests a page
- **THEN** existing access restrictions remain enforced
