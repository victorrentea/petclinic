# Design: owners-sort-pagination

## Context

`GET /api/owners` (`petclinic-backend-ts/src/owners/owner.controller.ts`) returns a bare `OwnerDto[]`, filtered only by a `lastName` prefix, built with a TypeORM QueryBuilder that eager-loads pets/visits. The Angular `owner-list` component renders everything in a Bootstrap table. At the production scale this app simulates (~100k owners) that is unusable. Issue #25, its grilling-session comment, and the business-refined functional spec (`owners-sort-pagination-functional-spec.md`, repo root) fix most decisions; this design records how they map onto this codebase (NestJS + TypeORM + PostgreSQL, no service layer, Angular 16 + Bootstrap 3 + barely-used Angular Material). Where the functional spec and the issue comments differ, the functional spec wins.

## Goals / Non-Goals

**Goals:**
- Server-side pagination, sorting (human collation, empty-values rule), and filtering on `GET /api/owners` with a stable order (id tiebreaker).
- Owners screen: always-active sort (default Name asc), paginator with counter + first/last and ≤5 hide threshold, URL-driven state that also survives in-app navigation, empty state, dimmed-stale-rows loading UX.
- Tests: backend e2e pinning sort-chain expansion + collation; Playwright e2e for sort/paginate/deep-link/back-button (CI-only).

