# Proposal

## Why

GH #25 asks for an Owners grid that is paged (5, 10 or 20 rows) and sortable. The product owner expects
~100,000 owners in production within a year; today `GET /api/owners` returns every owner with their pets in one
response and the grid renders them all, which will not survive that volume. Looking at the data also showed that
the current alphabetical order is wrong for names with diacritics (`Śliwiński` sorts after `Wensleydale`).

## What Changes

- **BREAKING** `GET /api/owners` always returns one page (`content`, `totalElements`, `totalPages`, `number`,
  `size`) instead of the full list. New query parameters `page` (0-based), `size` (1–20, default 10) and
  `sort` (`name` or `city`, `,asc`/`,desc`, default `name,asc`); `lastName` prefix search is kept.
  Out-of-range `size` or an unknown `sort` key answers 400.
- The Owners grid gets a pager (page sizes 5 / 10 / 20, first/previous/next/last, "1–10 of N") and sort arrows on
  **Name** and **City** only. Address, Telephone and Pets stay unsortable: the data shows free-text addresses,
  three phone formats for the same country and 1–2 pets per owner, so sorting them means nothing.
  This narrows the issue's "any column"; the product owner is told why on GH #25.
- Search, page, size and sort live in the URL, so Back from an owner's page returns to the same page.
- Name and city sort by human (ICU) alphabetical order, so names with diacritics land where readers expect.
- Every consumer of the old list (Angular service, Cucumber, MockMvc tests, the latency-proxy perf test,
  Playwright page object, JMeter plan) moves to the paged contract in the same change.

## Capabilities

### New Capabilities
- `owner-list`: browsing and searching owners as a paged, sortable list, over the REST API and in the Owners grid.

### Modified Capabilities
<!-- none: openspec/specs/ is empty -->

## Impact

- **API**: `GET /api/owners` response shape and parameters (OpenAPI regenerated, `api-types.ts` regenerated).
- **Database**: new migration changing the collation of `owners.first_name`, `last_name`, `city` and adding the
  sort and prefix-search indexes.
- **Backend**: `OwnerRestController.listOwners`, `OwnerRepository`, a new page DTO, error handling for bad paging
  parameters, pets loaded per page.
- **Frontend**: `OwnerListComponent`, `OwnerService`, `owners.module.ts` (Material paginator and sort),
  the already-present but unused `owner-page.ts`.
- **Tests and tools**: `OwnerTest`, `AddVisitApiTest`, `BasicAuthenticationConfigTest`,
  `OwnerSearchThroughLatencyProxyTest`, `owners.feature` + `OwnerSteps`, `petclinic-test` `OwnersPage`,
  JMeter CRUD plan.
- Out of scope: case-insensitive search (`po` finds nothing today) is a separate issue.
