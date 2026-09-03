## 1. Migration and indexes

- [ ] 1.1 Add `db/migration/V9__index_owners_for_paging.sql` creating `owners_name_idx (last_name, first_name, id)`, `owners_city_idx (city, id)` and `owners_last_name_prefix_idx (last_name text_pattern_ops)`; verify the backend boots against a fresh DB and `pg_indexes` lists all three
- [ ] 1.2 Regenerate `petclinic-backend/DB.sql` and `docs/generated/DB.puml` and verify the drift guardrail test passes (CODEOWNERS-protected — regenerate before pushing)
- [ ] 1.3 Commit and push this group green before starting group 2

## 2. Backend query and paged endpoint (test-first)

- [ ] 2.1 Write the failing page-boundary tests: first, middle and last page at `size=5`; `size=20` accepted; `size=21` → `400`; verify they fail for the right reason
- [ ] 2.2 Write the failing stability test: walking every page at `size=5` yields all 28 seeded owners with no repeat and no gap (this is the test that catches a missing `id` tie-breaker)
- [ ] 2.3 Write the failing sort tests for `NAME` and `CITY` in both directions, and the collation guard asserting `Śliwiński` sorts immediately after `Silver`
- [ ] 2.4 Add `OwnerRowDto` (id, firstName, lastName, address, city, telephone — no pets) and verify no `pets` field appears in the serialized row
- [ ] 2.5 Add the paged repository query with `ORDER BY last_name, first_name, id` / `city, id` and its count, composing with the existing case-sensitive `lastName` prefix filter; verify 2.1–2.3 pass and the logs show no `HHH000104`
- [ ] 2.6 Change `OwnerController` to accept `lastName`, `page`, `size`, `sort` (inner `enum SortField { NAME, CITY }`), `dir` (`Sort.Direction`) and return `PagedModel<OwnerRowDto>`; verify defaults are `page=0, size=10, sort=NAME, dir=ASC` and that a page past the end returns `200` with empty `content` and correct totals
- [ ] 2.7 Verify the handler is at exactly 5 parameters and the SonarCloud `java:S107` gate still passes

## 3. Bad enum values return 400, not 500

- [ ] 3.1 Write the failing test asserting `?sort=BANANA` and `?dir=SIDEWAYS` return `400`, not `500`
- [ ] 3.2 Add `@ExceptionHandler(MethodArgumentTypeMismatchException.class)` to `ExceptionControllerAdvice` returning a `ProblemDetail`; verify 3.1 passes
- [ ] 3.3 Commit and push groups 2–3 green

## 4. Contract regeneration

- [ ] 4.1 Update `openapi.yaml` with the new query params and the `PagedModel<OwnerRowDto>` response; verify `npm run lint:openapi` (Spectral) passes — CODEOWNERS, the PR needs `@victorrentea/elders`
- [ ] 4.2 Regenerate `petclinic-frontend/src/app/generated/api-types.ts` and verify the frontend still compiles
- [ ] 4.3 Regenerate `docs/generated/endpoint-complexity.{html,json}` and verify the drift check passes; commit and push this group before touching the frontend

## 5. Frontend grid

- [ ] 5.1 Collapse `OwnerService.getOwners()` + `searchOwners()` into one `findOwners(criteria)` reading `data.content`, and delete the orphan `owners/owner-page.ts`; verify nothing else imports either
- [ ] 5.2 Import `MatPaginatorModule` and add `<mat-paginator>` with 5/10/20 under the existing Bootstrap `<table>`; verify the row count and "1 – 10 of 28" label in the running app
- [ ] 5.3 Hand-roll sortable `Name` and `City` headers with sort arrows, keeping `#ownersTable td.ownerFullName` intact; verify clicking each header toggles direction
- [ ] 5.4 Render the name as `Last, First`; verify the grid shows `Potter, Harry`
- [ ] 5.5 Drive `lastName`, `page`, `size`, `sort`, `dir` through `ActivatedRoute.queryParams`, resetting `page` to 0 on search, sort and size change; verify reload and back-button keep the grid in place and a deep-linked URL lands on the right page
- [ ] 5.6 Commit and push the frontend green

## 6. End-to-end (mandatory, never skipped)

- [ ] 6.1 Fix `owner-search.feature.glue.ts`: read `data.content` instead of `Array.isArray(data)`, and change the Examples table to `Potter, Harry` / `Potter, Beatrix`; verify the existing scenarios pass
- [ ] 6.2 Rewrite `Then every owner in the clinic is listed`, which is no longer true under a 10-row page, as an assertion over the first page plus `totalElements` (or an explicit request for a page large enough); verify it passes
- [ ] 6.3 Add `owner-pagination.feature` covering page sizes 5/10/20, next/previous, sort toggling on both columns, and a deep-linked URL; verify the whole Playwright suite is green against the running stack
- [ ] 6.4 Verify `DeploymentDiagramTest` and the remaining drift guardrails are green, then push

## 7. Wrap-up

- [ ] 7.1 Update `AGENTS.md` with anything a future agent needs about the paged owners contract, and verify `scripts/check-agents-md.sh` passes
