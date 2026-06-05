# Tasks: owners-sort-pagination

TDD throughout: every backend task pairs a failing test (committed first conceptually) with the implementation that greens it.

## 1. Backend — Page envelope

- [ ] 1.1 Write failing e2e test: `GET /api/owners` returns `{content, totalElements, totalPages, number, size}` with defaults `number=0, size=10` (`test/owner.e2e-spec.ts`)
- [ ] 1.2 Create generic `PageDto<T>` + `OwnerListRowDto` (`id, firstName, lastName, address, city, telephone, petNames: string[]`) with OpenAPI annotations; add a raw→DTO mapper
- [ ] 1.3 Implement the list query in `owner.controller.ts`: single grouped projection (`getRawMany`) — `LEFT JOIN pet`, `array_agg(pet.name ORDER BY pet.name)` → `petNames`, `GROUP BY owner.id`, validated `page`/`size` → `LIMIT/OFFSET`, separate `COUNT` over filtered owners for `totalElements`; map to `PageDto<OwnerListRowDto>` — test 1.1 green
- [ ] 1.4 Write failing tests: row shape carries `petNames` (and no visits/type), owner with no pets → empty `petNames`; explicit `page`/`size` offsets, `lastName` filter combined with pagination (filtered `totalElements`), past-the-end page returns empty `content`; make green
- [ ] 1.5 Write failing tests: `400` for negative/non-numeric `page`/`size`; make green with validation pipe
- [ ] 1.6 Update existing e2e tests (`getAll`, `getAllWithLastNameFilter`) and fixtures for the new envelope

## 2. Backend — Sort chains & collation

- [ ] 2.1 Write failing tests pinning chain expansion: `name,asc` → `firstName, lastName, id ASC`; `city,desc` → `city DESC, firstName DESC, lastName DESC, id ASC`; `address` chain; **no sort param → name asc chain** (never unsorted)
- [ ] 2.2 Implement whitelist map + ORDER BY chain building in the controller; make green
- [ ] 2.3 Add TypeORM migration `CREATE EXTENSION IF NOT EXISTS unaccent`
- [ ] 2.4 Write failing tests for human collation: seed `ana`/`Ána`/`ANA`-style owners, assert they sort adjacent regardless of case/diacritics; make green with `lower(unaccent(...))` order expressions
- [ ] 2.5 Write failing tests for empty values: owners without city appear first on `city,asc`, last on `city,desc`; make green with `coalesce(col, '')`
- [ ] 2.6 Write failing tests: `400` on unknown sort column (`telephone`) and invalid direction; make green
- [ ] 2.7 Write failing test: id-tiebreaker stability — seed duplicate-name owners, fetch consecutive pages, assert no owner repeats or vanishes; make green

## 3. API contract propagation

- [ ] 3.1 Regenerate `openapi.yaml` from backend annotations; verify Page envelope and new query params appear
- [ ] 3.2 Regenerate `petclinic-frontend/src/app/generated/api-types.ts` (`npm run generate:api`); confirm guardrail/drift CI passes
- [ ] 3.3 Update Playwright `ApiClient` (`petclinic-ui-test/tests/support/api-client.ts`) for the envelope; fix any existing specs that consume it

## 4. Frontend — service & state

- [ ] 4.1 Add `Page<T>` + `OwnerListRow` (`petNames: string[]`) interfaces; extend `OwnerService.getOwners(lastName, page, size, sort)` to pass query params and type the envelope; render the Pets cell from `petNames` (the `<div *ngFor>` per-line markup)
- [ ] 4.2 Rework `owner-list.component.ts` to URL-as-source-of-truth: subscribe to `queryParamMap` → fetch; all interactions (sort, page, size, search) `router.navigate` with merged params; defaults (`page=0`, `size=10`, `sort=name,asc`) omitted from URL
- [ ] 4.3 Implement snap-to-page-1 on any sort/size/search change
- [ ] 4.4 Add session-scoped `OwnerListStateService`: remember last query params; bare `/owners` entry redirects (replaceUrl) to remembered state; fresh session starts at defaults

## 5. Frontend — UI

- [ ] 5.1 Import `MatSortModule`, `MatPaginatorModule`, `MatProgressSpinnerModule` in `app.module.ts`
- [ ] 5.2 Add `matSort` + `matSortDisableClear` with `mat-sort-header` on Name, Address, City (Telephone/Pets non-sortable); default active = Name asc with visible arrow; wire `sortChange` to router; CSS shim so sort headers fit the Bootstrap table
- [ ] 5.3 Add `<mat-paginator>` below the table: sizes 5/10/20, default 10, `showFirstLastButtons`, length from `totalElements` (counter "11–20 of 53"); wire `page` events to router
- [ ] 5.4 Hide paginator when filtered total ≤ 5 (`*ngIf="totalElements > 5"`); verify no flicker on page-size changes and that sorting stays active
- [ ] 5.5 Empty state: generic "No results" message when `content` is empty (same for empty clinic and fruitless search)
- [ ] 5.6 Loading overlay: `loading` flag, dimmed `<tbody>` (opacity + pointer-events), centered `mat-spinner`; stale rows persist until new page arrives
- [ ] 5.7 Manual smoke-check sort/paginate/deep-link/back-button/return-from-detail against the running stack

## 6. E2E (Playwright, CI-only)

- [ ] 6.1 Extend `OwnersPage` page object: header sort locators/actions, paginator controls (arrows, size selector, counter), row-count/first-row helpers, empty-state locator
- [ ] 6.2 Spec: sort — default arrow on Name asc at open; click City sorts asc, click again flips desc, order matches API-fetched expectation
- [ ] 6.3 Spec: paginate — next/last arrows change rows and counter; page size 5/20 changes row count and resets to page 1; paginator hidden when a narrow filter yields ≤ 5 results
- [ ] 6.4 Spec: deep-link — open `/owners?page=2&size=5&sort=city,desc`, assert restored view; back-button restores prior state; return from owner detail restores list state
- [ ] 6.5 Verify suite runs in CI workflow and is NOT in the pre-commit hook

## 7. Wrap-up

- [ ] 7.1 Full local run: backend tests, frontend build, Playwright suite against the running stack
- [ ] 7.2 Comment on issue #25: implementation summary + reminder that the Name-column sort order (firstName-first) awaits business confirmation
