# Tasks

## 1. Indexes

- [x] 1.1 Add `db/migration/V4__owner_list_indexes.sql` with the three indexes from design D7 (no seed changes); verify the backend boots and `pg_indexes` lists them
- [x] 1.2 Generate 100k owners in a scratch DB and run `EXPLAIN` for name/city × asc/desc × with/without a `lastName` prefix, page 0 and a deep page; verify each plan uses an index scan (no Seq Scan + Sort), and paste the plans into the PR description

## 2. Backend contract (TDD, MockMvc)

- [x] 2.1 Write failing MockMvc tests for the defaults, sizes 5/10/20, `name`/`city` × `asc`/`desc`, and filter + page; verify they fail for the right reason
- [x] 2.2 Add `OwnerListRequest` (validated, inner `sort`/`direction` enums with lowercase wire values, `{5,10,20}` size constraint), `OwnerPageDto` and `OwnerRowDto`; change `listOwners` to a `Page<Owner>` repository query using the D5 sort chains; verify the 2.1 tests pass
- [x] 2.3 Add tests for 400 on `size=7`, `page=-1`, `sort=telephone`, `direction=up`; verify each returns a `ProblemDetail`, not a 500
- [x] 2.4 Add tests for duplicate names crossing a page boundary and for walking all pages yielding every owner exactly once; verify they pass
- [x] 2.5 Add a slim-payload test (row has `petNames`, no `pets`/`visits` key); verify it passes and `GET /api/owners/{id}` tests are unchanged
- [x] 2.6 Add `@BatchSize(size = 20)` on `Owner.pets` and a query-count test (Hibernate `Statistics`, enabled for that class only) asserting ≤ 3 statements for a page of 20 owners with pets; verify it fails without the annotation and passes with it
- [x] 2.7 Update the existing list callers: `OwnerTest`, `functional/OwnerSteps` + `owners.feature`, `OwnerSearchThroughLatencyProxyTest`, `ValidationErrorRenderingTest`, `ExceptionControllerAdviceTest`, `BasicAuthenticationConfigTest`, `AddVisitApiTest`; drop `findByLastNameStartingWith` if nothing else needs it (`OwnerCreateTest` uses it); verify `./mvnw clean test` is green

## 3. Generated contract

- [x] 3.1 Regenerate `openapi.yaml` via `OpenApiExtractorTest` (the `ApiExamples.OWNERS` example becomes a page) and then `api-types.ts` via `npm run build`; verify `git diff` shows only generated changes and the guardrail tests pass

## 4. Frontend (Karma)

- [x] 4.1 Replace `getOwners`/`searchOwners` with `listOwners(query)` returning the generated page type, letting errors propagate instead of `catchError(..., [])`; delete the hand-written `owner-page.ts`; verify `owner.service.spec.ts` covers query building with defaults omitted
- [x] 4.2 Rewrite `OwnerListComponent` around `queryParamMap` → sanitize → `switchMap` (design D8), with resets on filter/sort/size/direction and a one-shot `replaceUrl` redirect past the end; verify component specs for URL→request, resets, stale-response cancellation and redirect
- [x] 4.3 Update the template (design D9): sortable Name/City header buttons with `aria-sort`, "LastName, FirstName" cell, `<app-combo>` page size, previous/next icon buttons disabled at the ends, stable-height loading, and a separate error banner vs empty message; verify component specs for loading/error/empty and that existing selectors are unchanged
- [x] 4.4 Verify `npm run test-headless` and `npm run build` are green

## 5. End-to-end (Playwright)

- [x] 5.1 Change `Given the clinic has these owners` to walk every page at `size=20`; switch `exactly these owners are listed` to a `;` separator and rewrite the Examples table to "Last, First"; verify the existing search scenarios pass
- [x] 5.2 Replace "every owner in the clinic is listed" with a paging-through scenario (keep `@generate_sequence`) and add the spec's page, sort and reset scenarios with their new glue steps; verify `owner-search.feature` passes against a local stack
- [x] 5.3 Fix `add-owner.spec.ts` and `genseq/openapi-operations.spec.ts` for the new list shape; verify the whole Playwright suite passes and the regenerated `generated/owner-search.feature.*.genseq.*` files are committed

## 6. Docs and integration

- [ ] 6.1 Regenerate the Owners screenshots in `user-manual/` (`/regen-user-manual`); verify the manual shows the paginated grid
- [x] 6.2 Update AGENTS.md / `petclinic-backend/AGENTS.md` where they describe the owners list; verify `scripts/check-agents-md.sh` passes
- [ ] 6.3 Open the PR referencing #25 with the EXPLAIN plans from 1.2; verify CI is green
