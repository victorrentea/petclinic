## 1. Database

- [x] 1.1 Add Flyway migration `V9__index_owners_for_paging.sql` with the three indexes from design D12 (`last_name, first_name, id`; `last_name text_pattern_ops`; `city, id`); verify the backend boots and `\d owners` (or the Postgres MCP) lists all three.
- [x] 1.2 Regenerate `petclinic-backend/DB.sql` and `petclinic-backend/docs/generated/DB.puml`; verify the DB-drift guardrail test passes. (`DB.puml` models tables and relations, not indexes, so it came back byte-identical - only `DB.sql` changed.)

## 2. Backend — failing tests first (TDD)

- [x] 2.1 In `OwnerTest`, write a failing test asserting `GET /api/owners` returns a page envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) with 10 rows by default, ordered by last name then first name.
- [x] 2.2 Write the failing **tiebreaker test**: sorted by `city`, walk every page with size 5 and assert each owner appears exactly once and the collected count equals `totalElements` (the 6-Londons bug, design D6).
- [x] 2.3 Write a failing test that `sort=pets.visits.description` (and any non-whitelisted key) returns HTTP 400 and no rows (design D7).
- [x] 2.4 Write a failing test combining `lastName` with `page`/`size`: the page contains only matching owners and `totalElements` counts only matches.
- [x] 2.5 Write a failing test that an out-of-range page returns an empty `content` with the correct `totalElements`/`totalPages`.

## 3. Backend — implementation

- [x] 3.1 Add a `Pageable` finder to `OwnerRepository` for the last-name prefix filter; verify 2.1 and 2.4 now reach the repository (paging applied in SQL, visible in the query log).
- [x] 3.2 Change `OwnerRestController.listOwners` to accept `lastName`, `page`, `size`, `sort` and return `Page<OwnerDto>`, defaulting to page 0 / size 10 / `name` ascending; verify 2.1 passes.
- [x] 3.3 Map the logical sort keys `name`/`city` to `last_name, first_name, id` / `city, id` with the unconditional `id` tiebreaker, rejecting anything else with `ResponseStatusException` 400 in the controller; verify 2.2 and 2.3 pass.
- [x] 3.4 Confirm `GET /api/owners/count` and the class-level `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")` are untouched; verify `BasicAuthenticationConfigTest` and the count endpoint's test still pass.
- [x] 3.5 Run the full backend suite; verify green, including `OwnerSearchThroughLatencyProxyTest` and `OwnerMcpResourceTest` after any needed adaptation.
- [x] 3.6 Fix the backend functional Cucumber glue (`OwnerSteps`) and `features/functional/owners.feature`, which assert a JSON array; verify `FunctionalCucumberSuite` is green. (Surefire does not pick this suite up by name, so it must be run explicitly: `mvn test -Dtest=FunctionalCucumberSuite`.)

## 4. Contract artifacts

- [x] 4.1 Regenerate `openapi.yaml`; verify `OpenApiExtractorTest` passes and the paged response shape is present.
- [x] 4.2 Run `npm run generate:api` in `petclinic-frontend`; verify `api-types.ts` carries the page envelope and the app compiles.
- [x] 4.3 Regenerate `endpoint-complexity.*`; verify its drift guardrail passes.

## 5. Frontend — failing tests first

- [x] 5.1 In `owner-list.component.spec.ts`, write failing tests for: changing page, changing size (5/10/20), toggling sort on Name and City, and search resetting to page 0 while keeping sort and size (design D11).
- [x] 5.2 Write a failing test that an empty response with `number > 0` triggers a re-request of page 0.
- [x] 5.3 Write a failing test that the Name cell renders `Potter, Harry` (design D5).

## 6. Frontend — implementation

- [x] 6.1 Update `owner.service.ts` to send `lastName`, `page`, `size`, `sort` and return the page envelope typed by the revived `owner-page.ts`; verify `owner.service.spec.ts` passes.
- [x] 6.2 Add clickable ▲/▼ sort headers on Name and City only (none on Address, Telephone, Pets) in the existing Bootstrap table, keeping `#ownersTable` and `td.ownerFullName`; verify 5.1 passes.
- [x] 6.3 Add the pager strip with the 5/10/20 `<select>`, defaulting to 10 and not persisted; verify 5.1 passes.
- [x] 6.4 Render the name as `Lastname, Firstname`; verify 5.3 passes.
- [x] 6.5 Sync `lastName`/`page`/`size`/`sort` to the URL through the `Router` and restore them on load; verify Back from an owner's details returns to the same page, sort and size (design D10).
- [x] 6.6 Run the frontend unit suite; verify green.

## 7. E2E and other callers

- [x] 7.1 Update `owner-search.glue.ts`: read `data.content` instead of asserting `Array.isArray(data)`, and flip the `fullName` helper to `Potter, Harry`; verify the glue compiles.
- [x] 7.2 Convert the owner-listing steps from a comma-separated `{string}` cell to a Gherkin data table (`namesIn` cannot parse `Potter, Harry`); verify the existing `owner-search.feature` scenarios still pass after the conversion.
- [x] 7.3 Move `openspec/changes/add-owners-pagination/acceptance/owners-pagination.feature` into `petclinic-test/src/` and write the step definitions it needs (page size, sort by column, go to page, walk to last page, pager assertions, sort-control presence, go back); verify each scenario fails before the feature exists and passes after.
- [x] 7.4 Rewrite the `owners.feature` scenario "Searching with an empty last name lists every owner" into "the first page lists the first 10 owners, and paging to the last page lists all 28", and update the `| Harry Potter |` data tables.
- [x] 7.5 Update `petclinic-test/scripts/record-bug40.js` and the `docker-compose.test.yml` healthcheck for the new response shape; verify the healthcheck reports healthy.
- [x] 7.6 Run the full Playwright/Cucumber e2e suite against a locally started stack; verify green (e2e is mandatory, never skipped).

## 8. Docs and wrap-up

- [x] 8.1 Re-shoot the owners-grid screenshot in `user-manual/` showing the pager and sort arrows; verify `manual.md` renders it.
- [x] 8.2 Update `CLAUDE.md` (REST Contract section) to state that `/api/owners` is paged, and note in issue #25 that Address, Telephone and Pets are unsortable by design (design D4).
- [x] 8.3 Run the full guardrail set (`GUARDRAILS.md`) and verify no drift check fails before pushing.
