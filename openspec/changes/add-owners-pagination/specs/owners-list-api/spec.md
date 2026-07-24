## ADDED Requirements

### Requirement: Paged envelope for the owners list
`GET /api/owners` SHALL return a page envelope object instead of a bare array. The envelope SHALL
be a hand-written `PageDto<T>` record with the flat shape `{content, totalElements, totalPages,
number, size}`, where `content` is the list of `OwnerDto` for the requested page, `number` is the
zero-based page index and `size` is the effective page size. This is a **BREAKING** contract change.

#### Scenario: First page of a multi-page result
- **WHEN** a client calls `GET /api/owners?page=0&size=10` against a database of 28 owners
- **THEN** the response body is `{content: [...10 owners...], totalElements: 28, totalPages: 3, number: 0, size: 10}`

#### Scenario: Last, partially filled page
- **WHEN** a client calls `GET /api/owners?page=2&size=10` against a database of 28 owners
- **THEN** `content` has 8 elements, `number` is 2, `totalElements` is 28 and `totalPages` is 3

#### Scenario: Page beyond the end
- **WHEN** a client requests a page index past the last page
- **THEN** the response is 200 with an empty `content` array and unchanged `totalElements` / `totalPages`

#### Scenario: Contract is published
- **WHEN** `OpenApiExtractorTest` runs against the application
- **THEN** the regenerated `openapi.yaml` describes the envelope as a named schema, and
  `npm run generate:api` produces a matching named TypeScript type in `api-types.ts`

### Requirement: Server-side paging and sorting parameters
The endpoint SHALL accept Spring `Pageable` request parameters (`page`, `size`, `sort`) exposed in
the OpenAPI contract via springdoc `@ParameterObject`, together with the existing optional
`lastName` prefix filter. Paging, sorting and filtering SHALL all be performed by the database; the
application SHALL never load the full owner table into memory.

#### Scenario: No parameters supplied
- **WHEN** a client calls `GET /api/owners` with no parameters
- **THEN** the server applies page 0, size 10 and the default Name-ascending sort

#### Scenario: Filter combined with paging
- **WHEN** a client calls `GET /api/owners?lastName=Po&page=0&size=5`
- **THEN** only owners whose last name starts with `Po` are counted in `totalElements` and only the
  first 5 of them are returned in `content`

#### Scenario: Parameters are discoverable
- **WHEN** the OpenAPI document is generated
- **THEN** `page`, `size`, `sort` and `lastName` appear as documented query parameters of the endpoint

### Requirement: Sortable properties are restricted to Name and City
The endpoint SHALL accept sorting only by the owner name and by city. `address` and `telephone`
SHALL NOT be sortable, because address is free text with leading house numbers and telephone is a
nullable, format-free string — sorting either produces output that reads as a defect.

#### Scenario: Sorting by an allowed property
- **WHEN** a client calls `GET /api/owners?sort=city,asc`
- **THEN** the response is 200 and rows are ordered by city ascending

#### Scenario: Sorting by a disallowed or unknown property
- **WHEN** a client calls `GET /api/owners?sort=bogus,asc` or `?sort=address,asc`
- **THEN** the response is **400** with the standard error body produced by the existing
  `@RestControllerAdvice`, and no 500 / stack trace is returned

### Requirement: Deterministic total ordering
The server SHALL expand every requested sort into a total order and SHALL always append the owner
`id` as the final tiebreaker, regardless of what the client sent. Sorting by name SHALL expand to
`last_name, first_name, id`. Page stability is a server-side correctness property and SHALL NOT
depend on the client supplying the tiebreaker. The appended `id` SHALL take the same direction as
the sort, so the whole ordering stays single-direction and one composite index can serve it by a
forward or backward scan rather than forcing an extra sort step.

#### Scenario: Descending sort is stable and index-servable
- **WHEN** a client walks every page of `GET /api/owners?sort=city,desc` over data where `city` has
  duplicates
- **THEN** the union of all pages contains every owner exactly once, and the executed ordering is
  `city DESC, last_name DESC, id DESC` — a single backward index walk, not a re-sort

#### Scenario: Name sort expands to the full chain
- **WHEN** a client calls `GET /api/owners?sort=lastName,asc`
- **THEN** the executed ordering is `last_name, first_name, id` — Beatrix Potter precedes Harry Potter

#### Scenario: Pages are stable across ties
- **WHEN** a client walks every page of `GET /api/owners?sort=city,asc` on data where `city` has
  duplicates (London ×7, Hogsmeade ×3)
- **THEN** the union of all pages contains every owner exactly once — no owner appears on two pages
  and none is skipped

#### Scenario: Client-supplied tiebreaker is not required
- **WHEN** a client sends only `sort=city,asc`
- **THEN** the server still appends `last_name` and `id` to make the order total

