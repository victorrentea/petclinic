## ADDED Requirements

### Requirement: Owners directory supports server-side pagination
The system SHALL present the Owners directory as a paged result set served by the backend. The directory MUST support page sizes of 5, 10, and 20 rows, default to 10 rows, and reset to the first page whenever the active filter, sort field, sort direction, or page size changes.

#### Scenario: Default owner directory page
- **WHEN** a user opens the Owners directory without grid query parameters
- **THEN** the system returns and renders the first page of owners using page size 10

#### Scenario: User changes page size
- **WHEN** a user changes the page size to 5 or 20
- **THEN** the system reloads the Owners directory from page 1 using the selected page size

#### Scenario: URL requests an out-of-range page
- **WHEN** a user opens the Owners directory with a page number beyond the last available page for the active filter
- **THEN** the system navigates to and renders the last available page instead of showing an empty page caused only by the invalid page number

### Requirement: Owners directory supports sortable owner fields
The system SHALL support server-side sorting on the Name and City columns. The Name column MUST display `Last name First name` and MUST sort by `lastName` followed by `firstName`. Address, Telephone, and Pets MUST remain non-sortable. Repeated selection of the same sortable column MUST toggle the sort direction between ascending and descending only.

#### Scenario: Default sort uses last-name-first ordering
- **WHEN** a user opens the Owners directory without sort query parameters
- **THEN** the system sorts owners by last name ascending and then first name ascending

#### Scenario: User sorts by name
- **WHEN** a user activates sorting on the Name column
- **THEN** the system orders owners by last name and then first name using the requested direction

#### Scenario: User toggles the same sortable column
- **WHEN** a user activates the same sortable column header twice in succession
- **THEN** the system reverses the sort direction without clearing sorting

#### Scenario: Pets column remains informational only
- **WHEN** a user views the Owners directory
- **THEN** the Pets column shows pet information but does not expose sorting behavior

### Requirement: Owners directory preserves searchable grid state in the URL
The system SHALL keep the last-name prefix filter, page number, page size, sort field, and sort direction in the Owners directory URL query parameters. Pagination and sorting MUST operate on the filtered result set. Invalid query-parameter values MUST be normalized to safe defaults instead of causing an error state.

#### Scenario: Filtering scopes paging and sorting
- **WHEN** a user searches by last-name prefix and then changes page, page size, or sort
- **THEN** the system applies those operations only to owners matching the active filter

#### Scenario: Refresh preserves grid state
- **WHEN** a user refreshes the Owners directory page with filter, page, page size, and sort query parameters present
- **THEN** the system restores the same grid state from the URL before loading owners

#### Scenario: Invalid query parameters are normalized
- **WHEN** a user opens the Owners directory with an unsupported page size, unknown sort field, invalid sort direction, or negative page number
- **THEN** the system replaces those values with the default page size, default sort, and first page and still renders the directory

#### Scenario: Empty filter result shows empty-state message
- **WHEN** the active last-name prefix filter matches no owners
- **THEN** the system shows the empty-state message and does not show grid rows or paginator controls
