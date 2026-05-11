## ADDED Requirements

### Requirement: Single-field owner search
The system SHALL expose `GET /api/owners?q={term}` where `q` is an optional, case-insensitive, contains search term applied across all owner fields (firstName, lastName, city, address, telephone) and all associated pet names. When `q` is absent or blank, all owners SHALL be returned.

#### Scenario: Search by last name (partial, lowercase)
- **WHEN** client sends `GET /api/owners?q=smi`
- **THEN** all owners whose lastName contains "smi" (case-insensitive) are returned

#### Scenario: Search by first name
- **WHEN** client sends `GET /api/owners?q=Jane`
- **THEN** all owners whose firstName contains "jane" (case-insensitive) are returned

#### Scenario: Search by city
- **WHEN** client sends `GET /api/owners?q=Bucharest`
- **THEN** all owners whose city contains "bucharest" (case-insensitive) are returned

#### Scenario: Search by pet name
- **WHEN** client sends `GET /api/owners?q=Fluffy`
- **THEN** all owners who have a pet whose name contains "fluffy" (case-insensitive) are returned

#### Scenario: No query returns all owners
- **WHEN** client sends `GET /api/owners` (no `q` parameter)
- **THEN** all owners are returned

#### Scenario: Empty query returns all owners
- **WHEN** client sends `GET /api/owners?q=`
- **THEN** all owners are returned

### Requirement: Owner list UI — single search input
The frontend SHALL replace the dedicated "Last name" input field with a single "Search..." input. The search SHALL be triggered automatically with a 300ms debounce after the user stops typing, and also immediately when the user presses Enter. There SHALL be no separate search button — the debounce replaces it.

#### Scenario: Live search on typing
- **WHEN** user types a search term in the "Search..." input and stops typing for 300ms
- **THEN** the owner list updates to show only matching owners

#### Scenario: Immediate search on Enter
- **WHEN** user presses Enter in the "Search..." input
- **THEN** the owner list updates immediately without waiting for debounce

### Requirement: Owner list sortable columns
The frontend owner list grid SHALL support client-side sorting by Name and City columns. Clicking a column header SHALL toggle between ascending and descending order, with a visual arrow indicator showing current sort direction.

#### Scenario: Sort by Name ascending
- **WHEN** user clicks the "Name" column header (first click)
- **THEN** the owner list is sorted alphabetically by last name, ascending, and an up-arrow indicator is shown

#### Scenario: Sort by Name descending (toggle)
- **WHEN** user clicks the "Name" column header a second time
- **THEN** the owner list is sorted by last name descending and a down-arrow indicator is shown

#### Scenario: Sort by City
- **WHEN** user clicks the "City" column header
- **THEN** the owner list is sorted alphabetically by city and an arrow indicator is shown
