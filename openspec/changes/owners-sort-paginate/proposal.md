## Why

The Owners list screen currently fetches every owner row at once and offers no sorting or pagination. At production scale (~100k owners) this is unusable: the browser stalls, the network payload is huge, and users have no way to locate a specific owner short of `Ctrl+F`. Adding server-driven pagination and sorting makes the screen viable at real scale and turns it into a first-class browse/search surface (bookmarkable, back-button friendly, shareable URLs).

## What Changes

- **BREAKING** `GET /api/owners` now returns `Page<OwnerDto>` (Spring shape: `content`, `totalElements`, `totalPages`, `number`, `size`) instead of a flat list. All in-repo consumers (`OwnerTest`, `OwnerSteps`, perf test, generated `api-types.ts`) updated in lockstep.
- `GET /api/owners` accepts `?lastName=`, `?page=`, `?size=`, `?sort=col,dir` query params. Client sends a single column + direction; server expands into the multi-column sort chain with `id ASC` as the always-final stable tiebreaker.
- Sortable columns: **Name**, **Address**, **City**. The **Pets** column is not sortable (1→N collection — ambiguous).
- Sort chains (server-built):
  - Name → `lastName, firstName, id`
  - City → `city, lastName, firstName, id`
  - Address → `address, lastName, firstName, id`
- Frontend switches to **server-side pagination and sorting only** — no client-side slicing.
- Owners grid header **"Name"** is renamed and rendered as **"Lastname, Firstname"** (phonebook convention).
- Adopt **minimal Angular Material**: `matSort` directive on `<thead>` and `<mat-paginator>` below the table. The Bootstrap `<table class="table table-striped">` markup stays.
- Page sizes: **5 / 10 / 20**, default **10**. Single-column sort; clicking the active column flips asc↔desc; clicking a new column starts asc. Sort never clears.
- `page`, `size`, `sort` are reflected in the URL query string (bookmarkable, back-button works).
- On filter/size/sort change, snap back to **page 1**.
- Loading UX: previous rows stay visible (dimmed) with a spinner overlay during the fetch.
- **Fix the broken Pets cell markup**: today the cell contains a `<tr *ngFor>` nested inside a `<td>` (invalid HTML — `<tr>` may only be a child of `<thead>` / `<tbody>` / `<tfoot>` / `<table>`). Replace with a single comma-separated inline list of pet names inside the `<td>`.

## Capabilities

### New Capabilities
- `owners-listing`: server-paginated, server-sorted browsing of the owner directory, including the sort-chain expansion contract, page-size choices, URL state, and the listing UX (loading overlay, page-1 snap-back).

### Modified Capabilities
<!-- None — no prior specs exist for the owners listing. -->

## Impact

- **Backend** (`petclinic-backend/`): `OwnerController` (or equivalent) signature changes to return `Page<OwnerDto>`; sort-chain expansion logic added; `OwnerTest`, `OwnerSteps`, and any perf test updated.
- **Frontend** (`petclinic-frontend/`): `OwnerListComponent` rewritten for server-driven paging/sorting; `OwnerService` returns the `Page` shape; URL synchronization wired via `ActivatedRoute`/`Router`. New dependency: Angular Material (`@angular/material`, `@angular/cdk`) — only `MatPaginatorModule` and `MatSortModule` imported.
- **Generated types** (`api-types.ts`): regenerated against the new `Page<OwnerDto>` response.
- **E2E** (`petclinic-ui-test/`): new Playwright spec covering sort, paginate, deep-link, back-button. CI-only — not in pre-commit.
- **Out of scope** (explicitly): removing `/api/owners/count`; case-insensitive lastName search; wiring `api-types.ts` into `OwnerService`; debounced typing on lastName filter; persisting page size across sessions.
