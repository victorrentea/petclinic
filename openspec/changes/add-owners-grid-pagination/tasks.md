## 1. Backend — paginated endpoint (TDD)

- [x] 1.1 Write failing test: `GET /api/owners` returns `OwnerPageDto` with default `page=0,size=10` and correct `totalElements`
- [x] 1.2 Write failing test: default sort is `name` ascending (last then first); `sort=city,asc` works
- [x] 1.3 Write failing test: a sort value that isn't `name`/`city` (e.g. `telephone`, or a raw field like `lastName`) is rejected, not applied
- [x] 1.4 Write failing test: `lastName` prefix filter composes with paging; `totalElements` reflects the filtered set
- [x] 1.5 Add `rest/dto/OwnerPageDto` (`content`, `totalElements`, `page`, `size`, `totalPages`)
- [x] 1.6 Change `OwnerRepository.findByLastNameStartingWith(String, Pageable): Page<Owner>`
- [x] 1.7 Update `OwnerRestController.listOwners` to read explicit `page`/`size`/`sort`(column `name`|`city`)/`dir` + `lastName` params (NOT an injected `Pageable`), reject unknown sort columns, map column→fields server-side (`name`→`lastName`,`firstName`; `city`→`city`), build `PageRequest`, map `Page<Owner>` → `OwnerPageDto`
- [x] 1.8 Run backend tests until 1.1–1.4 pass

## 2. Database — indexes for scale

- [x] 2.1 Add Flyway `V9__add_owners_search_indexes.sql`: `idx_owners_last_name_first_name (last_name, first_name)` and `idx_owners_city (city)`
- [x] 2.2 Verify migration applies cleanly on the embedded Postgres (startup + tests green)

## 3. API contract regeneration

- [x] 3.1 Run `OpenApiExtractorTest` to regenerate root `openapi.yaml`; confirm the guardrail passes
- [x] 3.2 Regenerate frontend `src/app/generated/api-types.ts` from the spec (do not hand-edit)

## 4. Frontend — Material grid + URL state

- [x] 4.1 Update `owner.service.ts` to send `page/size/sort/lastName` and type the response as the page envelope
- [x] 4.2 Add Material modules (`MatTableModule`, `MatPaginatorModule`, `MatSortModule`) in `owners.module.ts`
- [x] 4.3 Rewrite `owner-list.component.html` to `mat-table` with `mat-paginator` (options 5/10/20, default 10) and `matSort` (active `name`, asc); sort headers only on Name + City
- [x] 4.4 Display Name as "Last, First"; render Pets as comma-separated names (fix the invalid nested `<tr>`)
- [x] 4.5 Wire `(page)`/`(sortChange)`/search to `Router.navigate` with merged query params; rebuild the request from `ActivatedRoute.queryParams` in a single `load()`; reset to `page=0` on new search
- [x] 4.6 Frontend sends the clicked column name (`name`|`city`) + direction as the single `sort` param — no entity-field mapping on the client (name the `matColumnDef`s `name`/`city` so `matSort.active` is already the column name)
- [x] 4.7 Apply frontend-ux consistency CSS: Bootstrap-matching header/zebra/cell borders, `table-layout: fixed` + explicit per-column widths (chosen by inspecting the real owner data in the DB), `text-overflow: ellipsis` + `overflow: hidden` + `white-space: nowrap` on cells so long values truncate instead of reflowing the column, reuse `.btn-default`, `white-space: nowrap` on buttons/labels

## 5. Fix broken consumers & tests

- [x] 5.1 Update backend tests to the new shape: `rest/OwnerTest`, functional `owners.feature` + `OwnerSteps`, perf `OwnerSearchThroughLatencyProxyTest` + jmeter, `security/BasicAuthenticationConfigTest`
- [x] 5.2 Update `petclinic-ui-test` Playwright (`tests/pages/OwnersPage.ts`, `tests/support/api-client.ts`) for pagination/sort
- [x] 5.3 Update frontend specs `owner-list.component.spec`, `owner.service.spec`

## 6. Verify

- [x] 6.1 Run the full backend suite (all green)
- [x] 6.2 Run frontend unit tests + Playwright E2E (all green)
- [x] 6.3 Manually verify the grid in the running app: paging, sort on Name/City, lastName filter, deep-link/refresh restores state, styling matches sibling screens
