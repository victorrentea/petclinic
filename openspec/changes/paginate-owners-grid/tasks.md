## 0. Clear the tree first

- [ ] 0.1 Commit the uncommitted issue-#40 work (visit-date validation) on its own, and the `AGENTS.md` volumetry note on its own; verify `git status` is clean before touching anything below, so the #25 diff is readable

## 1. Backend — page the query (TDD, red first)

- [ ] 1.1 Add failing tests to `OwnerTest` (or a new `OwnerPageTest`): default listing returns 10 items with a `page` object carrying the true `totalElements`; verify they fail against today's array response
- [ ] 1.2 Add a failing test that walking every page of `?sort=city,asc` yields disjoint id sets covering all owners exactly once — the tie-stability requirement; verify it fails without a final tie-breaker
- [ ] 1.3 Add failing tests for the rejections: `?sort=address` → 400, `?sort=pets.visits.description` → 400, `?size=100000` → 400, `?size=7` → 400; verify each currently returns 200
- [ ] 1.4 Change `OwnerRepository.findByLastNameStartingWith` to take a `Pageable` and return `Page<Owner>`; verify the module compiles and 1.1 gets past the repository layer
- [ ] 1.5 Change `OwnerRestController.listOwners` to accept `Pageable`, apply the sort/size whitelist (`IllegalArgumentException` → 400 via `ExceptionControllerAdvice`), append the `id` tie-breaker, and return `PagedModel<OwnerDto>`; verify tests 1.1–1.3 go green
- [ ] 1.6 Update the endpoint's `@Operation`/`@ApiResponse` schema and `ApiExamples.OWNERS` to the page shape; verify `mvn -pl petclinic-backend test` is green and the Swagger example parses

## 2. Backend — make it fast

- [ ] 2.1 Add a failing test counting queries for a 10-owner page with pets (expect 2, not 11) using the repo's existing query-counting instrumentation; verify it fails at 11
- [ ] 2.2 Add `@BatchSize` to `Owner.pets`; verify 2.1 goes green and no `HHH90003004` warning appears in the test log
- [ ] 2.3 Write `V9__index_owners.sql` creating `owners (last_name, first_name, id)`, `owners (city, id)` and `owners (last_name text_pattern_ops)`, with a comment naming what each serves; verify `JpaMatchesDBSchemaTest` and the Flyway boot still pass
- [ ] 2.4 Confirm the indexes are actually used: run `EXPLAIN` for the default ordering and for the `LIKE 'Pot%'` filter against the local database and verify no sequential scan of `owners` and no separate sort node on the default ordering

## 3. Frontend — paged, sorted grid

- [ ] 3.1 Regenerate `openapi.yaml` (`OpenApiExtractorTest`) and `api-types.ts` (`npm run generate:api`); verify the generated page type appears and the drift check is clean
- [ ] 3.2 Delete `src/app/owners/owner-page.ts`; verify `ng build` still succeeds (nothing imported it)
- [ ] 3.3 Collapse `OwnerService.getOwners`/`searchOwners` into one call taking page, size, sort and lastName and returning the generated page type; verify `owner.service.spec.ts` passes after being updated to the new shape
- [ ] 3.4 Drive `OwnerListComponent` from `queryParamMap` (page, size, sort, lastName), navigating on every interaction and resetting to page 0 on a new search; verify updated `owner-list.component.spec.ts` covers the reset-to-page-0 and deep-link cases
- [ ] 3.5 Add `matSort` to the Name and City headers only, and a `<mat-paginator>` with `[5, 10, 20]` below the table, keeping `#ownersTable` and `td.ownerFullName` intact; import `MatSortModule`/`MatPaginatorModule` in `owners.module.ts`; verify `ng build` (strict) passes and the selectors still resolve
- [ ] 3.6 Render the Name cell as `lastName, firstName`; verify the updated `.ownerFullName` assertion in `owner-list.component.spec.ts` passes
- [ ] 3.7 Reuse or delete the orphan `.owners-controls` / `.owners-pagination` / `.owners-page-size` rules in `owner-list.component.css`; verify no unused pagination CSS is left behind

## 4. Fix the other consumers of the array shape

- [ ] 4.1 Update `petclinic-test/src/owner-search.glue.ts` (`the clinic has these owners`) to read `data.content`; verify the existing search scenarios pass
- [ ] 4.1b Move the glue's `fullName` helper to `lastName, firstName` and update the Background data table; verify the Background fails loudly on a mismatched seed rather than on the search step
- [ ] 4.1c Replace the comma separator in the `Examples` expected-owners column (and `namesIn`'s `split(',')`) with one that survives commas inside a name; verify a two-owner expectation still parses as two names, not four
- [ ] 4.2 Update `petclinic-test/src/visit-date-validation.dsl.ts` (`aPetWithAKnownBirthDateExists`) to iterate `data.content`; verify `visit-date-validation.spec.ts` passes
- [ ] 4.3 Update the scratchpad film scripts `bug-before.js` / `bug-after.js`; verify each still runs end to end

## 5. E2E — the grid's own scenarios

- [ ] 5.1 Rewrite the `@generate_sequence` scenario in `owner-search.feature` from "every owner in the clinic is listed" to "the first page of owners is listed" (first 10 of the default order + reported total); verify it passes and still produces a `Browser -> Backend` call
- [ ] 5.2 Add scenarios for: default page, changing page size, navigating to page 2, sorting by Name, sorting by City, and search combined with paging; verify all pass and that none of them creates or deletes an owner (the `petclinic-test/AGENTS.md` rule)
- [ ] 5.3 Extend `owner-search.glue.ts` with the paginator/sort steps, reusing `expectOwnersListed`; verify the whole Cucumber suite is green

## 6. Regenerate guardrail artifacts and land it

- [ ] 6.1 Regenerate `petclinic-backend/DB.sql` (`DbSchemaExtractorTest`) and `docs/generated/DB.puml`; verify the DB.sql↔DB.puml pre-push guard passes
- [ ] 6.2 Re-run `./run-tests-with-tracing.sh` to regenerate `owner-search.feature.genseq.puml`/`.json`; verify `DeploymentDiagramTest` still finds the `Browser -> Backend` arc
- [ ] 6.3 Run the full local gate — backend `mvn test`, strict `ng build`, Spectral lint on the new `openapi.yaml`, and the e2e suite — and verify everything is green before pushing
- [ ] 6.4 Post the "sortable by Name and City only, not any column" deviation as a comment on issue #25, and open the PR flagging that `openapi.yaml` and `db/migration/` need `@victorrentea/elders` review; verify the CODEOWNERS reviewers are requested on the PR
