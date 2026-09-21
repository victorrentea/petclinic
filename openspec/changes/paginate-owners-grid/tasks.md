## 1. Repository paging (TDD)

- [x] 1.1 Write a failing `@DataJpaTest`-style slice asserting `findByLastNameStartingWith("", PageRequest.of(0, 10, Sort.by("lastName","firstName","id")))` returns 10 owners and `totalElements` = the seeded count; verify it fails to compile/run against today's `List` signature
- [x] 1.2 Change `OwnerRepository.findByLastNameStartingWith` to `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`; verify 1.1 passes
- [x] 1.3 Add the stability case: walk every page sorted by `lastName` only-plus-`id` and assert the two `Potter`s and two `Darling`s each appear exactly once across pages of size 5; verify it passes
- [x] 1.4 Add the collation pin: assert `Śliwiński` sorts between `Silver` and `Tremaine` ascending by name, with a failure message naming collation as the cause; verify it passes on the embedded Postgres

## 2. N+1 and indexes

- [x] 2.1 Write a failing assertion (Hibernate statistics or a query-count rule) that fetching one page of 10 owners with pets issues a constant number of queries, not 1+N; verify it fails today
- [x] 2.2 Add `@BatchSize(size = 20)` to `Owner.pets`; verify 2.1 passes and no `HHH000104` warning appears in the log
- [x] 2.3 Add `db/migration/V4__index_owner_sort_columns.sql` creating `owners (last_name, first_name, id)` and `owners (city, id)`; verify the app boots and `pg_indexes` lists both after `./start-database.sh` + backend start
- [x] 2.4 Verify with `EXPLAIN` on a sorted page query that the planner uses the new index for the ordering (no `Sort` node over a seq scan)

## 3. Controller contract (TDD)

- [x] 3.1 Write failing controller tests: `sort=address`, `sort=telephone` and `sort=pets.name` each return 400 with a message naming `name` and `city`; verify they fail today (currently 200 or 500)
- [x] 3.2 Add the inner `enum OwnerSortField { NAME("lastName","firstName"), CITY("city") }` and the `page`/`size`/`sort` parameters with defaults `0` / `10` / `name,asc`; append `Sort.by("id")` as the final key; verify 3.1 passes
- [x] 3.3 Change `listOwners` to return `Page<OwnerDto>` and update its OpenAPI annotations; verify a manual `GET /api/owners?page=1&size=5&sort=city,desc` returns the envelope with the right `number`, `size`, `totalElements`, `totalPages`
- [x] 3.4 Verify a `page` beyond the last returns 200 with empty `content` and unchanged `totalElements`

## 4. Backend fallout

- [x] 4.1 Update `OwnerTest:131`, `AddVisitApiTest:105`, `VisitDateRangeApiTest:61` and `OwnerSearchThroughLatencyProxyTest:55` to read `content[...]` instead of the bare array; verify `mvn test` is green (`BasicAuthenticationConfigTest` asserts status only and should need no change — confirm)
- [x] 4.2 Regenerate `openapi.yaml` by running `OpenApiExtractorTest`; verify the diff shows the page envelope and the new parameters, and that the file was not hand-edited

## 5. Frontend data layer

- [x] 5.1 Run `npm run generate:api`; verify `src/app/generated/api-types.ts` carries the paged owners response
- [x] 5.2 Delete `src/app/owners/owner-page.ts` and point any reference at the generated type; verify `npm run build` succeeds with no orphan import
- [x] 5.3 Replace `getOwners()`/`searchOwners()` in `owner.service.ts` with one call taking `{lastName, page, size, sort}` and returning the page envelope; verify the existing `owner.service` specs (updated) pass

## 6. Owners grid

- [x] 6.1 Drive the grid from `queryParamMap` (`lastName`, `page`, `size`, `sort`) and make every control `router.navigate` instead of fetching directly; verify opening a crafted URL loads that exact page/sort/filter
- [x] 6.2 Make the Name and City `<th>` clickable with a direction indicator and `aria-sort`, keyboard-activatable; leave Address/Telephone/Pets plain; verify clicking Name toggles asc/desc and re-queries
- [x] 6.3 Add the paginator strip (prev/next, page indicator, disabled at the ends) with `<app-combo [options]="[5,10,20]">` for rows-per-page; verify the DOM carries `data-ds="combo"` and no raw `<select>`
- [x] 6.4 Reset to page 0 whenever the last-name filter changes; verify searching from page 3 lands on page 1 of the new result, not an empty page
- [x] 6.5 Render the Name cell as `{{owner.lastName}}, {{owner.firstName}}` in `owner-list.component.html`; verify the grid sorted by name ascending shows non-decreasing first letters, and that `owner-detail.component.html` still reads given-name-first
- [x] 6.6 Update `owner-list.component.spec.ts` for the paged shape and the surname-first cell (`.ownerFullName` at :103); verify `npm run test-headless` is green

## 7. Browser suites and tooling

- [x] 7.1 Update `add-visit.dsl.ts:16`, `owner-search.feature.glue.ts:33`, `visit-date-range.dsl.ts:40` and `visit-date-range.feature.glue.ts:30` to read `content` from the page envelope; verify each suite runs
- [x] 7.2 Fix the comma collision: in `owner-search.feature.glue.ts` make `fullName` (:16) build `Last, First` and switch the expected-owner list separator away from `,` (:17 `namesIn`, plus the feature file's cells); update `add-owner.spec.ts:55` to expect `${lastName}, Ada`; verify both suites pass and no expectation silently splits a rendered name in two
- [x] 7.3 Rewrite `owner-search.feature`'s empty-search scenario to assert the grid shows the first page of `totalElements` owners, renaming the scenario to say "first page"; verify it passes
- [x] 7.4 Add `"Owners": "owners"` to `human-review.json` → `steps.dsaudit.screens`; verify the design-system audit visits the owners grid
- [ ] 7.5 Run the full browser suite; verify green end to end (no suite is skipped)

## 8. Close-out

- [ ] 8.1 Update AGENTS.md if any documented behavior drifted (the owners endpoint contract, the sortable-column policy); verify the statement matches the shipped code
- [ ] 8.2 Run `mvn test` and the frontend tests together and verify both are green before committing
