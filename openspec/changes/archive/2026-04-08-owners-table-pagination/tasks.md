## 1. OpenAPI Contract

- [x] 1.1 Update `listOwners` operation in `openapi.yml`: add `page` and `size` query params, change response schema from array of `OwnerDto` to a generic page object (`content` array of `OwnerDto` + pagination metadata)
- [x] 1.2 Run `./mvnw clean install` to regenerate DTOs and verify compilation succeeds

## 2. Backend Repository

- [x] 2.1 Write a failing test for `findAll(Pageable)` returning a `Page<Owner>`
- [x] 2.2 Add `Page<Owner> findAll(Pageable pageable)` to `OwnerRepository` (Spring Data derives it)
- [x] 2.3 Write a failing test for `findByLastNameStartingWith(String, Pageable)` returning a `Page<Owner>`
- [x] 2.4 Add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` to `OwnerRepository`

## 3. Backend Controller

- [x] 3.1 Write a failing controller test for `GET /api/owners` returning paginated response shape
- [x] 3.2 Update `OwnerRestController.listOwners()` to accept `Pageable` (with `@PageableDefault(size=20)`) and return `Page<OwnerDto>`
- [x] 3.3 Write a failing test for unsupported sort field returning `400`
- [x] 3.4 Add sort field allowlist validation in `listOwners()` — reject any `sort` property other than `lastName` and `city` with `400 Bad Request`
- [x] 3.5 Run `./mvnw test` and confirm all backend tests pass

## 4. Frontend Service

- [x] 4.1 Add `OwnerPage` TypeScript interface in `owner.ts` with fields: `content`, `totalElements`, `totalPages`, `page`, `size`
- [x] 4.2 Update `OwnerService.getOwners(page, size, sort?)` to pass `page`, `size`, and optional `sort` params, return `Observable<OwnerPage>`
- [x] 4.3 Update `OwnerService.searchOwners(lastName, page, size, sort?)` similarly to return `Observable<OwnerPage>`

## 5. Frontend Component

- [x] 5.1 Add `MatPaginatorModule` and `MatSortModule` to `owners.module.ts` imports
- [x] 5.2 Write a failing unit test for `OwnerListComponent` verifying it calls service with `page=0, size=20` on init
- [x] 5.3 Update `OwnerListComponent` to hold `totalElements`, `pageIndex`, `pageSize` state
- [x] 5.4 Wire `MatPaginator` `(page)` event to re-fetch owners with updated `pageIndex`/`pageSize`
- [x] 5.5 Add `matSort` directive to the table and `mat-sort-header` to Name and City `<th>` elements
- [x] 5.6 Wire `MatSort` `(matSortChange)` event to re-fetch with updated `sort` param and reset `pageIndex` to 0
- [x] 5.7 Reset `pageIndex` to 0 when `lastName` filter changes
- [x] 5.8 Update `owner-list.component.html` to add `<mat-paginator>` below the table
- [x] 5.9 Run `npm test` and confirm all frontend tests pass
