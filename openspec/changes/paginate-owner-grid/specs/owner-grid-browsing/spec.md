# Spec Delta

## Purpose

Enable clinic users to browse, filter, sort, and page through a large owner population while keeping each REST response bounded and navigation deterministic.

## ADDED Requirements

### Requirement: The owners endpoint returns a bounded page
The system SHALL return `GET /api/owners` as a page envelope containing `content`, `number`, `size`, `totalElements`, and `totalPages`.

Each row SHALL contain owner identity and contact fields plus pet names, and SHALL NOT contain visit data.

#### Scenario: Default owner page
- **WHEN** a client requests `GET /api/owners` without paging parameters
- **THEN** the system returns page 0 with at most 10 owner rows and accurate total counts

#### Scenario: Empty page
- **WHEN** a client requests a valid page beyond the final page
- **THEN** the system returns an empty `content` collection with accurate page metadata

### Requirement: Clients can select an allowed page size
The system SHALL accept page sizes of 5, 10, or 20 rows and SHALL reject other sizes.

#### Scenario: Select an allowed page size
- **WHEN** a client requests a page size of 5, 10, or 20
- **THEN** the response contains no more than the requested number of rows and reports that size

#### Scenario: Reject an unsupported page size
- **WHEN** a client requests a page size outside 5, 10, or 20
- **THEN** the system responds with HTTP 400

### Requirement: Clients can sort every displayed owner column
The system SHALL support ascending and descending sorting by Name, Address, City, Telephone, and Pets.

Name SHALL sort by last name, first name, and owner ID. Pets SHALL sort by pet count. Address, City, and Telephone SHALL sort by their displayed values. All sort modes SHALL use owner name and ID as deterministic tie-breakers.

#### Scenario: Sort a scalar column
- **WHEN** a client requests Address, City, or Telephone sorting in either direction
- **THEN** owners are ordered by the selected value and deterministic owner tie-breakers

#### Scenario: Sort Name
- **WHEN** a client requests Name sorting in either direction
- **THEN** owners are ordered by last name, first name, and owner ID

#### Scenario: Sort Pets
- **WHEN** a client requests Pets sorting in either direction
- **THEN** owners are ordered by pet count and deterministic owner tie-breakers while pet names remain visible

#### Scenario: Reject an unsupported sort
- **WHEN** a client requests an unknown sort key or direction
- **THEN** the system responds with HTTP 400

### Requirement: Last-name filtering composes with paging and sorting
The system SHALL preserve case-sensitive last-name prefix filtering and SHALL apply filtering before counting, sorting, and paging.

#### Scenario: Filter a sorted page
- **WHEN** a client supplies a last-name prefix together with valid page and sort parameters
- **THEN** page content and totals describe only owners whose last names start with that exact-case prefix

#### Scenario: Submit a new filter in the grid
- **WHEN** a clinic user submits a last-name filter from any page
- **THEN** the grid opens page 1 of the filtered result while retaining the selected page size and sort

### Requirement: Grid navigation state is restorable
The system SHALL represent the normalized owner filter, page, page size, sort key, and direction in the browser URL.

#### Scenario: Reload a configured grid
- **WHEN** a clinic user reloads or directly opens an Owners URL containing valid grid parameters
- **THEN** the same filter, page, page size, and ordering are restored

#### Scenario: Navigate through browser history
- **WHEN** a clinic user changes grid state and then uses browser Back or Forward
- **THEN** the grid restores the state represented by that history entry

### Requirement: Grid interactions remain coherent during requests
The system SHALL ensure that only the latest requested grid state is rendered and SHALL distinguish loading, loaded, empty, and error states.

#### Scenario: A newer request supersedes an older request
- **WHEN** a clinic user changes the grid state before an earlier request completes
- **THEN** a late response from the earlier request does not replace the newer results

#### Scenario: No owners match
- **WHEN** a valid filter produces no owners
- **THEN** the grid displays an empty-result message rather than an error

#### Scenario: Loading fails
- **WHEN** the owners request fails
- **THEN** the grid displays an error state and does not report the result as empty

### Requirement: Paging controls respect result boundaries
The system SHALL offer page sizes 5, 10, and 20, identify the current page and total results, and prevent navigation before the first page or beyond the final page.

#### Scenario: Navigate between pages
- **WHEN** more than one page exists and the user chooses Next or Previous
- **THEN** the adjacent page loads without duplicating rows across a stable page boundary

#### Scenario: Change page size or sort
- **WHEN** a clinic user changes page size or sorting
- **THEN** the grid resets to page 1 and preserves the active last-name filter

### Requirement: Owner browsing meets the repository response-time objective
The system SHALL return representative first, middle, and final pages within 10 seconds for a dataset of 100,000 owners.

#### Scenario: Browse a large owner population
- **WHEN** representative filtered and unfiltered requests exercise every supported sort on 100,000 owners
- **THEN** each request completes within 10 seconds
