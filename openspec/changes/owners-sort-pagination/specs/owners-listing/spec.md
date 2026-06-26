## ADDED Requirements

### Requirement: Paginated owners listing

`GET /api/owners` SHALL return a single page of owners, never the full table. It SHALL accept
the request parameters `lastName`, `page`, `size`, `sort`, and `direction`, and SHALL build a
`PageRequest.of(page, size, Sort.by(direction, sortColumn))` to query the database. The default
page SHALL be `page=0`, `size=10`, `sort=name`, `direction=asc`.

#### Scenario: First page returned with defaults
- **WHEN** a client calls `GET /api/owners` with no parameters and the table holds 37 owners
- **THEN** the response contains 10 owners (page 0) ordered by `last_name, first_name` ascending
- **AND** the database query is `LIMIT 10 OFFSET 0`, not a full-table scan loaded into memory

#### Scenario: Explicit page and size honored
- **WHEN** a client calls `GET /api/owners?page=2&size=5`
- **THEN** the response contains owners 11–15 of the sorted result
- **AND** `page.number` is 2 and `page.size` is 5

### Requirement: Stable page envelope contract

The listing response SHALL use Spring Data's stable serialization
(`@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)`), returning the documented
envelope `{ content, page: { size, number, totalElements, totalPages } }`. The controller SHALL
return `PagedModel<OwnerDto>` built from `page.map(ownerMapper::toOwnerDto)` so the runtime JSON,
the regenerated `openapi.yaml`, and the generated Angular types all match. The raw `PageImpl`
"unstable serialization" shape SHALL NOT be emitted.

#### Scenario: Response carries the nested page object
- **WHEN** a client requests any owners page
- **THEN** the JSON body has a `content` array and a nested `page` object with `size`, `number`,
  `totalElements`, and `totalPages`
- **AND** it does NOT carry the flat `totalElements`/`totalPages`/`number`/`size` keys at the root

#### Scenario: Generated contract stays in sync
- **WHEN** the OpenAPI extraction guardrail regenerates `openapi.yaml`
- **THEN** the owners-list schema matches the runtime `PagedModel<OwnerDto>` shape with no drift,
  and CI passes

### Requirement: Last-name prefix filtering

The listing SHALL filter owners by a case-as-stored `last_name` prefix via
`Page<Owner> findByLastNameStartingWith(String lastName, Pageable)`. An empty or absent `lastName`
SHALL match all owners.

#### Scenario: Prefix narrows the result
- **WHEN** a client calls `GET /api/owners?lastName=Fra`
- **THEN** only owners whose last name starts with `Fra` are returned, paginated

#### Scenario: Empty filter matches all
- **WHEN** a client calls `GET /api/owners?lastName=`
- **THEN** the page is computed over all owners

### Requirement: Server-side sort whitelist

Only the four scalar columns SHALL be sortable: `name` (→ `ORDER BY last_name, first_name`),
`address`, `city`, `telephone`. The `pets` column SHALL NOT be sortable. So that the visible
ordering matches the sort key, the Name cell SHALL display the owner surname-first
("Franklin, George"), not first-name-first. An unknown or unsupported
`sort` key SHALL fall back to `name, asc` and SHALL NOT produce a 500. The `direction` SHALL be
case-insensitive; an invalid direction SHALL fall back to `asc`.

#### Scenario: Sort by a whitelisted column
- **WHEN** a client calls `GET /api/owners?sort=city&direction=desc`
- **THEN** owners are ordered by `city` descending

#### Scenario: Name sort uses compound order
- **WHEN** a client calls `GET /api/owners?sort=name`
- **THEN** owners are ordered by `last_name` then `first_name`

#### Scenario: Visible Name order matches the sort key
- **WHEN** the grid is sorted by Name ascending and renders cells surname-first ("Franklin, George")
- **THEN** the leading text of each cell (the surname) is what the rows are ordered by, so the
  column reads as sorted top-to-bottom

#### Scenario: Unknown sort key falls back safely
- **WHEN** a client calls `GET /api/owners?sort=pets` or `sort=bogus`
- **THEN** the response is 200 ordered by `name, asc`, not a 500 error

#### Scenario: Invalid direction falls back to ascending
- **WHEN** a client calls `GET /api/owners?sort=city&direction=sideways`
- **THEN** owners are ordered by `city` ascending

