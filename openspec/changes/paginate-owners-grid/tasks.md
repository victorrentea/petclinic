# Tasks

## 1. Database: collation and indexes (de-risk first)

- [ ] 1.1 Add `V4__owners_list_collation_and_indexes.sql`: alter `owners.first_name`, `last_name`, `city` to `COLLATE "und-x-icu"`; create `(last_name, first_name, id)`, `(city, last_name, first_name, id)` and `(last_name text_pattern_ops)`. Verify `mvn test -Dtest=JpaMatchesDBSchemaTest` boots on the embedded test Postgres. If ICU is missing there, switch to the fallback collation from design.md › Risks and note it in the migration.
- [ ] 1.2 Regenerate `docs/generated/DB.sql` (`DbSchemaExtractorTest`) and `DB.puml` (pre-commit). Verify `DbSchemaExtractorTest` is green and the diff shows only the collation and the 3 indexes.
- [ ] 1.3 Verify the existing case-sensitive prefix search is unchanged under the new collation: the current `OwnerTest` search tests pass untouched.

## 2. Backend: paged, sorted listing

- [ ] 2.1 TDD in `OwnerTest`: write failing MockMvc tests for each `owner-list` API scenario: first page and total, last partial page, past the last page, paging after the filter, default size 10, size ∉ {5,10,20} → 400, page -1 → 400, default sort by last name (Wendy Darling before Harry Potter), then first name (George before Wendy Darling), `city,desc` with name tie-breakers, unsupported sort key → 400, Śliwiński between Silver and Tremaine, and a 4-Londoners walk with size 5 seeing each owner exactly once. Verify they fail for the right reason.
- [ ] 2.2 Add `OwnerPageDto` (`content`, `page`, `size`, `totalElements`) to `rest/dto/`, and `OwnerMapper.toOwnerPageDto(Page<Owner>)`. Verify `PackagesArchTest` stays green.
- [ ] 2.3 Change `OwnerRepository.findByLastNameStartingWith` to take a `Pageable` and return `Page<Owner>`, and update every caller. Verify `mvn compile` passes.
- [ ] 2.4 In `OwnerRestController.listOwners`, bind and validate `page`/`size`/`sort`, map `sort` onto the fixed `Sort`s from design D3, and return `OwnerPageDto`. Verify the 2.1 tests pass.
- [ ] 2.5 Add `@BatchSize(size = 20)` on `Owner.pets`. Verify with a test that listing a page of 20 owners with pets runs at most 3 SQL statements (page, count, pets), for example by counting statements with Hibernate statistics.
- [ ] 2.6 Update the other backend callers of `GET /api/owners` to the page shape: `owners.feature`/`OwnerSteps`, `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`. Verify `mvn test` is fully green.
- [ ] 2.7 Regenerate `openapi.yaml` (`OpenApiExtractorTest`), describing `page`, `size` (enum 5/10/20) and `sort` (enum of the 4 values). Verify `npm run lint:openapi` passes and the CI drift check is clean.

## 3. Frontend: Owners screen

- [ ] 3.1 Run `npm run generate:api`. Replace `OwnerService.getOwners`/`searchOwners` with `listOwners({lastName, page, size, sort})` returning `Observable<OwnerPage>`, and update `owner.service.spec.ts`. Verify `npm run test-headless` passes for the service.
- [ ] 3.2 Import `MatTableModule`, `MatSortModule`, `MatPaginatorModule` in `owners.module.ts`. Verify `npm run test:arch` and `npm run build` (strict, no warnings) pass.
- [ ] 3.3 TDD in `owner-list.component.spec.ts`: the component loads from query params; a search and a sort navigate with `page: 0`; a page-size change keeps the first visible owner; only Name and City have sort headers; the empty message and hidden paginator show when `totalElements === 0`. Verify the tests fail first, then pass.
- [ ] 3.4 Rewrite `owner-list.component.ts/html` per design D8 (URL as the single source of truth, `switchMap` on `queryParamMap`), keeping `#ownersTable` and `td.ownerFullName`. Verify the 3.3 tests pass and the page works in `npm start` against the seeded backend.

## 4. End-to-end and docs

- [ ] 4.1 Update `owner-search.feature` and its glue: fetch owners from the page shape, and rewrite "Searching with an empty last name lists every owner" as "lists the first page and reports every owner in the total". Regenerate its `@generate_sequence` diagram. Verify the Playwright Cucumber run is green on the `default` fixture.
- [ ] 4.2 Add Playwright scenarios for the UI requirements: sort by clicking City (twice for descending), Telephone not sortable, refresh keeps page/sort/size, the shared link `/owners?lastName=Pot&page=0&size=5&sort=name,desc`, a search from a later page goes back to page 0, and the empty result. Verify they are green, and red on the previous commit.
- [ ] 4.3 Check `add-owner.spec.ts` still finds the new owner by last-name search (it searches by a unique last name, so paging shouldn't matter). Verify the spec is green.
- [ ] 4.4 Volume check: on a local database, generate 100,000 owners (`generate_series`) and run `EXPLAIN ANALYZE` for page 0 and the last page of each of the 4 sorts, the `Pot` prefix search and its count. Verify every plan uses the new indexes (no `Seq Scan` + `Sort` on `owners`), and attach the plans to the PR.
- [ ] 4.5 Update `AGENTS.md`'s API Endpoints line for `/api/owners` (paged: `page`, `size`, `sort`), keeping AGENTS.md under 200 lines. Mark Q3–Q18 in `Q&A.md` as decided or changed after the Three Amigos meeting. Verify `openspec validate paginate-owners-grid --strict` passes.
