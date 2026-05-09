# Implementation Plan: Owners Pagination

## Overview

Add server-side pagination, sorting, and a client-side page cache to the Owners list screen. The backend already returns `Page<Owner>` via `findBySearch`; this plan introduces `OwnerSummaryDto` (via MapStruct), sort-key translation in the controller, and a full frontend pagination UI with a sliding-window cache. Implementation follows TDD: write a failing test first, then implement.

## Tasks

- [x] 1. Backend — DTOs and Mapper
  - [x] 1.1 Create `PetSummaryDto` record and `OwnerSummaryDto` record
    - Create `PetSummaryDto` record with fields `id` and `name` in `rest/dto/`
    - Create `OwnerSummaryDto` record with fields `id`, `displayName`, `address`, `city`, `telephone`, `List<PetSummaryDto> pets` in `rest/dto/`
    - _Requirements: 1.1, 2.1, 11.2_

  - [x] 1.2 Create `OwnerSummaryMapper` (MapStruct) with TDD
    - Write a failing unit test verifying `Owner` → `OwnerSummaryDto` mapping: `displayName` = `firstName + ' ' + lastName`, pets mapped to `{id, name}` only (no visits)
    - Create `OwnerSummaryMapper` interface in `mapper/` package using MapStruct `@Mapper(componentModel = "spring")`
    - Map `displayName` via `@Mapping(expression = "java(owner.getFirstName() + \" \" + owner.getLastName())")` or a default method
    - Map `pets` to `List<PetSummaryDto>` (only `id` and `name`)
    - Confirm the test passes
    - _Requirements: 1.1, 2.1, 2.3_

  - [ ] 1.3 Write jqwik property test for OwnerSummaryDto mapping completeness
    - **Property 1: OwnerSummaryDto Mapping Completeness**
    - Generate arbitrary Owner entities with random firstName, lastName, address, city, telephone, and pets
    - Assert mapped DTO has `displayName == firstName + ' ' + lastName`, matching scalar fields, and pets containing only `{id, name}` with no visit data leakage
    - **Validates: Requirements 1.1, 2.1**

- [x] 2. Backend — Controller sort-key translation
  - [x] 2.1 Write failing test for sort-key translation logic
    - Write a unit test (or `@WebMvcTest`) verifying that `sort=name,asc` translates to `Sort.by("firstName").and(Sort.by("lastName"))` both ascending
    - Verify `sort=name,desc` translates to both fields descending
    - Verify `sort=city,asc` passes through unchanged
    - Verify default (no sort param) uses `firstName,lastName` ascending
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.2_

  - [x] 2.2 Implement sort-key translation in `OwnerRestController`
    - Add private `translateSort(Pageable)` method that replaces `name` sort key with `Sort.by("firstName").and(Sort.by("lastName"))` preserving direction
    - Pass `city` sort key through unchanged
    - Confirm the test from 2.1 passes
    - _Requirements: 1.3, 1.4, 1.5, 2.2_

  - [ ]* 2.3 Write jqwik property test for sort ordering correctness
    - **Property 2: Sort Ordering Correctness**
    - Generate random sets of Owner entities, apply sort via repository, verify returned page content is ordered correctly for `name,asc`, `name,desc`, `city,asc`, `city,desc`
    - **Validates: Requirements 1.3, 1.4, 1.5, 2.2**

- [x] 3. Backend — Update list endpoint to return `OwnerSummaryDto`
  - [x] 3.1 Write failing integration test for paginated list endpoint
    - Write `@WebMvcTest` or Spring Boot integration test verifying `GET /api/owners` returns `Page<OwnerSummaryDto>` shape with `content[].displayName`, `totalElements`, `totalPages`, `number`, `size`
    - Verify default page=0, size=10
    - Verify `GET /api/owners/{id}` still returns existing `OwnerDto` with `firstName`/`lastName`
    - _Requirements: 1.1, 1.2, 1.7, 11.1, 11.2_

  - [x] 3.2 Update `listOwners` method in `OwnerRestController`
    - Change return type from `Page<OwnerDto>` to `Page<OwnerSummaryDto>`
    - Inject `OwnerSummaryMapper` and use `.map(ownerSummaryMapper::toSummaryDto)`
    - Apply `translateSort(pageable)` before passing to repository
    - Keep `getOwner(id)` returning `OwnerDto` unchanged
    - Confirm integration test passes
    - _Requirements: 1.1, 1.2, 1.7, 2.1, 11.1, 11.2_

  - [ ]* 3.3 Write jqwik property test for page metadata consistency
    - **Property 3: Page Metadata Consistency**
    - Generate random (totalElements, page, size) combinations, verify `totalPages == ceil(totalElements / size)` and `number == requested page`
    - **Validates: Requirements 1.7**

