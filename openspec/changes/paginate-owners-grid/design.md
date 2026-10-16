# Design

## Context

See proposal.md for the why, and `specs/owner-listing/spec.md` for the behaviour.

Current state:
- `OwnerRestController.listOwners` calls `findByLastNameStartingWith(lastName)` with no
  `ORDER BY` and maps every owner with `OwnerMapper`, which maps each owner's pets
  (`PetMapper`) and each pet's visits (`VisitMapper`). `Owner.pets` and `Pet.visits` are lazy,
  so N owners cost 1 + N + (number of pets) queries.
- `OwnerRepository` extends the bare `Repository`, exposing only declared methods.
- The grid is a plain Bootstrap `<table>` in `owner-list.component.html`; Angular Material 16.2
  is installed (the visit forms use its datepicker), but no paginator or sort is used yet.
- Tests run on Zonky embedded Postgres, whose collation follows the machine's locale; dev runs
  `en_US.UTF-8`.

Data reviewed with the DB CLI (26 seeded owners) to choose the sortable columns:
- Name: 26 unique full names, diacritics included (Ștefan Mureșan, Łukasz Śliwiński).
- City: 20 distinct values, London ×5 — sorting groups owners.
- Address: free text, sometimes starting with a house number (`12…`, `221B…`, `Diagon Alley`) —
  a text sort orders `12…` < `221B…` < `4…`, which means nothing.
- Telephone: four formats (`+44…`, `(0044)…`, `0119…`, no prefix) — a text sort groups by
  formatting, not by country.
- Pets: several names per owner, no natural order.

## API contract (BREAKING)

`GET /api/owners` returns one page, `{content, totalElements}`, instead of a bare array:
- `page`: 0-based, default 0.
- `size`: 5, 10 or 20; default 10.
- `sort=<key>,<dir>`: key `name` or `city`, direction `asc` or `desc`; default `name,asc`.
- `lastName`: the existing prefix filter, unchanged.

Sorting is deterministic:
- `name` orders by first name, then last name, then `id`.
- `city` orders by city, then `id`.

So no owner repeats or goes missing across pages.

Errors and edge cases:
- An unknown sort key or direction, a size outside {5, 10, 20}, or a negative page → 400
  ProblemDetail naming the parameter.
- A page past the end → 200 with empty `content` and the real `totalElements`.

`openapi.yaml` and `petclinic-frontend/src/app/generated/api-types.ts` are regenerated, never
edited.

Consumers, checked against `Deployment.drawio.png` and the code:
- The frontend `OwnerService` is the only production caller.
- The chatbot reaches owners through MCP and `GET /api/owners/{id}`, so it is unaffected.
- `GET /api/owners/count` (the welcome page) is untouched.

## Affected code

- **Backend:**
  - `OwnerRestController` and `OwnerRepository`.
  - A new `OwnerPageDto`.
  - `@BatchSize` on `Owner.pets` / `Pet.visits`.
  - `ExceptionControllerAdvice` (400 for bad paging parameters).
- **Frontend:**
  - The `owner-list` component and `OwnerService`.
  - `OwnersModule`, which gets the Material paginator and sort modules.
  - Owners routing (query params).
  - Deleted: the orphan `owners/owner-page.ts`.
- **Tests and tooling that read the list:**
  - `petclinic-test` glue: `add-visit.dsl.ts`, `owner-search.feature.glue.ts`,
    `visit-date-range.feature.glue.ts`.
  - The backend probe in `start-apps.ts`.
  - `.human-review/feature-script.js`.
  - Backend tests calling `GET /api/owners`: `OwnerTest`, `AddVisitApiTest`,
    `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`.

## Goals / Non-Goals

**Goals:**
- Constant cost per request regardless of the number of owners: one page query, one count, and
  a fixed number of batch queries for pets and visits.
- A contract that exposes API sort names, not entity fields.

**Non-Goals:**
- A `mat-table` rewrite of the grid, or a design-system paginator component.
- Indexes, unless measurement at 10k owners asks for them (see Risks).
- Changing what each owner carries in `content` (pets and visits stay, as today).

## Decisions

### `GET /api/owners` is paged in place, returning `OwnerPageDto {content, totalElements}`
Hand-written record in `rest/dto`, like every other DTO. The client knows the page and size it
asked for, and `totalPages` is derivable, so echoing them would add fields that can disagree.
- *Rejected:* a new `/api/owners/page` endpoint — leaves the unbounded list alive.
- *Rejected:* returning Spring's `Page` (serialisation Spring Data itself flags as unstable) or
  `PagedModel` (nests the total under `page`, a shape we would not choose).
- *Rejected:* a bare array plus an `X-Total-Count` header — the total would be invisible to the
  generated `api-types.ts`.

### Paging parameters are parsed and validated by the controller
The controller takes `page`, `size` and `sort` as plain request parameters and maps the API
sort key to a Spring Data `Sort`:
- `name` → `firstName, lastName, id`
- `city` → `city, id`

Then it builds a `PageRequest`. An unknown key, direction or size throws an exception that
`ExceptionControllerAdvice` turns into a 400 ProblemDetail, the same style as the existing
validation errors.
- *Rejected:* Spring's `Pageable` resolver. It accepts `sort` on any entity property and any size
  up to its 2000 maximum, so it would need a whitelist anyway, and it ties the contract to entity
  field names.

### `OwnerRepository` gains `Page<Owner> findByLastNameStartingWith(String, Pageable)`
Spring Data derives the count query. The `List` variant is removed once nothing calls it.

