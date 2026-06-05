# Proposal: owners-sort-pagination

> Sources: [GitHub issue #25](https://github.com/victorrentea/petclinic/issues/25) + business-refined functional spec `owners-sort-pagination-functional-spec.md` (repo root, Romanian — UX-level decisions; it overrides the issue comments where they differ).

## Why

The Owners list loads every owner in one response and renders them all — unusable and slow at production scale (~100k owners). Users need to sort by column and page through results, with the heavy lifting done server-side.

## What Changes

- **BREAKING** `GET /api/owners` evolves in place: returns a `Page<OwnerListRowDto>` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) instead of a bare `OwnerDto[]`. The list now returns a dedicated read-model row (`id, firstName, lastName, address, city, telephone, petNames: string[]`) — exactly what the screen renders — built with a single grouped SQL query that aggregates pet names; no visits, pet types, or full pet entities are loaded. `OwnerDto` stays as-is for the detail endpoint. All in-repo consumers (backend e2e tests, generated `api-types.ts`, frontend `OwnerService`, Playwright `ApiClient`) are updated in the same change.
- New query params on `GET /api/owners`: `page`, `size`, `sort=col,dir` (alongside existing `lastName`).
- Sort chain is server-built from a single client column + direction; `id ASC` is always the final tiebreaker for stable pagination.
- **Human collation:** sorting is case- and diacritic-insensitive (`Popescu` = `popescu` = `Pópescu`); missing values sort as empty string — first on asc, last on desc (accepted business decision).
- Owners screen: clickable headers on Name/City/Address (single-column sort, asc↔desc toggle, **never unsorted** — default **Name ascending** with visible arrow indicator).
- Paginator below the table: page-size selector (5/10/20, default 10), position counter ("11–20 of 53"), first/prev/next/last arrows. **Hidden entirely when the (filtered) total ≤ 5**; sorting stays active.
- Screen state — **sort + page + search** — lives in the URL query string (bookmarkable, shareable, back-button) **and survives in-app navigation** (returning to Owners restores where you were; a fresh visit starts at defaults).
- Any change of sort, page size, or search term snaps to page 1; a filter that invalidates the current page lands on page 1.
- Empty state: one generic "No results" message for both empty clinic and fruitless search (accepted compromise).
- Loading UX: stale rows stay visible, dimmed, under a spinner overlay during fetch.
- Minimal Angular Material adoption: `matSort` on the existing Bootstrap table header, `<mat-paginator>` below it.

**Open decision (pending business confirmation, per issue comment 2026-06-02):** Name column sorts `firstName, lastName, id` to match the current `firstName lastName` display — not the phonebook-conventional `lastName, firstName`. Design proceeds with the display-order variant; flipping it later only changes the server sort-chain map and the header label.

## Capabilities

### New Capabilities
- `owners-list-api`: paginated, sorted, filtered `GET /api/owners` contract — Page envelope, query params, server-built sort chains with `id` tiebreaker, human collation, empty-value ordering, sortable-column whitelist.
- `owners-list-ui`: Owners screen sorting/pagination UX — always-active header sort, paginator with hide threshold, URL-driven + navigation-surviving state, snap-to-page-1 rules, empty state, dimmed-stale-rows loading overlay.

### Modified Capabilities
<!-- none — openspec/specs/ is empty; no existing specs to modify -->

## Impact

- **Backend** (`petclinic-backend-ts/`): `owner.controller.ts` (single grouped projection query — `array_agg` pet names, collated ORDER BY chain, `LIMIT/OFFSET`, `COUNT` for total), new `Page<T>` + `OwnerListRowDto`, a raw→DTO mapper, DB migration enabling `unaccent`, OpenAPI annotations; `test/owner.e2e-spec.ts` updated for the new envelope + new tests pinning sort-chain expansion, collation, and pet-name aggregation.
- **Frontend** (`petclinic-frontend/`): `owner-list` component/template (matSort, mat-paginator, URL state, state-restore service, empty state, loading overlay), `owner.service.ts` (params + Page type), `app.module.ts` (Material modules), regenerated `api-types.ts`.
- **E2E** (`petclinic-ui-test/`): `OwnersPage` page object + new Playwright spec covering sort, paginate, deep-link, back-button — CI-only, not in pre-commit.
- **Out of scope** (issue #25 + functional spec): building search (exists), owner deletion on this screen, persisting page size across visits/devices, multi-sort, removing `/api/owners/count`, case-insensitive lastName *search*, wiring `api-types.ts` into `OwnerService`, debounced filter typing. Deferred: a11y/keyboard operation of sort headers, large-volume performance tuning.
