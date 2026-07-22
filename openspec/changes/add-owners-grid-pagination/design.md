## Context

`GET /api/owners` today returns a bare `List<OwnerDto>` filtered by `lastName` prefix — no paging, no
sorting — and `owner-list.component.html` renders it as a hand-rolled Bootstrap `table.table-striped`
with `*ngFor`. Production holds **~10 000 owners**; the ~50-row Flyway seed is not representative.

Verified state (measured, not assumed):

| Thing | Reality |
|---|---|
| `Owner.pets` | `LAZY` `Set`, **no `@BatchSize`** → today's unpaged endpoint is an N+1 across all owners |
| `owners` indexes | **only** `owners_pkey` |
| DB collation | `datcollate = "C"` (byte order); ICU is available in this Postgres 16 build |
| `owner-page.ts` | An orphan `OwnerPage {content,totalElements,totalPages,number,size}` interface, referenced by nothing |
| Angular Material 16 | Already a dependency; only `MatSnackBar` + `MatSelect` used so far |
| Live dev dataset | 28 curated owners — `city`: 20 distinct with `London` ×6; `telephone`: 1 NULL, 10–13 chars; pets per owner: 0, 1 or 2 |

Constraint from `CLAUDE.md`: list endpoints page, sort and filter **server-side**; client-side paging
is not on the table.

## Goals / Non-Goals

**Goals:**
- Server-side pagination of `GET /api/owners` with a stable, typed response envelope
- Sorting by the two columns that have a real user story, with a closed whitelist
- Ordering that is *correct*: total (no dup/drop across pages) and human-alphabetical
- A page served in a bounded number of queries, with no full-table load anywhere in the path
- A grid that gains sort/paginator affordances without looking like a different application

**Non-Goals:**
- Sorting by address, telephone or pet count
- Fixing the `lastName` filter's case-sensitivity (own issue)
- Fixing `Owner.telephone`'s `@Pattern("^[0-9]{10}$")` vs. the 13-digit/NULL data in the DB (own issue)
- Applying the same treatment to the Vets grid (follow-up)
- A prefix (`varchar_pattern_ops`) index for `LIKE 'Dav%'` — deferred, see Risks

## Decisions

### D1 — Server-side paging with Spring Data `Pageable`

At 10 000 owners, shipping the table to the browser is not an option. `Pageable` gives us
`LIMIT/OFFSET` + `count(*)` for free, and Spring's argument resolver already parses `page`/`size`/`sort`.

### D2 — Explicit `OwnerPageDto` envelope

```json
{ "content": [ {"...OwnerDto"} ], "totalElements": 10000, "totalPages": 1000, "number": 0, "size": 10 }
```

Alternatives rejected:
- **bare `Page<OwnerDto>`** — Boot 3.5 logs *"Serializing PageImpl instances as-is is not supported"*;
  the JSON contract is explicitly declared unstable.
- **`PagedModel<OwnerDto>`** — framework-sanctioned but nests metadata under `page` and produces an ugly
  generated schema name in `openapi.yaml`.
- **array + `X-Total-Count` header** — `openapi-typescript` does not surface headers, so the frontend
  would read the total untyped.

Bonus: this shape is *exactly* the orphan `owner-page.ts`, which gets wired up instead of deleted.

This is a **breaking change** to `GET /api/owners`; the only non-test consumer is the Angular grid.

### D3 — Sortable columns: Name and City only

Judged against the real data, not the header row:

| Column | Verdict | Why |
|---|---|---|
| **Name** | ✅ | 26/28 distinct last names; the only column anyone scans to find a person — the existing `lastName` filter proves that access path |
| **City** | ✅ | 20 distinct with real clustering (`London` ×6); sorting is the *only* way to group by city (no city filter exists) |
| Address | ❌ | Lexically: `14 Kensington Gardens < 221B Baker Street < 26 Rue du Labrador` — house numbers as text, mixed streets and countries alongside `The Burrow`. It *looks* unsorted. No user story. |
| Telephone | ❌ | Text with country prefixes → sorting groups by country code by accident; plus a NULL needing a placement rule. No user story. |
| Pets | ❌ | 3 distinct values (0/1/2) — sorting clumps rows into 3 blobs; the cell renders pet *names* but would sort by *count*, which users report as broken. Also keeps the collection out of the paged query (D7). |

