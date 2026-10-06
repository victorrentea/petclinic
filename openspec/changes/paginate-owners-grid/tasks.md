# Tasks

Write each test first and watch it fail (TDD). Other sessions share this folder, so stage only these paths, by name.

## 1. Backend: paged, sorted, bounded `GET /api/owners`

- [x] 1.1 Move `OwnerTest`'s list/search tests into a new `OwnerListTest`, against the page shape (`content`, `totalElements`, `totalPages`, `number`, `size`) and add failing tests for the default page (page 0, size 10, name asc), last partial page and page past the end; verify they fail for the right reason with `mvn test -Dtest=OwnerTest`
- [x] 1.2 Add `OwnerPageDto` (hand-written) and change `listOwners` to take `page`/`size`/`sort` request params and return it, with `OwnerRepository.findByLastNameStartingWith(String, Pageable)` returning `Page<Owner>`; verify the 1.1 tests pass
- [x] 1.3 Add failing tests for `sort=name` (Beatrix before Harry Potter), `sort=city,desc`, the accented ordering (Long Silver < Łukasz Śliwiński < Mister Geppetto) and the 11-identical-owners page boundary; implement the `name|city` + `asc|desc` whitelist that always appends `id`; verify with `mvn test -Dtest=OwnerListTest`
- [x] 1.4 Add failing tests for `size=101`, `size=0`, `page=-1` and `sort=telephone` → 400 naming the parameter (and listing `name`, `city` for sort), plus `size=100` → 200; implement with `@Min`/`@Max`/`@Pattern` on a `@Validated` controller (the existing 400 handler covers them); verify with `mvn test -Dtest=OwnerListTest`
- [x] 1.5 Add failing tests for the `lastName` filter with paging (`Pot` → total 2, Beatrix then Harry; `pot` → empty, total 0); verify they pass after 1.2–1.3 or fix
- [x] 1.6 Add `@BatchSize` on `Owner.pets` and `Pet.visits` (or `hibernate.default_batch_fetch_size`) and a test asserting a 20-owner page issues a bounded number of SELECTs (e.g. Hibernate statistics ≤ 4); verify with `mvn test -Dtest=OwnerListTest`
- [x] 1.7 Update `functional/owners.feature` + `OwnerSteps` to read `content` from the page; verify with the Cucumber runner (`mvn test -Dtest=*Cucumber*`)
- [x] 1.8 Regenerate `openapi.yaml` (and `petclinic-backend/docs/generated/**` if touched) via `mvn test -Dtest=OpenApiExtractorTest`; verify the diff shows only the `listOwners` change and the guardrail tests pass with `mvn test`

## 2. Database: indexes for the two sorts and the prefix search

- [x] 2.1 Add `db/migration/V4__owner_list_indexes.sql` with `(first_name, last_name, id)`, `(city, first_name, last_name, id)` and `(last_name text_pattern_ops)`; verify the backend boots and `mvn test` passes (Flyway applies it on zonky)
- [x] 2.2 In a throwaway database loaded with ~100k generated owners, run `EXPLAIN ANALYZE` for: unfiltered name sort page 0 and a deep page, unfiltered city desc, and `lastName='Pot'` with each sort; drop any index the plans don't use and record the plans in design.md
- [x] 2.3 Regenerate the schema diagram if the DB schema extractor guardrail flags drift (`mvn test -Dtest=DbSchemaExtractorTest`); verify it passes

## 3. Frontend: service and page type

- [x] 3.1 Regenerate `src/app/generated/api-types.ts` (per its generator, never by hand) and make `owners/owner-page.ts` re-export the generated page type; verify `npm run build` compiles
- [x] 3.2 Replace `getOwners()`/`searchOwners()` in `OwnerService` with one `getOwnersPage({lastName, page, size, sort})` that omits empty params; update `owner.service.spec.ts` first (URL built per param combination, error handled); verify with `npm run test-headless`
- [x] 3.3 Fix `owner-detail.component.spec.ts` if it stubs the removed service methods; verify with `npm run test-headless`

## 4. Frontend: Owners grid

- [x] 4.1 Import `MatPaginatorModule` and `MatSortModule` in `owners.module.ts`; verify `npm run build`
- [x] 4.2 Write failing `owner-list.component.spec.ts` tests: query params → service call (1-based URL page → 0-based API page, defaults when absent); paginator/sort/search events → `router.navigate` with page reset and defaults omitted; no-owners message only on `totalElements === 0`, not on error; Telephone/Address/Pets headers not sortable
- [x] 4.3 Implement the component: derive requests from `queryParamMap` (switchMap, so only the latest answers — replacing the hand-rolled unsubscribe), navigate on every user change, `mat-paginator` with `[5, 10, 20]` and `length=totalElements`, `matSort` on Name and City only; verify 4.2 passes with `npm run test-headless`
- [x] 4.4 Run the app (`./start-database.sh`, `./start-backend.sh`, `./start-frontend.sh`) and check by hand: size 5 → 6 pages for 26 seeded owners, City sort, search from page 3 resets, Back from an owner's page and refresh keep page + sort, `/owners` stays clean at defaults

## 5. Acceptance tests (`petclinic-test`)

- [x] 5.1 Rewrite the "empty last name lists every owner" scenario in `owner-search.feature` as "lists the first page and the total of all owners", and add scenarios for page size 5 and sorting by City; update `owner-search.feature.glue.ts` and page objects; verify with the `petclinic-test` runner against the running stack
- [x] 5.2 Re-run `add-owner.spec.ts` unchanged; verify it still passes (it relies on `/owners` staying query-param-free)
- [x] 5.3 Regenerate the `@generate_sequence` diagram for the rewritten scenario (`petclinic-test/generated/owner-search.feature.*.genseq.*`); verify the genseq/openapi-operations spec passes

## 6. Integration and docs

- [x] 6.1 Update `AGENTS.md` → API Endpoints to note that `/api/owners` is paged (`page`, `size` ≤ 100, `sort=name|city`); verify no other line in it describes the old bare list
- [x] 6.2 Run the full backend suite (`mvn test`), `npm run test-headless` and the `petclinic-test` suite; verify all green before committing
