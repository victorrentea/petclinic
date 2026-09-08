## Purpose

Lets `GET /api/owners` serve a bounded, sorted page of owners instead of the whole table, so
the endpoint stays usable as the owners table grows toward the target volumetry of 100,000
rows.

## ADDED Requirements

### Requirement: Paginated owners listing
`GET /api/owners` SHALL return a page of owners as an object with `content`,
`totalElements`, `totalPages`, `number`, and `size` fields, never a bare JSON array.

#### Scenario: Default page
- **WHEN** a client calls `GET /api/owners` with no `page` or `size` parameter
- **THEN** the response is a page object with `number = 0` and `size = 10`, and `content`
  holds at most 10 owners

#### Scenario: Explicit page and size
- **WHEN** a client calls `GET /api/owners?page=1&size=10`
- **THEN** the response `content` holds owners 11-20 (by the active sort order), `number = 1`,
  and `size = 10`

#### Scenario: Page beyond available data
- **WHEN** a client requests a `page` index past the last page of results
- **THEN** the response status is 200 with an empty `content` array and correct
  `totalElements`/`totalPages`

### Requirement: Search composes with pagination
The existing `lastName` prefix filter SHALL apply together with `page`, `size`, and `sort` on
the same `GET /api/owners` endpoint, without a separate search endpoint.

#### Scenario: Filtered and paginated
- **WHEN** a client calls `GET /api/owners?lastName=Da&page=0&size=5`
- **THEN** `content` contains only owners whose last name starts with "Da", limited to the
  requested page and size

### Requirement: Sortable column whitelist
Only `lastName` and `city` SHALL be accepted as sort criteria. Any other requested sort
property, including navigation into nested associations such as `pets`, SHALL be rejected
with an error response rather than silently ignored or applied.

#### Scenario: Sorting by an allowed column
- **WHEN** a client calls `GET /api/owners?sort=city,asc`
- **THEN** the response status is 200 and `content` is ordered by city ascending

#### Scenario: Sorting by a disallowed or unknown property
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc` or
  `GET /api/owners?sort=pets.name,asc`
- **THEN** the response status is 400 and no data is returned

### Requirement: Stable ordering with tie-breaker
Sorting by `lastName` SHALL order by last name, then first name, then owner ID. Sorting by
`city` SHALL order by city, then last name, then first name, then owner ID. The final field
in every case SHALL be the owner ID, so that owners sharing all preceding sort values still
receive a fixed, repeatable order across pages.

#### Scenario: Duplicate last names split across pages
- **GIVEN** more owners share the same last name than fit on one page
- **WHEN** a client requests consecutive pages sorted by `lastName`
- **THEN** no owner appears on more than one page and no owner is skipped

### Requirement: Correct Unicode collation for text sorting
Sorting by `lastName` or `city` SHALL order names using Unicode-aware collation, so that
names with diacritics or non-ASCII characters (for example, "Śliwiński") sort alongside
visually similar ASCII letters rather than after all ASCII letters.

#### Scenario: Diacritic name sorts with its base letter
- **GIVEN** owners named "Silver", "Śliwiński", "Tremaine", and "Weasley" sorted by last name
  ascending
- **WHEN** the client reads the ordered `content`
- **THEN** "Śliwiński" appears between "Silver" and "Tremaine", not after "Weasley"

### Requirement: Slim owner list item payload
Each entry in a paginated owners listing SHALL include only the owner's id, first name, last
name, address, city, telephone, and the names of their pets. It SHALL NOT include pet visit
history or pet type details.

#### Scenario: Pet visits and type omitted from list payload
- **WHEN** a client calls `GET /api/owners` for an owner whose pet has visits and a type
- **THEN** the corresponding `content` entry includes the pet's name but omits its visits and
  type