`sort` therefore accepts exactly `name` and `city`. These are **UI-level keys mapped server-side** to
entity paths: the REST contract stays decoupled from the entity model, and the whitelist is total by
construction.

### D4 — `Name` sorts by `(last_name, first_name)` and the cell renders "Last, First"

```
Name                City
--------------------------------
Baskerville, Henry  Dartmoor
Bond, James         London
Darling, George     London
Darling, Wendy      London
```

Phone-book order, consistent with the *Last name* search box above the grid. Rendering "Last, First"
removes the dissonance of a column that sorts by a key the eye can't see. Cost: a visible copy change,
and the Playwright specs comparing cell text to API-derived "First Last" names must be updated.

### D5 — Every sort carries `, id` as a tiebreaker *(invariant, not a preference)*

`city` has `London` ×6 today and will have hundreds in production. A non-total `ORDER BY` combined with
`LIMIT/OFFSET` lets Postgres legally return the same owner on page 1 **and** page 2 while dropping
another entirely — a guaranteed, intermittent, user-visible bug.

- `sort=name` → `ORDER BY last_name, first_name, id`
- `sort=city` → `ORDER BY city, id`

Pinned by the pagination-stability regression test (D13).

### D6 — Pin ICU collation on the sort columns via Flyway

The database is `datcollate = "C"` — byte order. Measured on realistic surnames:

```
C collation:   Andrews < Darling < Macdonald < McCallister < Vance < Zephyr < de Vries < van Gogh < Ångström
lower() in C:  Andrews < Darling < de Vries < Macdonald < McCallister < van Gogh < Vance < Zephyr < Ångström
ICU en-US:     Andrews < Ångström < Darling < de Vries < Macdonald < McCallister < van Gogh < Vance < Zephyr
```

Only the last line is what a human calls alphabetical. Under `C`, every `van …` / `de …` / accented
surname is dumped at the **end** of an A–Z page. Additionally **production's cluster collation is
unknown** — it may be `en_US.UTF-8`, making dev and prod sort differently. Pinning per column removes
that variable.

```sql
-- V9__owner_grid_sorting.sql   (columns are TEXT, so no length juggling)
ALTER TABLE owners ALTER COLUMN last_name  TYPE TEXT COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE TEXT COLLATE "en-US-x-icu";
```

Rejected: app-level `lower()` ordering (fixes case only — `Ångström` still lands last, and every
sortable column then needs its own expression index), and doing nothing.

### D7 — Pets are batch-loaded, never joined into the paged query

Paging by itself shrinks today's N+1 to ≤20 queries. Adding `@BatchSize(size = 20)` to `Owner.pets`
collapses it to **2 queries** (page + batched pets), with page order preserved by Hibernate — no manual
re-ordering code.

`LEFT JOIN FETCH pets` + `Pageable` is explicitly **not** used: Hibernate falls back to in-memory
pagination (`HHH000104`), i.e. loads all 10 000 owners to serve 10 rows.

### D8 — Page size: default 10, allowed 5/10/20, hard cap 20

Configured through the framework rather than hand-rolled:

```properties
spring.data.web.pageable.default-page-size=10
spring.data.web.pageable.max-page-size=20
```

The cap matters: without it, `?size=1000000` re-opens exactly the full-table load D1 exists to prevent.
Spring clamps silently and the envelope reports the *effective* `size`, so the client is never lied to.

### D9 — Default sort `name,asc` when the client sends none

`ORDER BY last_name, first_name, id`. A deterministic default is required by D5 anyway — an unordered
`LIMIT/OFFSET` is unstable even on the first page.

### D10 — Unknown sort key ⇒ 400

Left alone, Spring Data resolves `sort=telephone` against the entity and throws
`PropertyReferenceException` → 500; worse, `sort=pets.visits.description` would silently emit joins.
The whitelist maps `name`/`city` to `Sort` explicitly; anything else returns `400` naming the accepted
keys.

### D11 — The `lastName` filter is untouched

Still `?lastName=Dav` prefix matching, now composable with `page`/`size`/`sort`. Changing size or sort
**preserves** the filter; changing the filter **resets to page 0** (frontend concern).

### D12 — Add the two sort indexes, defer the prefix index

`owners` currently has only `owners_pkey`. Measured on a throwaway 10 000-row ICU-collated copy
(created, measured, dropped — verified 0 tables remain):

