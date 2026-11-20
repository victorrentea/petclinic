# Spec Delta

## Purpose

Lists clinic owners through `GET /api/owners`, filtered, sorted and paged in the database, so the
Owners grid stays fast at ~100,000 owners.

## ADDED Requirements

### Requirement: Owners are returned one page at a time
`GET /api/owners` SHALL return a page envelope with `content` (the owners on this page, each with
their pets), `page` (0-based index), `size` and `totalElements`. A missing `page` defaults to 0. A
missing `size` defaults to 10. A page past the last one SHALL return empty `content` with the true
`totalElements`.

#### Scenario: Default page
- **WHEN** 12 owners exist and the client calls `GET /api/owners`
- **THEN** the response has 10 owners in `content`, `page` = 0, `size` = 10, `totalElements` = 12

#### Scenario: Last partial page
- **WHEN** 12 owners exist and the client calls `GET /api/owners?page=1&size=10`
- **THEN** `content` holds the 2 remaining owners and `totalElements` = 12

#### Scenario: Page beyond the end
- **WHEN** 12 owners exist and the client calls `GET /api/owners?page=5&size=10`
- **THEN** the response is 200 with empty `content` and `totalElements` = 12

#### Scenario: Pets are included
- **WHEN** an owner on the requested page has pets
- **THEN** that owner's entry in `content` lists those pets

### Requirement: Page size is restricted to 5, 10 or 20
The endpoint SHALL accept only `size` values 5, 10 and 20, and SHALL answer any other `size` with
400 Bad Request.

#### Scenario: Allowed size
- **WHEN** the client calls `GET /api/owners?size=20` and 30 owners exist
- **THEN** `content` holds 20 owners

#### Scenario: Disallowed size
- **WHEN** the client calls `GET /api/owners?size=1000`
- **THEN** the response is 400 Bad Request

### Requirement: Invalid page index is rejected
The endpoint SHALL answer a negative or non-numeric `page` with 400 Bad Request.

#### Scenario: Negative page
- **WHEN** the client calls `GET /api/owners?page=-1`
- **THEN** the response is 400 Bad Request

#### Scenario: Non-numeric page
- **WHEN** the client calls `GET /api/owners?page=abc`
- **THEN** the response is 400 Bad Request

### Requirement: Sort order is chosen from a whitelist
The endpoint SHALL accept only `sort` values `name,asc`, `name,desc`, `city,asc` and `city,desc`,
defaulting to `name,asc`. Any other value SHALL get 400 Bad Request, and the client's text SHALL
never reach the SQL.

#### Scenario: Unknown sort column
- **WHEN** the client calls `GET /api/owners?sort=telephone,asc`
- **THEN** the response is 400 Bad Request

#### Scenario: Malformed sort
- **WHEN** the client calls `GET /api/owners?sort=name;drop table owners`
- **THEN** the response is 400 Bad Request and the `owners` table is unchanged

### Requirement: Sorting by name orders by last name, first name, then id
`sort=name,<dir>` SHALL order owners by last name, then first name, then id, all in `<dir>`.

#### Scenario: Same last name
- **WHEN** owners Harry Potter and Beatrix Potter exist and the client sorts by `name,asc`
- **THEN** Beatrix Potter comes before Harry Potter

#### Scenario: Descending
- **WHEN** the client sorts by `name,desc`
- **THEN** the order is exactly the reverse of `name,asc`

### Requirement: Sorting by city orders by city, then name, then id
`sort=city,<dir>` SHALL order owners by city, then last name, then first name, then id, all in
`<dir>`.

#### Scenario: Owners in the same city
- **WHEN** four owners live in London and the client sorts by `city,asc`
- **THEN** the Londoners are grouped together, ordered by last name, then first name

### Requirement: Paging is stable across ties
For a fixed dataset, filter and sort, every owner SHALL appear on exactly one page.

#### Scenario: Walking all pages
- **WHEN** the client requests every page of size 5, sorted by `city,asc`, over owners that share
  cities and last names
- **THEN** the concatenated pages contain each owner exactly once

### Requirement: Name and city sort accent-aware
Sorting by name or city SHALL follow linguistic order, not byte order: a letter with a diacritic
sorts beside its base letter.

#### Scenario: Polish surname
- **WHEN** owners Scamander, Śliwiński and Wensleydale exist and the client sorts by `name,asc`
- **THEN** the order is Scamander, Śliwiński, Wensleydale

#### Scenario: Romanian surname
- **WHEN** owners Mureșan and Muresby exist and the client sorts by `name,asc`
- **THEN** Mureșan comes before Muresby

### Requirement: Last-name filter combines with paging
The `lastName` parameter SHALL keep filtering by case-sensitive prefix of the last name, and
`totalElements` SHALL count only the matching owners.

#### Scenario: Filtered count
- **WHEN** 2 owners named Potter exist among 12 owners and the client calls
  `GET /api/owners?lastName=Pot`
- **THEN** `content` holds the 2 Potters and `totalElements` = 2

#### Scenario: Case-sensitive prefix
- **WHEN** the client calls `GET /api/owners?lastName=pot`
- **THEN** no Potter is returned and `totalElements` = 0
