# Q&A — Issue #25: Add pagination to the Owners grid

Design interview held before writing code. Every answer below is either **decided** (Victor
chose it) or **recommended** (my default, still open). Facts come from the running dev
database, the deployment diagram and the source — not from assumption; where a fact decided
an answer, it is quoted.

Issue text:
> - The grid should be sortable by any column
> - The grid should be paginated in pages of 5, 10, or 20 rows per page

## Where we start from

`GET /api/owners` returns a bare `List<OwnerDto>` from `findByLastNameStartingWith`, with no
`ORDER BY` and no limit. The grid is a hand-rolled Bootstrap `<table>` with `*ngFor` —
no Material table, sort or paginator anywhere in the app (`MatSnackBarModule` is the only
Material module imported). `owner-page.ts` already declares an unused `OwnerPage` interface
in the Spring `Page` shape: a leftover from an earlier attempt, dead since the rename commit
`72474ebe`.

---

## Decided

### Q1 — Does paging and sorting run in the database or in the browser? → **Server-side**

`GET /api/owners` takes `page` / `size` / `sort`, and Postgres does `ORDER BY … LIMIT …
OFFSET …`. The browser never holds the whole table.

**Why:** the owner table is aimed at ~100k rows within a year. Client-side paging over a
`MatTableDataSource` is one file and zero backend work, and it stops working long before
that.

### Q2 — Do we break the response shape, or add a second endpoint? → **Break it; always return a Page**

```
GET /api/owners?lastName=&page=0&size=10&sort=lastName,asc
{ "content": [ … ], "totalElements": 142, "totalPages": 15, "number": 0, "size": 10 }
```

**Why — this is the part that was actually checked.** `petclinic-backend/docs/Deployment.drawio.png`
is a real draw.io file whose mxGraph XML rides in the PNG's `mxGraphModel` tEXt chunk, so it
can be parsed programmatically (which is exactly what `DeploymentDiagramTest` does). Its
edges:

| edge | `traced` |
|---|---|
| Pet Owner → Frontend | `no` — "a human clicking is not a span" |
| Veterinarian → Frontend | `no` |
| **Frontend → Backend** (REST · HTTPS/JSON) | `yes` |
| Backend → Database (JPA · SQL) | `yes` |

**The Angular SPA is the only declared client of the backend**, and the test's third rule —
"no arrow between two traced containers is left undeclared" — means an undrawn client would
have had to be added deliberately. Cross-checked in code: `petclinic-chatbot` calls only
`/api/owners/{id}`, never the list; no MCP tool lists owners. Client and server ship from
this repo in the same deploy, so there is no window where an old client meets a new server.
Versioning the endpoint would be ceremony.

⚠️ Caveat that survives the check: the diagram shows the *intended* topology, and
`petclinic-chatbot` is a separate Maven module calling the backend over REST that **has no box
on it**. Either it is not considered deployed, or the diagram has drifted. Out of scope here,
worth a separate issue.

### Q3 — "Sortable by any column": which columns? → **Name and City only**

`Name ↕ | Address | City ↕ | Telephone | Pets`

Narrower than the issue asks, deliberately. The verdict came from scanning all 30 rows of the
dev `owners` table, not from taste:

