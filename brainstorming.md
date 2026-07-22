# Brainstorming — GH #25: Add pagination to Owners grid

> Design session transcript, condensed. Nothing is implemented yet — this document is the
> shared understanding to approve (or shoot at) before code is written.
>
> **Issue #25** asks for exactly two things:
> - the grid should be sortable by any column
> - the grid should be paginated in pages of 5, 10 or 20 rows

---

## 1. Starting state (verified, not assumed)

| Thing | Reality |
|---|---|
| `GET /api/owners` | Returns a bare `List<OwnerDto>`, filtered by `lastName` prefix. No paging, no sorting. |
| Owners grid | `owner-list.component.html` — hand-rolled Bootstrap `table.table-striped`, `*ngFor`, no sort, no paging. |
| `owner-page.ts` | An **orphan** `OwnerPage {content,totalElements,totalPages,number,size}` interface, referenced by nothing. A leftover from an abandoned attempt. |
| Issue comment by `ariazevedopt` | Claims this was implemented (server-side paging + MatTable, "130 tests pass"). **There is no such branch and no such PR in this repo.** Treated as noise. |
| Angular Material 16 | Already a dependency; only `MatSnackBar` + `MatSelect` are used anywhere. |
| `openspec/changes`, `openspec/specs` | Empty. That process is dormant → skipped. |

### What the live database actually contains

The local `petclinic-database/data` dir holds a **curated 28-owner fictional-character
dataset** (Sherlock Holmes, Harry Potter, Kevin McCallister…) which is **not** what the Flyway
seed produces (`V3__sample_data.sql` inserts 48 generic owners).
`./start-database.sh` does `rm -rf data` before booting — running it would have **destroyed that
dataset**. Postgres was instead started by invoking the launcher jar directly
(`java -jar petclinic-database/target/petclinic-database.jar`), which honours
`setCleanDataDirectory(false)`.

| Column | Cardinality (of 28) | Notes |
|---|---|---|
| `last_name` | 26 distinct | `Potter` ×2, `Darling` ×2 |
| `first_name` | 28 distinct | |
| `city` | 20 distinct | `London` ×6, `Hogsmeade` ×3 — heavily non-unique |
| `address` | 27 distinct | `14 Kensington Gardens` ×2 (both Darlings) |
| `telephone` | 27 distinct, **1 NULL** | text, leading zeros significant, length 10–13 (`0119084455` … `0442074860707`, `0032…` BE, `0039…` IT) |
| pets per owner | **0, 1 or 2** | 2 owners have zero pets |

**Production scale: ~10 000 owners** (confirmed with the business mid-session). The ~50-row seed
is not representative. This has been recorded in `CLAUDE.md` so it is never re-litigated.

---

## 2. Decisions

### D1 — Paging happens server-side ✅ *(decided)*

Spring Data `Pageable`. Client-side paging was rejected on the spot: at 10 000 owners, shipping
the whole table to the browser is not an option.

### D2 — Response envelope: explicit `OwnerPageDto` ✅ *(decided)*

```json
{ "content": [ {...OwnerDto} ], "totalElements": 10000, "totalPages": 1000, "number": 0, "size": 10 }
```

Rejected alternatives:
- **bare `Page<OwnerDto>`** — Boot 3.5 logs *"Serializing PageImpl instances as-is is not supported"*
  and the JSON contract is explicitly unstable.
- **`PagedModel<OwnerDto>`** — framework-sanctioned but nests metadata under `page` and gets an
  ugly generated schema name.
- **array + `X-Total-Count`** — `openapi-typescript` does not surface headers, so the frontend
  would read the total untyped.

Bonus: this shape is *exactly* the orphan `owner-page.ts`, which now gets wired up instead of deleted.

This is a **breaking change** to `GET /api/owners`. Accepted — the only non-test consumer is the
Angular grid.

### D3 — Sortable columns: **Name and City only** ✅ *(decided)*

Judged against real data, not the header row:

