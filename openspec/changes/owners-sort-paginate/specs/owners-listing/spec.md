## ADDED Requirements

### Requirement: Paginated owners endpoint

The system SHALL expose `GET /api/owners` returning a Spring `Page<OwnerDto>` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) and accepting the query parameters `lastName`, `page`, `size`, and `sort` (in the form `col,dir`).

#### Scenario: Default request returns first page
- **WHEN** the client calls `GET /api/owners` with no query parameters
- **THEN** the response body is a `Page<OwnerDto>` envelope
- **AND** `number` is `0`, `size` is `10`, and `content` contains at most 10 owner DTOs

#### Scenario: Explicit page and size are honored
- **WHEN** the client calls `GET /api/owners?page=2&size=5`
- **THEN** the response `number` is `2`, `size` is `5`, and `content` contains at most 5 owner DTOs starting at offset 10

#### Scenario: lastName filter narrows the result
- **WHEN** the client calls `GET /api/owners?lastName=Smith`
- **THEN** every owner in `content` has a `lastName` that matches the filter as the existing search semantics define
- **AND** `totalElements` reflects only the matching rows

### Requirement: Server-built stable sort chain

The system SHALL accept a single `sort=<column>,<direction>` parameter where `<column>` is one of `name`, `address`, `city`, and expand it on the server into a multi-column sort chain that always ends with `id ASC` as the stable tiebreaker.

#### Scenario: Sort by name expands to lastName, firstName, id
- **WHEN** the client calls `GET /api/owners?sort=name,asc`
- **THEN** the underlying `Pageable` carries a `Sort` equal to `lastName ASC, firstName ASC, id ASC`

#### Scenario: Sort by city expands to city, lastName, firstName, id
- **WHEN** the client calls `GET /api/owners?sort=city,desc`
- **THEN** the underlying `Pageable` carries a `Sort` equal to `city DESC, lastName DESC, firstName DESC, id ASC`

#### Scenario: Sort by address expands to address, lastName, firstName, id
- **WHEN** the client calls `GET /api/owners?sort=address,asc`
- **THEN** the underlying `Pageable` carries a `Sort` equal to `address ASC, lastName ASC, firstName ASC, id ASC`

#### Scenario: id ASC is always the final tiebreaker
- **WHEN** any supported `sort` parameter is supplied with either direction
- **THEN** the last `Sort.Order` in the expanded chain is `id ASC`, regardless of the requested direction on the primary column

#### Scenario: Unsortable column is rejected
- **WHEN** the client calls `GET /api/owners?sort=pets,asc`
- **THEN** the response status is `400 Bad Request`

#### Scenario: Default sort when none is supplied
- **WHEN** the client calls `GET /api/owners` with no `sort` parameter
- **THEN** the underlying `Pageable` carries the `name` expansion (`lastName ASC, firstName ASC, id ASC`)

### Requirement: Server-driven pagination and sorting in the Owners screen

The Owners list screen SHALL fetch only the rows for the currently selected page from the server and SHALL NOT perform client-side slicing or sorting.

#### Scenario: Page change triggers a server fetch
- **WHEN** the user navigates from page 1 to page 2 via the paginator
- **THEN** the frontend issues a new `GET /api/owners` request with `page=1` (0-indexed) and the previous `size` and `sort` preserved

#### Scenario: Sort change triggers a server fetch
- **WHEN** the user clicks a sortable column header
- **THEN** the frontend issues a new `GET /api/owners` request with the updated `sort` parameter

### Requirement: Single-column sort toggling

The Owners screen SHALL support exactly one active sort column at a time. Clicking the active column flips its direction between `asc` and `desc`. Clicking a different sortable column activates that column in `asc` direction. The sort SHALL never be cleared.

#### Scenario: New column starts ascending
- **WHEN** the current sort is `name,asc` and the user clicks the `City` header
- **THEN** the new sort is `city,asc`

#### Scenario: Active column flips direction
- **WHEN** the current sort is `name,asc` and the user clicks the `Name` header
- **THEN** the new sort is `name,desc`

#### Scenario: Direction flips back
- **WHEN** the current sort is `name,desc` and the user clicks the `Name` header
- **THEN** the new sort is `name,asc`

#### Scenario: Pets column is not sortable
- **WHEN** the user clicks the `Pets` column header
- **THEN** the sort state is unchanged and no fetch is issued

### Requirement: Sortable column inventory

The Owners screen SHALL expose sort affordances on the `Name`, `Address`, and `City` columns only. The `Pets` column SHALL NOT carry a sort affordance.

#### Scenario: Header presence
- **WHEN** the Owners screen is rendered
- **THEN** the `Name`, `Address`, and `City` column headers display the Material sort-arrow affordance
- **AND** the `Pets` column header is plain text with no sort affordance

