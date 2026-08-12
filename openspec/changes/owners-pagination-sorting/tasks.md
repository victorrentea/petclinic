## 1. Backend: repository & validation

- [x] 1.1 Extend `OwnerRepository` to `PagingAndSortingRepository<Owner, Integer>` (or `JpaRepository`) and add a paginated finder, e.g. `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`; remove the old non-paginated `findByLastNameStartingWith(String)` once its only caller is migrated
- [x] 1.2 Implement a sort-property whitelist mapper: `name` → `Sort.by(direction, "lastName", "firstName")`, `city` → `Sort.by(direction, "city")`; throw/return `400 Bad Request` for any other sort key
- [x] 1.3 Implement a page-size whitelist check (`{5, 10, 20}`) and a non-negative page check, returning `400 Bad Request` for other values
- [x] 1.4 Unit test the sort-whitelist mapper and page-size/page-number checks in isolation (valid keys/sizes pass through, invalid ones are rejected)
- [x] 1.5 Enable `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` so pages serialize via the stable `PagedModel` envelope instead of raw `PageImpl` (Spring Boot 3.5 logs a deprecation warning otherwise)

## 2. Backend: controller

- [x] 2.1 Update `OwnerRestController#listOwners` to accept `page`, `size`, `sort` request params (defaults: `page=0`, `size=10`, `sort=name,asc`) alongside the existing `lastName` param
- [x] 2.2 Wire the whitelist checks from Section 1 into `listOwners` before querying, returning `400 Bad Request` on violation
- [x] 2.3 Return `Page<OwnerDto>` (map `Page<Owner>` content via `ownerMapper`, preserving pagination metadata) instead of `List<OwnerDto>`
- [x] 2.4 Update `@Operation`/`@ApiResponse` Swagger annotations and `ApiExamples.OWNERS` sample to reflect the new `Page<OwnerDto>` response shape
- [x] 2.5 Regenerate `openapi.yaml` via `OpenApiExtractorTest`, then regenerate the frontend types with `npm run generate:api` in the same commit (CI/pre-commit drift checks cover both); expect a mandatory `@victorrentea/elders` CODEOWNERS review on `openapi.yaml`
- [x] 2.6 Verify no `Serializing PageImpl instances as-is is not supported` warning appears in the application log for the listing endpoint

## 3. Backend: tests

- [x] 3.1 Controller/integration test: default call (`GET /api/owners`) returns page 0, size 10, sorted by lastName then firstName ascending
- [x] 3.2 Controller/integration test: `page`/`size` params return the correct slice and metadata (`totalElements`, `totalPages`)
- [x] 3.3 Controller/integration test: requesting a page beyond the last returns empty content with correct totals (not an error)
- [x] 3.4 Controller/integration test: `sort=name,asc` / `sort=name,desc` / `sort=city,asc` return correctly ordered results
- [x] 3.5 Controller/integration test: disallowed `sort` value returns `400 Bad Request`
- [x] 3.6 Controller/integration test: disallowed `size` value and negative `page` value each return `400 Bad Request`
- [x] 3.7 Controller/integration test: `lastName` filter combined with pagination/sorting returns the correctly filtered, sorted, paginated subset and correct totals
- [x] 3.8 Test that a page of owners still serializes each owner's pets without a JOIN FETCH on the paginated query (guards against the `HHH000104` in-memory-pagination regression; `Owner.pets` stays `@BatchSize`-fetched)
- [x] 3.9 Run `mvn test` for the backend module and confirm all owner-related tests pass

## 4. Frontend: service & model

- [x] 4.1 Derive the paged-response type from the generated `src/app/generated/api-types.ts` (mirroring how `owner.ts` derives `Owner` from `components['schemas']['OwnerDto']`) — do NOT hand-write a `PageResponse<T>` interface, it would drift from the generated contract
- [x] 4.2 Update `OwnerService.getOwners()` and `OwnerService.searchOwners()` to accept `page`, `size`, `sort` parameters and return the paged type, building the query string accordingly

## 5. Frontend: owner-list component & template

- [x] 5.1 Update `OwnerListComponent` state to track current page, page size, sort column/direction, and the paged result (`content` + totals)
- [x] 5.2 Import `MatPaginatorModule` into the owners module (only `MatSnackBarModule` is wired today) and add the paginator to `owner-list.component.html`, wired to request the corresponding page/size on interaction
- [x] 5.3 Make the **Name** and **City** column headers clickable: clicking the active column flips its direction, clicking the other column sorts it ascending; leave Address/Telephone headers non-interactive
- [x] 5.4 Swap the Name cell template from `{{ owner.firstName }} {{ owner.lastName }}` to `{{ owner.lastName }} {{ owner.firstName }}` (single space, no comma)
- [x] 5.5 Ensure the existing `lastName` search box continues to work together with pagination/sorting, resetting to page 0 on a new search while keeping the selected page size and sort

## 6. Frontend: tests

- [x] 6.1 Update/add `OwnerService` spec tests to assert `page`/`size`/`sort` query params are sent and the paged response is parsed correctly
- [x] 6.2 Update `owner-list.component.spec.ts` to cover: default load requests page 0/size 10/sort=name,asc; clicking Name/City headers requests the right sort; re-clicking the active column flips direction; a new search resets to page 0; paginator interaction requests the right page/size; Name column renders "Smith John" (last name first, single space)
- [x] 6.3 Run `npm test` (or `npm run test-headless`) for the frontend and confirm all owner-list/owner-service tests pass

## 7. Docs

- [x] 7.1 Add a note to `AGENTS.md` capturing the ~10,000-owners-within-a-year scale expectation as a durable assumption for future work on the Owners area
