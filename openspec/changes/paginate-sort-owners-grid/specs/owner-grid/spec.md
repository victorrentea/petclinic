# Spec Delta

## Purpose

Let clinic users browse, search and sort owners predictably through a bounded, server-paged grid,
including multilingual names and datasets of approximately 50,000 owners.

## ADDED Requirements

### Requirement: Bounded server-side pages
The Owners grid SHALL request only one server-computed page of matching owners at a time.
Allowed page sizes SHALL be 5, 10 and 20, with a default of 10. Filtering and sorting SHALL apply
to the entire matching result set before pagination.

#### Scenario: Initial page
- **WHEN** a user opens Owners without grid parameters
- **THEN** the first 10 matching owners in Name ascending order are displayed
- **AND** the grid does not download the full owner list

#### Scenario: Page boundaries
- **WHEN** a user navigates through 23 matching owners with size 10
- **THEN** the pages contain 10, 10 and 3 owners respectively
- **AND** unchanged data produces no missing or duplicate owners across those pages

#### Scenario: Alternate page sizes
- **WHEN** the user selects 5 or 20 rows per page
- **THEN** the first page is requested with that size, retaining the current search and sort

### Requirement: Observable alphabetical sorting
Name, Address, City and Telephone SHALL be sortable in either direction, one column at a time.
Text SHALL use English Unicode alphabetical ordering. Name SHALL compare the full displayed
first-name-space-last-name value, without splitting compound names or changing displayed spelling.
Telephone SHALL sort as text. Null and empty values SHALL be last in either direction.
Equal keys SHALL use ascending owner ID as a final tie-breaker.

#### Scenario: Compound and accented names
- **WHEN** Name ascending is selected for owners including Juan Carlos Martin Garcia Lorca,
  Harry Potter, Stefan Muresan and Lukasz Sliwinski, with accents preserved in their stored names
- **THEN** owners are ordered by their complete displayed names using English alphabetical rules
- **AND** Juan Carlos is compared under J rather than M
- **AND** accents and compound names remain unchanged on screen

#### Scenario: Sorting interaction
- **WHEN** a user selects a different sortable header
- **THEN** its ascending order is selected and the first page is requested
- **AND** selecting that same header again toggles to descending

#### Scenario: Stable ties and missing values
- **WHEN** owners have identical selected sort values or missing selected values
- **THEN** identical values are ordered by ascending owner ID
- **AND** null and empty values follow populated values in both ascending and descending order

### Requirement: Pets remain display-only
The Pets column SHALL display pet names but SHALL NOT provide a sort action.

#### Scenario: Pets header
- **WHEN** a user views the grid or navigates its headers with a keyboard
- **THEN** Pets has no sorting control or sort indicator
- **AND** each owner's pet names remain visible

### Requirement: Preserve last-name-prefix search
Search SHALL retain the existing case-sensitive last-name-prefix semantics.
Submitting a search SHALL return to the first page while retaining page size and sort.
An empty search SHALL include all owners, across pages.

#### Scenario: Prefix rather than substring or first name
- **WHEN** owners include Harry Potter and Beatrix Potter
- **THEN** searches for "Pot" and "Potter" match both
- **AND** "otter", "potter" and "Harry" do not match them

#### Scenario: Clear a filter
- **WHEN** the user submits an empty search from a later filtered page
- **THEN** the first page of all owners is displayed using the existing size and sort

### Requirement: Page navigation and counts
The grid SHALL show first, previous, next and last controls, the current page and total pages,
and the visible row range with the total number of matching owners.
Unavailable navigation SHALL be disabled. An empty result SHALL show zero results without an
invalid page or range.

#### Scenario: First and last pages
- **WHEN** 23 owners match and the user views the first page of size 10
- **THEN** the range is "1-10 of 23" and first/previous are disabled
- **AND** the last page shows "21-23 of 23" with next/last disabled

#### Scenario: Dataset shrinks
- **WHEN** a previously valid requested page lies beyond the current last page
- **THEN** the grid navigates to the last available page, or the empty first page if none remain
- **AND** the URL reflects the resulting page

### Requirement: URL-backed grid state
Search, page, size, sort column and direction SHALL be represented in URL query parameters.
Reload and browser Back SHALL restore the represented state. Navigating to an owner and back
SHALL preserve the grid state.

