## 1. Backend — paginated endpoint (TDD)

- [ ] 1.1 Write failing test: `GET /api/owners` returns `OwnerPageDto` with default `page=0,size=10` and correct `totalElements`
- [ ] 1.2 Write failing test: default sort is `lastName,firstName` ascending; `sort=city,asc` works
- [ ] 1.3 Write failing test: unsupported sort key (e.g. `telephone`) is rejected, not applied
- [ ] 1.4 Write failing test: `lastName` prefix filter composes with paging; `totalElements` reflects the filtered set
- [ ] 1.5 Add `rest/dto/OwnerPageDto` (`content`, `totalElements`, `page`, `size`, `totalPages`)
- [ ] 1.6 Change `OwnerRepository.findByLastNameStartingWith(String, Pageable): Page<Owner>`
- [ ] 1.7 Update `OwnerRestController.listOwners` to accept `Pageable` + `lastName`, apply the sort whitelist (`lastName,firstName,city`), map `Page<Owner>` → `OwnerPageDto`
- [ ] 1.8 Run backend tests until 1.1–1.4 pass

## 2. Database — indexes for scale

- [ ] 2.1 Add Flyway `V9__add_owners_search_indexes.sql`: `idx_owners_last_name_first_name (last_name, first_name)` and `idx_owners_city (city)`
- [ ] 2.2 Verify migration applies cleanly on the embedded Postgres (startup + tests green)

## 3. API contract regeneration

- [ ] 3.1 Run `OpenApiExtractorTest` to regenerate root `openapi.yaml`; confirm the guardrail passes
- [ ] 3.2 Regenerate frontend `src/app/generated/api-types.ts` from the spec (do not hand-edit)

## 4. Frontend — Material grid + URL state

- [ ] 4.1 Update `owner.service.ts` to send `page/size/sort/lastName` and type the response as the page envelope
- [ ] 4.2 Add Material modules (`MatTableModule`, `MatPaginatorModule`, `MatSortModule`) in `owners.module.ts`
- [ ] 4.3 Rewrite `owner-list.component.html` to `mat-table` with `mat-paginator` (options 5/10/20, default 10) and `matSort` (active `name`, asc); sort headers only on Name + City
- [ ] 4.4 Display Name as "Last, First"; render Pets as comma-separated names (fix the invalid nested `<tr>`)
- [ ] 4.5 Wire `(page)`/`(sortChange)`/search to `Router.navigate` with merged query params; rebuild the request from `ActivatedRoute.queryParams` in a single `load()`; reset to `page=0` on new search
- [ ] 4.6 Map the single `matSort` "name" active column to `sort=lastName,{dir}&sort=firstName,{dir}`
- [ ] 4.7 Apply frontend-ux consistency CSS: Bootstrap-matching header/zebra/cell borders, `table-layout: fixed` + explicit per-column widths, reuse `.btn-default`, `white-space: nowrap` on buttons/labels

## 5. Fix broken consumers & tests

- [ ] 5.1 Update backend tests to the new shape: `rest/OwnerTest`, functional `owners.feature` + `OwnerSteps`, perf `OwnerSearchThroughLatencyProxyTest` + jmeter, `security/BasicAuthenticationConfigTest`
- [ ] 5.2 Update `petclinic-chatbot` `AssistantFlowTest` (owners API stub → page envelope)
- [ ] 5.3 Update `petclinic-ui-test` Playwright (`tests/pages/OwnersPage.ts`, `tests/support/api-client.ts`) for pagination/sort
- [ ] 5.4 Update frontend specs `owner-list.component.spec`, `owner.service.spec`

## 6. Verify

- [ ] 6.1 Run the full backend suite (all green)
- [ ] 6.2 Run frontend unit tests + Playwright E2E (all green)
- [ ] 6.3 Manually verify the grid in the running app: paging, sort on Name/City, lastName filter, deep-link/refresh restores state, styling matches sibling screens