### Pets and visits are batch-fetched: `@BatchSize(size = 20)` on `Owner.pets` and `Pet.visits`
For a page of up to 20 owners, this loads their pets in one query and those pets' visits in one
query, instead of one query per owner and per pet. 20 matches the largest page size.
- *Rejected:* `JOIN FETCH` with paging. Hibernate pages in memory (HHH90003004) and loads every
  matching owner.
- *Rejected:* a hand-written second query for pets. It still leaves visits loading one by one,
  and needs the assembly done by hand.
- *Rejected:* a global `hibernate.default_batch_fetch_size`. It changes fetching for every
  association in the app, beyond this change.

### The grid uses `mat-paginator` + `matSort` on the existing table
`MatSortModule` works on plain `<th mat-sort-header>`, without `mat-table`.
- `disableClear` keeps the sort cycling between asc and desc.
- The paginator offers `[5, 10, 20]`.

The `OwnerPageDto` type comes from the regenerated `api-types.ts`; the orphan `owner-page.ts` is
deleted.

### Grid look, settled while reviewing it in the browser
- **Fixed column widths** (`table-layout: fixed`, 22/26/16/18/18 %). With auto layout the columns
  resized to each page's rows, so the headers jumped on every sort.
- **Sort indicator:** one solid triangle replaces Material's stem arrow. It shows dim on every
  sortable header without hovering, and bright ▲ or ▼ on the active sort.
- **Footer row:** "Add Owner" on the left, the paginator on the right. `#ownersTable` always
  renders; only the table and the paginator hide when nothing matches.
- **Pets column:** a "—" for an owner without pets. The pet names are `<div>`s instead of `<tr>`s
  nested in a `<td>`, which was invalid HTML.
- **Non-numeric `page`/`size`** (`size=abc`) gets a 400 too, through a
  `MethodArgumentTypeMismatchException` handler. Before, it reached the generic 500 handler. The
  handler applies to every endpoint, so `/api/owners/abc` is now a 400 as well.

### Grid state lives in the URL query parameters
The component subscribes to `ActivatedRoute.queryParamMap` and fetches from it. User actions
(page, size, sort, search) only navigate with new query params, so there is one source of truth
and the back button works without extra code.
- Searching sets `page=0` and keeps the sort.
- Defaults (page 0, size 10, `name,asc`) are left out of the URL, so `/owners` stays clean.
- A page past the end jumps to the last page with `replaceUrl`.

### Test helpers stop scanning the owner list
Glue that finds an owner or pet by scanning `GET /api/owners` would see only page 1:
- `visit-date-range` looks the pet up with `GET /api/pets`.
- `add-visit.dsl` and `owner-search` filter with `?lastName=`.

## Risks / Trade-offs

- **[Collation differs between machines]** Zonky inherits the OS locale, and on CI it may be `C`,
  where `Ś` sorts after `Z`. → Backend tests assert orders on ASCII names only, unless the first
  task finds the test locale is pinned. Dev and prod run `en_US.UTF-8`.
- **[Count query on every page]** Spring Data runs `count(*)` with the same filter on every
  request. → At 10k rows this costs about a millisecond. It is measured with the sort queries.
- **[No index on the sort columns]** Sorting by first name or city scans and sorts 10k rows. →
  `EXPLAIN ANALYZE` on 10k generated owners (a throwaway script, not seed data). A Flyway
  migration is added only if a query exceeds 50 ms.
- **[BREAKING contract]** Any client still expecting an array breaks. → The only production
  caller (the frontend) changes in the same commit set; the chatbot uses MCP and the single-owner
  endpoint.
- **[Page size 20 caps a batch]** Batch size 20 equals the largest page. → If a bigger page size
  is ever allowed, raise the batch size with it. A comment at the annotation says so.

### Measured at 10k owners (task 2.1)

**Setup:** temp copies of the real tables (`LIKE … INCLUDING ALL`), with 10,000 owners, 14,950 pets,
22,453 visits and 492 cities. Run on PostgreSQL 16.2 (`en_US.UTF-8`, macOS); warm runs, 3 each:

| Query | Plan | ms |
|---|---|---|
| Page 0, any of the 4 sorts | Seq Scan + top-N heapsort | 1.8–3.8 |
| Last page (offset 9990), by name | Seq Scan + in-memory quicksort | 27–29 (first cold run: 56) |
| Last page, by city | same | 16–18 (first cold run: 32) |
| `last_name LIKE 'Sm%'`, either order | Seq Scan + filter + top-N | ~1 |
| count, with or without filter | Seq Scan + aggregate | ~0.6 |
| Pets / visits batch (`IN` 20 / 40 ids) | Index Scan (`pets_owner_id_idx`, `visits_pet_id_idx`) | < 0.1 |

**Verdict:** no index migration. Every warm query is under the 50 ms line. The only one near it is
the last page sorted by name, which costs the collation-aware sort of all rows, and that grows
with the number of rows.

Indexes `(first_name, last_name, id)` and `(city, id)` bring the last page to ~2 ms and page 0 to
< 0.1 ms. They are the first move if owners outgrow ~10k or a Linux server sorts slower. A
`last_name` prefix index would need `text_pattern_ops` under this collation.

## Migration Plan

The frontend and backend ship together from one branch, with no compatibility window. Rollback
is a revert of the branch's merge.

## Open Questions

- ~~Does Zonky's embedded Postgres pin a locale here?~~ **Answered (task 1.1):** no. The database
  is created with the OS locale: `en_US.UTF-8` on this Mac, where Śliwiński sorts between Silver
  and Tremaine. A Linux CI runner may use `C.UTF-8`, where it sorts after Wensleydale, so
  backend tests assert the order of ASCII names only, and no diacritics test is added.
