# Tasks: Owners Pagination

## Task List

- [x] 1. Add `PagedOwnersDto` and update `OwnerRepository`
  - [x] 1.1 Create `PagedOwnersDto` class in `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/dto/` with fields `owners` (List<OwnerDto>), `totalElements` (long), `totalPages` (int), `currentPage` (int)
  - [x] 1.2 Add `findPagedOwners(@Param("term") String term, Pageable pageable)` JPQL query method to `OwnerRepository` using `DISTINCT` join with `pets`, filtering across `lastName`, `address`, `city`, `telephone`, `pet.name`, ordered by `CONCAT(firstName, ' ', lastName) ASC`

- [x] 2. Update `OwnerRestController.listOwners`
  - [x] 2.1 Create `PageRequestParams` record in `.../rest/dto/` with fields `lastName` (`@RequestParam(required = false)`), `page` (`@RequestParam(defaultValue = "0") @Min(0)`), `size` (`@RequestParam(defaultValue = "10") @Min(1) @Max(100)`)
  - [x] 2.2 Ensure `ExceptionControllerAdvice` handles `ConstraintViolationException` and returns `400 ProblemDetail` (add handler if not already present)
  - [x] 2.3 Replace the in-memory filter + `findAll()` logic with a call to `findPagedOwners(normalizedTerm, PageRequest.of(params.page(), params.size()))` and map the result to `PagedOwnersDto`
  - [x] 2.4 Change the return type of `listOwners` from `List<OwnerDto>` to `PagedOwnersDto`; accept `@Valid PageRequestParams params`

- [x] 3. Update `openapi.yaml` contract
  - [x] 3.1 Add `PagedOwners` schema component with `owners` (array of `OwnerDto`), `totalElements` (integer), `totalPages` (integer), `currentPage` (integer)
  - [x] 3.2 Update `GET /api/owners` parameters to include `page` (integer, default 0) and `size` (integer, default 10)
  - [x] 3.3 Update `GET /api/owners` response schema from `array of OwnerDto` to `PagedOwners`

- [x] 4. Backend tests
  - [x] 4.1 Update the existing `getAll` and `getAllWithNameFilter` tests in `OwnerTest.java` to deserialise `PagedOwnersDto` instead of `List<OwnerDto>` and assert on the `owners` field
  - [x] 4.2 Add `listOwners_defaultPagination` — no params → `currentPage=0`, `owners` size ≤ 10, `totalElements` ≥ 1
  - [x] 4.3 Add `listOwners_secondPage` — seed 3+ owners, `page=1&size=2` → correct second slice, `totalPages=ceil(n/2)`
  - [x] 4.4 Add `listOwners_outOfRange` — `page=999` → `owners` empty, `totalElements` correct
  - [x] 4.5 Add `listOwners_invalidSize_tooSmall` — `size=0` → 400
  - [x] 4.6 Add `listOwners_invalidSize_tooLarge` — `size=101` → 400
  - [x] 4.7 Add `listOwners_invalidPage_negative` — `page=-1` → 400
  - [x] 4.8 Add `listOwners_filteredPagination` — `lastName=Fr&page=0&size=5` → only matching owners in `owners`, `totalElements` reflects filter
  - [x] 4.9 Add `listOwners_sortedOrder` — seed owners with known names, assert `owners` list is sorted ascending by `firstName + " " + lastName`
  - [x] 4.10 Add property-based test `PaginationCoversAllOwnersProperty` (jqwik): for random owner collections and valid page sizes, iterating all pages yields every owner exactly once — **Feature: owners-pagination, Property 1: pagination covers all owners exactly once**
  - [x] 4.11 Add property-based test `FilteredPaginationCoversMatchingOwnersProperty` (jqwik): for random owners and random search terms, all pages combined contain exactly the matching owners — **Feature: owners-pagination, Property 3: filtered pagination covers all matching owners exactly once**
  - [x] 4.12 Add property-based test `SortedOrderAcrossPagesProperty` (jqwik): concatenated pages are sorted ascending by full name — **Feature: owners-pagination, Property 6: sorted order is consistent across pages**
  - [x] 4.13 Add property-based test `TotalElementsEqualsMatchingCountProperty` (jqwik): `totalElements` equals the count of owners matching the search term — **Feature: owners-pagination, Property 7: totalElements equals the count of matching owners**

