## Why

The Owners grid loads **every** owner in a single request and renders them in one unsorted
Bootstrap table. The business expects **10,000 owners within a few months** (recorded in
`CLAUDE.md` → Expected Data Volumes), at which point this screen ships a multi-megabyte payload,
serialises three levels deep (owners → pets → visits) with an N+1 per row, and gives the user no
way to order or navigate it.

Resolves [issue #25](https://github.com/victorrentea/petclinic/issues/25). The full design
interview — 14 decisions, the live-database findings that overturned two of them, and the
remaining open questions — is recorded in [`QA.md`](../../../QA.md).

## What Changes

**Server-side paging and sorting.** Fetch-all-then-slice-in-the-browser is explicitly rejected;
the database does the work.

- **BREAKING** `GET /api/owners` returns a page object (`content`, `totalElements`, `number`,
  `size`) instead of a bare JSON array, and accepts `page`, `size` and `sort` query parameters.
  Every consumer is internal (one Angular screen plus our own tests); the chatbot and MCP server
  use `/api/owners/{id}` and are unaffected.
- **Three sortable columns only** — Name, City, Pets. The issue's "any column" was deliberately
  narrowed after reading the real data: sorting Address puts `4 Privet Drive` after
  `30 Wellington Square` (text ordering of house numbers), and nobody browses clients by
  telephone. Address and Telephone stay plain, non-clickable headers.
- **Pets sorts by count**, ascending-first, so the zero-pet owners lead. The Pets cell gains the
  count next to the names, because otherwise the rows reorder by a quantity that is nowhere on
  screen.
- **Every sort carries a hidden tiebreaker** (last name, first name, id). Without it, slicing an
  unordered block across pages shows the same owner twice while another never appears — acute for
  Pets, which has only 3 distinct values.
- **Paging state lives in the URL** (`?lastName=&page=&size=&sort=`), making Back, refresh and
  shared links work. These parameter names become a public contract.
- **BREAKING (data)** A Flyway migration pins `ro-x-icu` collation on `owners.last_name`,
  `first_name` and `city`. The database currently collates as `C` (raw bytes), which sorts every
  `Ș`/`Ț` surname — and anyone typed in lowercase — **after Z**. Name-ascending is the default
  sort, so this is the first screen every user sees.
- **Three distinct empty states** replacing today's conflated one, which renders no message on an
  empty search and shows "no owners named X" when the *backend is down*.
- **Malformed markup fixed**: the Pets cell currently opens a `<tr>` inside a `<td>`.
- **N+1 mitigated** via `@BatchSize` on `Owner.pets`; a fetch-join is ruled out because it makes
  Hibernate paginate in memory (`HHH000104`).

**Out of scope, deliberately:** the other four grids (Pets, Vets, Visits, Specialties) keep their
`*ngFor` tables; search semantics stay starts-with-on-last-name; trimming `visits` out of the list
payload becomes a follow-up issue.

## Capabilities

### New Capabilities
- `owner-listing`: browsing the owner list — server-side pagination, sorting, the interaction
  between search and paging, URL-addressable view state, parameter validation, and the empty and
  error states of the grid.

### Modified Capabilities
<!-- None. openspec/specs/ is empty; this is the first capability in the repo. -->

## Impact

**Backend**
- `OwnerRestController.listOwners` — response type, query parameters, sort allowlist
- `OwnerRepository` — add `Page<Owner> findByLastNameStartingWith(String, Pageable)`
- `Owner` entity — `@Formula` derived `petCount`, `@BatchSize` on `pets`
- `OwnerDto` — gains `petCount`
- New Flyway migration for the `ro-x-icu` collation
- New page-response DTO (Spring's `Page` JSON shape is not stable API)

**Frontend**
- `owner-list.component.{ts,html}` — matSort headers, `mat-paginator`, URL sync, empty states,
  `switchMap` against out-of-order responses
- `owner.service.ts` — paged signature
- `owners.module.ts` — `MatSortModule`, `MatPaginatorModule`
- `owner-page.ts` — **deleted**, replaced by the generated type

**Contracts**
- `openapi.yaml` regenerated → `src/app/generated/api-types.ts` regenerated; Spectral lint

**Tests that break and must be repaired** (all identified, none unknown)
- `petclinic-test/src/owner-search.feature` — asserts all 28 owners on screen
- `petclinic-test/src/owner-search.glue.ts` — reads `GET /api/owners` as a bare array
- `petclinic-backend/.../features/functional/owners.feature` — "the response JSON array has size 2"
- `.../functional/OwnerSteps.java`
- `.../perf/OwnerSearchThroughLatencyProxyTest.java` — throughput baseline shifts (10 rows, not 28)
- `owner.service.spec.ts`, `owner-list.component.spec.ts`

**Gates**: CI runs a SonarCloud Quality Gate that fails the build; `CLAUDE.md` mandates TDD for
non-trivial code.
