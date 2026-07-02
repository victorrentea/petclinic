## Context

The Owners grid currently fetches `GET /api/owners` as a bare `List<OwnerDto>` and renders it in a plain Bootstrap 3 `<table>` with `*ngFor`. There is no sorting or pagination anywhere in the stack: `OwnerRepository` extends the bare `Repository<Owner,Integer>` marker (no `PagingAndSorting`), and no endpoint in the backend uses `Pageable`/`Page`. The `owners` table is expected to reach **~1 million rows**, which makes the current "load everything" approach unusable.

Two hints already exist in the code: a dead `OwnerPage` interface in the frontend shaped like a Spring page, and a `GET /api/owners/count` endpoint. Angular Material 16 is installed but `MatTable`/`MatPaginator`/`MatSort` are not yet imported anywhere.

## Goals / Non-Goals

**Goals:**
- Server-side pagination and sorting for the Owners grid, correct and index-backed at ~1M rows.
- Preserve the existing `?lastName=` prefix filter, composing it with paging and sorting.
- A stable, documented paged response contract.
- Sortable by Name and City from the UI, with page sizes 5 / 10 / 20.

**Non-Goals:**
- Sorting by Address, Telephone, or Pets (explicitly excluded by the stakeholder).
- Keyset/seek pagination (offset is used for v1; see Risks).
- Deep-linkable URL state for page/sort/size (deferred to a follow-up).
- Changing authorization, or touching other entities' listings.

## Decisions

### D1 — Server-side pagination (not client-side)
At ~1M rows, shipping the full table to the browser is a non-starter. The backend gains `page`/`size`/`sort` params and returns one page. *Alternative rejected:* client-side `MatTableDataSource` sort/paginate — only viable for tiny datasets.

### D2 — Sortable columns limited to Name and City
`name` maps to `(lastName, firstName)`; `city` maps to `city`. Address/Telephone/Pets are display-only. *Rationale:* every sortable column needs an index at 1M rows; the stakeholder narrowed scope to these two. Pets is a per-row collection with no natural single-column sort key.

**Name is sorted last-name-first, and the column is displayed the same way** — "Smith, John" instead of today's "John Smith". *Rationale:* the original design silently sorted by last name while the column still displayed first-name-first, so a name-sorted list looked scrambled to the user (the visible leading token was the first name). The business confirmed surname-first is how staff look owners up, so display and sort key are aligned to "lastName, firstName". This also lets one `(last_name, first_name)` index serve both the last-name search filter and the Name sort (see D8) — a convenience, not the reason for the ordering.

### D3 — Response shape: `PagedModel<OwnerDto>`
Return Spring's `PagedModel<>(page.map(mapper::toOwnerDto))`. *Rationale:* Spring Boot 3.3+ logs a warning and treats raw `PageImpl` JSON as unstable; `PagedModel` is the officially stable replacement. Shape is `{ content, page: { size, number, totalElements, totalPages } }`. *Alternatives rejected:* raw `Page` (unstable, noisy JSON, warning); a hand-written flat DTO (more code, and the stakeholder chose `PagedModel`). The frontend `OwnerPage` interface is reshaped to this nested form.

