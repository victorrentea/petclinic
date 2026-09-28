# GH #25 — Paginated, sortable Owners grid: design Q&A

Issue: *sortable by any column; pages of 5, 10 or 20 rows.* Branch `blip26`.
✅ = decided by Victor · 💡 = Claude's recommendation, not yet reviewed.

## Decided

| # | Question | Answer |
|---|---|---|
| 1 ✅ | Where does it land? | `blip26`. `main` stays the unpaginated starting point of the exercise. |
| 2 ✅ | Sort by Pets? | No — a list has no natural order (0–2 pets per owner, 6 owners have none). |
| 3 ✅ | Name sorts by…? | As displayed: `first_name, last_name`. Display stays "Kevin McCallister" (Portugal: first name first). |
| 4 ✅ | New endpoint or same? | Same `GET /api/owners`, always paginated. A full-list endpoint is what ~100k owners rules out. |
| 5 ✅ | Response shape | Hand-written `OwnerPageDto { content: OwnerDto[], totalElements }` — not Spring's `Page` (unstable JSON, leaks `pageable`/`sort` into `openapi.yaml`). |
| 6 ✅ | Which columns sort, and how are they asked for? | Only **Name** and **City**, as opaque keys `sort=name\|city&dir=asc\|desc`. From the data: addresses start with house numbers (`"110" < "27"`), phones mix `0044…` with local numbers — their text order means nothing. |
| 7 ✅ | Initial state and page sizes | Name ascending, 10 rows. Any `size` other than 5/10/20 → 400, so no client pulls the whole table. |

## Recommended

| # | Question | Recommendation |
|---|---|---|
| 8 💡 | Tie-breakers | `name` → `first_name, last_name, id`; `city` → `city, first_name, last_name, id`. The trailing `id` keeps pages stable when values repeat (London × 8). |
| 9 💡 | Search box + paging | One request carries `lastName, sort, dir, page, size`. Changing the filter, the sort or the size goes back to page 1. Search semantics stay as today (last-name prefix). |
| 10 💡 | Indexes (new `V4__owner_grid_indexes.sql`) | `(first_name, last_name, id)`, `(city, first_name, last_name, id)`, and `last_name text_pattern_ops` — with the DB on `en_US.UTF-8`, a plain btree cannot serve `LIKE 'Mc%'`. |
| 11 💡 | ⚠️ The dev DB already ran a *different* V4 | `flyway_schema_history` holds `V4 owner list indexes` from branch `rabo26oct` (indexes leading with `last_name`). Our V4 will fail Flyway validation on boot. Reset the dev DB once with `./start-database.sh` (wipes runtime rows). |
| 12 💡 | Pets per row (lazy `Owner.pets`) | `@BatchSize(size = 20)` on `Owner.pets`: one extra query per page instead of one per owner. A `JOIN FETCH` of a collection with paging makes Hibernate page in memory (HHH90003004). |
| 13 💡 | Grid state in the URL | `?page=&size=&sort=&dir=&lastName=` — refresh, Back and a shared link keep the same page. |
| 14 💡 | Frontend widgets | `mat-paginator` (`[5, 10, 20]`) and `matSort` on the existing table, headers for Name and City only, `disableClear` (asc ↔ desc, no third "unsorted" click). The design system has no paginator yet; wrap one in when a second grid needs it. |
| 15 💡 | Page past the end (`page=99`) | 200 with empty `content` and the real `totalElements`; the paginator shows where the data ends. |
| 16 💡 | Bad `sort` / `dir` / `size` | 400 `ProblemDetail` through the existing `ExceptionControllerAdvice`. |
| 17 💡 | Acceptance test (required) | `petclinic-test/src/owners-grid.feature`, tagged `@generate_sequence`: sort by City, 5 per page, page 2 continues page 1's order. Assert **order and counts, never names** — suites run in parallel on one DB and other tests add owners. |
| 18 💡 | Callers of the old full list | `owner-search.feature` glue: "every owner" → `totalElements`. `add-visit.dsl.ts` and the `visit-date-range` glue: find the pet via `GET /api/pets` (it carries `ownerId`) instead of scanning all owners. Backend `owners.feature` and `OwnerSearchThroughLatencyProxyTest` read `$.content`. |
| 19 💡 | MCP / chatbot | Unaffected — they only use `findByIdFetchingPets`. |
| 20 💡 | The six "Ada Acceptance…" owners in the dev DB | Left behind by `add-owner.spec.ts`. Out of scope: a separate issue, since they will show up on the first page. |
| 21 💡 | `count(*)` on every page request | Keep it — milliseconds at 100k rows, and the paginator needs the total. |
