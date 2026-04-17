## 1. Backend — API Contract (Java-first)

- [x] 1.1 Update `OwnerRestController` and DTOs in Java to reflect new endpoint signature (page params, `Page<OwnerDto>` response)
- [x] 1.2 Start the app (or run `./mvnw spring-boot:run`) so springdoc regenerates the OpenAPI YAML
- [x] 1.3 Sync the generated YAML into the committed `openapi.yaml` so `MyOpenAPIDidNotChangeTest` passes

## 2. Backend — Repository

- [x] 2.1 Change `OwnerRepository` to extend `PagingAndSortingRepository<Owner, Integer>` (keep existing custom query)
- [x] 2.2 Replace `searchByText(String searchText)` with `searchByText(String searchText, Pageable pageable)` — same JPQL, Pageable applied automatically by Spring Data; delete the old signature entirely

## 3. Backend — Controller & Sorting Validation

- [x] 3.1 Update `OwnerRestController.listOwners` to accept `Pageable` (via `@PageableDefault`) and return `Page<OwnerDto>` (mapped via mapper)
- [x] 3.2 Add a `@PageableDefault(sort = {"firstName", "lastName"}, direction = Sort.Direction.ASC)` annotation for default sort
- [x] 3.3 Add sort field whitelist validation: reject any sort property not in `{firstName, lastName, city}` with HTTP 400
- [x] 3.4 Update `OwnerMapper` to map `Page<Owner>` → page response object (or return Spring's `Page<OwnerDto>` directly)

## 4. Backend — Tests

- [x] 4.1 Write failing test for `listOwners` with `page` and `size` params returning correct page structure (TDD)
- [x] 4.2 Write failing test for `listOwners` with `sort=firstName,asc` returning owners in correct order
- [x] 4.3 Write failing test for invalid sort field returning HTTP 400
- [x] 4.4 Write failing test for search combined with pagination returning correct `totalElements`
- [x] 4.5 Implement backend changes to make all tests pass (tasks 2.x, 3.x)

## 5. Frontend — Service Layer

- [x] 5.1 Update `OwnerService.getOwners()` to accept `page`, `size`, `sort`, `q` params and return `Observable<OwnerPage>` (activate the existing `OwnerPage` interface)
- [x] 5.2 Create `OwnerPaginationService` with: page cache (`Map<string, OwnerPage>`), `currentPage$` observable, `loadPage(page, size, sort, q)` method, `clearCache()` method, `evictDistantPages(currentPage)` method
- [x] 5.3 Implement pre-fetch logic in `OwnerPaginationService`: after emitting current page, fire background requests for `page±1` if in bounds and not cached; skip if `navigator.connection?.saveData` is true
- [x] 5.4 Implement generation counter in `OwnerPaginationService` to discard stale pre-fetch responses after cache invalidation

## 6. Frontend — Component

- [x] 6.1 Inject `OwnerPaginationService` into `OwnerListComponent`; remove direct `OwnerService` pagination calls from component
- [x] 6.2 Add `calculatePageSize()` method: measure available table body height, divide by row height constant (41px), clamp to minimum 5
- [x] 6.3 Call `calculatePageSize()` on init before first request
- [x] 6.4 Add `@HostListener('window:resize')` with 1000ms debounce: recalculate size, clear cache, reset to page 0
- [x] 6.5 Add sort state (`sortColumn: 'name' | 'city'`, `sortDir: 'asc' | 'desc'`) to component; wire column header click to toggle sort and reset to page 0

## 7. Frontend — Template

- [x] 7.1 Add clickable sort header to Name column with ↑/↓ indicator based on sort state
- [x] 7.2 Add clickable sort header to City column with ↑/↓ indicator
- [x] 7.3 Add pagination controls below the table: "Page X of Y", disabled Prev on page 1, disabled Next on last page
- [x] 7.4 Show a loading indicator while the current page request is in-flight

## 8. Frontend — Tests

- [ ] 8.1 Unit test `OwnerPaginationService`: cache hit skips HTTP request
- [ ] 8.2 Unit test `OwnerPaginationService`: cache cleared on sort change
- [ ] 8.3 Unit test `OwnerPaginationService`: eviction removes pages beyond ±1
- [ ] 8.4 Unit test `OwnerPaginationService`: stale generation counter discards old responses
- [ ] 8.5 Unit test `OwnerListComponent`: resize recalculates page size and resets to page 0
