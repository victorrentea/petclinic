# owners-list-api

## ADDED Requirements

### Requirement: Paginated owners listing
`GET /api/owners` SHALL return a page envelope with fields `content` (array of list rows), `totalElements`, `totalPages`, `number` (0-based page index), and `size`. The endpoint SHALL accept query params `page` (default 0), `size` (default 10), `sort` (`col,dir`), and the existing `lastName` prefix filter. Pagination, sorting, and filtering MUST happen at the database level — never load all owners in memory.

Each row SHALL be a list read-model carrying exactly `id`, `firstName`, `lastName`, `address`, `city`, `telephone`, and `petNames` (array of pet name strings) — the columns the Owners screen renders. The list query MUST NOT load visits, pet types, or full pet entities; pet names SHALL be aggregated in SQL.

#### Scenario: Row shape and pet-name aggregation
- **WHEN** `GET /api/owners` returns an owner that has pets
- **THEN** that row contains `petNames` as an array of the owner's pet names, and carries no visits/pet-type/full-pet data

#### Scenario: Owner with no pets
- **WHEN** an owner has no pets
- **THEN** its row has `petNames` as an empty array

#### Scenario: Default page
- **WHEN** `GET /api/owners` is called with no query params
- **THEN** the response is a page envelope with `number=0`, `size=10`, at most 10 owners in `content`, and `totalElements` equal to the total owner count

#### Scenario: Explicit page and size
- **WHEN** `GET /api/owners?page=2&size=5` is called
- **THEN** `content` holds the owners at offset 10–14 of the sorted result, `number=2`, `size=5`

#### Scenario: lastName filter combines with pagination
- **WHEN** `GET /api/owners?lastName=Da&page=0&size=10` is called
- **THEN** `totalElements` counts only owners whose last name starts with `Da`, and `content` is the first page of those

#### Scenario: Page beyond the last
- **WHEN** `page` points past the last page of results
- **THEN** the response has an empty `content` and correct `totalElements`/`totalPages`

### Requirement: Server-built sort chains
The server SHALL accept a single sort column + direction (`sort=col,dir` where `dir` is `asc` or `desc`) and expand it into a full ORDER BY chain. `id ASC` SHALL always be the final tiebreaker. When no `sort` is given, the server SHALL apply the default chain for `name` ascending — there is no unsorted state. The chains are:
- `name` → `firstName, lastName, id` *(display-order variant — pending business confirmation per issue #25 comment 2026-06-02)*
- `address` → `address, firstName, lastName, id`
- `city` → `city, firstName, lastName, id`

The requested direction applies to the leading column(s); the `id` tiebreaker is always ASC.

#### Scenario: Sort by name ascending
- **WHEN** `GET /api/owners?sort=name,asc` is called
- **THEN** results are ordered by `firstName ASC, lastName ASC, id ASC`

#### Scenario: Sort by city descending
- **WHEN** `GET /api/owners?sort=city,desc` is called
- **THEN** results are ordered by `city DESC, firstName DESC, lastName DESC, id ASC`

#### Scenario: No sort param falls back to default chain
- **WHEN** `GET /api/owners` is called without `sort`
- **THEN** results are ordered by the `name` ascending chain (`firstName ASC, lastName ASC, id ASC`)

#### Scenario: Stable pagination with duplicate names
- **WHEN** two owners share identical values in every sorted column and consecutive pages are fetched
- **THEN** the `id ASC` tiebreaker guarantees each owner appears on exactly one page

### Requirement: Human collation
Text sorting SHALL be case-insensitive and diacritic-insensitive: `Popescu`, `popescu`, and `Pópescu` compare as equal (then the chain's next column / `id` tiebreaker decides their order).

#### Scenario: Case and diacritics ignored
- **WHEN** owners named `ana`, `Ána`, and `ANA` are sorted by name ascending
- **THEN** they appear adjacent, ordered among themselves by the tiebreaker, not by case or accent

### Requirement: Empty values sort as empty string
A NULL or empty value in the active sort column SHALL be treated as the empty string: such rows appear first on ascending and last on descending.

#### Scenario: Missing city ascending
- **WHEN** `GET /api/owners?sort=city,asc` is called and some owners have no city
- **THEN** the city-less owners appear before all owners with a city

#### Scenario: Missing city descending
- **WHEN** `GET /api/owners?sort=city,desc` is called and some owners have no city
- **THEN** the city-less owners appear after all owners with a city

### Requirement: Sortable-column whitelist
Only `name`, `address`, and `city` SHALL be accepted as sort columns. Telephone (no sorting value) and pets (composite 1→N collection, no natural order) are not sortable. An unknown sort column or direction MUST be rejected with `400 Bad Request` — never interpolated into SQL.

#### Scenario: Unknown sort column rejected
- **WHEN** `GET /api/owners?sort=telephone,asc` is called
- **THEN** the server responds `400 Bad Request`

#### Scenario: Invalid direction rejected
- **WHEN** `GET /api/owners?sort=name,sideways` is called
- **THEN** the server responds `400 Bad Request`

### Requirement: Invalid pagination params rejected
`page` MUST be an integer ≥ 0 and `size` MUST be an integer in the validated 1–100 range. Non-numeric or out-of-range values MUST yield `400 Bad Request`.

#### Scenario: Negative page
- **WHEN** `GET /api/owners?page=-1` is called
- **THEN** the server responds `400 Bad Request`
