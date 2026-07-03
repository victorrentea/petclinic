## ADDED Requirements

### Requirement: Owners grid supports server-side pagination
The system SHALL load the Owners grid through server-side pagination rather than
fetching the full owner list into the browser. The grid SHALL allow page sizes
of 5, 10, and 20 rows, and it SHALL combine pagination with the existing
last-name prefix filter.

#### Scenario: Open the Owners page with default paging
- **WHEN** a user opens the Owners page without specifying any grid controls
- **THEN** the system returns the first page of owners using server-side paging
- **AND** the grid shows at most 5 owner rows

#### Scenario: Change the page size
- **WHEN** a user changes the Owners grid page size to 10 or 20 rows
- **THEN** the system reloads the grid from the server using the requested page
  size
- **AND** the grid shows at most the selected number of owner rows

### Requirement: Owners grid supports server-side sorting on supported columns
The system SHALL support server-side sorting for the Owners grid columns Name,
Address, City, and Telephone. The Pets column MUST remain visible but MUST NOT
be sortable.

#### Scenario: Sort by a supported column
- **WHEN** a user selects sorting on Name, Address, City, or Telephone
- **THEN** the system reloads the Owners grid from the server using that sort
- **AND** the returned rows appear in the selected order

#### Scenario: Keep Pets non-sortable
- **WHEN** a user views the Owners grid header
- **THEN** the Pets column is displayed without sorting controls

### Requirement: Owners grid names are displayed and ordered by last name first
The system SHALL display owner names in the grid as last name followed by first
name. When users sort by the Name column, the system SHALL order owners by last
name, then by first name.

#### Scenario: Render owner names in the grid
- **WHEN** the Owners grid displays a row for an owner named George Franklin
- **THEN** the Name cell shows `Franklin George`

#### Scenario: Sort by Name
- **WHEN** a user sorts the Owners grid by Name ascending
- **THEN** owners are ordered by last name ascending
- **AND** owners with the same last name are ordered by first name ascending

### Requirement: Owners grid resets paging when the result definition changes
The system SHALL reset the Owners grid to the first page whenever the last-name
filter, active sort, or selected page size changes.

#### Scenario: Change the filter
- **WHEN** a user changes the last-name prefix filter
- **THEN** the system requests the first page of the filtered result set

#### Scenario: Change sorting or page size
- **WHEN** a user changes the active sort or page size
- **THEN** the system requests the first page of the newly defined result set
