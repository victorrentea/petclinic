# Tasks

## 1. Branch and housekeeping

- [x] 1.1 Create `gh25-owners-pagination` from `main`, cherry-pick the OpenSpec commit `9477d175`, bring over this
      change folder and the two GH25 lines in `AGENTS.md`; verify `openspec status --change add-owners-grid-pagination`
      lists all four artifacts on the new branch
- [x] 1.2 Delete the 20 leftover "Kevin McCallister / 671 Lincoln Ave" owners (and their pets/visits) from the local
      dev DB; verify with `db-cli` that `select count(*) from owners` is back to 26
- [ ] 1.3 Find which Playwright spec leaves those owners behind and open a GitHub issue for it; verify the issue URL
      is in the final report

## 2. Database: collation and indexes

- [x] 2.1 Write a failing repository test: owners Silver, Śliwiński, Tremaine listed by name come back in that order;
      verify it is red on `C` collation
- [x] 2.2 Add `V4__owners_sortable_columns.sql` (ICU collation on `first_name`, `last_name`, `city`; indexes
      `(last_name, first_name, id)`, `(city, last_name, first_name, id)`, `(last_name text_pattern_ops)`); verify
      2.1 goes green locally, then push and verify CI boots Flyway on the Linux Zonky Postgres (design risk #1)
- [x] 2.3 Write a test that inserts 100,000 owners with `generate_series` and asserts `EXPLAIN` of the page query
      (by name, by city, with a `lastName` prefix, on a late page) contains no `Seq Scan on owners`; verify it passes
- [x] 2.4 Update any living diagram or guardrail the migration drifts (see `GUARDRAILS.md`); verify the guardrail
      tests pass

## 3. Backend API: paged contract

- [x] 3.1 Write failing MockMvc tests for every API scenario in `specs/owner-list/spec.md` (defaults, later page,
      past the end, size 0 / 500 → 400, sort by city desc, unknown sort → 400, 15 identical owners across two
      pages, search totals); verify all red
- [x] 3.2 Implement `OwnerPageDto`, the `OwnerSort` enum with its total orders, `page`/`size`/`sort` params with
      `@Min/@Max`, the paged repository method; verify 3.1 green
- [x] 3.3 Add `@BatchSize(size = 20)` on `Owner.pets` and a test counting SQL statements for one page (owners +
      count + one pets query); verify it passes
- [x] 3.4 Regenerate `openapi.yaml` via `OpenApiExtractorTest` and update `ApiExamples.OWNERS`; verify the
      generated diff shows only the new params and response shape
- [x] 3.5 Move the backend consumers to the page shape: `OwnerTest`, `AddVisitApiTest`,
      `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`, `owners.feature` + `OwnerSteps`,
      JMeter CRUD plan; verify `mvn test` is green
- [x] 3.6 Update the API Endpoints section of `AGENTS.md` with the paging params; verify it stays under 200 lines

## 4. Frontend: paged, sortable grid

- [x] 4.1 `npm run generate:api`; change `OwnerService.getOwners` to take `{lastName, page, size, sort}` and return
      `OwnerPage` (drop `searchOwners`); update `owner.service.spec.ts`; verify it passes
- [x] 4.2 Write failing `owner-list.component.spec.ts` tests: reads state from query params, page-size change and
      sort change and new search reset to page 0, past-the-end answer navigates to the last page, empty result shows
      the "no owners" message without a pager, only Name and City have sort headers; verify red
- [x] 4.3 Implement with `MatPaginatorModule` + `MatSortModule` in `owners.module.ts`, URL-driven state and
      `switchMap`; verify 4.2 green, `npm run test-headless`, `npm run test:arch` and `npm run build` pass
- [x] 4.4 Update the Owners section of `docs/user-manual/manual.md` (pager, sortable columns); verify the text
      matches the running UI

## 5. End to end

- [x] 5.1 Update `petclinic-test/src/pages/OwnersPage.ts` with pager and sort helpers, and write a Playwright spec
      (`test.use({dbFixture: 'default'})`) covering: 20 rows per page, sort by city both ways, Back from an owner
      returns to the same page and sort, a new search resets to page 1; verify red before 4.3 lands, green after,
      with `PW_TRACE=on` traces kept
- [x] 5.2 Re-run the whole Playwright suite (`add-owner.spec.ts` reads the grid); verify it is green

## 6. Delivery

- [ ] 6.1 Commit, push, open a PR with "Closes #25"; verify `ci.yml` is green with the ci-watch skill (Sonar
      coverage and duplication gates included)
- [ ] 6.2 Draft the GH #25 comment explaining why sorting is limited to Name and City (data findings) and the scale
      target; show it to Victor and post only after his OK
