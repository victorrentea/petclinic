## Why

Issue #25 asks for a sortable, paginated Owners grid. The `owners` table is expected to reach
~100,000 rows within a year (per Bizu), so today's "load all owners, sort/filter in the browser"
approach is not a premature optimization to avoid — at that volume it is a bug. A prior contributor
claimed server-side pagination and sorting were already implemented, but no `Pageable`, `MatTable`,
`MatSort`, or `MatPaginator` exist anywhere in the codebase; the only trace is an orphaned
`OwnerPage` interface in the frontend that nothing imports.

## What Changes

- `GET /api/owners` gains `page`, `size`, and `sort` query parameters (Spring's standard
  `Pageable` binding) and returns a paginated envelope (`{content, totalElements, totalPages,
  number, size}`) instead of a bare array. **BREAKING**: response shape changes from `OwnerDto[]`
  to a `PageDto<OwnerDto>` envelope.
- Default page size 10, hard cap 20 enforced in the controller (400 if exceeded) — not via the
  global `spring.data.web.pageable.max-page-size` property, which truncates silently instead of
  rejecting.
- Sorting restricted to an allowlist of columns (`lastName`, `firstName`, `address`, `city`,
  `telephone`); unknown sort properties return 400 instead of a 500 or an arbitrary join. `pets` is
  not sortable (deviation from a literal "any column", called out explicitly).
- Every sort always appends `id ASC` as a tiebreaker, and always applies `NULLS LAST` regardless of
  direction, so paging stays deterministic and a second click on an empty column (e.g. `Telephone`)
  doesn't look broken.
- `owners(last_name, first_name, id)` composite index added to back the default sort without
  penalizing every list/search call with a full table scan at 100k rows.
- `Owner.pets` gets `@BatchSize` so paginated rows don't trigger `HHH000104` (in-memory pagination
  from a collection `JOIN FETCH`) or N+1 queries per page.
- Frontend Owners grid becomes `MatTable` + `MatSort` + `MatPaginator`, wired to the new
  server-side envelope, preserving the `#ownersTable` / `td.ownerFullName` E2E selectors. The `Name`
  column stays a single column, rendered as `"LastName, FirstName"`, sorted by `lastName, firstName`.
  The pre-existing invalid-markup bug (`<tr>` nested inside a `<td>` for the `pets` cell, producing
  60 `<tr>` for 28 owners) is fixed as part of adopting `MatTable`.
- Searching by last name resets to page 0 and keeps the current sort; no deep-linking of
  page/sort state in this change.
- E2E: the `every owner in the clinic is listed` scenario is rewritten (it breaks on a 10-row page
  with 28 seeded owners), plus a new pagination scenario is added.

## Capabilities

### New Capabilities
- `owners-list-pagination`: server-side paginated, sortable, filtered listing of owners — request
  contract (page/size/sort parameters, defaults, caps, allowlist, 400s), response envelope shape,
  deterministic ordering (tiebreaker + NULLS LAST), and the corresponding Owners grid UI behavior.

### Modified Capabilities
(none — no pre-existing spec covers owner listing; this is a new capability, not a change to an
existing documented one)

## Impact

- **Backend**: `OwnerRestController#listOwners` (signature + return type), a new `PageDto<T>`,
  `OwnerRepository` (new `Pageable`-based query, allowlist validation), a new `owners(last_name,
  first_name, id)` index migration, `Owner.pets` mapping (`@BatchSize`), `ExceptionControllerAdvice`
  (handling the new "page size/sort property" validation errors), `openapi.yaml` (regenerated from
  `OpenApiExtractorTest`, not hand-edited).
- **Frontend**: `OwnerService.getOwners` (return type + params), `OwnerListComponent` and its
  template (`MatTable`/`MatSort`/`MatPaginator`), the previously-unused `owner-page.ts` becomes the
  paginated response type.
- **Tests**: `OwnerTest`, `AddVisitSequenceTest`, `BasicAuthenticationConfigTest`,
  `OwnerSearchThroughLatencyProxyTest`, cucumber `OwnerSteps`, Playwright E2E glue, and the
  `start-apps.ts` healthcheck all consume `GET /api/owners` and need updating for the new envelope.
- **Not impacted**: the chatbot and MCP server only call `GET /api/owners/{id}`, unaffected by the
  list endpoint's contract change.
- **AGENTS.md**: already records the ~100k-row volume assumption and the "paging/sorting/filtering
  belongs in the database" rule that motivates this change.