**Non-Goals (issue #25 + functional spec):**
- Building search (exists; we only integrate); owner deletion on this screen; multi-sort; persisting page size across visits/devices; a11y/keyboard sort operation (deferred); removing `/api/owners/count`; case-insensitive *search*; wiring `api-types.ts` into `OwnerService`; debounced filter input.

## Decisions

### 1. Evolve `GET /api/owners` in place → `Page<OwnerListRowDto>` (a list read-model, NOT `OwnerDto`)
Spring-style envelope: `{ content, totalElements, totalPages, number, size }`. A versioned `/api/v2/owners` was rejected — all consumers are in-repo and updated atomically in this change, so a parallel endpoint is pure overhead. Implemented as a generic `PageDto<T>` class with OpenAPI annotations so `api-types.ts` regenerates correctly.

The list endpoint returns a **dedicated projection DTO** `OwnerListRowDto = { id, firstName, lastName, address, city, telephone, petNames: string[] }` — exactly the columns the Owners screen renders. `OwnerDto` (with full `pets: PetDto[]` + visits) stays untouched and continues to serve the detail endpoint `GET /api/owners/:id`, which genuinely displays pets and visits. Rationale: the list screen has no use for full pet entities, pet types, or visits — fetching them is pure waste at 100k owners. Decoupling the list read-model from the aggregate also lets the list query project and aggregate in SQL (Decision #4).

### 2. Sort handling: whitelist map in the controller, server-built chains
A `Record<string, string[]>` maps the three allowed sort keys to entity-column chains:

| client key | ORDER BY chain |
|---|---|
| `name` | `firstName, lastName, id` *(see Open Questions)* |
| `address` | `address, firstName, lastName, id` |
| `city` | `city, firstName, lastName, id` |

Direction applies to all named columns; `id` tiebreaker is always ASC. No `sort` param → the `name` asc chain (never unsorted, matching the UI). Unknown key/direction → 400 via validation pipe. The whitelist doubles as SQL-injection protection — sort input is never interpolated, only looked up. Alternative considered: accepting raw multi-column sort from the client (rejected: leaks schema, widens injection/validation surface, and the chain policy is a server concern).

### 3. Human collation + empty-values via SQL expressions
Each text column in the chain is wrapped as `lower(unaccent(coalesce(col, '')))` in `addOrderBy` (raw expression, built server-side from the whitelist — never from client input):
- `lower` + `unaccent` ⇒ case- and diacritic-insensitive (`Popescu` = `popescu` = `Pópescu`), per the functional spec's "sort like a human".
- `coalesce(col, '')` ⇒ NULL/empty sorts as empty string: first on asc, last on desc — the consciously-accepted business rule.

Requires a TypeORM migration: `CREATE EXTENSION IF NOT EXISTS unaccent`. Alternative considered: ICU nondeterministic collation (rejected: per-column DDL churn, equality semantics complicate LIKE elsewhere; `unaccent` is the same pattern already proven with pg_trgm in the owner-search work).

### 4. Single grouped projection query — aggregate pet names in SQL
The current list query left-joins pets→type→visits and hydrates full entity graphs; the screen shows none of type/visits and only pet *names*. We replace it with one projecting, aggregating query:

```sql
SELECT owner.id, owner.first_name, owner.last_name, owner.address, owner.city, owner.telephone,
       array_remove(array_agg(pet.name ORDER BY pet.name), NULL) AS pet_names
FROM owner
LEFT JOIN pet ON pet.owner_id = owner.id
WHERE owner.last_name LIKE :prefix ESCAPE '\'
GROUP BY owner.id
ORDER BY <collated chain>          -- Decision #3
LIMIT :size OFFSET :page*:size
```

After `GROUP BY` there is exactly **one row per owner**, so `LIMIT/OFFSET` paginate correctly at the SQL level — this single decision both eliminates over-fetch (no visits, no pet types, no full pet entities) **and** kills the in-memory-pagination problem in one move. `totalElements` is a plain `COUNT(*)` over owners matching the `lastName` filter (no join needed). Built with `createQueryBuilder().getRawMany()` + a small raw→DTO mapper; `array_agg` → `petNames: string[]`.

Alternatives considered: (a) two queries — page of owner ids, then load pets for those ids (rejected: extra round-trip, still over-fetches pet entities we don't need); (b) `leftJoinAndSelect` + `take/skip` relying on TypeORM id-deduplication (rejected: switches to in-memory pagination, the exact failure mode at 100k owners); (c) `string_agg(pet.name, ', ')` → a flat string (viable and matches the "comma between" request, but `string[]` keeps the separator a frontend concern and preserves the `<div *ngFor>` per-line markup).

### 5. Frontend: minimal Material on top of Bootstrap
`MatSortModule` (`matSort` + `matSortDisableClear` on `<thead>`, `mat-sort-header` on the three sortable `<th>` — arrow on active column, hover affordance on the rest, exactly the spec's indicator behavior) and `MatPaginatorModule` (`<mat-paginator>` with `showFirstLastButtons`; its default range label is already "11–20 of 53"). Keep the Bootstrap `table table-striped`; do not migrate to `<mat-table>` (visual churn, out of scope). `MatProgressSpinnerModule` for the overlay. Paginator wrapped in `*ngIf="totalElements > 5"` — threshold on the filtered total only, so it cannot flicker on page-size changes.

### 6. URL as the single source of truth, plus a session-scoped restore
The component never holds page/size/sort/search as primary state. Header clicks, paginator events, and search submits `router.navigate` with merged `queryParams`; a `queryParamMap` subscription is the only data-fetch trigger. Deep-linking and back/forward come free. Snap-to-page-1 = any navigation that changes sort/size/search also sets `page: 0`. Defaults (`page=0`, `size=10`, `sort=name,asc`) are omitted from the URL.

"State survives in-app navigation": a tiny session-scoped `OwnerListStateService` remembers the last query params; entering bare `/owners` with no params redirects (replaceUrl) to the remembered ones. In-memory only ⇒ a fresh visit naturally starts at the defaults, satisfying "no persistence across visits" without extra code.

### 7. Empty state
When `content` is empty, render one generic "No results" row/message — identical for empty clinic and fruitless search (accepted compromise: no guidance like "clear the filter"). Paginator is already hidden by the ≤5 threshold.

### 8. Testing strategy
- **Backend**: extend `test/owner.e2e-spec.ts` (Jest + SuperTest, the NestJS analogue of the issue's "WebMvcTest") — pin envelope shape, each sort key's full chain expansion, default chain, collation (case/diacritics), empty-values ordering, id-tiebreaker stability across duplicate names, 400s for bad params. Fixtures seed owners with duplicate/accented/missing values to make those tests meaningful. TDD: each behavior gets a failing test first.
- **E2E**: new Playwright spec in `petclinic-ui-test/tests/` using `OwnersPage` + `ApiClient`, covering sort toggle + default arrow, page navigation + counter, page-size change, paginator hide threshold, deep-link restore, back-button. CI-only — not in the pre-commit hook.
- No Karma specs (issue decision: brittle, not worth maintaining).

## Risks / Trade-offs

- [Breaking response shape] → all consumers are in-repo; updated in one change, guardrail CI (`api-types.ts` drift check) catches stragglers.
- [`lower(unaccent(...))` ORDER BY can't use plain b-tree indexes] → fine for this change (functional spec defers large-volume perf); follow-up option: expression indexes per sort column.
- [`array_agg` + `GROUP BY` on a wide owner table] → grouping is on `owner.id` (PK) with a single left join to `pet`; bounded and index-friendly. Far cheaper than hydrating pets+types+visits.
- [matSort on a non-mat-table] → supported (sort directive is table-agnostic), but header styling needs a small CSS shim to fit Bootstrap.
- [Empty-block-first on ascending may surprise demo viewers] → consciously accepted in the functional spec; not a bug.
- [Name-sort decision may flip after business review] → isolated to one whitelist entry + one header label; cheap to change (see Open Questions).

## Migration Plan

Single deploy — backend and frontend ship together from one repo. One DB migration (`CREATE EXTENSION IF NOT EXISTS unaccent`) runs via the existing migrate-on-start flow; it is additive and rollback-safe. Rollback = revert the commit (extension can stay, harmless).

## Open Questions

- **Name column order** (issue #25 comment 2026-06-02, pending business): currently `firstName lastName` display with `firstName, lastName, id` sort. If business prefers phonebook convention, switch display to "Last Name" and the chain to `lastName, firstName, id` — a two-line change (whitelist map + template).
