# Q&A — gh #25 "Add pagination to Owners grid"

Issue: the grid should be sortable by any column, and paginated in pages of 5, 10 or 20 rows.

Context that drove the answers:
- **~50,000 owners within a year** (business forecast), so nothing may load every owner.
- The only caller of `GET /api/owners` is our Angular app. The chatbot and Claude Code reach
  the backend over `/mcp`, which looks owners up by id only (see `Deployment.drawio.png`).
- Dev data (41 owners): names with diacritics (`Śliwiński`, `Mureșan`, `Martín García Lorca`),
  4 telephone formats, free-form addresses, 15 identical Kevin McCallisters (ids 27–41).
  The DB collation is `C.UTF-8`, so `Śliwiński` sorts after `Wensleydale`.

**Status:** ✅ decided by Victor · 💡 recommended, still open

| # | Question | Answer | Status |
|---|---|---|---|
| 1 | Page and sort on the server or in the browser? | Server: Spring Data `Pageable`, in the database. | ✅ |
| 2 | Change `GET /api/owners` in place, or add a separate paged endpoint? | In place: `lastName`, `page`, `size`, `sort` → a page object. No unpaged variant left behind. | ✅ |
| 3 | Which columns are sortable? | **Name** (`lastName, firstName, id`) and **City** (`city, id`). Not Address (free-form; the same street lands in two places), not Telephone (4 formats; a real fix is E.164, a separate issue), not Pets (a list per owner). `id` is always the final tie-breaker, so pages are stable across equal rows. | ✅ |
| 4 | How does text sort the way people expect? | Flyway migration: `COLLATE "und-x-icu"` on `last_name`, `first_name`, `city`, plus indexes `(last_name, first_name, id)` and `(city, id)`. Not `COLLATE` in the query, which those indexes can't serve. A test proves the embedded (Zonky) Postgres has ICU. | ✅ |
| 5 | Where is the grid's state kept? | In the URL: `/owners?lastName=Pot&page=2&size=10&sort=city,desc`. Back from an owner's details returns to the same page, and links can be shared or reloaded. `page` counts from 1 in the URL; the service converts it to Spring's 0-based page. | 💡 |
| 6 | Defaults and allowed sizes? | `size=10`, sorted by Name ascending. The server accepts only 5, 10 or 20 and answers 400 otherwise, so `?size=50000` can't load everything. | 💡 |
| 7 | What do the sort parameters look like? | `sort=name,asc` / `sort=city,desc`. The server maps those keys to columns itself (`name` → `lastName, firstName`) and appends `id`. Any other key → 400, so a client can't trigger arbitrary joins. | 💡 |
| 8 | Response shape? | A hand-written `OwnerPageDto {content, totalElements, totalPages, number, size}` (house style: hand-written DTOs; it already matches `owner-page.ts`). Not Spring's `PageImpl` serialized as-is. | 💡 |
| 9 | `Page` (with a count) or `Slice` (without)? | `Page`: the paginator shows the total. `count(*)` over 50,000 rows with the same filter is cheap. | 💡 |
| 10 | Pets in each row: an N+1 risk? | Yes, a page of 20 owners means 21 queries. Use `@BatchSize(size = 20)` on `Owner.pets` (2 queries per page). Never `JOIN FETCH` with pagination: Hibernate then pages in memory (HHH90003004). | 💡 |
| 11 | A page past the end (stale link, or rows deleted meanwhile)? | Land on the last page: the frontend gets an empty page with `totalPages > 0`, asks again for the last page, and replaces the URL. Zero results show the "No owners…" message and no paginator. | 💡 |
| 12 | Search and paging together? | Search stays submit-only (the Find button). A new search or sort goes back to page 1; changing the page size also goes back to page 1. | 💡 |
| 13 | Search semantics (today: case-sensitive prefix)? | Out of #25's scope; keep it as-is. File a separate issue for case- and accent-insensitive search (`pot` → Potter, `Sliwinski` → Śliwiński). At 50,000 owners it will be the next complaint. | 💡 |
| 14 | UI widgets? | Angular Material `mat-paginator` (`pageSizeOptions` 5/10/20) and `matSort` on the Name and City headers only. Move them into `design-system/` only when a second grid needs them. | 💡 |
| 15 | Tests? | Backend: collation (Śliwiński between Silver and Tremaine), the tie-breaker on identical rows, size and sort-key validation (400), batch-fetched pets (query count). Cucumber/Playwright: next page, size 20, sort by City and reverse, back from details returns to the same page, a link past the end lands on the last page. One test with about 50,000 generated owners checks via `EXPLAIN` that the Name sort uses its index. | 💡 |
| 16 | Data volume for the demo? | Keep the "Default" seed small; add a second dataset location (`R__seed.sql` generating ~50,000 owners with `generate_series`) to show paging at scale. | 💡 |
| 17 | The 15 duplicate Kevin McCallisters in the dev DB? | Leftovers from a test that writes to the dev database. Separate issue: find that test and isolate it. Don't clean them up by hand (`./start-database.sh` wipes the DB anyway). | 💡 |
| 18 | Contract artefacts? | Regenerate `openapi.yaml` (`OpenApiExtractorTest`) and `api-types.ts`; the MCP and the chatbot need no change. | 💡 |