| Column | Verdict | Why |
|---|---|---|
| **Name** | ✅ sortable | 26/28 distinct last names; it is the only column anyone scans to find a person, and the existing `lastName` filter proves that access path. |
| **City** | ✅ sortable | 20 distinct with real clustering (`London` ×6). Sorting is the *only* way to group by city — there is no city filter. |
| Address | ❌ | Lexically sorts to `14 Kensington Gardens < 221B Baker Street < 26 Rue du Labrador < 27 Outer Circle` — house numbers as text, mixing streets and countries alongside `The Burrow` / `Malfoy Manor`. It *looks* unsorted. No user story. |
| Telephone | ❌ | Text with country prefixes; sorting groups by country code by accident. Plus a NULL needing a placement rule. No user story. |
| Pets | ❌ | Only 3 distinct values (0/1/2) — "sorting" clumps rows into 3 blobs. The cell renders pet *names* but would sort by *count*: users report that as broken. Also keeps the collection out of the paged query (see D7). |

So `sort` accepts exactly two keys: **`name`** and **`city`**. These are *UI-level* keys mapped
server-side to entity paths — the REST contract stays decoupled from the entity model, and the
whitelist is total by construction.

### D4 — `Name` sorts by `(last_name, first_name)`, and the cell renders **"Last, First"** ✅ *(decided)*

```
Name                City
--------------------------------
Baskerville, Henry  Dartmoor
Bond, James         London
Carraclough, Sam    Yorkshire
Darling, George     London
Darling, Wendy      London
```

Phone-book order, consistent with the *Last name* search box above the grid. Rendering
"Last, First" removes the dissonance of a column that sorts by a key the eye can't see.
Cost: a visible copy change, and the Playwright specs comparing cell text to API-derived
"First Last" names must be updated.

### D5 — Every sort carries `, id` as a tiebreaker 🔒 *(invariant, not a preference)*

`city` has `London` ×6. A non-total `ORDER BY` combined with `LIMIT/OFFSET` lets Postgres legally
return the same owner on page 1 **and** page 2 while dropping another entirely. At 10 000 rows this
is a guaranteed, intermittent, user-visible bug. Therefore:

- `sort=name` → `ORDER BY last_name, first_name, id`
- `sort=city` → `ORDER BY city, id`

A regression test pins this (see D13).

### D6 — Collation: pin **ICU** on the sort columns via a Flyway migration ✅ *(decided)*

The database is `datcollate = "C"` — **byte order**. Measured, on realistic surnames:

```
C collation:   Andrews < Darling < Macdonald < McCallister < Vance < Zephyr < de Vries < van Gogh < Ångström
lower() in C:  Andrews < Darling < de Vries < Macdonald < McCallister < van Gogh < Vance < Zephyr < Ångström
ICU en-US:     Andrews < Ångström < Darling < de Vries < Macdonald < McCallister < van Gogh < Vance < Zephyr
```

Only the last line is what a human calls alphabetical. Under `C`, every `van …` / `de …` / accented
surname is dumped at the **end** of an A–Z page. Additionally, **production's cluster collation is
unknown** — it may be `en_US.UTF-8`, which would make dev and prod sort *differently*. Pinning the
collation per column removes that variable.

```sql
-- V9__owner_grid_sorting.sql   (columns are TEXT, so no length juggling)
ALTER TABLE owners ALTER COLUMN last_name  TYPE TEXT COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE TEXT COLLATE "en-US-x-icu";
```

ICU is available in this Postgres 16 build (785 ICU collations present). Rejected: app-level
`lower()` ordering (fixes case only — `Ångström` still lands last, and every sortable column then
needs its own expression index) and doing nothing.

### D7 — Pets are batch-loaded, never joined into the paged query 🔸 *(recommendation)*

`Owner.pets` is a `LAZY` `Set` with **no `@BatchSize`** — today's unpaged list endpoint is an
**N+1 across all owners**. Two consequences:

- Paging *by itself* shrinks that N+1 to ≤20 queries.
- Adding `@BatchSize(size = 20)` to `Owner.pets` collapses it to **2 queries** (page + batched pets),
  with page order preserved by Hibernate — no manual re-ordering code.

A `LEFT JOIN FETCH pets` + `Pageable` is explicitly **not** used: Hibernate would fall back to
in-memory pagination (`HHH000104`), i.e. load all 10 000 owners to serve 10 rows.

### D8 — Page size: default 10, allowed 5/10/20, hard-capped at 20 🔸 *(recommendation)*

Configured through the framework rather than hand-rolled:

```properties
spring.data.web.pageable.default-page-size=10
spring.data.web.pageable.max-page-size=20
```

The cap matters: without it, `?size=1000000` re-opens exactly the full-table load that D1 exists to
prevent. Spring clamps silently, and the response envelope reports the effective `size`, so the
client is never lied to.

### D9 — Default sort when the client sends none: `name,asc` 🔸 *(recommendation)*

