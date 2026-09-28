# Tasks

## 1. Database

- [ ] 1.1 Reset the dev DB once (`./start-database.sh`) to drop the foreign V4 from `rabo26oct`; verify `flyway_schema_history` has no V4
- [ ] 1.2 Add `db/migration/V4__owner_grid_indexes.sql` with `(first_name, last_name, id)`, `(city, first_name, last_name, id)`, `(last_name text_pattern_ops)`; verify backend boots and `EXPLAIN` of a `LIKE 'Mc%' ORDER BY first_name, last_name, id LIMIT 10` uses the indexes; regenerate `docs/generated/DB.sql` so the drift check passes

## 2. Backend API (TDD in `OwnerTest`)

- [ ] 2.1 Failing tests first: default request → ≤10 owners by name asc + `totalElements`; `sort=city&dir=desc`; `size=5` page 0 + page 1 disjoint and in order; page past the end → empty `content`, real total; `lastName` filter counts only matches; `size=1000`, `sort=telephone`, `dir=up` → 400 `ProblemDetail`
- [ ] 2.2 Add `OwnerPageDto { content, totalElements }` and an `OwnerSort` enum (`name`, `city`) that owns its tie-broken `Sort`; verify with a unit test on the enum's sort columns
- [ ] 2.3 Change `OwnerRepository.findByLastNameStartingWith` to take a `Pageable` and return `Page<Owner>`; rewrite `listOwners` to validate `size ∈ {5,10,20}`, `page ≥ 0`, and return `OwnerPageDto`; verify 2.1 goes green
- [ ] 2.4 Map bad `sort`/`dir`/`size` to 400 `ProblemDetail` in `ExceptionControllerAdvice`; verify the 400 tests and `ValidationErrorRenderingTest` pass
- [ ] 2.5 Add `@BatchSize(size = 20)` on `Owner.pets`; verify with a test (Hibernate statistics or SQL count) that one page costs ≤ 3 queries (page, count, pets)
- [ ] 2.6 Update `ApiExamples.OWNERS` to a page example and the `@ApiResponse` schema; run `OpenApiExtractorTest`, commit the regenerated `openapi.yaml`, run `npm run lint:openapi`
- [ ] 2.7 Adapt the other backend readers of the list to `$.content`: `OwnerSteps` / `owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`, the JMeter plan; verify `mvn test` in `petclinic-backend` is green

## 3. Frontend

- [ ] 3.1 `npm run generate:api`; delete `owner-page.ts` in favour of the generated `OwnerPageDto`; verify `ng build` compiles
- [ ] 3.2 `OwnerService.getOwners({lastName, sort, dir, page, size})` returning the page; drop `searchOwners`; update `owner.service.spec.ts` to assert the query string
- [ ] 3.3 `OwnerListComponent`: read state from `queryParamMap`, fetch with `switchMap`, write state back via `router.navigate({queryParams})`; filter/sort/size changes reset `page` to 0; verify in `owner-list.component.spec.ts`
- [ ] 3.4 Template: `matSort` + `mat-sort-header` on Name and City only, `matSortDisableClear`, `mat-paginator` `[5,10,20]` showing the total; import `MatSortModule`, `MatPaginatorModule` in `OwnersModule`; verify spec tests and a manual look at `/owners`
- [ ] 3.5 Fix `owner-detail.component.spec.ts` stubs broken by the service change; verify `npm test` is green

## 4. UI acceptance (Playwright + Cucumber)

- [ ] 4.1 Add `petclinic-test/src/owners-grid.feature` (+ glue), tagged `@generate_sequence`: sort by City, 5 per page, page 2 continues page 1's order; also opening a URL with `page/size/sort/dir` restores the same page, and Back returns to page 1. Assert order and counts only, never names; verify it passes
- [ ] 4.2 Adapt `owner-search.feature.glue.ts`: Background checks named owners via `?lastName=`; "every owner is listed" compares the paginator total to `totalElements`; verify the feature passes
- [ ] 4.3 Switch `add-visit.dsl.ts` and `visit-date-range.feature.glue.ts` to find the pet via `GET /api/pets` (`ownerId`); verify `add-visit.spec.ts` and `visit-date-range.feature` pass

## 5. Integration & docs

- [ ] 5.1 Full stack run: all backend tests, `npm test`, full Playwright suite green; `chatbot.spec.ts` still green (MCP unaffected)
- [ ] 5.2 Update `AGENTS.md` if anything drifted (e.g. owners list is paginated; dev-DB reset note for the V4 clash); regenerate living diagrams per `GUARDRAILS.md` if they changed