- [x] 5. Update `MyOpenAPIDidNotChangeTest` snapshot
  - [x] 5.1 Run the disabled helper test in `MyOpenAPIDidNotChangeTest` to regenerate the `openapi.yaml` snapshot after all backend changes are complete

- [x] 6. Update Angular `OwnerPage` interface and `OwnerService`
  - [x] 6.1 Update `petclinic-frontend/src/app/owners/owner-page.ts` to match the API contract: rename `content` → `owners`, `number` → `currentPage`, remove `size` field
  - [x] 6.2 Add `getOwnersPaged(page: number, size: number, lastName?: string): Observable<OwnerPage>` to `OwnerService`, building the URL with `page`, `size`, and optional `lastName` query params
  - [x] 6.3 Remove (or deprecate) the old `getOwners()` and `searchOwners()` methods from `OwnerService` once no callers remain

- [x] 7. Create `PaginationControlComponent`
  - [x] 7.1 Generate `PaginationControlComponent` in `petclinic-frontend/src/app/owners/pagination-control/` with inputs `currentPage`, `totalPages`, `pageSize`, `loading` and outputs `pageChange` and `pageSizeChange`
  - [x] 7.2 Implement the template: "Previous" button (disabled when `currentPage === 0 || loading`), numbered page buttons (disabled when `loading`), "Next" button (disabled when `currentPage === totalPages - 1 || loading`), page-size `<select>` with options 10 / 20 / 50
  - [x] 7.3 Declare `PaginationControlComponent` in `OwnersModule`

- [x] 8. Refactor `OwnerListComponent`
  - [x] 8.1 Add state fields: `currentPage = 0`, `pageSize = 10`, `totalPages = 0`, `loading = false`, `previousOwners: Owner[] | null = null`, `lastRequest: { page: number; size: number; lastName: string } | null = null`
  - [x] 8.2 Replace the `ngOnInit` owner fetch and `searchByTerm` logic with a single `loadPage(page, size, lastName)` method that calls `ownerService.getOwnersPaged`, sets `loading = true` before the call and `loading = false` in `finalize`, snapshots `previousOwners` before each request, and updates `owners`, `totalPages`, `currentPage` on success
  - [x] 8.3 On API error in `loadPage`: show the error banner message "Failed to load owners. Please try again.", restore `owners` from `previousOwners`, re-enable controls (set `loading = false`)
  - [x] 8.4 Wire `onSearchInput` / `onSearchBlur` to reset `currentPage = 0` before calling `loadPage`
  - [x] 8.5 Add `onPageChange(page: number)` and `onPageSizeChange(size: number)` handlers; `onPageSizeChange` resets `currentPage = 0`
  - [x] 8.6 Add a `retry()` method that repeats `lastRequest`

- [x] 9. Update `owner-list.component.html`
  - [x] 9.1 Add the error banner `<div>` above the table (shown when `errorMessage` is set) with the message "Failed to load owners. Please try again." and a "Retry" button that calls `retry()`
  - [x] 9.2 Replace the `*ngIf="!owners"` no-results message with a condition that checks `owners?.length === 0 && lastName` and shows `No owners matching "{{lastName}}"`
  - [x] 9.3 Add `<app-pagination-control>` below the owners table, bound to `currentPage`, `totalPages`, `pageSize`, `loading`, `(pageChange)`, `(pageSizeChange)`; hide it when `owners?.length === 0`

- [x] 10. Update `OwnerService` tests
  - [x] 10.1 Update `owner.service.spec.ts`: replace tests for `getOwners()` and `searchOwners()` with tests for `getOwnersPaged()` — verify correct URL construction with `page`, `size`, and `lastName` params, and that the response is typed as `OwnerPage`

- [x] 11. Add `OwnerListComponent` and `PaginationControlComponent` unit tests
  - [x] 11.1 Add `OwnerListComponent` spec: initial load calls `getOwnersPaged(0, 10, '')`, page navigation updates `currentPage`, search input resets `currentPage` to 0, error state shows banner and restores previous owners, `loading = true` during request
  - [x] 11.2 Add `PaginationControlComponent` spec: "Previous" disabled on page 0, "Next" disabled on last page, numbered buttons emit correct page index, page-size selector emits new size
  - [x] 11.3 Add property-based tests with fast-check: page-size change always resets to page 0 — **Feature: owners-pagination, Property 8: page-size change resets to page 0 and covers all owners**; search filter change always resets to page 0 — **Feature: owners-pagination, Property 9: search filter change resets to page 0**
