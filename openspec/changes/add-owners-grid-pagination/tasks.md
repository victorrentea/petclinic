Tests come first within each group, per `CLAUDE.md` → Task Modifiers. Requirement references point
at `specs/owner-listing/spec.md`; decision references (D1–D10) at `design.md`.

## 1. Database foundation — collation

- [ ] 1.1 Write a failing backend test that seeds owners named "Stan", "Ștefan", "Tudor" and a lowercase "popescu", sorts by name ascending, and asserts locale order (requirement: *Names are ordered by locale rules*)
- [ ] 1.2 Add the Flyway migration pinning `ro-x-icu` on `owners.last_name`, `first_name`, `city` (D5); confirm 1.1 passes
- [ ] 1.3 Verify the migration applies cleanly to a database created by `./start-database.sh` and that existing backend tests still pass

## 2. Domain — pet count and fetch strategy

- [ ] 2.1 Write a failing test asserting owners sorted by pet count ascending place the zero-pet owners first (requirement: *Sortable columns…* / *Sorting by pets ascending*)
- [ ] 2.2 Add the `@Formula` derived `petCount` to the `Owner` entity (D3); confirm 2.1 passes
- [ ] 2.3 Write a guardrail test asserting the query count for one page load stays bounded as page size grows — this is what stops a fetch join being reintroduced (D4)
- [ ] 2.4 Add `@BatchSize` to `Owner.pets` and to `Pet.visits`; confirm 2.3 passes
- [ ] 2.5 Confirm no `HHH000104` in-memory-pagination warning appears in the logs for any paged query

## 3. Backend API — contract and validation

- [ ] 3.1 Write failing controller tests for defaults: no parameters yields page 0, size 10, name ascending (requirement: *The default view is defined and populated*)
- [ ] 3.2 Write failing tests for each sortable column in both directions, and for the tiebreaker: the two Potters come back in a stable, name-ordered sequence (requirement: *Ordering is deterministic across pages*)
- [ ] 3.3 Write failing tests for parameter validation: `page=99999` yields an empty page with a true total; `size=1000` clamps to 20; `size=7` succeeds at a supported size; `sort=telephone` and an unrecognised sort name both yield 400 (requirement: *View-state parameters are validated*)
- [ ] 3.4 Write a failing test asserting the total count reflects the `lastName` filter, not the table size
- [ ] 3.5 Add the page-response DTO — `content`, `totalElements`, `number`, `size` — rather than exposing Spring's `Page` (D2)
- [ ] 3.6 Add `Page<Owner> findByLastNameStartingWith(String, Pageable)` to `OwnerRepository`, keeping it on the minimal `Repository<Owner,Integer>` interface — do **not** widen to `JpaRepository` (D6 context)
- [ ] 3.7 Implement the sort allowlist in the controller: map the public names `name` / `city` / `petCount` to entity properties, reject anything else with 400 before building a `Sort`, and append the last-name/first-name/id tiebreaker in the same method (D6, D7). Do not accept Spring's `Pageable` resolver unvalidated
- [ ] 3.8 Add `petCount` to `OwnerDto`; confirm all of 3.1–3.4 pass

## 4. Contract regeneration

- [ ] 4.1 Regenerate `openapi.yaml` from the backend and review the diff for the owners list operation
- [ ] 4.2 Run `npm run lint:openapi` (Spectral) and resolve any finding
- [ ] 4.3 Run `npm run generate:api` to refresh `src/app/generated/api-types.ts`
- [ ] 4.4 Delete `petclinic-frontend/src/app/owners/owner-page.ts` and switch all usages to the generated type (D2)

## 5. Frontend — service and component

- [ ] 5.1 Write failing Karma specs: changing sort, page size or search each returns to page 1 (requirement: *Changing sort, page size or search returns to the first page*)
- [ ] 5.2 Write failing Karma specs: view state is written to and read back from the query parameters (requirement: *View state is addressable and shareable*)
- [ ] 5.3 Write a failing Karma spec: when two responses arrive out of order, the newest wins (requirement: *The most recent request determines what is displayed*)
- [ ] 5.4 Update `owner.service.ts` to the paged signature, keeping `.pipe()` on its own line per `CLAUDE.md`
- [ ] 5.5 Drive the component from the query parameters as the single source of view state, using `replaceUrl` for sort/page/size so Back leaves the grid rather than replaying sort clicks (D10)
- [ ] 5.6 Apply `switchMap` to the request stream (D9); confirm 5.3 passes
- [ ] 5.7 Import `MatSortModule` and `MatPaginatorModule` into `owners.module.ts`

## 6. Frontend — the grid itself

- [ ] 6.1 Add `matSort` to the table and `mat-sort-header` to the Name, City and Pets headers only; leave Address and Telephone as plain headers (D8, requirement: *Sortable columns are restricted…*)
- [ ] 6.2 Add `<mat-paginator>` below the table with page-size options 5 / 10 / 20 and a visible total; no jump-to-page control
- [ ] 6.3 Fix the malformed Pets cell — it currently opens a `<tr>` inside a `<td>` — and render the count alongside the pet names, showing an explicit `0` for owners with none (requirement: *The Pets column shows the count…*)
- [ ] 6.4 Implement the three distinct states: search-matched-nothing (naming the term, search field retained), no-owners-at-all, and request-failed (requirement: *Empty and failed results are distinguishable*)
- [ ] 6.5 Add the empty-page message and its link back to page 1 for a page index past the end
- [ ] 6.6 Move the Add Owner control out of the table block so it is present in every state (requirement: *Adding an owner is always reachable*)
- [ ] 6.7 Preserve `#ownersTable` and `td.ownerFullName`; add `data-testid` hooks for the paginator and sort headers

## 7. Repair the tests this change breaks

- [ ] 7.1 `petclinic-test/tests/support/api-client.ts` — `fetchOwners()` / `fetchOwnersByPrefix()` for the page response
- [ ] 7.2 `petclinic-backend/src/test/resources/features/functional/owners.feature` — the step asserting the body is a JSON array of size 2
- [ ] 7.3 `petclinic-backend/.../functional/OwnerSteps.java` — list-response parsing
- [ ] 7.4 `petclinic-frontend/.../owner.service.spec.ts` and `owner-list.component.spec.ts` — stubs returning `Observable<Owner[]>`
- [ ] 7.5 Run `OwnerSearchThroughLatencyProxyTest` and confirm it still passes in CI; record the shifted baseline but do not tune it (this test is known-flaky locally, green in CI)

## 8. End-to-end

- [ ] 8.1 Rewrite `owners.spec.ts` → *shows the first 10 owners, sorted by name* (replacing *shows all owners on initial load*)
- [ ] 8.2 Add one deep-link test: navigating straight to `?page=2&size=5&sort=city,asc` renders that exact view — the only test proving the URL → backend → grid chain end to end
- [ ] 8.3 Confirm no per-column or per-page-size E2E was added; that coverage stays in backend tests

## 9. Documentation and close-out

- [ ] 9.1 Record in `CLAUDE.md` that positional-paging drift under concurrent inserts is **known and accepted**, with the keyset trade-off spelled out, so it is not "fixed" later
- [ ] 9.2 Record in `CLAUDE.md` the `ro-x-icu` decision and why the collation sits on the columns rather than the database
- [ ] 9.3 Open the follow-up issue for trimming `visits` out of the list payload (design.md → Open Questions)
- [ ] 9.4 Run the full backend and frontend suites plus the E2E suite; confirm the SonarCloud Quality Gate passes on the pull request
