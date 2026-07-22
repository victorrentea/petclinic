## ADDED Requirements

### Requirement: Paginated owners response envelope

`GET /api/owners` SHALL return a page envelope rather than a bare array, so the client knows how many
owners exist without downloading them.

The envelope SHALL contain `content` (array of owner DTOs), `totalElements`, `totalPages`, `number`
(0-based page index) and `size` (the **effective** page size actually applied).

The response SHALL NOT be a serialized Spring `PageImpl` — the contract is an explicit, versioned DTO.

#### Scenario: Default request returns an envelope
- **WHEN** a client calls `GET /api/owners` with no query parameters
- **THEN** the response is `200` with fields `content`, `totalElements`, `totalPages`, `number`, `size`
- **AND** `number` is `0` and `size` is `10`
- **AND** `content` holds at most 10 owner DTOs

#### Scenario: Totals reflect the whole table, not the page
- **WHEN** 28 owners exist and a client calls `GET /api/owners?size=10`
- **THEN** `content` has 10 entries, `totalElements` is `28` and `totalPages` is `3`

### Requirement: Page size is bounded

The endpoint SHALL default to a page size of 10 and SHALL cap the page size at 20. A larger requested
size SHALL be clamped rather than rejected, and the envelope's `size` SHALL report the size that was
actually applied.

#### Scenario: Supported page sizes
- **WHEN** a client requests `size=5`, `size=10` or `size=20`
- **THEN** the response `size` equals the requested value and `content` holds at most that many owners

#### Scenario: Oversized page request is clamped
- **WHEN** a client calls `GET /api/owners?size=1000000`
- **THEN** the response is `200`, `size` is `20`, and `content` holds at most 20 owners

### Requirement: Only whitelisted columns are sortable

The endpoint SHALL accept exactly two UI-level sort keys — `name` and `city` — in the standard
`sort=<key>,<asc|desc>` form. These keys are part of the REST contract and SHALL be mapped
server-side to entity paths, so the contract stays decoupled from the entity model.

Any other sort key SHALL be rejected with `400 Bad Request` and a message naming the accepted keys.
It SHALL NOT return `500`, SHALL NOT be silently ignored, and SHALL NOT be resolved against the
entity graph (which would let a caller emit arbitrary joins such as `pets.visits.description`).

#### Scenario: Sort by name
- **WHEN** a client calls `GET /api/owners?sort=name,asc`
- **THEN** owners are ordered by last name, then first name

#### Scenario: Sort by city descending
- **WHEN** a client calls `GET /api/owners?sort=city,desc`
- **THEN** owners are ordered by city, descending

#### Scenario: Unknown sort key is rejected
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc`
- **THEN** the response is `400 Bad Request`
- **AND** the message names `name` and `city` as the accepted keys

#### Scenario: Entity-path sort key is rejected
- **WHEN** a client calls `GET /api/owners?sort=pets.visits.description,asc`
- **THEN** the response is `400 Bad Request` and no query is executed against `visits`

### Requirement: Sort order is total and deterministic

Every sort SHALL append the owner `id` as a final tiebreaker, so that `LIMIT`/`OFFSET` paging over
non-unique columns is stable:

- `sort=name` → `ORDER BY last_name, first_name, id`
- `sort=city` → `ORDER BY city, id`

When the client sends no `sort`, the endpoint SHALL apply `name,asc` as the default — an unordered
`LIMIT/OFFSET` is unstable even for the first page.

#### Scenario: Paging over a non-unique column loses nothing and duplicates nothing
- **GIVEN** several owners share the same city
- **WHEN** a client pages through the entire result set with `sort=city,asc`
- **THEN** the union of all pages equals the full set of owners exactly once — no duplicates, no omissions

#### Scenario: No sort parameter falls back to name ascending
- **WHEN** a client calls `GET /api/owners` with no `sort`
- **THEN** owners are ordered by last name, first name, id, ascending

### Requirement: Alphabetical ordering is human-alphabetical

Ordering of `last_name`, `first_name` and `city` SHALL follow a linguistic collation
(`en-US-x-icu`), pinned on the columns themselves so that the result does not depend on the
database cluster's collation setting.

Under the current `C` (byte-order) collation, lowercase-prefixed surnames (`van Gogh`, `de Vries`)
and accented surnames (`Ångström`) sort after `Z`, which users read as a broken A–Z page.

#### Scenario: Lowercase-prefixed and accented surnames sort in linguistic order
- **GIVEN** owners with last names `Andrews`, `Ångström`, `de Vries`, `van Gogh`, `Zephyr`
- **WHEN** a client calls `GET /api/owners?sort=name,asc`
- **THEN** they appear in the order `Andrews`, `Ångström`, `de Vries`, `van Gogh`, `Zephyr`

### Requirement: The last-name filter composes with paging and sorting

The existing `lastName` prefix filter SHALL keep its current matching behaviour and SHALL be
applicable together with `page`, `size` and `sort`. Totals in the envelope SHALL reflect the
**filtered** result set.

#### Scenario: Filter, sort and page together
- **WHEN** a client calls `GET /api/owners?lastName=Da&sort=city,asc&page=0&size=5`
- **THEN** only owners whose last name starts with `Da` are returned, ordered by city then id
- **AND** `totalElements` counts only the matching owners

### Requirement: A page costs a bounded number of queries

Serving one page SHALL NOT issue one query per owner to load pets. Pets SHALL be batch-loaded, and
the paged query itself SHALL be executed by the database — the application SHALL NOT load the full
result set into memory to slice it (Hibernate's in-memory pagination fallback, `HHH000104`).

#### Scenario: Pets do not cause N+1
- **WHEN** a page of 20 owners each having pets is requested
- **THEN** the pets are loaded in a bounded number of additional queries, independent of page size
- **AND** the owners of the page retain the order established by the sort

### Requirement: The unauthenticated owner count endpoint is preserved

`GET /api/owners/count` SHALL remain available and `permitAll()`. It is not superseded by
`totalElements`, which is only reachable by an `OWNER_ADMIN`.

#### Scenario: Welcome screen counts owners anonymously
- **WHEN** an unauthenticated client calls `GET /api/owners/count`
- **THEN** the response is `200` with the total number of owners
