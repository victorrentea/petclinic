## 1. Backend — Repository

- [x] 1.1 Add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` to `OwnerRepository` (keep existing non-pageable overload)

## 2. Backend — Controller

- [x] 2.1 Add `Pageable pageable` param with `@PageableDefault(sort = "firstName", direction = ASC, size = 10)` to `listOwners`
- [x] 2.2 Change return type to `Page<OwnerDto>` and use `page.map(ownerMapper::toOwnerDto)`

## 3. Backend — Test

- [x] 3.1 Add `@DataJpaTest` verifying `findByLastNameStartingWith(String, Pageable)` returns the correct slice (filtered content + correct `totalElements`) when sorted by `firstName` ascending

## 4. Frontend — Module & Service

- [x] 4.1 Add `MatSortModule` and `MatPaginatorModule` to `OwnersModule` imports
- [x] 4.2 Add `searchOwnersPaged(lastName: string, page: number, size: number, sort: string): Observable<Page<Owner>>` method to `OwnerService` (new HTTP call returning `Page<Owner>`)
- [x] 4.3 Define a `Page<T>` interface in the owners module (fields: `content`, `totalElements`, `totalPages`, `number`, `size`)

## 5. Frontend — Component

- [x] 5.1 Inject `ActivatedRoute` and `Router` into `OwnerListComponent`
- [x] 5.2 Subscribe to `queryParams` on init and trigger the paged API call with extracted `lastName`, `page`, `size`, `sort`
- [x] 5.3 On search submit: call `Router.navigate([], { queryParams: { lastName, page: 0, size, sort } })`
- [x] 5.4 On sort change (`MatSortChange`): call `Router.navigate` with updated `sort` param and `page: 0`
- [x] 5.5 On page change (`PageEvent`): call `Router.navigate` with updated `page` and `size` params

## 6. Frontend — Template

- [x] 6.1 Add `mat-sort` directive to `<table>` with `matSortActive="firstName"` and `matSortDirection="asc"`
- [x] 6.2 Add `mat-sort-header` to Name (`firstName`) and City (`city`) column headers
- [x] 6.3 Add `<mat-paginator>` below the table with `[pageSizeOptions]="[5, 10, 20]"` and `pageSize="10"`

## 7. Frontend — Test

- [x] 7.1 Add component test that stubs `OwnerService.searchOwnersPaged` and verifies URL query params are updated correctly when sort changes
- [x] 7.2 Add component test that verifies URL query params are updated correctly when paginator page changes
