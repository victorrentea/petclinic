# Q&A — GitHub issue #25, "Add pagination to Owners grid"

Design interview held on 2026-08-27, before writing any code. The issue's whole text was:

> - The grid should be sortable by any column
> - The grid should be paginated in pages of 5, 10, or 20 rows per page

Everything below is the reasoning that turns those two lines into a buildable design.
**Q1–Q6 were decided by Victor** (with business/FE input where noted); **Q7–Q15 are the
follow-up decisions, answered with the recommendation and left open to challenge.**

## Starting state (verified, not assumed)

| | |
|---|---|
| `GET /api/owners` | returns a plain `List<OwnerDto>`, filtered by `?lastName=` (prefix, case-sensitive) |
| row payload | `OwnerDto` nests `pets`, and each pet nests its `visits` — both **LAZY**, mapped outside any transaction → **N+1 twice over** (~60 queries for 20 rows) |
| grid | hand-written Bootstrap 3 `<table class="table table-striped">`; **no `MatTable` anywhere in the app** (Material is used only for datepickers, one `mat-select`, the snackbar) |
| DB | 28 owners seeded by Flyway; `owners` has **exactly one index — the PK**; collation `en_US.UTF-8` |
| leftovers | `owner-page.ts` (`OwnerPage` interface) exists, unused — an orphan from an earlier attempt; the issue also carries a comment from a third party claiming it was implemented (nothing of it is on this branch) |

## The decisive input

Business expects **10,000 — possibly 100,000 — owners within a year.** The seeded 28 rows
are demo data; nothing may be sized off them. This is now recorded in `CLAUDE.md`
(Domain Model → *Expected data volume*) so the next session doesn't re-derive it.

---

## Q1 — Where does the paging happen: server or client? → **server-side**

- (a) **Server-side** (`Pageable`): correct sorting across the whole dataset, small payload; but a breaking REST contract change.
- (b) Client-side: no contract change, but the browser downloads every owner with pets and visits.

**Decided: (a).** At 100k owners (b) is not paging, it's a memory leak with a page-size
`<select>` on top. It would also make the repo's sequence-diagram/observability material lie
about what the DB does.

## Q2 — What is a grid row, once paged? → **keep the full `OwnerDto`**

- (a) **Keep `OwnerDto` as-is** (pets + visits nested): contract diff is only the envelope; the N+1 stays.
- (b) Slim `OwnerRowDto` + one batched pets query: N+1 gone, bigger contract diff.
- (c) Slim + drop the Pets column: one single query, but the grid loses a column.

**Decided: (a), deliberately.** The N+1 behind open-session-in-view is the *subject* of this
repo's training material — the sequence diagrams exist to show exactly those ~60 queries.
Fixing it here would delete the lesson. **This is a knowingly accepted debt, not an oversight**:
at 100k owners a 20-row page still costs ~60 queries, and that is the first thing to revisit
if this ever stops being a demo.

## Q3 — What JSON shape wraps the page? → **raw `Page<OwnerDto>`**

- (a) **Return `Page` raw**: zero code; Boot 3.5 logs the "serializing PageImpl as-is is not supported" warning, and `openapi.yaml` inherits the `pageable`/`sort`/`unpaged` noise.
- (b) `spring.data.web.pageable.page-serialization-mode=VIA_DTO` → Spring's `PagedModel`.
- (c) Own `PageDto<T>` — exactly the orphan `OwnerPage` TS interface.

**Decided: (a).** Convenient bonus: the raw Page JSON does carry `content` /
`totalElements` / `totalPages` / `number` / `size`, so the existing `owner-page.ts`
interface fits it as-is and stops being dead code.

## Q4 — Which columns are sortable, and how is Name sorted? → **Name + City only; display becomes `Potter, Harry`**

Decided by looking at the **real 28 rows**, not at the issue's wording:

| column | what is actually in it | sortable? |
|---|---|---|
| **Name** | 28 distinct first names, 26 last (Potter ×2, Darling ×2) | **yes** — `last_name, first_name, id` |
| **Address** | `4 Privet Drive`, `221B Baker Street`, `27 Outer Circle` | **no** — house-number-first strings sort as garbage (`221B` before `27`) |
| **City** | 20 distinct / 28 rows; London ×6, Hogsmeade ×3 | **yes** — the one genuinely useful grouping |
| **Telephone** | 10–13 digits, leading zeros, **1 empty** (Kevin McCallister, id 1) | **no** — a text sort only groups by country prefix, and forces a NULLs-first/last call for one row |
| **Pets** | 0–2 per owner (James Bond and Poirot have none) | **no** — only meaningful as a count, i.e. an aggregate on the paged query |

So **"sortable by any column" is not honoured literally** — it was written without looking at
the values. Address, Telephone and Pets get no sort arrow.

**The Name trap:** the cell renders `firstName lastName` but the only sensible sort key is the
last name (also what the search box filters on). Sorted by `last_name`, the column would read
*Henry Baskerville, James Bond, Sam Carraclough, George Darling* — H, J, S, C — and look broken.
Sorting by first name instead would divorce the sort key from the search key.

**Decided:** business approved changing the **display** to `Potter, Harry`, so the sort key is
literally what the user sees. Sort order stays European — `last_name`, then `first_name`
(US-style first-name-first ordering is explicitly not wanted).

**The pagination trap:** City has **6 Londons**. `ORDER BY city` alone is non-deterministic
under `LIMIT/OFFSET`, so the same owner can appear on page 1 *and* page 2 while another is never
shown. **`id` is appended to every sort as tiebreaker**, unconditionally.

