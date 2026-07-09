## Context

The Owners screen currently calls `GET /api/owners`, which runs `findByLastNameStartingWith` and maps **every** matching row to `OwnerDto` (with nested pets). In production the `owners` table holds ~1,000,000 rows, so this is unbounded in memory, latency, and payload. The grid is a static Bootstrap 3 table with no sort or paging. The dev database already carries two btree indexes — `owners_last_name_first_name_idx (last_name, first_name)` and `owners_city_idx (city)` — but the database collation is `C` (byte-order), so those indexes only serve **case-sensitive** ordering. Angular Material 16.2.1 is already a dependency but unused. The MCP surface does not use the list endpoint (`PetClinicMcp` uses `findByIdFetchingPets`).

## Goals / Non-Goals

**Goals:**
- Server-side pagination and sorting for owners, safe at 1M rows.
- Case-insensitive, index-backed ordering for the two columns users actually sort by.
- A hardened query contract (no unbounded pages, no unindexed sorts).
- A Material grid wired to the server params.

**Non-Goals:**
- Sorting Address, Telephone, or Pets (unindexed / collection / undefined semantics).
- Cursor/keyset pagination (offset paging is sufficient for the grid's page depth; noted as a future option).
- Changing the MCP or any single-owner endpoint.
- Full linguistic/ICU collation; simple `lower()` case-folding is enough.

## Decisions

**D1 — Server-side over client-side.** With 1M rows, loading all owners into the browser is a non-starter; use Spring Data `Pageable`. *Alternative rejected:* client-side `MatTableDataSource` sorting — trivial to build but impossible at this scale.

**D2 — Return `Page<OwnerDto>` directly.** The controller returns Spring's `Page<OwnerDto>`; the frontend's existing `OwnerPage` interface already mirrors that JSON. *Alternatives rejected:* a hand-written page DTO and returning `PageImpl` explicitly — the owner chose the framework type to keep the controller thin. *Trade-off:* Spring Boot logs a warning about serializing `PageImpl`; accepted (optionally silenced via `spring.data.web.pageable` config), and the extra envelope fields are tolerated.

**D3 — Whitelisted params, not raw `Pageable` sort.** The API accepts `page`, `size ∈ {5,10,20}`, `sort ∈ {name,city}`, `dir ∈ {asc,desc}`; the controller maps the sort key to a real `Sort` and rejects anything else with 400. *Why:* a raw URL `sort` token can't express `ignoreCase`, the `(lastName, firstName)` composite, or the `id` tiebreaker, and it opens a DoS hole (`sort=address` → 1M-row filesort; `size=1000000` → a million DTOs). *Alternative rejected:* conventional Spring `Pageable` resolver.

**D4 — Case-insensitive ordering via `lower()` functional indexes.** `name → [lower(lastName), lower(firstName), id]`, `city → [lower(city), id]`, built with `Sort.Order.ignoreCase()`. A new migration adds `owners (lower(last_name), lower(first_name))` and `owners (lower(city))`. *Why:* the `C` collation makes the existing plain btrees useless for case-insensitive order; without functional indexes every sort is a 1M-row filesort. The last-name search also becomes case-insensitive and reuses the composite index's leading column. *Alternative rejected:* raw `C`/byte-order sort (free, but visibly wrong on messy prod data — capitals before lowercase, accents last).

**D5 — Deterministic tiebreaker.** No sort key is unique (`Potter` ×2, `London` ×7 in dev), so `id` is always appended to `ORDER BY`; otherwise rows shuffle between pages.

**D6 — Do not fetch-join pets in the page query.** `OwnerDto` carries `List<PetDto>`, but `LEFT JOIN FETCH pets` together with `Pageable` triggers Hibernate in-memory pagination (HHH000104) — catastrophic at 1M rows. Instead page owners without the collection, and mitigate the resulting N+1 with `@BatchSize` on `Owner.pets` (or `hibernate.default_batch_fetch_size`), so a page's pets load in one or two extra queries.

**D7 — Angular Material grid.** `MatTable` + `MatSort` + `MatPaginator` in server-side mode; only Name and City are `mat-sort-header`; paginator page-size options are 5/10/20. `getOwners`/`searchOwners` collapse into one paged call; sort/search changes reset to page 0. *Trade-off:* first Material component in a Bootstrap 3 app — styled through the `frontend-ux` skill to minimize visual drift. *Alternative rejected:* Bootstrap-native table + hand-rolled paginator (chosen against by the owner in favor of Material).

**D8 — Name column: last-name sort + "Last, First" display.** The Name column sorts by `(lastName, firstName)` and renders as `lastName, firstName` (e.g. `McCallister, Kevin`) so the visible text matches the order. The sort direction is a **product/convention choice** (directory ordering by surname), *not* a technical constraint — the migration builds whatever index is needed. Last-name-leading is preferred because it also lets the one `lower(last_name)`-leading index required by the case-insensitive search serve the sort too; a first-name-leading sort would need a second functional index. *Alternatives rejected:* keep `firstName lastName` display (mismatches the sort — the original bug); split into two independently-sortable columns (extra index / write-amp).

## Risks / Trade-offs

- **Deep-offset paging on 1M rows is slow at high page numbers** → acceptable for the grid's expected depth; keyset pagination noted as a future upgrade.
- **`CREATE INDEX` locks writes on a 1M-row table** → we would like `CONCURRENTLY`, but **Flyway holds a transactional lock on its schema-history table during a migration, and `CREATE INDEX CONCURRENTLY` deadlocks against it** (CONCURRENTLY waits for that transaction to drain; it never does). So `V10` uses plain, transactional `CREATE INDEX` (verified: `CONCURRENTLY` hangs the Zonky test-context startup indefinitely). For a true zero-downtime build on the 1M-row prod table, create the two indexes `CONCURRENTLY` out-of-band via an ops runbook; `V10` then no-ops through `IF NOT EXISTS`.
- **Version number is `V10`, not `V9`** → the shared dev DB already has a pre-existing (never-committed-to-repo) `V9` "add owner search indexes" from Jul 2 that created the raw indexes; reusing `V9` caused a Flyway checksum mismatch. `V10` is the clean next version.
- **Extra functional indexes add write-amplification** → **drop** the now-redundant raw `owners_last_name_first_name_idx` / `owners_city_idx` (no query does a case-sensitive `last_name`/`city` lookup once search and sort are `lower()`-based), via plain `DROP INDEX IF EXISTS` (same Flyway-lock reason precludes `CONCURRENTLY`).
- **Breaking response shape** → single-release BREAKING change; the only consumers (owner-list screen, perf/functional tests, generated `openapi.yaml` + `api-types.ts`) are all updated in this change.
- **`Page<OwnerDto>` serialization warning** → cosmetic; silence via config if noisy.

## Migration Plan

1. Add Flyway `V10`: plain `CREATE INDEX IF NOT EXISTS` the two `lower(...)` functional indexes, then `DROP INDEX IF EXISTS` the two redundant raw indexes. (For a zero-downtime prod build, create the functional indexes `CONCURRENTLY` out-of-band first — `V10` then no-ops.)
2. Ship backend contract change + frontend grid together (BREAKING; no dual-shape window needed — no external array consumer).
3. Regenerate `openapi.yaml` (OpenApiExtractorTest) and frontend `api-types.ts`; CI drift gates confirm.
4. Rollback: revert the code change; the additive indexes may remain (harmless) or be dropped separately.

## Open Questions

- Should the `Page` serialization warning be silenced via config, or left as-is?
