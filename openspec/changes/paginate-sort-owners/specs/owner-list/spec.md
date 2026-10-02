# Spec Delta

## Purpose

Allow clinic users to browse owners through bounded pages, retain existing last-name prefix filtering, and navigate a stable Name or City ordering without downloading the entire owner dataset.

## ADDED Requirements

### Requirement: Owner list page contract
`GET /api/owners` SHALL return HTTP 200 with exactly `content` and `totalElements` as its page-envelope fields. `content` SHALL contain existing owner DTOs with their pets, pet types, and visits; `totalElements` SHALL count all matching owners before pagination.

#### Scenario: Default request
- **WHEN** an authorized user requests `/api/owners` with no query parameters against an unchanged dataset of 26 owners
- **THEN** the response contains the first 10 owners in Name ascending order and `totalElements` is 26
- **AND** the response is an object, not an array or an envelope with framework-specific page metadata

#### Scenario: Existing nested data
- **WHEN** a selected owner has multiple pets and visits
- **THEN** the selected owner's DTO contains the same nested data as before pagination
- **AND** owners without pets are also eligible for inclusion

### Requirement: Paging inputs and bounds
The API SHALL use zero-based `page` with default 0 and `size` with default 10. Valid page sizes SHALL be only 5, 10, and 20. Negative, non-integer, or unrepresentable page numbers and invalid sizes SHALL return HTTP 400 rather than being silently normalized.

#### Scenario: Requested page
- **WHEN** a user requests `page=1&size=5` with at least 10 matching owners
- **THEN** the response contains owners at positions 6 through 10 of the requested ordering
- **AND** `totalElements` still counts all matching owners

#### Scenario: Invalid paging
- **WHEN** a user supplies `size=7`, `size=0`, `page=-1`, or `page=abc`
- **THEN** the API returns HTTP 400

#### Scenario: Page beyond the final result
- **WHEN** a valid page number is beyond the last page
- **THEN** the API returns HTTP 200 with empty `content` and the actual matching `totalElements`

### Requirement: Business-key sorting
The API SHALL accept only `sort=name,asc`, `name,desc`, `city,asc`, or `city,desc`, defaulting to `name,asc` when omitted. Name SHALL order by last name, first name, and owner ID; City SHALL order by city, last name, first name, and owner ID. The selected direction SHALL apply to every field in the chain.

#### Scenario: Name ties
- **WHEN** owners share a last name and first name and the user requests either Name sort direction
- **THEN** their IDs break the tie in that same direction
- **AND** traversing successive pages on an unchanged dataset does not duplicate or omit owners

#### Scenario: City descending
- **WHEN** a user requests `sort=city,desc`
- **THEN** cities are descending and ties are resolved by descending last name, first name, and ID

#### Scenario: Unsupported sort
- **WHEN** a user requests an entity-property sort such as `lastName,asc`, an unsupported key such as `telephone,asc`, a malformed sort such as `name`, or direction `name,up`
- **THEN** the API returns HTTP 400

### Requirement: Preserved last-name filtering
The API SHALL preserve case-sensitive literal last-name prefix filtering. An omitted or empty `lastName` SHALL match all owners. Pagination and sorting SHALL operate on the filtered set, with `totalElements` reflecting that set.

#### Scenario: Prefix and case
- **WHEN** the dataset includes Harry Potter and Beatrix Potter
- **THEN** `lastName=Pot` matches both, whereas `lastName=otter`, `lastName=Harry`, and `lastName=potter` match neither

#### Scenario: Filtered page total
- **WHEN** seven owners match a prefix and the user requests `size=5&page=1`
- **THEN** two matching owners are returned and `totalElements` is 7

#### Scenario: Literal special characters
- **WHEN** the prefix contains `%` or `_`
- **THEN** those characters are matched literally rather than expanding the result as SQL wildcards

### Requirement: Bounded list data access
Owner listing SHALL retrieve owner rows only for the requested page and associations only for selected owners. A full non-empty page SHALL require at most three SQL SELECT statements, including counting, association loading, and response mapping, independent of the number of matching owners or pets.

#### Scenario: Cold full-page retrieval
- **WHEN** a full page of 20 owners with multiple pets, pet types, and visits is requested with an empty persistence context and caches disabled
- **THEN** the response uses at most three SQL SELECT statements
- **AND** owner pagination is performed by the database, not after loading all owners or collection rows

