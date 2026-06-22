## 1. Backend — repository paging & sorting (TDD)

- [x] 1.1 Add a repository test asserting `searchOwners(pattern, Pageable)` returns a `Page<Owner>` with correct `totalElements` and page slice for a known dataset
- [x] 1.2 Add a test asserting sort direction (asc/desc) on `city` and that an empty `q` matches all owners with default `firstName,lastName` order
- [x] 1.3 Change `OwnerRepository.searchOwners` to `Page<Owner> searchOwners(@Param("pattern") String pattern, Pageable pageable)` (keep the existing cross-column `LIKE` + pet `EXISTS` JPQL); let Spring Data derive the count query
- [x] 1.4 Run the repository tests until green

## 2. Backend — controller contract (TDD)

- [x] 2.1 In `OwnerTest`, add a test that `GET /api/owners` returns the `Page` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) with default size 10 when no params given
- [x] 2.2 Add tests for `page`/`size` paging, Name sort (orders by `firstName` then `lastName`), `sort=city,asc` / `sort=city,desc`, default order (`firstName,lastName`) when `sort` omitted, non-sortable column (address/telephone/pets) falling back to default (no error), and `q` + sort + page composing
- [x] 2.3 Update `OwnerRestController.listOwners` to accept `page`, `size`, `sort` (or `Pageable`) plus `q`, whitelist only the sortable columns (Name → `firstName,lastName`; and `city`) with a safe `Sort.by("firstName","lastName")` default — Address/Telephone/Pets not sortable — and return the paged `OwnerDto` response
- [x] 2.4 Map `Page<Owner>` → paged `OwnerDto` (reuse `OwnerMapper` for content, preserve page metadata)
- [x] 2.5 Run controller tests until green; confirm no N+1 regression on the list endpoint (page-bounded to ≤ size rows; was unbounded before)

## 3. API contract & drift artifacts

- [x] 3.1 Run the backend so the OpenAPI extractor regenerates `openapi.yaml`; verify the `GET /api/owners` response is now the paged shape and `OpenApiExtractorTest` passes
- [x] 3.2 Regenerate frontend types with `npm run generate:api` and confirm `petclinic-frontend/src/app/generated/api-types.ts` reflects the paged response

## 4. Frontend — service & model

- [ ] 4.1 Update `OwnerService.getOwners`/`searchOwners` to accept `{ q, page, size, sort }`, build the query string, and return `Observable<OwnerPage>` (use the existing `OwnerPage` model)
- [ ] 4.2 Update/extend `owner.service.spec.ts` to assert the request URL params and that the response maps to `OwnerPage`

## 5. Frontend — list component & template

- [ ] 5.1 In `OwnerListComponent`, hold `sortField`, `sortDir`, `pageIndex`, `pageSize` (default 10); load via the paged service call and store the returned page
- [ ] 5.2 Make the Name and City `<th>` headers clickable: click sorts ascending, click again toggles descending; show an asc/desc indicator on the active column (Address, Telephone, and Pets headers stay non-sortable)
- [ ] 5.3 Add Bootstrap pagination controls below the table and a page-size `<select>` for 5/10/20 (default 10); changing either refetches the matching server page
- [ ] 5.4 Ensure sort/page state composes with the existing search box (searching resets to page 0)
- [ ] 5.5 Update `owner-list.component.spec.ts` for header-click sorting, pagination, and page-size behavior

## 6. End-to-end & verification

- [ ] 6.1 Add/extend a Playwright e2e under `petclinic-ui-test/` covering: sort by a column header (asc/desc indicator), navigate pages, and change page size to 20
- [ ] 6.2 Run backend tests, frontend unit tests, and the e2e suite; confirm all green
- [ ] 6.3 Manually verify the Owners screen in the running app (sortable headers, pagination, 5/10/20 selector default 10)

## 7. Wrap-up

- [ ] 7.1 Confirm drift artifacts (`openapi.yaml`, `api-types.ts`) are committed and guardrail tests pass locally
- [ ] 7.2 Commit per logical unit and push; note the breaking `GET /api/owners` response shape in the PR/commit message (GH25)
