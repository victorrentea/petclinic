# Tasks

## 1. Backend: a page of owners, sorted by name or city

- [ ] 1.1 Write a red MockMvc `OwnerListTest`.
  - Cover: default page (≤ 10 rows plus total), size 5 page 1, a page past the end, the
    `name`/`city` asc/desc orders with names kept ascending inside a descending city, identical
    names across a page boundary, the `lastName` filter with a filtered total, and the accented
    order Long → Łukasz → Mister.
  - Verify: `mvn test -Dtest=OwnerListTest` fails for the expected reasons.
- [ ] 1.2 Add `OwnerPageDto`, `Page<Owner> findByLastNameStartingWith(String, Pageable)`, and the
  `name`/`city` whitelist that maps to a `Sort` ending on `id`. `listOwners` returns the page.
  - Verify: the sorting and paging tests in `OwnerListTest` pass.
- [ ] 1.3 If the accented-order test fails on zonky, set the embedded Postgres locale to
  `en_US.UTF-8`.
  - Verify: the accented test passes without being weakened.
- [ ] 1.4 Add `@BatchSize(size = 20)` on `Owner.pets` and `Pet.visits`.
  - Verify: a test counts the SQL statements for a page of 20 owners (Hibernate statistics or the
    datasource proxy), and the count stays the same with 5 or 20 owners.
- [ ] 1.5 Move `OwnerTest`'s list and search tests and `ApiExamples.OWNERS` to the page shape.
  - Verify: `mvn test -Dtest='OwnerTest,OwnerListTest'` is green.

## 2. Backend: invalid parameters are a 400

- [ ] 2.1 Write red tests for `size=50`, `page=-1`, `sort=telephone`, `sort=name,up` and `page=abc`,
  each expecting a 400 ProblemDetail whose errors name the parameter.
  - Verify: they fail; today's response is 200 or 500.
- [ ] 2.2 Validate `page`, `size` and `sort` in the controller, throw a dedicated exception, and map
  it and `MethodArgumentTypeMismatchException` to `validationProblem` in `ExceptionControllerAdvice`.
  - Verify: the tests from 2.1 pass.
- [ ] 2.3 Regenerate `openapi.yaml` (it shows the `page`/`size`/`sort` parameters and `OwnerPageDto`)
  and `docs/generated/DomainModel.puml` if `@BatchSize` changed it.
  - Verify: `mvn test` is green, including `OpenApiExtractorTest`, the guardrail and diagram tests,
    and `PackagesArchTest`.

## 3. Frontend: the grid pages and sorts on the server

- [ ] 3.1 Regenerate `api-types.ts`. Add `OwnerPage` and `OwnerService.listOwners({page, size, sort,
  lastName})`, replacing `getOwners`/`searchOwners` and letting errors propagate.
  - Verify: `owner.service.spec.ts` asserts the query string (defaults omitted) and an error
    reaching the subscriber.
- [ ] 3.2 Write red `owner-list.component.spec.ts` cases:
  - a load is driven by the URL query params;
  - paginator and sort events navigate with the new params;
  - a search, sort change or size change drops `page`;
  - only Name and City carry `mat-sort-header`;
  - Add Owner shows on an empty result;
  - an error shows its message, not "No owners…".

  Verify: `npm run test-headless` fails on them.
- [ ] 3.3 Implement the component.
  - Import `MatSortModule` and `MatPaginatorModule` into `OwnersModule`.
  - Make `queryParams` drive the load through `switchMap`.
  - Use `matSortDisableClear`, `matSortStart="asc"`, and a paginator with `[5, 10, 20]` and the
    total.

  Verify: `npm run test-headless` and `npm run test:arch` are green.

## 4. End-to-end

- [ ] 4.1 Change the glue so nothing scans the whole owner list.
  - `add-visit.dsl.ts` and `visit-date-range.feature.glue.ts` find their pet through `GET /api/pets`.
  - `owner-search.feature.glue.ts` drops `allOwnerNames`.
  - Verify: `add-visit.spec.ts` and `visit-date-range.feature` pass.
- [ ] 4.2 Turn `owner-search.feature`'s "lists every owner" into "shows the first page": 10 rows,
  and the paginator shows the total.
  - Verify: that feature passes.
- [ ] 4.3 Write `owners-grid.feature`:
  - sort by city descending;
  - change the page size to 5;
  - go to page 2, open an owner, go Back, and land on the same page and sort;
  - Telephone is not sortable.

  Verify: it is red against the old grid and green now, with the Cucumber run passing in full.

## 5. Docs and integration

- [ ] 5.1 Regenerate the owners section and screenshot of `user-manual/` with the
  `regen-user-manual` skill.
  - Verify: the manual describes paging and the Name/City sort.
- [ ] 5.2 Update `AGENTS.md` if anything drifted. The REST contract line for `/api/owners` should
  mention paging; `VOLUMETRY.md` is linked.
  - Verify: re-read it against the code.
- [ ] 5.3 Commit, push, and watch CI.
  - Verify: `ci.yml` is green, including the Sonar gate (new coverage ≥ 80%, duplication ≤ 3%).
- [ ] 5.4 Open a separate issue for the stray "Ada Acceptance…" owners left by `add-owner.spec.ts`.
  - Verify: the issue URL is recorded in this file.