#### Scenario: Empty page retrieval
- **WHEN** no owners are selected
- **THEN** no query loads pets or visits for unselected owners

### Requirement: Owners grid navigation
The grid SHALL display a page of owners, offer page sizes 5/10/20, indicate the current range and total, and expose sorting controls only for Name and City. The initial grid state SHALL correspond to API defaults. Existing Bootstrap styling, owner-detail navigation, and Add Owner behavior SHALL remain available.

#### Scenario: Initial grid
- **WHEN** the Owners screen loads with more than 10 owners
- **THEN** 10 rows and a range/total indicator are displayed
- **AND** the paginator offers sizes 5, 10, and 20
- **AND** Address, Telephone, and Pets have no sorting controls

#### Scenario: Page navigation
- **WHEN** a user moves to the next page
- **THEN** exactly one list request retrieves that page with the applied filter, size, and sort

### Requirement: Grid state transitions
A submitted search, page-size change, or sort change SHALL reset the page index to 0. Search SHALL preserve the active sort. Page and sort navigation SHALL use the submitted filter, not unsubmitted input edits. The URL query parameters `page`, `size`, `sort`, and `lastName` SHALL represent the applied state. Refreshing, opening a shared URL, and browser Back/Forward SHALL restore that state without duplicate list requests.

#### Scenario: Refresh or share a page
- **WHEN** a user refreshes or another user opens the owners URL
- **THEN** the page, page size, sort key/direction, and submitted prefix are restored
- **AND** exactly one request loads the matching page and the controls show the restored settings

#### Scenario: Invalid URL settings
- **WHEN** known query parameters are malformed, repeated, or unsupported
- **THEN** all owner-list settings revert to the API defaults
- **AND** a visible notice explains the reset, the URL is replaced with the default settings, and one default-page request is made

#### Scenario: Unsubmitted text is not shared
- **WHEN** a user edits the search input without submitting
- **THEN** the URL keeps the last submitted prefix

#### Scenario: Browser history
- **WHEN** a user navigates Back or Forward between owner-list states
- **THEN** the grid and submitted search input restore the corresponding URL state

#### Scenario: Search after navigation
- **WHEN** a user is on a later page with City descending selected and submits a new prefix
- **THEN** exactly one request is sent for page 0 with that prefix and City descending

#### Scenario: Size or sort change
- **WHEN** a user changes the page size or toggles a sortable header on a later page
- **THEN** exactly one request is sent with page 0 and the new setting

#### Scenario: Unsubmitted search text
- **WHEN** a user edits the search input without submitting and then navigates pages
- **THEN** the page request retains the previously submitted prefix

### Requirement: Latest request wins
Only the latest list request SHALL update the displayed rows, total, loading state, or error state. Leaving the screen SHALL cancel any outstanding list subscription.

#### Scenario: Late earlier response
- **WHEN** a user searches or changes paging while an earlier request remains in flight
- **THEN** the older response cannot overwrite the latest page or total

### Requirement: Empty results and failures are distinct
After a successful response with `totalElements=0`, the grid SHALL show a no-owners message containing the submitted prefix and hide the paginator. Request failures SHALL display an explicit error rather than being presented as successful empty search results.

#### Scenario: No matches
- **WHEN** a submitted prefix matches no owners
- **THEN** the no-owners message is visible and the paginator is hidden

#### Scenario: Nonzero total but empty page
- **WHEN** the API returns empty `content` with a nonzero total
- **THEN** the grid does not claim that the prefix has no matches
- **AND** navigation back to a valid page remains available

#### Scenario: Failed request
- **WHEN** the latest list request fails
- **THEN** an explicit error is displayed and no no-matches message is inferred from the failure

### Requirement: Unchanged authorization and owner operations
Existing owner-list authorization and all owner-detail, count, create, update, delete, nested pet/visit, and chatbot owner-detail/MCP contracts SHALL remain unchanged. All in-repository list consumers SHALL use the new page envelope.

#### Scenario: Existing authorization
- **WHEN** an unauthorized client requests the paginated owner list
- **THEN** existing authentication and role restrictions still apply

#### Scenario: Owner detail and booking
- **WHEN** a client retrieves an owner by ID or books a visit through existing endpoints
- **THEN** its request and response contracts are unchanged