| Query | No index | `(last_name, first_name, id)` | `+ varchar_pattern_ops` |
|---|---|---|---|
| deep page, `OFFSET 5000` | **7.6 ms** — seq scan 10k + quicksort, **1.6 MB sort buffer per request** | **1.1 ms** — index scan, no sort | — |
| `LIKE 'Darling%'` (1 000 matches) | 0.79 ms | 0.31 ms | — |
| `LIKE 'Zzz%'` (no match) | 0.86 ms — seq scan 10k | 0.86 ms — seq scan 10k | **0.23 ms** — `Index Cond` |

```sql
CREATE INDEX owners_last_first_id_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_id_idx       ON owners (city, id);
```

The win is not the 6 ms — it is eliminating a **1.6 MB sort allocation on every page request**, which
grows with the table and multiplies with concurrency.

### D13 — Tests first (TDD, per CLAUDE.md)

- **Backend REST** — envelope shape; default size 10; `size=5/20`; `size=99` clamps to 20;
  `sort=name,desc`; `sort=city,asc`; `sort=telephone` → 400; filter + sort + page composed.
- **Pagination stability** — the load-bearing one: seed several owners in the same city, page through
  the whole set sorted by `city`, assert the union of pages equals the full set with no duplicates and
  no omissions. This is the test that catches a missing `, id` tiebreaker (D5).
- **Collation** — insert `van Gogh`, `Ångström`, `Zephyr`; assert ICU order. Fails today under `C`.
- **Cucumber** (`owners.feature`) — 2 human-readable scenarios: page through owners; sort by city.
  The existing *"the response JSON array has size 2"* step must move to `content`.
- **Frontend** — `owner-list.component.spec.ts` (sort/page events → service calls, URL sync),
  `owner.service.spec.ts` (new signature/envelope).
- **Playwright** — `OwnersPage` selectors, default page shows 10 of N, navigate to page 2, sort by city.
  `owners.spec.ts`'s *"shows all owners on initial load"* is false by construction → *"shows the first
  page of owners"*.
- **Existing tests that break**: `OwnerTest`, `OwnerSteps`, `OwnerSearchThroughLatencyProxyTest`,
  `BasicAuthenticationConfigTest`.

### D14 — Frontend: MatTable + MatSort + MatPaginator, restyled to Bootstrap

Material is already a dependency and gives the 5/10/20 selector, sort arrows and accessible semantics
for free — hand-rolling those is more code and worse a11y. But per the `frontend-ux` skill, the
framework defaults must **not** ship: the grid has to be indistinguishable from the Vets screen.

- Replicate Bootstrap's header treatment, zebra striping on odd rows, and cell borders via
  `.mat-mdc-header-cell` / `.mat-mdc-cell` / `tr.mat-mdc-row:nth-child(odd)`.
- Reuse `.btn-default` for *Add Owner* / *Find Owner*; `white-space: nowrap` on buttons and labels.
- **`table-layout: fixed` + an explicit width per column** (`.mat-column-*`) — mandatory for a sortable
  table, otherwise every sort click re-measures content and column boundaries jump.

### D15 — List state lives in the URL

`/owners?page=2&size=10&sort=city,asc&lastName=Dav` is the single source of truth. Every sort/page/filter
action navigates with merged query params instead of mutating component state, so back/forward, refresh
and deep links all work. Costs almost nothing at build time; retrofitting later costs a rewrite.

### D16 — `GET /api/owners/count` stays

Looks redundant next to `totalElements`, but it is `permitAll()` and the **welcome screen**
(`welcome.component.ts`) calls it *unauthenticated*, while `totalElements` sits behind `OWNER_ADMIN`.

## Blast Radius

Everything the change touches beyond the code it directly implements. The **Gate** column is what
fails the build if the artifact is not regenerated.

### Code

| Area | Change |
|---|---|
| `OwnerController` / `OwnerService` / `OwnerRepository` | `Pageable` signature; sort whitelist → 400 |
| new `OwnerPageDto` | `content`, `totalElements`, `totalPages`, `number`, `size` |
| `Owner` entity | `@BatchSize(size = 20)` on `pets` |
| `application.properties` | `spring.data.web.pageable.default-page-size=10`, `max-page-size=20` |
| new `db/migration/V9__owner_grid_sorting.sql` | ICU collation + `owners_last_first_id_idx`, `owners_city_id_idx` |
| `owner-list.component.{ts,html,scss}` | MatTable/MatSort/MatPaginator, Bootstrap-styled, `table-layout: fixed` |
| `owner.service.ts`, `owner-page.ts` | New paged signature; the orphan interface finally gets wired up |
| `app.module` imports | `MatTableModule`, `MatSortModule`, `MatPaginatorModule` |

