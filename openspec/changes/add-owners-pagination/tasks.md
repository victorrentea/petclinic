## 1. Backend: paginated, sorted, slim owners listing (TDD)

- [ ] 1.1 Write `OwnerTest` (or a new slice test) asserting `GET /api/owners` returns a page
      object `{content, totalElements, totalPages, number, size}` with default `page=0`,
      `size=10` - verify the test fails against the current bare-array response
- [ ] 1.2 Write tests for `?page=`/`?size=` composing with existing `?lastName=` filter,
      including a page index past the last page returning 200 with empty `content` -
      verify tests fail (no `Pageable` support yet)
- [ ] 1.3 Write tests for the sort whitelist: `sort=lastName,asc`/`sort=city,asc` succeed;
      `sort=telephone,asc` and `sort=pets.name,asc` return 400 - verify tests fail
- [ ] 1.4 Write a test proving stable tie-breaker ordering (owners sharing a sort key never
      duplicate or skip across consecutive pages) using the seeded duplicate last names
      (`Potter`, `Darling`) - verify it fails
- [ ] 1.5 Write a test proving the list payload omits pet visits/type (slim
      `OwnerListItemDto` shape) while still including pet names - verify it fails
- [ ] 1.6 Add `OwnerListItemDto` and `OwnerPageDto` in `rest/dto/`, update `OwnerMapper` with
      a mapping to the slim item DTO, add `Pageable`/whitelisted-`Sort`-aware query method(s)
      to `OwnerRepository`, and update `OwnerRestController.listOwners` to accept
      `page`/`size`/`sort`, validate the whitelist, and return `OwnerPageDto` - run the tests
      from 1.1-1.5 and verify they all pass
- [ ] 1.7 Run `OpenApiExtractorTest` (or the project's openapi regeneration command) and
      verify `openapi.yaml` regenerates cleanly with the new response/parameter shapes and no
      drift failure

## 2. Database migration for collation and indexes

- [ ] 2.1 Add `db/migration/V9__owners_icu_collation_and_sort_indexes.sql` altering
      `owners.last_name`, `owners.first_name`, `owners.city` to `COLLATE "und-x-icu"` and
      creating indexes `(last_name, first_name, id)` and `(city, last_name, first_name, id)`
- [ ] 2.2 Start the backend against `./start-database.sh` and verify Flyway applies `V9__`
      cleanly with no errors, and existing rows are unaffected (row count and values
      unchanged)
- [ ] 2.3 Re-run the stable-ordering and Unicode-collation backend tests (from 1.4 and the
      spec's diacritic scenario) against the migrated schema and verify they pass, including
      a case proving a diacritic name (e.g. "Śliwiński") sorts with its base letter rather
      than after all ASCII letters

## 3. Frontend: sortable, paginated owners grid

- [ ] 3.1 Regenerate `api-types.ts` from the updated `openapi.yaml` (`npm run generate:api`)
      and verify the new page/list-item types are present
- [ ] 3.2 Delete the unused `petclinic-frontend/src/app/owners/owner-page.ts` and verify no
      remaining import references it (`grep -r owner-page src/`)
- [ ] 3.3 Update `OwnerService.getOwners`/`searchOwners` to call `GET /api/owners` with
      `page`/`size`/`sort`/`lastName` query parameters and return the generated page type -
      update `owner.service.spec.ts` and verify it passes
- [ ] 3.4 Update `owner-list.component.ts` to track `page`, `size`, and `sort` state, read/write
      them via the Angular router's query parameters, and reset `page` to 0 when the
      `lastName` search term changes - verify via `owner-list.component.spec.ts`
- [ ] 3.5 Update `owner-list.component.html`: render the Name column as
      `{{ owner.lastName }} {{ owner.firstName }}`, make the Name and City headers clickable
      to toggle sort direction, and add a page-size selector (5/10/20, default 10) built with
      `<app-combo>` - verify `owner-list.component.spec.ts` passes and manually verify in the
      browser via `./start-frontend.sh` that clicking headers and changing page size updates
      the URL query parameters and the grid
- [ ] 3.6 Verify `Address` and `Telephone` headers remain plain (non-clickable), matching the
      spec's sortable-column whitelist

## 4. Contract and end-to-end tests

- [ ] 4.1 Rewrite `owners.feature:14-17` ("Search owners by last name") to assert on the
      `content` array instead of a top-level array, and update `OwnerSteps.java` accordingly
      - verify the scenario passes
- [ ] 4.2 Add one `petclinic-test` Cucumber/Playwright scenario covering paging (navigate to
      a second page and verify different owners are shown, and changing page size changes
      the number of visible rows) - verify it passes end-to-end against a running backend
      and frontend
- [ ] 4.3 Run the full backend test suite (`mvn test` in `petclinic-backend`) and the full
      frontend test suite and verify both are green
