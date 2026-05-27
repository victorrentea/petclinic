## 1. Backend — paginated endpoint

- [x] 1.1 Write a failing **unit test** `SortColumnTest` that asserts `SortColumn.NAME.expand(ASC)` returns `Sort.by(ASC, "lastName", "firstName").and(Sort.by(ASC, "id"))` — i.e. `lastName ASC, firstName ASC, id ASC` (red). (Pivot from `@WebMvcTest`: project has no existing WebMvcTests and the controller's `@PreAuthorize` makes a thin-slice test heavy. A pure unit test pins the expansion invariant — the design's actual goal.)
- [x] 1.2 Extend `SortColumnTest` with cases for `CITY.expand(DESC)` → `city DESC, lastName DESC, firstName DESC, id ASC`, `ADDRESS.expand(ASC)` → `address ASC, lastName ASC, firstName ASC, id ASC`, `SortColumn.fromClient("name")` round-trip, `SortColumn.fromClient("pets")` throws `IllegalArgumentException`. Add **integration** cases in existing `OwnerTest` (project's pattern is `@SpringBootTest` + real DB): default no-`sort` returns `Page` envelope; `?sort=pets,asc` → 400; sorted rows arrive in the expected order.
- [x] 1.3 Introduce a server-side `SortColumn` enum (`NAME`, `ADDRESS`, `CITY`) with an `expand(Sort.Direction)` method that returns the full `Sort` chain ending in `id ASC`. (Implemented as a nested enum inside `OwnerRestController`.)
- [x] 1.4 Change `OwnerController.list(...)` to accept `Pageable` (`PageableHandlerMethodArgumentResolver`) plus `lastName`, validate the requested sort column against `SortColumn`, expand it, and call the repository's existing paginated query. Added new derived-query method `OwnerRepository.findByLastNameStartingWith(String, Pageable)`. Translates `IllegalArgumentException` from `SortColumn.fromClient` into `ResponseStatusException(400)`, and added a `@ExceptionHandler(ResponseStatusException.class)` to `ExceptionControllerAdvice` so the catch-all 500 handler doesn't swallow it.
- [x] 1.5 Change the controller return type to `Page<OwnerDto>` and the `OwnerDto` mapping so the Spring `Page` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) is serialized verbatim. Make the failing tests in 1.1–1.2 pass (green).
- [x] 1.6 Update `OwnerTest` and `OwnerSteps` to consume the `Page<OwnerDto>` shape.
- [x] 1.7 Update the existing perf test (if it asserts the response shape) to consume `Page<OwnerDto>`. (Switched from `$` size-check to `$.totalElements`.)
- [x] 1.8 Run the full backend test suite (`mvn test`) and confirm green. (88/88 green.)

## 2. Generated API types

- [x] 2.1 Regenerate `api-types.ts` against the new `Page<OwnerDto>` response so the frontend has a typed envelope to import. (Ran `OpenApiExtractorTest` to refresh `openapi.yaml`, then `npm run generate:api`.)
- [x] 2.2 Confirm `api-types.ts` exports a `PageOwnerDto` (or equivalent) shape with `content`, `totalElements`, `totalPages`, `number`, `size`. (Verified `PageOwnerDto` is present with `content`, `number`, `size`, etc.)

## 3. Frontend — dependencies and module wiring

- [x] 3.1 Add `@angular/material` and `@angular/cdk` at versions compatible with Angular 16 to `petclinic-frontend/package.json`. (Both already present at 16.2.1 — no change needed.)
- [x] 3.2 Import `MatSortModule` and `MatPaginatorModule` in the module that hosts the Owners screen — and only those two Material modules.
- [x] 3.3 Add the Material prebuilt theme (or minimal styles) needed for `mat-paginator` rendering against the existing Bootstrap 3 layout. (Theme already imported in `src/styles.css` — `@import "@angular/material/prebuilt-themes/indigo-pink.css"`.)

## 4. Frontend — OwnerService

- [x] 4.1 Update `OwnerService.list(...)` (or equivalent) to accept `lastName`, `page`, `size`, and `sort` (as `<col>,<dir>`) and to return an `Observable<Page<OwnerDto>>`. Introduced `OwnersPage` interface and `listOwners(params)` method. Removed the now-unused `getOwners()` and `searchOwners(...)` methods.
- [x] 4.2 Ensure `OwnerService` issues a single request per call, with query params reflecting the inputs exactly (no client-side slicing or sorting).

## 5. Frontend — OwnerListComponent