### Requirement: Page-size options

The Owners screen SHALL offer page sizes of 5, 10, and 20, with 10 selected by default on first visit.

#### Scenario: Default page size
- **WHEN** the user first visits the Owners screen with no `size` in the URL
- **THEN** the paginator shows `10` selected and the request is issued with `size=10`

#### Scenario: Switching page size
- **WHEN** the user changes the page size from `10` to `20`
- **THEN** a new request is issued with `size=20` and `page=0`

### Requirement: URL is the source of truth for view state

The Owners screen SHALL reflect `page`, `size`, `sort`, and `lastName` in the URL query string and SHALL drive its fetch from the URL rather than from component-local state.

#### Scenario: Deep-link restores view
- **WHEN** the user opens `/owners?page=3&size=20&sort=city,desc&lastName=Sm`
- **THEN** the screen renders page 4 (0-indexed page 3) of size 20, sorted by `city DESC`, filtered by `lastName=Sm`

#### Scenario: URL updates on interaction
- **WHEN** the user clicks the `City` header and the previous sort was `name,asc`
- **THEN** the URL changes to include `sort=city,asc` while preserving `page`-snap-back and the other params

#### Scenario: Back button restores prior view
- **WHEN** the user changes sort, then page, then presses the browser Back button
- **THEN** the screen restores the view that existed before the page change (URL, rendered rows, paginator, sort arrows)

### Requirement: Snap to page 1 on filter, size, or sort change

The Owners screen SHALL navigate to `page=0` (1st page) whenever the `lastName` filter, `size`, or `sort` parameter changes.

#### Scenario: Filter change snaps to first page
- **WHEN** the user is on page 4 and types a new value into the lastName filter that triggers a fetch
- **THEN** the URL `page` parameter becomes `0` and the screen renders page 1 of the filtered result

#### Scenario: Page-size change snaps to first page
- **WHEN** the user is on page 4 with size 10 and switches size to 20
- **THEN** the URL `page` parameter becomes `0` and the screen renders page 1 with size 20

#### Scenario: Sort change snaps to first page
- **WHEN** the user is on page 4 sorted by `name,asc` and clicks the `City` header
- **THEN** the URL `page` parameter becomes `0` and the screen renders page 1 sorted by `city,asc`

### Requirement: Loading UX preserves context

While a fetch is in flight, the Owners screen SHALL keep the previously rendered rows visible at reduced opacity and SHALL overlay a spinner. New rows SHALL replace the dimmed rows only when the response lands.

#### Scenario: Spinner overlay during fetch
- **WHEN** a new fetch is initiated and the previous response has already rendered rows
- **THEN** the previous rows remain visible at reduced opacity
- **AND** a spinner overlay is shown over the table

#### Scenario: Rows replaced on response
- **WHEN** the in-flight fetch completes successfully
- **THEN** the dimmed rows are replaced with the new page's rows
- **AND** the spinner overlay is hidden

### Requirement: Name column rendering

The Owners screen SHALL render the name column with the header text **"Lastname, Firstname"** and each cell as `<lastName>, <firstName>` (comma-separated, lastName first).

#### Scenario: Header text
- **WHEN** the Owners screen is rendered
- **THEN** the name column header reads "Lastname, Firstname"

#### Scenario: Cell content
- **WHEN** an owner row is rendered for owner `firstName="George", lastName="Franklin"`
- **THEN** the name cell text is `Franklin, George`

### Requirement: Pets cell renders a valid, comma-separated list

The Pets cell SHALL be valid HTML (no `<tr>` nested inside a `<td>`) and SHALL render the owner's pets as a single inline comma-separated list of pet names within the `<td>`.

#### Scenario: Owner with multiple pets
- **WHEN** an owner row is rendered for an owner whose pets are `Leo`, `Basil`, `Max`
- **THEN** the Pets cell text content is exactly `Leo, Basil, Max`
- **AND** the cell contains no `<tr>` element

#### Scenario: Owner with one pet
- **WHEN** an owner row is rendered for an owner with a single pet `Whiskers`
- **THEN** the Pets cell text content is exactly `Whiskers` (no trailing comma)
- **AND** the cell contains no `<tr>` element

#### Scenario: Owner with no pets
- **WHEN** an owner row is rendered for an owner whose pets list is empty
- **THEN** the Pets cell is empty (or renders an empty string)
- **AND** the cell contains no `<tr>` element

#### Scenario: Markup is valid
- **WHEN** the Owners screen is rendered
- **THEN** the Pets `<td>` contains no `<tr>` element at any nesting depth
