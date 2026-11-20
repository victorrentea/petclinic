# #25 Paginate the Owners grid — Q&A

Issue: *"The grid should be sortable by any column, should be paginated in pages of 5, 10, or 20 rows."*
Volume: ~100,000 owners by late 2027 (see AGENTS.md).

✅ = decided by Victor · 💡 = recommended, to confirm with the Three Amigos

| # | Question | Answer | Why | |
|---|---|---|---|---|
| 1 | Page and sort on the server or in the browser? | **Server.** | 100k owners with their pets in one response is the problem; paging in the browser only hides it. | ✅ |
| 2 | Which columns are sortable? | **Name and City only.** Address, Telephone and Pets stay plain. | Address is free text that starts with a house number; phones mix `+44…`, `(0044)…`, `0044…`; Pets is a list. Sorting any of them orders nothing a user cares about. | ✅ |
| 3 | What does each sort order by? | Name: `last_name, first_name, id`. City: `city, last_name, first_name, id`. Default: Name A→Z. | Seed data has ties (2 Potters, 2 Darlings, 4 Londoners). Without a unique last key an owner can appear on two pages, or on none. | 💡 |
| 4 | How do accented names sort? | Accent-aware: `COLLATE "und-x-icu"` on `last_name`, `first_name`, `city`, set in a new versioned migration. | The DB is `C.UTF-8` (byte order): today Śliwiński sorts after Wensleydale, and Mureșan, Łukasz, Ștefan land out of place. | 💡 |
| 5 | Which indexes? | `(last_name, first_name, id)`, `(city, last_name, first_name, id)`, plus `last_name text_pattern_ops` for the `lastName` prefix search. | `owners` has only its PK today. Under an ICU collation, `LIKE 'x%'` can't use the normal index, so the prefix search needs its own. | 💡 |
| 6 | Same endpoint or a new one? | Same `GET /api/owners`, new params `page` (0-based), `size`, `sort`, combined with the existing `lastName`. | One way to list owners. The callers are only the frontend `OwnerService` and our own tests (`OwnerTest`, `owners.feature`, `OwnerSteps`, auth/perf tests), all changed in the same PR. | 💡 |
| 7 | Response shape? | Own DTO `OwnerPageDto { content: OwnerDto[], page, size, totalElements }`, not Spring's `Page` JSON. | Spring warns that serializing `PageImpl` is unstable; a hand-written DTO fits the project's rule and keeps `openapi.yaml` explicit. Breaking change, acceptable: the only consumer moves with it. | 💡 |
| 8 | Format of `sort`? | Whitelisted: `sort=name,asc` / `name,desc` / `city,asc` / `city,desc`. Anything else → 400. | Never pass a client string through to `ORDER BY`. The tie-breakers in #3 are added server-side. | 💡 |
| 9 | Which page sizes? | Only 5, 10, 20; default **10**; any other `size` → 400. | Exactly what the issue says, and it caps the payload at 20 owners. | 💡 |
| 10 | Offset or keyset (cursor) paging? | **Offset** (`LIMIT/OFFSET`). | The paginator needs "page N of M" and a jump to any page. At 100k rows, a deep offset over an index takes milliseconds; keyset pays off only at millions. | 💡 |
| 11 | Exact total count? | Yes, `COUNT(*)` with the same `lastName` filter. | ~100k rows is cheap to count, and the paginator shows "x of N". Revisit at millions. | 💡 |
| 12 | How are the Pets column's names loaded? | Page of owners first, then their pets in **one** `WHERE owner_id IN (…)` query (or `@BatchSize`). No `JOIN FETCH` with paging. | `JOIN FETCH` + paging makes Hibernate page in memory over all rows (HHH90003004). Lazy loading = 1 query per owner. `pets_owner_id_idx` already exists. | 💡 |
| 13 | What resets to page 1? | A new search and a sort change. Changing the page size keeps the first visible owner on screen. | Otherwise "page 7" of a different result is shown, often empty. | 💡 |
| 14 | Where is the grid's state kept? | In the URL: `/owners?lastName=Pot&page=2&size=10&sort=city,asc`. | Back button, refresh and a shared link return to the same page. | 💡 |
| 15 | Which UI widgets? | Angular Material `mat-table` + `MatSort` (Name, City headers) + `MatPaginator` with `pageSizeOptions=[5,10,20]`. | Material is already used (datepickers, `mat-select`). Moving it into `design-system/` can wait until a second grid needs it. | 💡 |
| 16 | Empty result? | "No owners with last name starting with …" when `totalElements == 0`, paginator hidden. | The current `*ngIf="!owners"` never fires: an empty array is truthy. | 💡 |
| 17 | How is it tested? | Backend: MockMvc on sort, ties across pages, Śliwiński after Scamander, bad `sort`/`size` → 400. Frontend: Playwright on paginator + sort + URL. Volume: one manual `EXPLAIN ANALYZE` on 100k generated owners, attached to the PR, not in CI. | Proves the order, the stability and that the indexes are actually used, without a 100k-row CI fixture. | 💡 |
| 18 | Out of scope? | Searching by city or phone, normalizing phone numbers, sorting by pet count, case-insensitive search. | Each is its own issue; phone normalization especially is a data cleanup, not a grid feature. | 💡 |