#### Scenario: Restore a grid view
- **WHEN** a user opens a bookmarked grid URL or returns with browser Back
- **THEN** the represented filter, page size, sort and page are restored before loading results

### Requirement: Explicit loading and failure states
The grid SHALL distinguish loading, successful results, no matches and request failure.
Only the latest requested state SHALL update displayed rows, counts and loading/error indicators.
Failures SHALL show an error and retry action, never a successful empty result.
Add Owner and search SHALL remain available when there are no matches.

#### Scenario: Out-of-order responses
- **WHEN** a new search or sort is requested before an earlier request finishes
- **THEN** the earlier response or cancellation cannot replace rows or clear the newer loading state

#### Scenario: Failed request and retry
- **WHEN** loading a page fails
- **THEN** the user sees an error with Retry rather than "no owners found"
- **AND** Retry requests the same current grid state

#### Scenario: No matches
- **WHEN** a successful search returns no owners
- **THEN** an explicit no-matches message and zero count are shown
- **AND** search and Add Owner remain available

### Requirement: Accessible grid controls
Sortable headers and pagination controls SHALL be keyboard operable and clearly labelled.
The active sort direction SHALL be exposed to assistive technology. Page size SHALL use the
existing standard single-select widget; result/loading/error changes SHALL be announced.

#### Scenario: Keyboard operation
- **WHEN** a user operates the grid without a mouse
- **THEN** sorting, page navigation and page-size selection are available with visible focus
- **AND** the selected sort direction and result status are accessible

### Requirement: Explicit paginated API contract
GET /api/owners/page SHALL return content, totalElements, totalPages, number and size.
Parameters SHALL be page (zero-based), size, lastName, sort and direction.
Defaults SHALL be page=0, size=10, lastName="", sort=name, direction=asc.
Content SHALL contain owner ID, name fields, address, city, telephone and pet names,
without pet visit histories.

#### Scenario: Bounded response shape
- **WHEN** an authorized client requests page=1, size=5, sort=city, direction=desc
- **THEN** the response has at most 5 owner rows, matching totals, number=1 and size=5
- **AND** content contains no nested visit histories

#### Scenario: Page beyond the result set
- **WHEN** an authorized client requests a valid nonnegative page beyond the available pages
- **THEN** the response contains empty content and accurate totals and echoes the requested page

### Requirement: Invalid input is explicit
The paginated API SHALL reject malformed or negative page values, unsupported sizes, sort keys
other than name/address/city/telephone, and directions other than asc/desc with HTTP 400 and a
descriptive error. Omitted values alone SHALL use defaults. Invalid grid URL parameters SHALL
show an error with an explicit reset-to-defaults action rather than silently changing the input.

#### Scenario: Reject unsupported sort
- **WHEN** a client requests sort=pets or an arbitrary expression as its sort key
- **THEN** the API returns HTTP 400 rather than applying a fallback order

#### Scenario: Reject invalid paging
- **WHEN** a client requests page=-1, a non-integer page or size=100
- **THEN** the API returns HTTP 400 identifying the invalid parameter

### Requirement: Preserve API compatibility and authorization
Existing GET /api/owners SHALL retain its array response and search behavior.
The paginated endpoint SHALL use the same OWNER_ADMIN access policy as the existing owner list.

#### Scenario: Existing consumer
- **WHEN** an authorized existing client requests /api/owners?lastName=Pot
- **THEN** it continues to receive the matching owner array rather than a page envelope

#### Scenario: Unauthorized paginated request
- **WHEN** a caller without the required owner-administration access requests the paginated endpoint
- **THEN** access is denied according to the existing authentication and authorization policy

### Requirement: Scale without full-dataset materialization
At 50,000 owners, a grid request SHALL retrieve at most the selected page of owner rows plus
their pet-name data and aggregate metadata. It SHALL NOT load all matching owners or visit
histories into application memory to filter, sort or page them.

#### Scenario: Representative scale verification
- **WHEN** first, middle and last pages and prefix-filtered pages are requested against an
  isolated 50,000-owner dataset
- **THEN** each response respects the selected size and reports correct counts
- **AND** database/application evidence confirms pagination precedes owner-row materialization
- **AND** pet-data fetching uses a bounded number of queries independent of page size