`ORDER BY last_name, first_name, id`. A deterministic default is required anyway by D5 — an
unordered `LIMIT/OFFSET` is unstable even on the first page.

### D10 — Unknown sort key ⇒ **400**, not 500, not silently ignored 🔸 *(recommendation)*

Left alone, Spring Data resolves `sort=telephone` against the entity and throws
`PropertyReferenceException` → 500. Worse, `sort=pets.visits.description` would silently emit joins.
The whitelist (`name`, `city`) maps to `Sort` explicitly; anything else returns
`400 Bad Request` naming the accepted keys.

### D11 — The `lastName` filter stays exactly as it is 🔸 *(recommendation)*

Still `?lastName=Dav` prefix matching, now composable with `page`/`size`/`sort`. Changing the page
size or sort **preserves** the filter; changing the filter **resets to page 0** (frontend concern).

Known adjacent wart, deliberately *not* fixed here: the filter is **case-sensitive**
(`?lastName=dav` matches nothing). Out of scope for #25 — worth its own issue.

### D12 — Indexes: add the two sort indexes, defer the prefix index 🔸 *(recommendation)*

`owners` currently has **only** `owners_pkey`. Measured on a throwaway 10 000-row ICU-collated copy
(schema created, measured, and dropped — verified 0 tables remain):

| Query | No index | `(last_name, first_name, id)` | `+ varchar_pattern_ops` |
|---|---|---|---|
| deep page, `OFFSET 5000` | **7.6 ms** — seq scan 10k + quicksort, **1.6 MB sort buffer per request** | **1.1 ms** — index scan, no sort | — |
| `LIKE 'Darling%'` (1 000 matches) | 0.79 ms | 0.31 ms | — |
| `LIKE 'Zzz%'` (no match) | 0.86 ms — seq scan 10k | 0.86 ms — seq scan 10k | **0.23 ms** — `Index Cond` |

So:

```sql
CREATE INDEX owners_last_first_id_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_id_idx       ON owners (city, id);
```

Rationale: the win is not the 6 ms — it is eliminating a **1.6 MB sort allocation on every page
request**, which grows with the table and multiplies with concurrency.

**Trap worth documenting in the migration:** pinning a non-`C` collation (D6) means a plain btree
**cannot** serve `LIKE 'Dav%'`. Verified in the plan — the prefix is applied as a `Filter`, not an
`Index Cond`. Fixing that needs a separate `varchar_pattern_ops` index. Deferred: at 10 000 rows the
seq-scan prefix filter is under 1 ms, and it's a one-line addition when search becomes hot.

### D13 — Tests (TDD, per CLAUDE.md) 🔸 *(recommendation)*

Written before the implementation:

- **Backend REST** — envelope shape; default size 10; `size=5/20`; `size=99` clamps to 20;
  `sort=name,desc`; `sort=city,asc`; `sort=telephone` → 400; filter + sort + page composed.
- **Pagination stability** — the load-bearing one: seed several owners in the same city, page through
  the whole set sorted by `city`, assert the union of pages equals the full set with **no duplicates
  and no omissions**. This is the test that would catch a missing `, id` tiebreaker (D5).
- **Collation** — insert `van Gogh`, `Ångström`, `Zephyr`; assert ICU order. Fails today under `C`.
- **Cucumber** (`owners.feature`) — 2 human-readable scenarios: page through owners; sort by city.
  The existing *"the response JSON array has size 2"* step must move to `content`.
- **Frontend** — `owner-list.component.spec.ts` (sort/page events → service calls, URL sync),
  `owner.service.spec.ts` (new signature/envelope).
- **Playwright** — `OwnersPage` selectors, default page shows 10 of N, navigate to page 2, sort by city.
  `owners.spec.ts`'s *"shows all owners on initial load"* is now false by construction and must
  become *"shows the first page of owners"*.
- **Existing tests that break and must be updated**: `OwnerTest`, `OwnerSteps`,
  `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`.

### D14 — Frontend: Material MatTable + MatSort + MatPaginator, **restyled to Bootstrap** 🔸 *(recommendation)*

Material is already a dependency and gives the 5/10/20 selector, sort arrows, and accessible
semantics for free — hand-rolling those is more code and worse a11y. But per the `frontend-ux`
skill, the framework defaults must **not** ship: the grid has to be indistinguishable from the
Vets screen next door.

