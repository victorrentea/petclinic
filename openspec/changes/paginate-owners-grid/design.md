## Context

See proposal.md — Why. The state that shapes the approach:

- `OwnerRepository` is a bare `Repository<Owner, Integer>` (not `JpaRepository`), so a `Pageable`
  overload has to be declared explicitly; there is no service layer, so the controller is where
  request-level policy lives.
- The grid is Bootstrap 3 with `*ngFor`. `MatSnackBarModule` is the only Angular Material module
  imported anywhere in the app.
- `owners` has no index but its primary key (`V1__core_owners_pets.sql`, confirmed against
  `pg_indexes`), while `V2` already indexes `vets (last_name)`.
- `openapi.yaml` is generated output; hand-editing it is denied in `.claude/settings.json`.
- `petclinic-frontend/src/app/owners/owner-page.ts` already declares the exact `Page` shape this
  change needs — dead since `72474ebe`, and about to be duplicated by the generated types.

## Goals / Non-Goals

**Goals:**
- One endpoint, one response shape, paged and ordered by the database.
- The sortable-column policy enforced on the server, not as a frontend convention.
- Stable page boundaries over the duplicate values the real data has.

**Non-Goals:**
- Introducing Angular Material table/sort/paginator. See Decisions.
- A general-purpose sort DSL. Two keys, whitelisted.
- Cleaning the `Ada Acceptance*` rows acceptance runs leave in the dev DB; adding the Chatbot
  container to `Deployment.drawio.png`; sorting by pet count.

## The contract

`GET /api/owners?lastName=&page=0&size=10&sort=name,asc`

```json
{ "content": [ ... ], "totalElements": 142, "totalPages": 15, "number": 0, "size": 10 }
```

- `page` defaults to `0`, `size` to `10` (the middle of the three offered sizes: 30 owners over
  size 10 is 3 pages, enough to see paging work in a demo), `sort` to `name,asc`.
- `sort` is `<key>,<asc|desc>` with `key` ∈ {`name`, `city`}. `name` expands to
  `lastName, firstName`; `city` maps to `city`. Anything else is 400.
- `id` is appended as the final sort key by the server, never sent by the caller.
- `lastName` keeps its current prefix-match meaning and is applied before paging, so
  `totalElements` counts only matches. The grid resets to `page=0` whenever it changes — without
  that, searching while on page 3 of 15 shows an empty grid for a filter that matches plenty,
  which is the classic "the search is broken" report.
- The grid's Name cell renders `lastName, firstName` — see Decisions.

## Decisions

**Break the response shape rather than add `/api/owners/paged`.** The deployment diagram declares
the Angular SPA as the backend's only traced client, and `DeploymentDiagramTest`'s third rule
means an undrawn client would have had to be added deliberately. `petclinic-chatbot` calls only
`/api/owners/{id}`; no MCP tool lists owners. Client and server ship from this repo in one deploy,
so there is no window where an old client meets a new server — versioning would be ceremony.
*Alternative rejected:* a second endpoint, leaving two code paths and a list endpoint that still
does not scale. *Caveat:* `petclinic-chatbot` is a REST caller with no box on the diagram; either
it is not considered deployed or the diagram has drifted. Out of scope, worth its own issue.

**A controller-level `enum OwnerSortField { NAME("lastName", "firstName"), CITY("city") }` maps the
allowed keys to columns; anything else is a 400.** Binding a raw `Pageable` lets a client send
`sort=pets.name` — Spring adds the join silently — or `sort=<typo>`, which throws a 500 from deep
inside JPA. The enum is also where the `name → lastName, firstName` expansion belongs. Per the
house style, it is an inner enum of the controller, not a top-level type.
*Alternative rejected:* `@PageableDefault` on a raw `Pageable` parameter, which is less code and
no whitelist at all.

**The `id` tiebreak is appended in the controller, not asked of the caller:**
`PageRequest.of(page, size, field.sort(direction).and(Sort.by("id")))`. With two `Potter`s, two
`Darling`s and six Londons, Postgres may return equal-key rows in any order per query, so under
`LIMIT/OFFSET` the same owner can land on two pages or none. Making the client send the tiebreak
would make correctness optional.

**`@BatchSize(size = 20)` on `Owner.pets`, not `JOIN FETCH`.** Hibernate cannot paginate a fetched
collection in SQL: it logs `HHH000104` and pages in memory after loading everything — precisely
the bug this change exists to remove. Paging alone already caps N at the page size; `@BatchSize`
takes 1+N to 2. Sizing it at 20 covers the largest offered page in one extra query.
*Alternative rejected:* an `@EntityGraph`, which has the same in-memory-paging trap.

**`V4__index_owner_sort_columns.sql` adds `owners (last_name, first_name, id)` and
`owners (city, id)`.** Leading columns mirror the `ORDER BY` exactly, including the `id` tiebreak,
so the index can serve the ordering rather than only the filter. The `lastName` prefix filter
rides the first index too. This is schema, so `db/migration/`, never `db/seed/`.

