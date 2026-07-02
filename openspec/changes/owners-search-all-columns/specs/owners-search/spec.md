## ADDED Requirements

### Requirement: Cross-column contains search

The system SHALL search owners case-insensitively using a `contains` (substring) match of a single
query term `q` against every column visible in the Owners table: the concatenated full name
(`firstName + ' ' + lastName`), address, city, telephone, and the names of the owner's pets. An owner
SHALL be returned when the term matches **any** of these columns. The whole `q` string SHALL be treated
as one substring; multi-term / token-AND matching is out of scope.

#### Scenario: Match on last name, case-insensitive contains
- **WHEN** an owner named "George Franklin" exists and a client searches with `q=ankl`
- **THEN** the response includes that owner

#### Scenario: Match spanning first and last name across the space
- **WHEN** an owner named "John London" exists and a client searches with `q=hn lon`
- **THEN** the response includes that owner

#### Scenario: Match on address
- **WHEN** an owner lives at "110 W. Liberty St." and a client searches with `q=liberty`
- **THEN** the response includes that owner

#### Scenario: Match on city
- **WHEN** an owner lives in "Madison" and a client searches with `q=ADI`
- **THEN** the response includes that owner

#### Scenario: Match on a pet name
- **WHEN** an owner has a pet named "Leo" and a client searches with `q=leo`
- **THEN** the response includes that owner even though no owner column matches

#### Scenario: No match returns empty page
- **WHEN** no owner column and no pet name contains `q=zzzznomatch`
- **THEN** the response content is empty and `totalElements` is 0

### Requirement: Telephone raw-digit matching

The telephone column SHALL be matched as a raw-digit substring against `q` exactly as stored (bare
digits, no formatting). Formatting characters typed by the user (parentheses, dashes, spaces) are NOT
normalized and will therefore not match stored digits.

#### Scenario: Digit substring matches
- **WHEN** an owner's telephone is stored as "6085551023" and a client searches with `q=5551`
- **THEN** the response includes that owner

#### Scenario: Formatted input does not match
- **WHEN** an owner's telephone is stored as "6085551023" and a client searches with `q=(608)`
- **THEN** the response does not include that owner on the telephone column

### Requirement: Server-side pagination

The owners list endpoint SHALL be paginated server-side using `page` (0-based) and `size` query
parameters, defaulting to page 0 and size 20. The response SHALL carry the page content plus the total
number of matching owners (`totalElements`) so the frontend can render pagination controls. The full
owner list SHALL NOT be loaded into memory on the client or returned unpaginated.

#### Scenario: Default pagination
- **WHEN** a client requests the owners list with no `page`/`size`
- **THEN** the response contains at most 20 owners and reports the total match count

#### Scenario: Second page
- **WHEN** more than 20 owners match and a client requests `page=1&size=20`
- **THEN** the response contains the next slice of owners and the same `totalElements`

#### Scenario: Empty query returns first page of all owners
- **WHEN** a client requests the owners list with an empty or absent `q`
- **THEN** the response is the first page of all owners ordered deterministically, not the whole list

### Requirement: Deterministic ordering

Search and list results SHALL be ordered by `lastName`, then `firstName`, then `id` so that pagination
is stable and deterministic across requests.

#### Scenario: Stable order across pages
- **WHEN** a client pages through results
- **THEN** owners appear in `lastName, firstName, id` order with no duplicates or gaps between pages

### Requirement: Trigram-indexed substring performance

Substring search over the ~1 million-row owners table SHALL be served by `pg_trgm` GIN indexes whose
expressions match the query expressions exactly, so that `ILIKE '%term%'` does not degrade into a full
table scan. The query SHALL be expressed in native SQL (using `||` and `lower(...)`) rather than JPQL,
because JPQL `concat()` compiles to a different expression than the indexed `||` and would bypass the
index.

#### Scenario: Search uses the trigram indexes
- **WHEN** a substring search runs against a realistic-volume owners table
- **THEN** the database uses the trigram GIN indexes rather than scanning all rows

### Requirement: Deprecated lastName parameter back-compat

The API SHALL keep accepting the legacy `lastName` query parameter, mapped to the previous
case-sensitive starts-with behavior, marked deprecated, so existing external clients keep working. The
frontend SHALL stop sending `lastName` and use `q` instead.

#### Scenario: Legacy client still works
- **WHEN** an external client calls the endpoint with `lastName=Franklin`
- **THEN** the endpoint returns owners whose last name starts with "Franklin" as before

#### Scenario: Frontend uses q
- **WHEN** the frontend performs a search
- **THEN** it sends `q` (not `lastName`) and renders the paged response

### Requirement: Authorization unchanged

The owners list/search endpoint SHALL continue to require the `OWNER_ADMIN` role when security is
enabled.

#### Scenario: Role enforced
- **WHEN** security is enabled and a caller without `OWNER_ADMIN` requests the owners search
- **THEN** the request is rejected as forbidden

### Requirement: Debounced as-you-type search UI

The Owners screen SHALL provide a single "Search" box that triggers search as the user types, debounced
by ~300 ms and gated to a minimum of 2 characters, collapsing rapid keystrokes into a single request.
An empty box SHALL show the first page of all owners.

#### Scenario: Debounce collapses keystrokes
- **WHEN** the user types several characters within the debounce window
- **THEN** only one search request is issued after typing settles

#### Scenario: Min-length gate
- **WHEN** the user has typed only 1 character
- **THEN** no cross-column search request is issued

#### Scenario: Clearing the box
- **WHEN** the user clears the search box
- **THEN** the screen shows the first page of all owners