- [x] 4. Checkpoint — Backend complete
  - Ensure all backend tests pass (`./mvnw test` in `petclinic-backend/`), ask the user if questions arise.

- [x] 5. Frontend — Models and OwnerService update
  - [x] 5.1 Create `OwnerSummary` and `PetSummary` interfaces, update `OwnerPage`
    - Create `owner-summary.ts` with `OwnerSummary` interface (`id`, `displayName`, `address`, `city`, `telephone`, `pets: PetSummary[]`) and `PetSummary` interface (`id`, `name`)
    - Update existing `owner-page.ts` to reference `OwnerSummary` instead of `Owner` in `content` field
    - _Requirements: 1.1_

  - [x] 5.2 Add `getOwnerPage` method to `OwnerService` with TDD
    - Write a failing unit test verifying `getOwnerPage({page, size, sort, q})` calls `GET /api/owners` with correct `HttpParams`
    - Implement `getOwnerPage` method returning `Observable<OwnerPage>` with params: `page`, `size`, `sort`, and optional `q`
    - Keep existing `getOwners` method for backward compatibility during migration
    - Confirm the test passes
    - _Requirements: 1.2, 1.3, 1.5_

- [x] 6. Frontend — PageCacheService
  - [x] 6.1 Create `PageCacheService` with TDD
    - Write failing unit tests for: `getPage` returns null on miss, returns cached data on hit; `storePage` stores correctly; `evictOutsideWindow` removes pages outside `[current-2, current+2]`; `invalidateAll` clears everything; cache holds max 5 entries
    - Implement `PageCacheService` as `@Injectable()` with `Map<string, OwnerPage>` storage
    - Cache key format: `${page}:${size}:${sort}:${q ?? ''}`
    - Implement sliding window eviction: keep only pages within `[currentPage-2, currentPage+2]`
    - Confirm tests pass
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 9.1_

  - [ ]* 6.2 Write fast-check property test for cache window invariant
    - **Property 10: Cache Window Invariant**
    - Generate random sequences of page navigations, verify cache never exceeds 5 entries and all cached pages are within `[currentPage-2, currentPage+2]`
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 7. Frontend — PaginationToolbarComponent
  - [x] 7.1 Create `PaginationToolbarComponent` with TDD
    - Write failing unit tests for slot computation using worked examples from brainstorm (10 total pages, current=1,2,3,4,7,8,9,10)
    - Test: slots length ≤ 7, all unique, all in [1, totalPages], sorted ascending
    - Test: exactly one slot marked `isCurrent` with correct page number
    - Test: first slot has `«` prefix, last slot has `»` suffix
    - Test: hidden when totalPages=0
    - Implement `PaginationToolbarComponent` with `@Input() currentPage` (1-based), `@Input() totalPages`, `@Output() pageChange`
    - Implement pure `computeSlots(current, total)` function per design algorithm
    - Confirm tests pass
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 7.2 Write fast-check property tests for pagination toolbar
    - **Property 4: Pagination Toolbar Slot Invariants**
    - Generate random (currentPage, totalPages) where totalPages ≥ 1 and 1 ≤ currentPage ≤ totalPages
    - Assert: length ≤ 7, all unique, all in [1, totalPages], sorted ascending
    - **Validates: Requirements 3.1, 3.6, 3.7, 3.8**
    - **Property 5: Pagination Toolbar Current Page Marking**
    - Assert: exactly one slot marked `isCurrent` with page === currentPage
    - **Validates: Requirements 3.5**