**The Bootstrap table stays; the paginator is hand-rolled around `<app-combo [options]="[5,10,20]">`.**
AGENTS.md makes `<app-combo>` mandatory for any single-select in a form, and `MatPaginator` embeds
its own `mat-select` for page size with no way to swap it — so the design system, not taste, rules
Material out. Pulling in `MatTableModule`/`MatSortModule` would also mean either restyling the grid
to Material or running two design languages in one table. The new header cells and paginator strip
carry stable ids/classes for the browser suites to target.

**The grid's Name cell is rendered surname first: `{{lastName}}, {{firstName}}`.** Ordering by
`last_name, first_name` is what a clinic user means by sorting names, but with the given name
printed first the sorted column is illegible — read against the dev data, page 1 ascending shows
`Ada Acceptance…`, `Henry Baskerville`, `James Bond`, `Sam Carraclough`, `George Darling`,
`Charles Dickens`: leading letters A, H, J, S, G, C. The eye tracks the first character, so a
correct sort reads as no sort at all. Surname-first makes the ordering self-evident and agrees
with the search box, which already asks for a last name.
*Alternatives rejected:* splitting Name into two sortable columns (widens the grid and rewrites
every row template and e2e selector for no extra information); sorting by `first_name` to match
the display (search filters on last name, so search and sort would disagree, and no clinic looks
people up by given name). *Scope:* only the grid. `owner-detail.component.html` keeps
`{{firstName}} {{lastName}}` — a single record is not a sorted column.

**Grid state goes through the Router as `?lastName=&page=&size=&sort=`,** with the component
reacting to `queryParamMap` and navigating (not re-fetching directly) on every control. One source
of truth, deep links work, the back button works, and the e2e suites can navigate straight to a
page instead of clicking there. Today the grid already loses its search text when you open an owner
and come back; this fixes that as a side effect.

**Generated artifacts are regenerated in the same commit as the controller change:** `openapi.yaml`
via `OpenApiExtractorTest`, then `npm run generate:api` for `src/app/generated/api-types.ts`. The
regenerated page type makes `owner-page.ts` redundant — delete it rather than keep two definitions
of one shape.

**`owner-search.feature`'s empty-search scenario is rewritten, not patched.** "Every owner in the
clinic is listed" is false by construction at size 10 over 30 owners. The step asks the API for
`totalElements` and asserts the grid shows the first page of them, and the scenario is renamed to
say so. Fetching every page to rebuild the old assertion would be testing the test.

## Blast radius

The array shape is read in eight places, all of which change with the contract:

*Backend tests* — `OwnerTest:131` (`search("/api/owners")`), `AddVisitApiTest:105`,
`VisitDateRangeApiTest:61` (`json(...).get(0).path("id")`), `OwnerSearchThroughLatencyProxyTest:55`.
`BasicAuthenticationConfigTest:37,44` asserts status only and should survive.

*Browser suites* — `add-visit.dsl.ts:16`, `owner-search.feature.glue.ts:33`,
`visit-date-range.dsl.ts:40`, `visit-date-range.feature.glue.ts:30`; each does
`axios.get(`${API_BASE}/owners`)` and treats the body as an array. The compiler catches the four
Java ones; these four do not fail until run.

*Generated and vendored artifacts* — `openapi.yaml` (via `OpenApiExtractorTest`; hand-editing is
denied in `.claude/settings.json`), then `src/app/generated/api-types.ts` via
`npm run generate:api`. `src/app/owners/owner-page.ts` is deleted once the generated type exists.

*Tooling* — `human-review.json` → `steps.dsaudit.screens` currently lists only "Book a visit" and
"Edit a pet"; the owners grid is added so the design-system audit visits the screen this change
touches.

## Risks / Trade-offs

- **Collation drift.** `Śliwiński` sorts between `Silver` and `Tremaine` under `en_US.UTF-8` but
  after `Tremaine` under `C`, and an index built under a different collation will not serve the
  ordering at all → a test pins the expected position of that row so a differently-initialised
  embedded Postgres fails loudly instead of quietly reordering pages.
- **`OFFSET` makes the last page the most expensive one.** At 100k rows this is acceptable; keyset
  paging would change the response contract → revisit only if page latency shows up in traces.
- **Breaking the response shape breaks eight known call sites at once.** They are enumerated in
  tasks.md; the compiler catches the four Java ones, the four TypeScript DSL/glue files do not
  fail until run → the browser suites run before the change is called done.
- **Ascending name sort opens the grid on `Ada Acceptance*` leftovers** in the dev DB, so demos
  start on test garbage → not this change's bug; noted as out of scope, cleanup is a separate issue.
- **The comma in "Darling, George" collides with a test fixture.**
  `owner-search.feature.glue.ts:17` parses the feature's expected-owner cell with
  `cell.split(',')`, and `fullName` at line 16 builds `First Last`; both stop working the moment
  a rendered name contains a comma → the feature's list separator changes (`;`) and `fullName`
  becomes surname-first, in the same task. `add-owner.spec.ts:55` asserts
  `toContainText('Ada ${lastName}')` and flips the same way.
- **Hand-rolled paginator means hand-rolled accessibility.** Sort headers need `aria-sort` and
  keyboard activation that `MatSort` would have given for free → the design-system audit step in
  `human-review.json` gains the owners grid so this screen is actually inspected.