### Generated artifacts to regenerate

| Artifact | Why | Gate |
|---|---|---|
| `openapi.yaml` | Response shape + new query params | `OpenApiExtractorTest` drift check · **CODEOWNERS elders** |
| `petclinic-frontend/src/app/generated/api-types.ts` | `npm run generate:api` | pre-commit + CI auto-stage |
| `db/migration/V9__owner_grid_sorting.sql` | New migration | **CODEOWNERS elders** |
| `petclinic-backend/DB.sql` | `DbSchemaExtractorTest` | drift check · **CODEOWNERS elders** |
| `docs/generated/DB.puml` | pre-commit generator | pre-push + CI guard · **CODEOWNERS elders** |
| Spectral lint | New params/schema must pass `.spectral.yaml` | pre-push + CI |
| `user-manual/manual.md` + `screenshots/owners-list.png` | Line 46 reads *"The list shows **every** registered owner"* — false after this change | manual |

Unaffected: `JpaMatchesDBSchemaTest` (collation is not part of Hibernate's validation),
`PackagesArchTest` and `C3ArchTest` (no new package, no new component).

### Existing tests that break by construction

`OwnerTest` · `OwnerSteps` + `owners.feature` (the *"the response JSON array has size 2"* step moves
onto `content`) · `OwnerSearchThroughLatencyProxyTest` · `BasicAuthenticationConfigTest` ·
`owners.spec.ts` (*"shows all owners on initial load"*) · `OwnersPage` selectors.

## Risks / Trade-offs

- **Breaking API change** → the only non-test consumer is the Angular grid, updated in the same PR;
  `openapi.yaml` + generated `api-types.ts` regenerate together and are gated by drift checks.
- **Pinned non-`C` collation defeats plain-btree `LIKE 'Dav%'`** → verified in the plan: the prefix is
  applied as a `Filter`, not an `Index Cond`. Mitigation: at 10 000 rows the seq-scan prefix filter is
  under 1 ms; a `varchar_pattern_ops` index is a one-line addition when search becomes hot. The trap is
  documented in the migration itself.
- **`ALTER COLUMN … TYPE` rewrites the table and takes an `ACCESS EXCLUSIVE` lock** → acceptable at
  10 000 rows (sub-second); would need `CREATE INDEX CONCURRENTLY` + a different strategy at 10⁷.
- **ICU availability** → confirmed present in this Postgres 16 build (785 ICU collations). If a target
  cluster lacks ICU the migration fails loudly at deploy time rather than sorting wrongly.
- **"Last, First" is a visible copy change** → user manual and screenshots must be updated; Playwright
  assertions comparing cell text to API-derived "First Last" break by construction.
- **Material-in-a-Bootstrap-app drift** → mitigated by D14's explicit restyle plus a visual comparison
  against the Vets grid; without it the screen reads as a different application.
- **Two other Claude Code sessions are live in this folder** (PIDs 20926, 65614) → implement in a git
  worktree on `feat/25-owners-grid-pagination` to avoid concurrent-edit races.

## Migration Plan

1. Merge `V9__owner_grid_sorting.sql` (collation + 2 indexes). It is backward compatible: the old
   endpoint keeps working against the recollated columns.
2. Deploy backend + frontend **together** — the envelope change is breaking for the grid.
3. Regenerate and commit `openapi.yaml`, `api-types.ts`, `DB.sql`, `docs/generated/DB.puml`; all are
   drift-checked in CI and CODEOWNERS-gated.
4. Rollback: revert the application deploy. The migration can stay — collation and indexes are
   transparent to the old code. If it must be undone, `ALTER COLUMN … COLLATE "C"` + `DROP INDEX`.

## Open Questions

*For business* (restated in plain language at the end of `proposal.md`):

- Is the **"Last, First"** rendering (D4) acceptable in the user manual and any screenshots/training
  material showing the owners grid?
- Should the **Vets grid** get the same treatment in a follow-up, or stay a plain Bootstrap table?
  (#25 says Owners only; consistency argues otherwise once this ships.)

*Technical only* (not for the business review):

- Do you want the `varchar_pattern_ops` prefix index (D12) in **this** PR after all, since the migration
  is already going through elders review?
