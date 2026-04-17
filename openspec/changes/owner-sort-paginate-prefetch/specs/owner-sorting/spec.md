## ADDED Requirements

### Requirement: Sortable Name and City columns
The owners table SHALL display sort indicators on the Name and City column headers. Clicking a column header SHALL cycle the sort direction: ASC → DESC → ASC.

#### Scenario: Default sort on page load
- **WHEN** user navigates to the owners list for the first time
- **THEN** the Name column shows the ASC sort indicator (↑) immediately on first render, before any user interaction, and owners are ordered by firstName then lastName ascending; City column shows no indicator

#### Scenario: Sort indicator signals clickability
- **WHEN** the owners list is first displayed
- **THEN** both the Name and City column headers SHALL be visually styled to suggest they are interactive (e.g., cursor pointer, hover effect), even if not currently sorted by that column

#### Scenario: Click active sort column to reverse direction
- **WHEN** user clicks the currently active sort column header
- **THEN** sort direction toggles and the table reloads with the new direction

#### Scenario: Click inactive sort column
- **WHEN** user clicks a column that is not the current sort column
- **THEN** that column becomes the active sort column with ASC direction and the table reloads

#### Scenario: Visual sort indicator
- **WHEN** a column is the active sort column
- **THEN** the column header shows an arrow (↑ for ASC, ↓ for DESC); other columns show no indicator

### Requirement: Name column sorts by firstName then lastName
When sorting by the Name column, the backend SHALL sort by `firstName` as the primary key and `lastName` as the secondary key.

#### Scenario: Name sort maps to two fields
- **WHEN** user activates sort on the Name column
- **THEN** the request includes `sort=firstName,<dir>&sort=lastName,<dir>` (both same direction)
