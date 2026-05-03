## ADDED Requirements

### Requirement: Owner listing returns paginated results
The system SHALL allow clients to request owners with pagination, free-text search, and supported sorting through `GET /api/owners`, and SHALL return a paginated response containing the current page of owners plus page metadata.

#### Scenario: Default owner listing request
- **WHEN** a client requests `GET /api/owners` without pagination or sorting parameters
- **THEN** the system returns the first page of owners with a default page size of 10 and sorts the results by last name ascending, first name ascending, and id ascending

#### Scenario: Filtered owner listing request
- **WHEN** a client requests `GET /api/owners` with a `query` value and pagination parameters
- **THEN** the system filters owners using the existing free-text owner search behavior before applying pagination and returns metadata computed from the filtered result set

#### Scenario: Supported page size request
- **WHEN** a client requests `GET /api/owners` with `size=20`
- **THEN** the system returns owner results using a page size of 20

#### Scenario: Unsupported page size request
- **WHEN** a client requests `GET /api/owners` with a page size other than 10 or 20
- **THEN** the system responds with a client error instead of silently using an unspecified page size

### Requirement: Owner listing supports the agreed sort options
The system SHALL support sorting the owner list only by the owner search screen columns Name and City in ascending or descending order, and SHALL reject unsupported sort keys from the owner listing API.

#### Scenario: Sort by owner name ascending
- **WHEN** a client requests the owner list sorted by Name ascending
- **THEN** the system orders owners by last name ascending, then first name ascending, and then id ascending

#### Scenario: Sort by owner city descending
- **WHEN** a client requests the owner list sorted by City descending
- **THEN** the system orders owners by city descending and then id ascending

#### Scenario: Unsupported sort key
- **WHEN** a client requests the owner list with a sort key outside Name or City
- **THEN** the system responds with a client error instead of silently applying an unspecified order

### Requirement: Owner search screen preserves URL-driven state
The owner search screen SHALL keep the active search query, sort, page, and page size in the URL and SHALL load results from that URL state.

#### Scenario: User refreshes a filtered owner search
- **WHEN** a user refreshes the owner search screen with `query`, `sort`, `page`, and `size` present in the URL
- **THEN** the screen restores the same search state and requests the matching owner page from the backend

#### Scenario: User navigates with browser history
- **WHEN** a user changes query, sort, page, or page size on the owner search screen and then uses the browser back or forward buttons
- **THEN** the screen reloads the owner results that correspond to the URL shown by the browser

### Requirement: Owner search screen provides sortable, paginated browsing
The owner search screen SHALL display the current page of owners, SHALL let users change sort direction from the Name and City column headers, and SHALL provide numbered page navigation that keeps the active search query and selected sort applied.

#### Scenario: User changes sort on the owner search screen
- **WHEN** a user changes the selected owner search screen sort column or direction
- **THEN** the screen reloads owners using the new sort, preserves the active search query, and resets to the first page of results

#### Scenario: User navigates between owner pages
- **WHEN** a user moves to the next or previous owner page
- **THEN** the screen requests that page from the backend and keeps the active search query and selected sort applied

#### Scenario: User changes the search query while on a later page
- **WHEN** a user updates the owner search text while not on the first page
- **THEN** the screen resets to the first page before displaying the newly filtered results

#### Scenario: User changes rows per page
- **WHEN** a user changes the owner search screen rows-per-page control from 10 to 20 or from 20 to 10
- **THEN** the screen requests results using the selected page size, preserves the active search query and selected sort, updates the URL state, and resets to the first page

#### Scenario: Numbered pagination shows required anchors
- **WHEN** the owner search screen renders pagination for a result set with more than one page
- **THEN** the pagination control shows the first page, last page, current page, previous page when available, next page when available, the page halfway between the current and first page, and the page halfway between the current and last page
