# Design

## Context

See proposal.md for why. Today:
- `GET /api/owners?lastName=` → `OwnerRepository.findByLastNameStartingWith` → `List<OwnerDto>`,
  each with its pets and each pet with its visits. `Owner.pets` and `Pet.visits` are lazy and
  nothing batches them, so a list costs 1 + owners + pets queries.
- `owners.last_name`, `first_name` and `city` are plain `TEXT` with no index, under the
  database's default collation (dev: libc `en_US.UTF-8`, which varies by OS).
- Postgres is the zonky embedded 16.2 build; it ships ICU, `ro-RO-x-icu` included (checked on
  the dev database: `Sava < Szabo < Șerban < Tudor`).
- The owner list's only caller is the Angular `OwnerListComponent` via `OwnerService`
  (code + `Deployment.drawio.png`).

An earlier, unmerged proposal for #25 lives on branch `paginate-owners-grid` (6 Oct 2026). It
is superseded by this one: different volume, name order and Back behaviour.

### API and code impact

- **BREAKING** `GET /api/owners` returns a page (`content`, `totalElements`) instead of a list,
  and takes `page`, `size` and `sort`. Its only caller is our frontend, which ships in the same
  release; the chatbot reaches the backend only through `/mcp`, `/api/specialties/feed` and
  `/actuator/*` (checked in `petclinic-chatbot`, matching `Deployment.drawio.png`).
- Backend: `OwnerRestController.listOwners`, `OwnerRepository`, a new `OwnerPageDto`, a Flyway
  migration (collation + indexes), Hibernate batch fetching, regenerated `openapi.yaml`.
- Frontend: `owner-list` component and `OwnerService`, Material table/sort/paginator in the
  owners module, regenerated `generated/api-types.ts`. The Pets cell today nests a `<tr>` in a
  `<td>` (invalid HTML), and Add Owner sits inside the results `*ngIf`, so it vanishes when a
  search finds nobody.
- Tests: backend `OwnerTest`, `AddVisitApiTest`, Cucumber `owners.feature`, the latency perf
  test; e2e `owner-search.feature`, `add-owner.spec.ts`, `visits.spec.ts`,
  `visit-date-range.spec.ts`.
- Dev data: the #40 e2e tests left 53 "Ada Lovelace"/"Probe" owners in the dev database; they
  are deleted, and those tests now delete what they create.

## Goals / Non-Goals

**Goals:**
- A page of 20 owners costs a constant number of queries, independent of the table size.
- Sorting and the prefix search can use an index at 50,000 owners.

**Non-Goals:**
- Keeping grid state in the URL (Back and refresh reset to page 1).
- Normalizing telephone numbers or addresses.
- A reusable design-system grid component.

## Decisions

**1. Change `GET /api/owners` in place, returning a hand-written `OwnerPageDto`.**
`{content: OwnerDto[], totalElements: long}`. A hand-written DTO, like every other DTO here,
rather than serializing Spring's `Page`/`PageImpl` (whose JSON shape Spring Data itself warns
is unstable) or `PagedModel` (adds a nested `page` object for no benefit). A parallel
endpoint was rejected: frontend and backend ship together and nobody else calls it.

**2. API sort keys are words, not entity fields.** `sort=name|city[,asc|desc]` is mapped in
the controller to a JPA `Sort`: `name` → `lastName, firstName, id`; `city` → `city, lastName,
firstName, id`; the direction applies to the first key only (City ties stay ascending by
name). Accepting raw `Pageable` sort properties was rejected: it would expose `telephone`,
`address` and every future field, and couple the API to entity names. Unknown keys, and sizes
other than 5/10/20, throw `ValidationException`, which `ExceptionControllerAdvice` already
turns into a 400 ProblemDetail.

**3. Pin Romanian collation per column, in a Flyway migration.**
`ALTER COLUMN … TYPE text COLLATE "ro-RO-x-icu"` on `last_name`, `first_name`, `city`. Pinning
the columns, not the database, makes dev, tests (fresh Zonky copies) and production agree
without touching how any database is created. Alternative `ORDER BY … COLLATE` in the query
was rejected: an index can only serve the collation it was built with.

**4. Indexes for the two sorts and the search.**
`(last_name, first_name, id)`, `(city, last_name, first_name, id)`, and
`(last_name text_pattern_ops)` for `LIKE 'Mur%'`, which a non-C collation index cannot serve.
Verified with `EXPLAIN` on 50,000 generated owners, not assumed.

**5. Load the page's pets and visits in batches.**
`spring.jpa.properties.hibernate.default_batch_fetch_size=20` (the largest page): one query
for the owner page, one for the count, one `IN (…)` for their pets, one for those pets' visits.
A `JOIN FETCH` with paging was rejected — Hibernate then pages in memory (HHH90003004) over
every matching owner. A slimmer row DTO without visits was rejected for now: keeping `OwnerDto`
keeps the frontend `Owner` type and the generated types unchanged per row. The batch size is
global, so other screens' lazy loads get batched too, which only reduces queries.

**6. Frontend: Angular Material `mat-table` + `matSort` + `mat-paginator`.**
Already a dependency (16.2.1, used by the visit datepicker). `matSortDisableClear` gives the
asc/desc-only toggle; `mat-sort-header` only on Name and City. The component asks the server
on every sort/page/search event; a new search, sort or page size resets `pageIndex` to 0. The
existing "only the latest query may answer" guard (`load?.unsubscribe()`) stays.

## Risks / Trade-offs

- [The CI runner's zonky build lacks ICU, and the migration fails there] → the first CI run
  of the migration proves it; fallback is `und-x-icu`, else pin a libc collation the image has.
- [A column collation change rewrites `owners` and locks it] → at 79 rows today it is instant;
  noted in the migration for anyone replaying it on a large copy.
- [Global batch fetch size changes other screens' SQL] → it only merges per-row lazy loads into
  `IN` queries; the backend suite, the traced sequence diagrams and `DeploymentDiagramTest`
  show any drift.
- [Count query on every page] → `count(*)` over 50,000 rows with the search index is
  milliseconds; measured together with the page query.

## Migration Plan

Single release: Flyway migration, backend and frontend deploy together. Rollback = previous
release; the collation and indexes are harmless to the old code, so the migration need not be
reverted.