- Replicate Bootstrap's header treatment, zebra striping on odd rows, and cell borders via
  `.mat-mdc-header-cell` / `.mat-mdc-cell` / `tr.mat-mdc-row:nth-child(odd)`.
- Reuse `.btn-default` for *Add Owner* / *Find Owner*; `white-space: nowrap` on buttons and labels.
- **`table-layout: fixed` + an explicit width per column** (`.mat-column-*`) — mandatory for a
  sortable table, otherwise every sort click re-measures content and the column boundaries jump.

### D15 — List state lives in the URL 🔸 *(recommendation)*

`/owners?page=2&size=10&sort=city,asc&lastName=Dav` is the single source of truth. Every sort/page/
filter action navigates with merged query params instead of mutating component state, so
back/forward, refresh and deep links all work. This is the `frontend-ux` skill's standing advice and
it costs almost nothing at build time — retrofitting it later costs a rewrite.

### D16 — `GET /api/owners/count` stays 🔸 *(recommendation)*

It looks redundant next to `totalElements`, but it is `permitAll()` and the **welcome screen**
(`welcome.component.ts`) calls it *unauthenticated*. `totalElements` sits behind `OWNER_ADMIN`.
Leave it alone.

---

## 3. Blast radius / artifacts to regenerate

| Artifact | Why | Gate |
|---|---|---|
| `openapi.yaml` | Response shape + new query params | `OpenApiExtractorTest` drift check · **CODEOWNERS elders** |
| `petclinic-frontend/src/app/generated/api-types.ts` | `npm run generate:api` | pre-commit + CI auto-stage |
| `db/migration/V9__owner_grid_sorting.sql` | New migration | **CODEOWNERS elders** |
| `petclinic-backend/DB.sql` | `DbSchemaExtractorTest` | drift check · **CODEOWNERS elders** |
| `docs/generated/DB.puml` | pre-commit generator; pre-push + CI guard | **CODEOWNERS elders** |
| `user-manual/manual.md` + `screenshots/owners-list.png` | Line 46 currently reads *"The list shows **every** registered owner"* — false after this change | manual |
| Spectral lint | New params/schema must pass `.spectral.yaml` | pre-push + CI |

Nothing touches `JpaMatchesDBSchemaTest`'s expectations (collation is not part of Hibernate's
validation), and `PackagesArchTest` / `C3ArchTest` are unaffected — no new package, no new component.

---

## 4. Process

- **Work in a git worktree.** Two other Claude Code sessions (PIDs 20926, 65614) are live in this
  folder; the session-start hook flagged concurrent-edit risk.
- **Branch** `feat/25-owners-grid-pagination` off `main`; PR references #25.
- **Commits**: normal, concise. *Not* didactic — that mode is explicitly opt-in via the keyword.
- **Postgres**: I started it from the jar (PID in the background task). It is still running on
  :5432 with the curated dataset intact. Stop it with Ctrl-C in that task, or leave it up.

### Already applied this session

`CLAUDE.md` gained two durable memory entries, both at your instruction:
1. **Production scale ~10 000 owners** — list endpoints page/sort/filter server-side; don't ask
   whether client-side paging suffices.
2. **"Go look at the data"** — query the real DB before reasoning about volumes, cardinality, sort or
   index choices; ask for access rather than assume.

---

## 5. Findings outside #25's scope (flagged, not fixed)

1. **`Owner.telephone` validation contradicts the data.** The entity declares
   `@Pattern("^[0-9]{10}$")` (exactly 10 digits) and `@NotEmpty`, but the live DB holds 13-digit
   international numbers (`0442074860707`) and **one NULL** (`V5__clear_demo_owner_phone.sql` cleared
   it deliberately). Any `PUT` on such an owner fails validation today. Deserves its own issue.
2. **The `lastName` filter is case-sensitive** (D11).
3. **`owner-page.ts` was dead code** — now redeemed by D2 rather than deleted.
4. **The `ariazevedopt` comment on #25 is unsubstantiated** — no branch, no PR, no code. Someone may
   want to reply on the issue.

---

## 6. Open questions for you

- Is the **"Last, First"** rendering (D4) acceptable in the user manual and any screenshots/training
  material that show the owners grid?
- Should the **Vets grid** get the same treatment in a follow-up, or stay a plain Bootstrap table?
  (#25 says Owners only; consistency argues otherwise once this ships.)
- Do you want the `varchar_pattern_ops` prefix index (D12) in **this** PR after all, since the
  migration is already going through elders review?