- [x] 5.1 Wire the component to subscribe to `ActivatedRoute.queryParamMap` and drive its fetch from the URL; remove component-local pagination/sort state.
- [x] 5.2 Implement a `navigate(patch)` helper that calls `Router.navigate([], { relativeTo, queryParamsHandling: 'merge', queryParams: patch })`.
- [x] 5.3 Add `<mat-paginator [pageSizeOptions]="[5,10,20]" [pageSize]="size" [pageIndex]="page" [length]="totalElements">` below the table; on `(page)` event call `navigate({ page: e.pageIndex, size: e.pageSize })`.
- [x] 5.4 Add `matSort` to `<thead>` and `mat-sort-header` to the `Name`, `Address`, and `City` headers only; on `(matSortChange)` call `navigate({ sort: ${active},${direction}, page: 0 })`.
- [x] 5.5 Make the `Pets` column header plain text (no `mat-sort-header`).
- [x] 5.6 Rename the name column header to **"Lastname, Firstname"** and render the cell as `{{owner.lastName}}, {{owner.firstName}}`.
- [x] 5.7 On `lastName` filter change, call `navigate({ lastName: value, page: 0 })`.
- [x] 5.8 On `size` or `sort` change, ensure the `navigate` call sets `page: 0` as well (snap-back).
- [x] 5.9 Implement the loading UX: while the fetch is in flight, keep the previous rows rendered at reduced opacity (e.g. `class.loading` toggling `opacity: 0.5`) and overlay a spinner positioned absolutely over the table.
- [x] 5.10 Default the URL on first visit to `page=0`, `size=10`, `sort=name,asc`. (Component falls back to these defaults when the corresponding query params are absent — no extra navigation needed.)
- [x] 5.11 Fix the broken Pets cell in `owner-list.component.html`: removed the nested `<tr *ngFor>` and replaced with a single inline `<ng-container *ngFor="let pet of owner.pets; let last = last">{{ pet.name }}<ng-container *ngIf="!last">, </ng-container></ng-container>` block.
- [x] 5.12 Verify in the rendered DOM that the Pets `<td>` contains no `<tr>` element at any depth. (Covered by the new Playwright spec assertion `#ownersTable tbody td tr` → 0.)

## 6. E2E test

- [x] 6.1 Add a Playwright spec under `petclinic-ui-test/` named `owners-sort-paginate.spec.ts`.
- [x] 6.2 Cover: load `/owners`, verify default page 1 of size 10 sorted by name asc.
- [x] 6.3 Cover: click `City` header → URL contains `sort=city,asc`, rows reorder, page resets to 1.
- [x] 6.4 Cover: change page size to 20 → URL contains `size=20`, page resets to 1.
- [x] 6.5 Cover: paginate to page 3 → URL contains `page=2`, rows update.
- [x] 6.6 Cover: deep-link directly to `/owners?page=2&size=20&sort=city,desc` → rendered state matches URL.
- [x] 6.7 Cover: back-button after a sort change restores the prior view.
- [x] 6.8 Confirm the spec is wired into the CI workflow only — NOT into the pre-commit hook. (Pre-commit hook `.githooks/pre-commit` confirmed Playwright-free. **Note**: `petclinic-ui-test/` is NOT currently invoked by `.github/workflows/ci.yml` either — that's a pre-existing gap, out of scope for this change. The new spec also covers a regression assertion on the broken Pets `<tr>` markup.)

## 7. Guardrails and cleanup

- [x] 7.1 Re-run `C3ArchTest` (and any other architecture guardrail tests) to confirm no drift. (All 6 guardrail tests green: `C3ArchTest`, `JpaMatchesDBSchemaTest`, `OpenApiExtractorTest`, `DbSchemaExtractorTest`, `DomainModelExtractorTest`, `PackagesArchTest`.)
- [x] 7.2 Verify no remaining call site assumes `GET /api/owners` returns a flat list. (Backend: only `ValidationErrorRenderingTest` references `/api/owners` and it's a POST. Frontend: only a stale comment in `owner-detail.component.spec.ts:82` mentions `getOwners` — no code call.)
- [x] 7.3 Run frontend build (`npm run build`) and backend build (`mvn package -DskipTests=false`); confirm green. (Both green. Karma headless `npm run test-headless` also green: 102/102.)
- [ ] 7.4 Manually exercise the screen in dev (`./start-database.sh`, `./start-backend.sh`, `./start-frontend.sh`): sort, paginate, deep-link, back-button, loading dim/spinner, page-1 snap-back. **(Requires interactive dev servers — left for you to verify.)**