### Requirement: Page size guard
The server SHALL cap the requested page size at 20 and SHALL default it to 10, configured via
`spring.data.web.pageable.max-page-size` and `spring.data.web.pageable.default-page-size`, so that
no single request can retrieve an unbounded number of owners.

#### Scenario: Oversized page requested
- **WHEN** a client calls `GET /api/owners?size=100000`
- **THEN** the effective page size is clamped to 20, `size` in the response is 20, and at most 20
  owners are returned

#### Scenario: Cap agrees with the offered page sizes
- **WHEN** the UI offers page sizes 5, 10 and 20
- **THEN** every offered size is accepted by the server without clamping

### Requirement: Locale-neutral alphabetical ordering of owner names and cities
Owner ordering SHALL follow linguistic collation rather than byte order. A Flyway migration SHALL
recollate `owners.last_name`, `owners.first_name` and `owners.city` to `und-x-icu` (ICU root), so
that lowercase-initial surnames and accented letters sort where a human expects. The root collation
is chosen because it is byte-identical to `nl-x-icu`, and the Netherlands is the primary market.

#### Scenario: Mixed-case and accented surnames
- **WHEN** owners `Bakker`, `de Vries`, `Gogh`, `Szabó`, `Ștefănescu`, `Tudor`, `van Gogh` exist and
  the list is sorted by name ascending
- **THEN** they are returned in the order `Bakker`, `de Vries`, `Gogh`, `Ștefănescu`, `Szabó`,
  `Tudor`, `van Gogh` — lowercase-initial and accented surnames interleaved with the plain ones,
  and **not** in the `C`-collation order, which places every lowercase-initial name after all
  uppercase-initial ones and every accented name last.
  Note `Ștefănescu` precedes `Szabó`: ICU root folds `Ș` to `S`, so it compares `Ște…` against
  `Sza…`. Romanian would order them the other way round — that is precisely the accepted divergence
  of finding 3c, asserted below.

#### Scenario: Ordering matches Dutch expectations exactly
- **WHEN** any set of owner names is sorted under the configured collation
- **THEN** the result is identical to the same set sorted under `nl-x-icu`

#### Scenario: Collation is available where the migration runs
- **WHEN** the migration runs against the embedded PostgreSQL used by the test suite and by
  `./start-database.sh`
- **THEN** it succeeds — the `und-x-icu` collation is present on both

#### Scenario: Accepted divergence for the secondary markets
- **WHEN** Hungarian names `Cukor`, `Czako`, `Csaba` are sorted ascending
- **THEN** they are returned in root order `Csaba, Cukor, Czako`, not Hungarian order
  `Cukor, Czako, Csaba` — a known, product-owner-accepted limitation, asserted here so that a
  future switch to per-locale ordering is a deliberate spec change and not an accident

### Requirement: Bounded query count per page
Serving one page of owners SHALL NOT issue a query per owner. Pets and visits SHALL be loaded with
Hibernate batch fetching (`spring.jpa.properties.hibernate.default_batch_fetch_size=50`).
A collection `JOIN FETCH` combined with `Pageable` SHALL NOT be used, because Hibernate cannot
paginate a collection join in SQL and falls back to in-memory pagination (`HHH000104`) — the exact
failure this change exists to prevent.

#### Scenario: Query count for one page
- **WHEN** a page of 10 owners is fetched
- **THEN** roughly 3 SQL statements are executed (count, owners, batched pets), not ~46

#### Scenario: No in-memory pagination
- **WHEN** the owners page query runs
- **THEN** Hibernate does not log `HHH000104` (firstResult/maxResults applied in memory)

### Requirement: Indexes supporting the sort and search paths
The migration SHALL create indexes that serve both the default sort chain and the City sort chain,
since `owners` today has only its primary key. The existing `lastName` prefix search SHALL remain
index-servable after recollation, which requires a separate `text_pattern_ops` index because an
ICU-collated b-tree cannot serve `LIKE 'prefix%'`.

#### Scenario: Default name sort is index-served
- **WHEN** `EXPLAIN` is run for the default sort against a 10,000-row dataset
- **THEN** the plan uses an index on `(last_name, first_name, id)` and performs no full sort

#### Scenario: City sort is index-served
- **WHEN** `EXPLAIN` is run for `sort=city,asc` against a 10,000-row dataset
- **THEN** the plan uses an index on `(city, last_name, id)`

#### Scenario: Prefix search is index-served after recollation
- **WHEN** `EXPLAIN` is run for `lastName=Po` against a 10,000-row dataset
- **THEN** the plan uses the `text_pattern_ops` index on `last_name` and does not sequentially scan