## Q5 — What builds the sort arrows and the pager? → **keep the Bootstrap table**

- (a) Material `MatTable` + `MatSort` + `MatPaginator`: free arrows and page-size dropdown, but a Material island in a Bootstrap 3 app, and it changes `#ownersTable` / `td.ownerFullName`.
- (b) **Bootstrap table kept**: clickable `<th>` with ▲/▼ + a small pager strip with a 5/10/20 `<select>`; ~40 lines, no new modules.

**Decided: (b)** (FE dev consulted). The e2e suite, the generated sequence diagrams and the
`user-manual/` screenshots are all anchored on the current DOM — (a) would force re-recording
all of them for a cosmetic gain.

## Q6 — Replace `GET /api/owners`, or add a second endpoint? → **replace**

- (a) **Replace**: `GET /api/owners?lastName=&page=&size=&sort=` returns a `Page`. All callers get fixed in this change.
- (b) Add `/api/owners/page` beside it: nothing breaks, but two shapes for the same rows — and the unpaged one is the loaded gun at 100k.
- (c) Same URL, shape switches on the presence of `page`: a contract neither OpenAPI nor a generated TS client can express honestly.

**Decided: (a).** Every caller is inside this repo (list below).

---

## Follow-up decisions (recommended answers, still open to challenge)

**Q7 — Page sizes and default.** Options **5 / 10 / 20** exactly as the issue says;
**default 10**, default sort `last_name, first_name, id` ascending. The size choice is not
persisted across sessions.

**Q8 — Where does grid state live?** In the **URL query params**
(`/owners?lastName=&page=&size=&sort=`), synced through the Angular `Router`. At 100k owners
the grid is ~10,000 pages deep; without this, clicking an owner and pressing Back drops the
user on page 1 — and a colleague can't be sent a link to what they're looking at.

**Q9 — Search × paging interaction.** Submitting a search **resets to page 0** and keeps the
current sort. If a response comes back empty with `number > 0` (a deep link to a page that
the filter shrank away), the grid re-requests page 0 rather than showing an empty table.

**Q10 — Sort key whitelist.** The client sends a logical key — `name` or `city` — and the
server maps it to `last_name, first_name, id` / `city, id`. An unknown key is rejected with a
`ResponseStatusException` 400 (per `petclinic-backend/CLAUDE.md`: a controller rejects
requests itself, it does not depend on `rest.error`). **A client-supplied `Sort` is never
passed to Spring Data raw** — that lets anyone sort by `pets.visits.description` and turn the
paged query into a cartesian join.

**Q11 — Indexes** (verified against the live schema: `owners` has only its PK).
A new Flyway migration adds:

```sql
CREATE INDEX ON owners (last_name, first_name, id);         -- default sort + filtered sort
CREATE INDEX ON owners (last_name text_pattern_ops);        -- the LIKE 'Pot%' prefix search
CREATE INDEX ON owners (city, id);                          -- city sort
```

`text_pattern_ops` is **not optional**: this database's collation is `en_US.UTF-8`, and under a
non-C collation a plain btree cannot serve a `LIKE 'prefix%'` predicate. (Note `vets_last_name_idx`
has the same latent problem — out of scope here.)

**Q12 — `Page` vs `Slice`.** Keep `Page`: the pager needs `totalElements` to render page
numbers. The cost is a `count(*)` per request — a full scan at 100k rows, tens of ms,
accepted. If it ever hurts, `Slice` (next/prev only) is the escape hatch.

**Q13 — `GET /api/owners/count` stays.** It is consumed by `welcome.component.ts`, not by
the grid; `totalElements` does not replace it.

**Q14 — Tests (TDD, failing test first).**
- Backend: page shape and default sort; **the tiebreaker test — walk every page and assert no owner is seen twice and none is missed** (the 6-Londons bug); rejection of an unknown sort key; `lastName` filter combined with paging.
- Frontend: `owner-list.component.spec.ts` for page/sort/size changes and the search-resets-to-page-0 rule.
- E2E: the scenario **"Searching with an empty last name lists every owner" no longer holds** — with 28 owners and size 10 the first page shows 10. It becomes "the first page lists the first 10 owners, and paging to the last page lists all 28". The `| Harry Potter |` data table and the `fullName` helper in `owner-search.glue.ts` flip to `Potter, Harry`.

**Q15 — Fallout to carry in the same change** (all of it inside this repo):

- callers of the list endpoint: `owner.service.ts`, `owner-search.glue.ts` (it asserts `Array.isArray(data)`), backend `owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`, `petclinic-test/scripts/record-bug40.js`, the `docker-compose.test.yml` healthcheck;
- regenerated guardrail artifacts: `openapi.yaml` (`OpenApiExtractorTest`), `api-types.ts` (`npm run generate:api`), `endpoint-complexity.*`, and — because of the new migration — `petclinic-backend/DB.sql` + `docs/generated/DB.puml`;
- `user-manual/` screenshot of the owners grid;
- security is unchanged: the endpoint keeps `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`;
- the MCP tools are unaffected — `PetClinicMcp` only uses `findByIdFetchingPets`.

## Known debts accepted here

1. **The N+1 stays** (Q2) — deliberate teaching material, and the single biggest reason this endpoint will not survive 100k owners.
2. **Raw `Page` serialization** (Q3) — carries a Boot warning and a noisy OpenAPI schema; revisit if the log noise or a Boot upgrade bites.
3. **"Any column" is not delivered** (Q4) — Address, Telephone and Pets are unsortable by design; the issue should be updated to say so.