### Requirement: Input validation and caps

`page` SHALL be `>= 0`. `size` SHALL be capped at 20; an invalid or out-of-range `size` SHALL
default to 10. These caps protect the server from a client requesting an unbounded page at 1M rows.

#### Scenario: Size capped at maximum
- **WHEN** a client calls `GET /api/owners?size=1000`
- **THEN** the effective page size is at most 20

#### Scenario: Invalid size defaults
- **WHEN** a client calls `GET /api/owners?size=-3` or `size=abc`
- **THEN** the effective page size is 10

### Requirement: No N+1 and no in-memory pagination when hydrating pets

Each owner's pets SHALL be loaded in bulk, not per row. The implementation SHALL page the owner
roots scalar-only and then batch-load the page's pets in a single `IN (...)` query via
`hibernate.default_batch_fetch_size` (set to 20, i.e. `>=` the max page size). The implementation
SHALL NOT `JOIN FETCH` the to-many `pets` together with pagination (which would make Hibernate
paginate in memory), and SHALL NOT issue one pet query per owner.

#### Scenario: One page costs a bounded number of queries
- **WHEN** a page of 20 owners is fetched and rendered with their pets
- **THEN** pets are loaded with at most one additional batched `IN (...)` query, not 20 separate
  queries
- **AND** the owner page query carries `LIMIT/OFFSET` in SQL (not applied after loading all rows)

### Requirement: Indexes supporting sort and filter at scale

A `V9` Flyway migration SHALL add indexes covering every sortable/filterable path on `owners`:
`(last_name, first_name)`, `city`, `address`, `telephone`, plus a `text_pattern_ops` variant so
`last_name LIKE 'prefix%'` is index-backed.

#### Scenario: Prefix filter is index-backed
- **WHEN** the database plans `WHERE last_name LIKE 'Fra%' ORDER BY last_name, first_name`
- **THEN** it can use the `text_pattern_ops` / `(last_name, first_name)` index rather than a full scan

### Requirement: Material owners grid themed as Bootstrap

The owners grid SHALL be rendered with Angular Material `mat-table` + `matSort` + `mat-paginator`,
driven by the server response (`length = totalElements`, `pageSizeOptions = [5, 10, 20]`). Sort and
page events SHALL refetch from the server rather than re-sort a client-side `MatTableDataSource`.
`matSort` SHALL be enabled only on the four sortable columns. The grid SHALL be re-themed to look
identical to the existing Bootstrap screens (header background/bold/border, odd-row striping, cell
borders, `table-layout: fixed` with explicit `.mat-column-*` widths).

#### Scenario: Paginator reflects server totals
- **WHEN** the server reports `totalElements = 37`
- **THEN** the paginator length is 37 and offers page sizes 5, 10, 20

#### Scenario: Sort click refetches from server
- **WHEN** the user clicks the `City` column header to sort
- **THEN** the component navigates with `sort=city` and refetches that page from the server
- **AND** it does NOT sort the already-loaded rows on the client

#### Scenario: Pets column is not sortable
- **WHEN** the grid renders
- **THEN** the `Pets` column header has no sort affordance

#### Scenario: Visually matches Bootstrap screens
- **WHEN** the owners grid is displayed next to other list screens
- **THEN** header styling, row striping, and cell borders are indistinguishable from the Bootstrap tables

### Requirement: URL query params are the source of truth for list state

List state SHALL live in the URL as `?lastName=&page=&size=&sort=&direction=`. The component SHALL
read `ActivatedRoute.queryParams`, initialize the paginator and sort from the URL, and on every
sort/page/search navigate with merged query params and refetch. Back/forward, refresh, and
deep-linking SHALL all reproduce the same list state. Changing `lastName` SHALL reset `page` to 0.

#### Scenario: Deep link reproduces state
- **WHEN** a user opens `/owners?lastName=Fra&page=1&size=20&sort=city&direction=desc` directly
- **THEN** the grid shows page 1, size 20, sorted by city descending, filtered to `Fra`

#### Scenario: Back button restores previous page
- **WHEN** the user paginates from page 0 to page 1 and presses the browser Back button
- **THEN** the grid returns to page 0 with the prior sort/filter

#### Scenario: New search resets to first page
- **WHEN** the user is on page 3 and types a new `lastName` and searches
- **THEN** the grid navigates to `page=0` with the new `lastName`
