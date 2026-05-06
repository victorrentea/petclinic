## 1. Backend — API Changes

- [x] 1.1 Add `page`, `size`, `sort`, `direction` query params to `GET /api/owners` controller method
- [x] 1.2 Update `OwnerRepository` to use `Pageable` and return `Page<Owner>`
- [x] 1.3 Implement sort by `CONCAT(first_name, ' ', last_name)` for `name` sort param (JPQL / custom Sort)
- [x] 1.4 Map `Page<Owner>` to a `PagedResponse<OwnerSummaryDto>` (content + totalElements + totalPages + number + size)
- [x] 1.5 Write unit/integration tests for paginated and sorted owner queries

## 2. Backend — DB Indexes

- [x] 2.1 Add Flyway/Liquibase migration: composite index on `(first_name, last_name)` for name sort
- [x] 2.2 Add Flyway/Liquibase migration: index on `city` for city sort

## 3. Backend — Defaults & Validation

- [x] 3.1 Default `page=0`, `size=10`, `sort=name`, `direction=asc` when params are absent
- [x] 3.2 Validate `direction` is `asc` or `desc`; return 400 otherwise
- [x] 3.3 Validate `sort` is `name` or `city`; return 400 otherwise

## 4. Frontend — Owner Service

- [x] 4.1 Update `OwnerService.getOwners()` to accept `page`, `size`, `sort`, `direction`, `search` and pass them as HTTP params
- [x] 4.2 Define TypeScript interface for the paged response (`PagedOwners`)

## 5. Frontend — URL State Management

- [x] 5.1 Inject `ActivatedRoute` and `Router` into owner-list component
- [x] 5.2 Read initial grid state from `queryParams` on component init
- [x] 5.3 On any state change (search / page / sort), call `router.navigate` with updated `queryParams` (`replaceUrl: true` for search/sort, default for page nav)
- [x] 5.4 Use `switchMap` on `queryParams` observable to trigger API call and cancel stale requests

## 6. Frontend — Pagination Controls

- [x] 6.1 Add page size selector (5, 10, 25) that resets page to 0 on change
- [x] 6.2 Add First, Previous, Next, Last buttons plus a sliding window of 5 page numbers centered on current page (clamped at boundaries)
- [x] 6.3 Disable First/Previous on page 0; disable Next/Last on last page; highlight current page number
- [x] 6.4 Display "Records X-Y of Z" info line below the table

## 7. Frontend — Sort Headers

- [x] 7.1 Make Name and City column headers clickable
- [x] 7.2 Toggle sort direction (ASC → DESC → ASC) when clicking the active sort column
- [x] 7.3 Switch to ASC when clicking an inactive column
- [x] 7.4 Show 🔼 / 🔽 icon on the active sort column; no icon on others

## 8. Frontend — Search Reset

- [x] 8.1 Reset `page` to 0 in URL whenever the search term changes

## 9. Tests & Polish

- [x] 9.1 Add Angular component tests for pagination, sorting, and URL-state scenarios
- [ ] 9.2 Manual smoke test: navigate to page 3 → change search → verify reset to page 1
- [ ] 9.3 Manual smoke test: copy URL and open in new tab → verify state is restored