- [x] 8. Frontend — OwnerListComponent state management and UI
  - [x] 8.1 Write failing tests for OwnerListComponent state transitions
    - Test: sort toggle on same column flips direction, resets page to 0
    - Test: sort click on different column sets new column ascending, resets page to 0
    - Test: page size change resets page to 0 and invalidates cache
    - Test: search input change (debounced) resets page to 0, retains sort
    - Test: page button click updates page number
    - Test: loading indicator shown when page not in cache
    - Test: in-flight cancellation via switchMap (rapid navigation)
    - _Requirements: 4.3, 6.2, 6.3, 6.6, 7.1, 7.2, 8.5, 10.1, 10.2, 10.3_

  - [x] 8.2 Refactor `OwnerListComponent` to use pagination state
    - Add `PaginationState` interface: `{ page: number, size: number, sort: string, q: string }`
    - Default state: `{ page: 0, size: 10, sort: 'name,asc', q: '' }`
    - Integrate `PageCacheService` (provided at component level so it's destroyed on route leave)
    - Use `switchMap` for in-flight request cancellation
    - Implement prefetch logic: after current page loads, prefetch ±1 and ±2 in background
    - Wire `getOwnerPage` from `OwnerService`
    - Confirm state transition tests pass
    - _Requirements: 4.3, 6.6, 7.1, 7.2, 8.4, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3_

  - [x] 8.3 Update `OwnerListComponent` template for pagination UI
    - Update table to use `OwnerSummary` (display `displayName` instead of `firstName + lastName`)
    - Add sortable column headers for Name and City with sort indicators (`▲`/`▼`)
    - Add page size selector dropdown (10, 25, 50) below the grid
    - Add total-results summary on the left: `Showing {start}–{end} of {totalElements} owners`
    - Add `<app-pagination-toolbar>` on the right
    - Hide pagination toolbar and summary when `totalElements === 0`
    - Default Name column shows `▲` indicator on initial load
    - _Requirements: 3.9, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.4, 6.5_

  - [ ]* 8.4 Write fast-check property tests for state transitions
    - **Property 7: Sort State Transitions** — generate random sort states and click targets, verify toggle/reset behavior
    - **Validates: Requirements 6.2, 6.3**
    - **Property 8: State Change Resets Page** — generate random states and trigger types (size change, sort change, search change), verify page resets to 0
    - **Validates: Requirements 4.3, 6.6, 7.1**
    - **Property 9: Search Retains Sort** — generate random sort states and search terms, verify sort unchanged after search
    - **Validates: Requirements 7.2**

  - [ ]* 8.5 Write fast-check property test for total-results summary formatting
    - **Property 6: Total-Results Summary Formatting**
    - Generate random (page, size, totalElements) where totalElements > 0
    - Assert summary equals `Showing {start}–{end} of {totalElements} owners` where `start = page * size + 1` and `end = min((page + 1) * size, totalElements)`
    - **Validates: Requirements 5.1**

- [x] 9. Checkpoint — Frontend unit tests pass
  - Ensure all frontend tests pass (`npm run test-headless` in `petclinic-frontend/`), ask the user if questions arise.

- [x] 10. Integration — End-to-end wiring and smoke test
  - [x] 10.1 Register new components and services in `OwnersModule`
    - Declare `PaginationToolbarComponent` in `OwnersModule`
    - Provide `PageCacheService` at component level (not module level)
    - Ensure `OwnerService` updated method is available
    - _Requirements: 9.1, 9.2_

  - [ ]* 10.2 Write Playwright end-to-end smoke test
    - Test full pagination flow: navigate pages, verify content changes
    - Test sort by Name and City, verify visual indicators
    - Test page size change resets to page 1
    - Test search filters results and resets page
    - Test empty state hides pager
    - _Requirements: 3.1, 4.3, 5.3, 6.1, 7.1_

- [x] 11. Final checkpoint — All tests pass
  - Ensure all backend tests pass (`./mvnw test`), all frontend tests pass (`npm run test-headless`), ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- TDD approach: each implementation task starts with a failing test, then implements to make it pass
- Backend tasks use jqwik for property-based tests; frontend uses fast-check
- The existing `findBySearch` query is reused — no new repository query needed
- `OwnerSummaryMapper` (MapStruct) maps `Owner` → `OwnerSummaryDto` without touching visits (pets are lazy-loaded with `@BatchSize`)
- The existing `owner-page.ts` type is updated in-place (already has the right shape)
- `PageCacheService` is provided at component level to ensure cache destruction on route leave
- Checkpoints ensure incremental validation between backend and frontend phases
