## 1. Backend — repository (TDD: @DataJpaTest)

- [x] 1.1 Write a failing `@DataJpaTest` for paged + last-name-prefix search returning `Page<Owner>` (asserts page size, totalElements, content)
- [x] 1.2 Write failing tests for sort whitelist `{lastName, firstName, city}`, default `lastName asc`, and the always-appended `id` tiebreaker
- [x] 1.3 Write a failing test for invalid/unknown sort field → falls back to `lastName asc` (no exception)
- [x] 1.4 Add `@BatchSize(20)` to `Owner.pets`; write a test asserting pet loading is batched (bounded query count, no N+1) with the root query collection-free
- [x] 1.5 Add `OwnerRepository` method (`Page<Owner> findByLastNameStartingWith(String, Pageable)`, case-sensitive prefix kept); make tests green

## 2. Backend — controller (TDD: MockMvc)

- [x] 2.1 Write a failing MockMvc test: `GET /api/owners` returns the `Page` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`) with default size 10 and default sort `lastName asc`
- [x] 2.2 Write failing tests for `page`, `size`, `sort`, and `lastName` params (including `sort=city,desc`)
- [x] 2.3 Write a failing test: oversized `size` (e.g. 500) is clamped to max 20
- [x] 2.4 Write a failing test: invalid sort field (e.g. `telephone,asc`) returns 200 with `lastName asc`, not 500
- [x] 2.5 Change `OwnerRestController.listOwners` to accept `Pageable` + `lastName` and return `Page<OwnerDto>`; add sort-whitelist mapping + size clamp; ensure mapping runs inside the transaction (OSIV); make tests green
- [x] 2.6 Add `default-page-size=10` / `max-page-size=20` config to `application.properties`

## 3. API contract & frontend types

- [x] 3.1 Regenerate root `openapi.yaml` via `OpenApiExtractorTest` (it is generated, not hand-edited) → `PageOwnerDto` + pageable params now documented
- [x] 3.2 Run `npm run generate:api`; `generated/api-types.ts` now has `PageOwnerDto`; existing `owner-page.ts` already matches the shape

## 4. Frontend — service & component (TDD: specs)

- [x] 4.1 Wire `MatPaginatorModule` (Angular Material) into `owners.module.ts`
- [x] 4.2 Write a failing service spec; update `owner.service.ts` `getOwners` to pass `page`/`size`/`sort`/`lastName` and return `OwnerPage`
- [x] 4.3 Write failing component specs: two-state sort toggle on Name/City only, Name rendered last-name-first ("Carter Adam"), default `lastName asc`
- [x] 4.4 Write failing component specs: `MatPaginator` (first/prev/next/last, "Showing X–Y of Z", no numbered buttons), page-size options 5/10/20 (default 10)
- [x] 4.5 Write failing component specs for URL sync of `page`/`size`/`sort`/`lastName` (init from `ActivatedRoute`, write on change)
- [x] 4.6 Write failing component specs for edge cases: search/sort/page-size change resets to page 0; out-of-range page clamps to last valid page; zero results → "No owners found" and paginator hidden
- [x] 4.7 Implement `owner-list.component.ts` state + handlers and `owner-list.component.html` (sortable headers, paginator, last-name-first Name cell, fix malformed pets markup); make specs green

## 5. E2E (Playwright, petclinic-ui-test/)

- [x] 5.1 Update `support/api-client.ts` to consume the paged response (`content` + totals); add `getFullNamesLastFirst`
- [x] 5.2 Add pagination/sort locators to `pages/OwnersPage.ts` (paginator buttons, range label, sortable headers, page-size selector)
- [x] 5.3 Write e2e specs in `tests/owners.spec.ts`: paginate + range label, sort Name asc/desc, change page size, deep-link restore, zero-results state
- [x] 5.4 Implement step definitions for `features/owners-pagination-sorting.feature`; Cucumber dry-run maps all 22 steps across 3 scenarios
- [x] 5.5 Added a CI `e2e` job (docker-compose harness, `SKIP_SERVER_START=1`); pre-commit hook already runs no browser tests (only gitleaks/Spotless/type-gen)

## 6. Verify & finalize

- [x] 6.1 Full backend suite (131 tests, 0 failures) + frontend specs (113, 0 failures) green
- [x] 6.2 Verified the running app via Playwright screenshots (sort asc/desc on Name & City, paginate, page size); added `owners-column-stability.spec.ts` asserting columns don't drift (≤1px) across all sorts
- [x] 6.3 Guardrail drift clean: `docs/generated` and `DB.sql` unchanged; `openapi.yaml` + `api-types.ts` regenerated in-tree
