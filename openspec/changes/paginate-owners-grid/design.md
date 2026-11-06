# Design

## Context

See proposal.md for motivation and the specs for required behavior.

Current state on this branch, read from the code and migrations V1-V3:

- `OwnerRestController.listOwners` loads every match through `findByLastNameStartingWith`, a
  case-sensitive prefix, and maps each owner to an `OwnerDto` that nests pets and their visits.
- `owners` has only its primary key. `pets(owner_id)` is already indexed.
- `first_name`, `last_name` and `city` are `TEXT` under the database's `C.UTF-8` collation, so
  letters with diacritics sort after Z.
- `OwnerRepository` extends the bare `Repository`, so it offers only what it declares.
- The app has no Spring Data paging in use, no `MatPaginator` and no `MatSort`. `owner-page.ts`
  already has the wanted shape but nothing imports it.

The dev database cannot be used as evidence for this design: it carries migrations V4 and V5 from
elsewhere, which is where its indexes and `und-x-icu` columns come from.

Data profile that drove the sort and search decisions (28 seed owners): 22 distinct cities with
London five times; telephones in `+44…`, `(0044)…`, `0034…` and local formats; free-text addresses;
3 owners with diacritics in their name; at most 2 pets per owner and 3 visits per pet.

## Goals / Non-Goals

**Goals:**

- Every query stays bounded at 100,000 owners, including the count.
- `Pageable` and `Sort` keep working without native SQL.

**Non-Goals:**

- Normalising telephone numbers, which is what sorting them would need.
- Matching inside a last name (`Garcia`), which needs `pg_trgm`.
- Searching by anything but last name.
- Paging other unbounded lists such as `/api/visits`, tracked separately.

## Decisions

### 1. ICU collation on the columns

One migration sets `COLLATE "und-x-icu"` on `first_name`, `last_name` and `city`.

Alternative: `COLLATE` in each query plus expression indexes. Rejected because Spring Data `Sort`
cannot emit it, which would force native queries for every ordering.

### 2. A `search_key(text)` database function

An `IMMUTABLE` SQL function returns `lower(public.unaccent('public.unaccent', $1))`. The
two-argument form with a schema-qualified dictionary is what makes `IMMUTABLE` honest, since the
one-argument form depends on `search_path`. Unaccenting first means both `Ș` and `ș` reduce to `s`
before lowering.

The query compares `search_key(last_name) LIKE search_key(:prefix) || '%'` with an escape character.

Alternative: a generated `search_key` column. Rejected for now: it adds a column and a write path
for what an expression index gives without either.

Alternative: case-insensitivity alone via `lower()`. Rejected because it leaves `Mures`, `Sli` and
`Martin` returning nothing.

### 3. Indexes

| Index | Serves |
| --- | --- |
| `(first_name, last_name, id)` | sort by name, both directions |
| `(city, first_name, last_name, id)` | sort by city, both directions |
| `(search_key(last_name) text_pattern_ops)` | prefix search |

`text_pattern_ops` is required for `LIKE` under a non-C collation. No index on `address` or
`telephone`, since neither is sorted or searched.

A search that matches many owners is filtered first and sorted afterwards. That is acceptable
because a prefix narrows the set, and task 7.2 measures the broadest case.

### 4. Sort keys are an API vocabulary

`sort=name` and `sort=city` map to `firstName,lastName,id` and `city,firstName,lastName,id`, with
the direction applied to every field, so a backward index scan serves descending order. Field names
are not accepted directly: that would expose the model and allow unindexed sorts.

`id` is always the last key, because it is what makes page order stable.

### 5. Hand-written page DTO

`OwnerPageDto {content, totalElements, totalPages, number, size}`, following the project's rule of
hand-written DTOs, built in the mapper. Serialising Spring's `Page` directly was rejected: its JSON
form is not a stable contract, and it would leak into `openapi.yaml`.

### 6. Validation through the existing advice

Invalid `page`, `size` and `sort` throw `ValidationException`, which `ExceptionControllerAdvice`
already turns into a 400 `ProblemDetail`.

### 7. Two repository queries

Blank search calls a plain paged query. Non-blank calls the `search_key` query. A single query with
`:prefix = '' OR …` was rejected because that `OR` stops the planner from using the search index.

### 8. Loading pets

`hibernate.default_batch_fetch_size=20`, no fetch join. A collection fetch join with paging makes
Hibernate page in memory, which at this volume means loading every owner. `OwnerDto` stays as it is
even though the grid only needs pet names: batch fetching bounds the cost, and a dedicated row DTO
would change the frontend `Owner` model too.

### 9. The URL is the grid's only state

The component derives its request from `ActivatedRoute.queryParams` through `switchMap`, and every
user action navigates. That one path covers Back, refresh and links, and `switchMap` keeps the
existing guarantee that only the latest query answers. `OwnerService` exposes one
`getOwners(query)`, replacing `getOwners()` and `searchOwners()`.

`MatPaginatorModule` and `MatSortModule` are imported directly in the owners module. The design
system wraps form inputs only, so no wrapper is added.

## Risks / Trade-offs

- [Rights: `CREATE EXTENSION` may be refused to the migration's role] → `unaccent` is verified
  present in the Linux 16.2.0 binaries, not yet exercised. Task 1.1 runs the migration first;
  if the role cannot create it, the fallback is `lower()` only, and the spec must drop the
  diacritics requirement.
- [Docker stack: `postgres:16` is a third environment] → covered by running the suite on the
  isolated stack in task 7.3.
- [ICU differs between environments: Linux binaries bundle ICU 60] → tests assert the order of
  letters with diacritics relative to base letters, not exact collation details.
- [`unaccent` rules miss a letter] → the spec names `Ș`, `ș`, `Ś`, `Ł`; tests cover them. Anything
  else simply fails to match, as it does today.
- [Name sort is by first name while search is by last name] → accepted in the design interview;
  search is the route to an owner by surname.
- [`OwnerDto` still carries visits] → accepted, see decision 8; bounded at 20 owners per page.

## Technical Impact

**BREAKING** `GET /api/owners` always returns one page instead of a JSON array of all owners, and no
endpoint returns every owner any more. **BREAKING** the `lastName` filter ignores case and
diacritics, where it used to be a case-sensitive prefix. See VOLUMETRY.md for the volume target.

- **API**: the response of `GET /api/owners` changes shape; new `page`, `size`, `sort` parameters;
  invalid values answer 400. Only the frontend consumes it in production (`Deployment.drawio.png`
  and the code agree; the chatbot uses `/mcp`, `/api/specialties/feed` and `/actuator`).
- **Database**: a new migration changes the collation of `first_name`, `last_name` and `city`, adds
  the `unaccent` extension, and adds indexes. The dev database must be reset: it already holds
  migrations V4 and V5 that do not exist on this branch.
- **Backend**: `OwnerRestController`, `OwnerRepository`, a page DTO, Hibernate batch fetching.
- **Frontend**: `OwnerService`, the owner list component, the owners module.
- **Generated**: `openapi.yaml` and `api-types.ts`.
- **Tests**: `owner-search.feature` pins today's case-sensitive search and an "every owner is
  listed" scenario, so both change; so do the backend tests and Playwright helpers that read the list.

## Migration Plan

1. `V4__owner_listing.sql`: extension, function, collation, indexes. Changing a collation rebuilds
   any dependent index, cheap at today's size. The seed and reference rows are untouched.
2. Developers reset their database with `./start-database.sh`, since any database carrying the
   other V4/V5 would otherwise fail Flyway validation.
3. Rollback: revert the commits and reset. There is no production database in this repo.

The API change is not backward compatible and ships together with the frontend.