### D4 — Repository: add a paged method to the bare marker
Keep `extends Repository<Owner,Integer>` and add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`. Spring Data honors a `Pageable` arg on any repository method regardless of base interface, so the project's uniform bare-marker convention is preserved. *Alternative rejected:* switching to `PagingAndSortingRepository`/`JpaRepository` — breaks the convention across 7 repos and still needs the custom filter method.

### D5 — Sort key translation and whitelist at the controller
The controller accepts logical sort keys (`name`, `city`), translates `name` → `Sort.by("lastName","firstName")`, and **ignores** any other key, falling back to default `name` asc. *Rationale:* binding a raw Spring `Pageable` would let a caller `ORDER BY` any entity property, including unindexed ones (full scan) or unknown ones (error). Centralizing the policy keeps it in one place and safe.

### D6 — Page-size cap
Effective `size` is clamped to a maximum of 100. *Rationale:* prevents `size=1000000` from dumping the table and defeating pagination.

### D7 — Pets loaded via batch fetching, never `JOIN FETCH` + `Pageable`
The page query selects owners only (no collection fetch). Pets are loaded with Hibernate batch fetching (`@BatchSize` on the collection, or a second `WHERE owner_id IN (:ids)` query). *Rationale:* `JOIN FETCH o.pets` together with a `Pageable` triggers Hibernate `HHH000104` — it fetches all rows and paginates **in memory**, catastrophic at 1M rows. Batch fetching bounds it to a few `IN` queries per page.

### D8 — Indexes
Add btree indexes `(last_name, first_name)` (covers the prefix filter and the Name sort) and `(city)` (City sort) via a schema migration. *The `db` skill is consulted when authoring the migration.*

### D9 — Frontend: Angular Material `mat-table` + `matSort` + `mat-paginator`
Migrate the Bootstrap table to Material components in **server-side mode**: `(matSortChange)` and `(page)` events trigger a refetch; `mat-paginator` `length` is bound to `page.totalElements`, `pageSizeOptions=[5,10,20]`, default 10. The malformed nested `<tr>`-in-`<td>` pets cell is replaced with a proper cell. The Name cell renders `{{lastName}}, {{firstName}}` (was `{{firstName}} {{lastName}}`) so the display matches the Name sort key (D2), keeping the router link to the owner detail. The `frontend-ux` skill is applied to keep buttons/labels consistent with the surrounding Bootstrap app. *Alternative considered:* hand-rolled Bootstrap sort headers + pager — more custom code, no built-in page-size selector.

### D10 — Search/paging interaction
A new `lastName` search resets to page 0; sort and page size persist. Spring pages are zero-based and `mat-paginator.pageIndex` is zero-based, so they map directly.

### D11 — Generated artifacts
Regenerate `openapi.yaml` (via `OpenApiExtractorTest`) and the frontend `api-types.ts` after the contract change; re-run guardrail/drift tests.

## Risks / Trade-offs

- **Deep offset pagination is slow at 1M rows** (`OFFSET 900000 LIMIT 10` scans and discards) → Ship offset for v1 with the indexes above; track keyset/seek pagination as a follow-up. Acceptable because real usage filters by last name, keeping result sets small.
- **`count(*)` on every request** (required for `totalElements`) can be costly on large filtered sets → The `(last_name, first_name)` index supports the filtered count; revisit `Slice` (no total) only if counts become a bottleneck. `PagedModel` needs totals, so keep them for now.
- **BREAKING response contract** → Frontend and OpenAPI are updated in the same change; `owner-list.component`, `owner.service`, and `OwnerPage` are migrated together so nothing consumes the old array shape.
- **Batch-fetch tuning** → If `@BatchSize` is too small, pets still take several `IN` queries per page; size it to the max page size (100) so one page of owners loads pets in a bounded number of queries.

## Affected Areas

Concrete components touched by this change (the plain-language summary is in proposal.md → Impact):

- **API (BREAKING)** — `GET /api/owners` response shape and parameters: `OwnerRestController.listOwners` now takes `page`/`size`/`sort`, translates/whitelists the sort key, clamps `size` to 100, and returns `PagedModel<OwnerDto>`.
- **Repository** — `OwnerRepository` gains `Page<Owner> findByLastNameStartingWith(String, Pageable)`.
- **Mapping** — `OwnerMapper` used via `page.map(ownerMapper::toOwnerDto)`.
- **Database** — new schema migration adding btree indexes on `owners(last_name, first_name)` and `owners(city)`; `Owner.pets` batch-fetch configuration.
- **Frontend** — `owner-list.component` (html + ts), `owner.service`, `owners.module` (new Angular Material `MatTable`/`MatSort`/`MatPaginator` imports), and the reshaped `OwnerPage` interface.
- **Generated** — `openapi.yaml` (via `OpenApiExtractorTest`) and `petclinic-frontend/src/app/generated/api-types.ts`.
- **Guardrails** — architecture/OpenAPI drift tests re-run after the contract change.

## Open Questions

- Should pets be shown inline in the paginated grid at all, or dropped from the list payload (loaded only on the owner detail)? Kept for now to match current UI; dropping them would simplify and speed up the list.
- Confirm whether "smooth at any page depth" is a hard requirement; if so, keyset pagination moves in-scope and D2's sort flexibility is further constrained.