| Column | Sort? | What the real data says |
|---|---|---|
| **Name** | ✅ | Two DB columns in one cell. `Potter` appears twice (Harry #2, Beatrix #15) and `Darling` twice (George #11, Wendy #19) — see Q5. |
| **City** | ✅ | 21 distinct over 30 rows, no nulls; the column a clinic user would actually sort by. London ×6. |
| **Address** | ❌ | Every value starts with a house number stored as `TEXT`. Ascending reads `110 Analytical…`, `14 Kensington…`, `221B Baker St`, `26 Rue…`, `27 Outer…`, `30 Wellington…`, `4 Privet Drive`, `62 West Wallaby`, `671 Lincoln`. Users read that as a bug, not a sort. |
| **Telephone** | ❌ | Mixed-length digit strings (`0032225112233` vs `6085551023`), so lexicographic ≠ numeric; plus one NULL (Kevin McCallister #1) that jumps top↔bottom as direction flips. Nobody browses owners in phone order. |
| **Pets** | ❌ | Counts are only **0, 1, 2** — max is 2. Sorting 30 rows into three buckets does nothing visible on a 5-row page. A `count(*)` subquery would buy literally no legible ordering. |

Two things the scan turned up that outlive this decision:

- **Collation is load-bearing.** `Śliwiński` (#4) sorts between `Silver` and `Tremaine` under
  the DB's `en_US.UTF-8`, but *after* `Tremaine` under `C`. Any sort assertion touching that
  row flips if the embedded Postgres used by tests initializes with a different collation.
- **Ascending name sort opens the grid on test garbage.** Rows #29/#30 are
  `Ada Acceptancentglkqjz` / `Ada Acceptancekeyzdqfu` — not in `R__seed.sql`, so they are
  leftovers from acceptance runs against the dev DB, and they sort *ahead of* `Baskerville`.
  Not this issue's bug, but it decides what a demo's first page looks like.

---

## Open — recommended answers

### Q4 — How do the last-name filter and paging combine?

**Recommended:** `lastName` stays a filter parameter beside `page`/`size`/`sort`; the
repository becomes `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`.
Changing the filter **resets to page 0**.

Without the reset, searching while on page 3 of 15 shows an empty grid for a filter that
matches plenty — the classic "the search is broken" report.

### Q5 — Sorting by a non-unique column over LIMIT/OFFSET is unstable. Tiebreaker?

**Recommended:** always append `id` as the final sort key, in the controller, not the caller:
`PageRequest.of(n, size, sort.and(Sort.by("id")))`.

This is not theoretical here. Sorting by `last_name` alone with two `Potter`s and two
`Darling`s lets Postgres return them in either order per query — so under `LIMIT/OFFSET` the
same owner can appear on two pages, or on none. City is worse: six Londons.

### Q6 — Default sort and default page size?

**Recommended:** `sort=lastName,asc` (+ the `id` tiebreak) and `size=10` — the middle of the
three offered sizes. 30 owners → 3 pages, enough to see paging work in a demo.

Today the endpoint has no `ORDER BY` at all, so the current order is whatever Postgres
returns; any explicit default is an improvement. Note Q3's caveat: ascending by name puts the
two `Ada Acceptance*` leftovers first.

### Q7 — A raw `Pageable` lets the client sort by any property. Constrain it?

**Recommended:** yes — an inner `enum OwnerSortField { NAME("lastName", "firstName"), CITY("city") }`
in the controller, mapping the two allowed keys to their real columns; anything else is a 400.

Spring will happily bind `sort=pets.name`, silently adding a join, or `sort=<typo>` and throw
a 500 from deep inside JPA. The enum makes Q3's decision enforceable on the server instead of
being a frontend convention, and it is where the `lastName, firstName` expansion belongs.

### Q8 — The Name column is `firstName + lastName` in one cell. What does its arrow sort by?

**Recommended:** `ORDER BY last_name, first_name, id`; header stays "Name".

Sorting by last name while displaying "Harry Potter" first-name-first is mildly surprising —
but it is what a clinic user means by sorting names, and the alternative (rendering
"Potter, Harry") changes the display, which the issue did not ask for.

### Q9 — Angular Material table/sort/paginator, or extend the Bootstrap table?

**Recommended:** keep the existing `<table class="table table-striped">`; add clickable `<th>`
with sort arrows and a small paginator strip by hand.

`MatSnackBarModule` is the *only* Material module in the app; the grid is Bootstrap 3. Pulling
in `MatTableModule` + `MatSortModule` + `MatPaginatorModule` means either restyling the grid to
Material or fighting two design languages in one table. See also Q10 — `MatPaginator` cannot
satisfy the house rule.

### Q10 — The rows-per-page control is a single-select. Which widget?

**Recommended:** `<app-combo [options]="[5,10,20]">` from
`petclinic-frontend/src/app/design-system/`.

AGENTS.md: "Every single-select in a form goes through `<app-combo>` … a raw `<select>` in a
form template is a bug, not a shortcut." `MatPaginator` embeds its own `mat-select` for page
size and offers no way to swap it — so the Material paginator is ruled out by the design
system, which is the strongest argument in Q9.

### Q11 — Does grid state live in the URL?

**Recommended:** yes — `?lastName=&page=&size=&sort=`, driven through the Router.

Deep-linkable, the back button works, and today's grid already loses its search box contents
when you open an owner and come back. The e2e suites also get to navigate straight to page 3
instead of clicking there.

### Q12 — `Owner.pets` is `LAZY` but always mapped into the DTO. Fix the N+1 here?

**Recommended:** yes, one annotation: `@BatchSize(size = 20)` on `Owner.pets`.

Today the list endpoint fires 1 + N queries **for the whole table**. Paging alone caps N at the
page size (≤21 queries), which is already a large improvement; `@BatchSize` takes it to 2.
`JOIN FETCH` is *not* an option — Hibernate cannot paginate a fetched collection in SQL and
silently falls back to loading everything and paging in memory (`HHH000104`), which is exactly
the bug this issue exists to avoid.

### Q13 — Indexes for the sort columns?

**Recommended:** a new versioned migration adding
`CREATE INDEX ON owners (last_name, first_name, id);` and `CREATE INDEX ON owners (city, id);`

Verified against the real schema, not from memory: `V1__core_owners_pets.sql` creates `owners`
with **no index but the primary key**, and `pg_indexes` confirms only `owners_pkey` exists.
Meanwhile `V2` indexes `vets (last_name)` — so the *vets* table is indexed for the search the
*owners* table performs unindexed today. Without these, every page request at 100k rows is a
full scan plus a sort, and `OFFSET` makes the last page the most expensive one.

Leading columns must match the `ORDER BY` collation (`en_US.UTF-8`) or the index will not be
used for ordering — the `Śliwiński` caveat again, this time as a performance bug.

New file under `db/migration/` (schema chain, never rows), not `db/seed/`.

### Q14 — What breaks, exactly?

The array shape is read in these places, all of which need updating with Q2:

*Backend tests* — `OwnerTest:131` (`search("/api/owners")`), `AddVisitApiTest:105`,
`VisitDateRangeApiTest:61` (`json(...).get(0).path("id")`), `OwnerSearchThroughLatencyProxyTest:55`.
`BasicAuthenticationConfigTest:37,44` asserts status only and should survive.

*Browser suites* — `add-visit.dsl.ts:16`, `owner-search.feature.glue.ts:33`,
`visit-date-range.dsl.ts:40`, `visit-date-range.feature.glue.ts:30` — each does
`axios.get(`${API_BASE}/owners`)` and treats the body as an array.

**The one that needs a decision, not a fix:** `owner-search.feature` asserts *"every owner in
the clinic is listed"* for an empty search. With 30 owners and a default size of 10 that is
false by construction.
**Recommended:** the step asks the API for `totalElements` and asserts the grid shows the
**first page** of them, with the scenario renamed to say so. Fetching every page to rebuild the
old assertion would be testing the test.

### Q15 — Generated artifacts to regenerate

**Recommended:** in the same commit as the controller change —
`openapi.yaml` via `OpenApiExtractorTest` (hand-editing is denied in `.claude/settings.json`),
then `npm run generate:api` in the frontend, which rewrites
`src/app/generated/api-types.ts`. The regenerated types make the orphan `owner-page.ts`
redundant — **delete it** rather than leaving two definitions of the same shape.

Also add the owners grid to `human-review.json` → `steps.dsaudit.screens` (it currently lists
only "Book a visit" and "Edit a pet"), so the design-system audit actually visits the screen
this issue changes.

### Q16 — TDD order

**Recommended**, per the house rule that non-trivial code starts with a failing test:

1. Repository slice: `findByLastNameStartingWith(lastName, Pageable)` returns the right page and
   `totalElements` — including the `Potter`/`Darling` stability case from Q5.
2. Controller: the sort-field whitelist (Q7) rejects `sort=address` and `sort=pets.name` with 400.
3. A collation-pinning assertion for `Śliwiński`, so a differently-initialized embedded Postgres
   fails loudly instead of reordering a page.
4. Only then the Angular grid, then update the browser suites of Q14.

---

## Deliberately out of scope

- Cleaning the `Ada Acceptance*` rows that acceptance runs leave in the dev DB.
- Adding the Chatbot container to `Deployment.drawio.png`.
- Sorting by pet count, unless the Pets column starts showing a number (Q3).
