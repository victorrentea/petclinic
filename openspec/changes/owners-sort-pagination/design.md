## Context

`GET /api/owners` (`OwnerRestController.listOwners`) currently runs
`OwnerRepository.searchOwners(pattern)` and returns the entire matching `List<OwnerDto>`. The
recently added `q` param does cross-column DB search (firstName/lastName/address/city/telephone
+ pet name via `EXISTS`). There is no paging or sorting: the frontend `OwnerListComponent`
loads everything and renders one Bootstrap 3 table.

Two facts shape this design:
- **Scale**: production has ~100k owners. Loading all of them is the problem we are fixing, so
  paging and sorting MUST happen in the database, not in the browser or in a Java stream.
- **Existing groundwork**: the frontend already declares an unused `OwnerPage` interface
  (`content`, `totalElements`, `totalPages`, `number`, `size`) — the Spring Data `Page` shape.
  The design adopts that shape so the frontend model is finally used as intended.

Constraints: the app uses Angular 16 with Bootstrap 3 (and Angular Material available). Drift
guardrails regenerate `openapi.yaml` and `api-types.ts`; `openapi.yaml` is CODEOWNERS-sensitive.

## Goals / Non-Goals

**Goals:**
- Server-side pagination and sorting on `GET /api/owners`, composing with the existing `q` search.
- Sortable Name and City headers and pagination + page-size (5/10/20, default 10) UI.
- Keep the DB query single-statement and index-friendly; no N+1 regression on the list.

**Non-Goals:**
- Sorting by the Pets column (derived collection — out of scope, left non-sortable).
- Changing the search semantics or the set of searchable columns.
- Infinite scroll, cursor pagination, or saved/sticky user preferences across sessions.
- Any DB schema migration (this is a read-only feature; `DB.sql` is unchanged).

## Decisions

### Decision: Return Spring `Page<OwnerDto>` from the list endpoint
`listOwners` accepts `@RequestParam` `page`, `size`, `sort` (or a bound `Pageable`) plus the
existing `q`, and returns the `Page` envelope. The repository query takes a `Pageable` and
returns `Page<Owner>`; the controller maps the page content through `OwnerMapper` and preserves
the page metadata.
- **Why**: it is the idiomatic Spring shape, matches the pre-existing frontend `OwnerPage`
  model, and lets Spring Data apply `LIMIT/OFFSET` + `ORDER BY` in SQL.
- **Alternative considered**: a custom `{items,total}` DTO — rejected as redundant with the
  built-in `Page` shape the frontend already models.
- **Breaking-change note**: the response goes from a JSON array to a paged object. This is an
  accepted breaking change (see Migration Plan); the only known consumers are this frontend and
  the OpenAPI-generated types, both updated in the same change.

### Decision: Whitelist two sortable columns; safe default; map "Name" to first+last
Bind sort to an allowed set of two logical columns — Name (→ order by `firstName`, then
`lastName`) and `city`. An absent/invalid sort falls back to `Sort.by("firstName","lastName")`.
Address and Telephone are intentionally NOT sortable (product decision, GH25 follow-up), and
the Pets collection is not sortable.
- **Why Name = firstName,lastName (not lastName,firstName)**: the list renders "First Last"
  (e.g. "Harry Potter"), so the eye scans the first name first. Sorting by last name would make
  the leading text appear unordered (Harry, Roger, Tom, Newt…). Sorting by the displayed leading
  text is the WYSIWYG-consistent, least-surprising choice. `lastName` is the deterministic
  tiebreaker.
- **Why a whitelist**: prevents sorting on non-existent/unsafe properties and on the derived
  pets collection; gives stable, deterministic ordering for pagination (unstable sort =
  duplicate/missing rows across pages).
- **Alternative considered**: pass the client `sort` straight to `Pageable` — rejected because
  an invalid property throws `PropertyReferenceException` and an unstable sort breaks paging.

### Decision: Keep the existing `searchOwners` JPQL, add `Pageable`
Reuse the current `@Query` (cross-column `LIKE` + pet `EXISTS`) but change its signature to
`Page<Owner> searchOwners(String pattern, Pageable pageable)`. Spring Data derives the count
query and applies sorting/paging. Empty `q` still means "match everything" via the `%%` pattern.
- **Why**: preserves the audited search behavior and the `EXISTS`-not-`JOIN`/`ILIKE` lessons;
  only adds paging on top.
- **Trade-off**: a derived count query runs per request; acceptable and necessary to populate
  `totalElements`/`totalPages` for the UI.

### Decision: Frontend keeps Bootstrap styling; component owns sort+page state
`OwnerListComponent` holds `sortField`, `sortDir`, `pageIndex`, `pageSize` (default 10), calls
`ownerService.getOwners({q, page, size, sort})` → `Observable<OwnerPage>`, and makes the Name and
City `<th>` headers clickable with an asc/desc caret (Address, Telephone, and Pets stay plain
headers), plus Bootstrap pagination controls and a page-size `<select>`. The single service
method carries the `q`, `page`, `size`, `sort` query params.
- **Why**: matches the existing plain-Bootstrap owners table and the project's table/grid UX
  conventions; avoids introducing a Material `mat-table` that would diverge from the rest of the
  screen. Merging search + sort + page into one request path keeps them composable.
- **Alternative considered**: Angular Material `mat-table` + `mat-paginator` + `matSort` —
  rejected to stay visually consistent with the current Bootstrap owners screen.

## Risks / Trade-offs

- **Breaking API response shape** → other clients of `GET /api/owners` break. Mitigation: only
  this frontend + generated types consume it; both updated here; documented in tasks.
- **Unstable sort corrupts pagination** (rows shift between pages) → always append a
  deterministic tiebreaker (Name sorts `firstName, lastName`; City appends `firstName, lastName`,
  and ultimately a unique key). Mitigation captured in the sort decision and a spec scenario.
- **Sorting on a non-indexed column at 100k rows** → slow `ORDER BY`. Mitigation: rely on
  existing/added DB indexes for sortable columns if profiling shows a hot path; out-of-scope to
  add speculative indexes here but flagged for the indexing review.
- **Drift gates fire** (`OpenApiExtractorTest`, TS regen) and `openapi.yaml` needs elder review.
  Mitigation: regenerate both artifacts in the change and expect a CODEOWNERS review.

## Migration Plan

1. Land backend paging/sorting behind the same path; keep `q` working.
2. Regenerate `openapi.yaml`, then `api-types.ts` (`npm run generate:api`).
3. Update the frontend service + component to consume `OwnerPage`.
4. Rollback: revert the change set; no data migration, so rollback is code-only.

## Open Questions

- Should the active sort/page state survive a page refresh (e.g. via URL query params)? Default
  assumption: no persistence beyond the in-memory component state for this change.
- Is a secondary tiebreaker beyond `firstName,lastName` needed for fully deterministic order on
  duplicate names? Assumed sufficient for now; revisit if paging shows duplicates.
