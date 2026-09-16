## 1. Database

- [ ] 1.1 Add a versioned Flyway migration in `petclinic-backend/src/main/resources/db/migration/`
  creating index `owners(last_name, first_name, id)`, and verify the app boots cleanly against a
  freshly wiped `./start-database.sh` instance (Flyway applies without checksum errors)
- [ ] 1.2 Add `@BatchSize` to `Owner.pets`, and verify a test that loads a page of owners with pets
  issues one batched query instead of one query per owner (no `HHH000104` warning in logs)

## 2. Backend: paginated, sorted, filtered listing

- [ ] 2.1 Create `PageDto<T>` (`content`, `totalElements`, `totalPages`, `number`, `size`) under
  `rest/dto/`, and verify it serializes to the documented JSON shape via a unit/mapper test
- [ ] 2.2 Add a repository query on `OwnerRepository` that accepts `Pageable` and the `lastName`
  prefix filter and returns `Page<Owner>`, and verify with a repository test that filtering,
  paging, and the requested sort are all applied
- [ ] 2.3 Update `OwnerRestController#listOwners` to accept `Pageable pageable` (via
  `@PageableDefault(size = 10, sort = "lastName")`), map the result through `PageDto<OwnerDto>`, and
  verify `GET /api/owners` with no parameters returns page 0, size 10 in the new envelope shape
- [ ] 2.4 Add a sort-property allowlist check (`lastName`, `firstName`, `address`, `city`,
  `telephone`) in the controller, rejecting any other property (including `pets`) with 400 via
  `ExceptionControllerAdvice`, and verify with tests for an allowlisted, a non-allowlisted, and an
  unknown sort property
- [ ] 2.5 Add an explicit `size > 20` guard returning 400, and verify with a test that `size=21`
  (and other over-cap values) is rejected while `size=20` succeeds
- [ ] 2.6 Apply an `id ASC` tiebreaker and `NULLS LAST` (both directions) to every resolved `Sort`,
  and verify with a test using owners that share a sort-column value (and a null `telephone`) that
  page boundaries stay stable and non-overlapping across repeated requests
- [ ] 2.7 Regenerate `openapi.yaml` via `OpenApiExtractorTest` (do not hand-edit), and verify the
  generated spec documents `page`/`size`/`sort` parameters and the new response envelope

## 3. Frontend: Owners grid

- [ ] 3.1 Update the (currently orphaned) `OwnerPage` type and `OwnerService.getOwners` to call the
  new paginated endpoint and return `OwnerPage`, and verify with a service spec that page/size/sort
  query parameters are sent and the envelope is parsed
- [ ] 3.2 Replace the Owners grid's plain `<table>` with `MatTable` + `MatSort` + `MatPaginator`
  bound to server-side paging/sorting, keeping the `#ownersTable` and `td.ownerFullName` selectors,
  and verify the existing component spec (updated) renders a page of owners
- [ ] 3.3 Fix the pre-existing invalid markup for the `Pets` cell (`<tr>` nested inside a `<td>`),
  and verify the rendered table has exactly one `<tr>` per owner row
- [ ] 3.4 Render the `Name` column as `"LastName, FirstName"` and wire its sort to `lastName,
  firstName`, and verify with a component test that clicking the header issues a request sorted by
  `lastName,firstName`
- [ ] 3.5 Wire the paginator to offer page sizes 5, 10, and 20, and verify selecting a size issues a
  new request with that `size` and `page=0`
- [ ] 3.6 Make last-name search reset to page 0 while keeping the current sort, and verify with a
  component test that submitting a search resets `page` to 0 without changing `sort`

## 4. Tests and fixtures

- [ ] 4.1 Update `OwnerTest`, `AddVisitSequenceTest`, `BasicAuthenticationConfigTest`, and
  `OwnerSearchThroughLatencyProxyTest` for the new response envelope, and verify they pass
- [ ] 4.2 Update cucumber `OwnerSteps` and the Playwright E2E glue for the new envelope and grid
  markup, and verify the affected scenarios pass
- [ ] 4.3 Rewrite the `every owner in the clinic is listed` E2E scenario (28 seeded owners no longer
  fit on one 10-row page) and add a new pagination scenario (change page, change page size), and
  verify both pass against `./start-database.sh` + `./start-backend.sh` + `./start-frontend.sh`
- [ ] 4.4 Update the `start-apps.ts` healthcheck for the new `GET /api/owners` response shape, and
  verify `./start-*.sh` scripts still report `✅ started` for all three apps

## 5. Full verification

- [ ] 5.1 Run the full backend test suite (`mvn test` in `petclinic-backend/`) and verify all tests
  pass
- [ ] 5.2 Run the full frontend test suite (`ng test` in `petclinic-frontend/`) and verify all tests
  pass
- [ ] 5.3 Run the Playwright E2E suite in `petclinic-test/` against the running apps and verify all
  scenarios pass
