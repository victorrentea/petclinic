## Context

The Owners list screen is the primary "find an owner" surface in PetClinic. Today `GET /api/owners` returns the full list as a flat JSON array; the Angular component receives all rows and renders them as a single unscrolled table. At the production scale this app targets (~100k owners — see `memory/project_scale.md`) this is broken end-to-end: payload size, DOM cost, and user experience all collapse.

Backend (Spring Boot 3.5, Java 21, JPA + Postgres): the repository already has a paginated query path used by `/api/owners/count` and a perf test, but the controller flattens it. The frontend (Angular 16, Bootstrap 3 styling) renders the rows with no Material or any pagination component. The codebase has a guardrails architecture (`C3ArchTest`) and a generated `api-types.ts` shared with the frontend.

Key constraints baked in by prior decisions (issue #25 + grilling session 2026-05-27):
- Server-driven only. No client-side slicing.
- Single-column sort, never cleared. Stable pagination required (id-tiebreaker mandatory).
- URL is the source of truth for view state.
- Pets column is not sortable — 1→N collection makes sort ambiguous.
- Bootstrap table stays; Material adopted only for `matSort` + `mat-paginator`.

## Goals / Non-Goals

**Goals:**
- Make the Owners screen usable at 100k-owner scale.
- Establish a clean contract for paged list endpoints (Spring `Page<T>` shape) that future list screens can reuse.
- Keep view state (`page`, `size`, `sort`) bookmarkable and back-button-friendly.
- Lock the sort-chain expansion in a backend test so the stable-pagination guarantee can't silently regress.
- Cover the user-visible behaviour (sort, paginate, deep-link, back-button) with one Playwright E2E in `petclinic-ui-test/`.
- Fix the broken `<tr>`-inside-`<td>` markup in the Pets cell (invalid HTML present in `owner-list.component.html` today).

**Non-Goals:**
- Removing `/api/owners/count` (kept for callers that still use it).
- Multi-column sort UI (the chain is server-built from a single client-chosen column).
- Case-insensitive lastName search.
- Wiring `api-types.ts` into `OwnerService` (separate cleanup).
- Debounced typing on the lastName filter (separate UX work).
- Persisting page size across sessions.
- Frontend Karma specs — brittle, not worth the maintenance (per project memory).

## Decisions

### D1. Evolve `GET /api/owners` in place; return `Page<OwnerDto>`

**Choice:** Change the existing endpoint's response shape to Spring's `Page<OwnerDto>` (`content`, `totalElements`, `totalPages`, `number`, `size`). All in-repo consumers (`OwnerTest`, `OwnerSteps`, perf test, generated `api-types.ts`) updated in lockstep.

**Why:** There are no external consumers; carrying a parallel `/api/owners/v2` endpoint would mean dead code on day one. Spring's `Page` shape is the project's de-facto convention and is what `PageableHandlerMethodArgumentResolver` produces for free.

**Alternatives considered:**
- *New `/api/owners/page` endpoint.* Rejected — splits the surface for no consumer benefit; old endpoint becomes a deprecation chore.
- *Custom envelope (`{ items, total, offset }`).* Rejected — reinvents Spring's shape; loses free serialization and `Pageable` binding.

### D2. Server-built sort chain from a single client column

**Choice:** Client sends `?sort=<col>,<dir>` with one of three logical columns (`name`, `address`, `city`). Server expands:
- `name` → `lastName, firstName, id`
- `city` → `city, lastName, firstName, id`
- `address` → `address, lastName, firstName, id`

`id ASC` is always the final tiebreaker, regardless of which column or direction the client requested.

**Why:** Stable pagination requires a deterministic total order; duplicate `(lastName, firstName)` pairs are inevitable in a 100k-row dataset. Putting the expansion on the server (a) keeps the contract tight (client can't ask for something the server didn't authorize), (b) makes the stable-pagination invariant testable in one place, (c) lets us evolve the chain (e.g. add `country`) without a client release.

**Alternatives considered:**
- *Client sends the full chain.* Rejected — pushes a correctness invariant onto the client and makes the surface impossible to validate server-side.
- *No tiebreaker, accept duplicate-row drift.* Rejected — produces visibly broken paging when two pages contain "the same" Smith.

### D3. Pets column is not sortable

**Choice:** Pets header is plain text, no `mat-sort-header` directive. Backend `sort=pets,*` returns HTTP 400.

**Why:** Pets is a `1→N` collection. "Sort by pets" has no single well-defined meaning (first pet name? pet count? earliest pet birthdate?) and any choice would be surprising at least half the time. Better to refuse than to ship a confusing default.

### D4. Adopt minimal Angular Material (`MatSort`, `MatPaginator`)

**Choice:** Add `@angular/material` + `@angular/cdk` (Angular-16 compatible versions). Import only `MatSortModule` and `MatPaginatorModule`. Keep the Bootstrap 3 `<table class="table table-striped">` markup — Material attaches via the `matSort` directive on `<thead>`, the paginator sits below the table as a separate component.

**Why:** Building correct sort/paginate primitives from scratch is a tarpit (a11y, keyboard, ARIA, focus). Material gives us battle-tested versions for free. Restricting to two modules keeps bundle and theming pain small; we don't pull in `MatTable`, so the visual identity (Bootstrap striped table) is preserved.

**Alternatives considered:**
- *NG-Bootstrap pagination.* Rejected — no equivalent `matSort` directive that adorns a non-Material `<thead>` while staying accessible.
- *Hand-rolled sort headers + paginator.* Rejected — large surface to get right; recurring source of a11y bugs.

### D5. "Name" column renders as "Lastname, Firstname"

**Choice:** Rename the column header to **"Lastname, Firstname"** and render the cell as `{{lastName}}, {{firstName}}`.

**Why:** Phonebook convention aligns the visual ordering with the sort intent (lastName first), so users see why a Smith appears before a Smithson. Also unblocks the mental model "when I click this header I sort by lastName then firstName".

### D6. URL query string is the source of truth for view state

**Choice:** `page`, `size`, `sort`, `lastName` live in the URL. The component subscribes to `ActivatedRoute.queryParamMap`, and any UI interaction navigates with `relativeTo: route, queryParamsHandling: 'merge'`. The HTTP fetch is driven by the URL, not by component-local state.

**Why:** Makes the screen bookmarkable, shareable, and back-button-correct. Also makes the component effectively stateless — a single observable pipeline (URL → fetch → render) is easier to reason about than a stateful component that also writes the URL.

**Alternatives considered:**
- *Component state + URL sync side-effect.* Rejected — two sources of truth race each other (back button vs. user click).

### D7. Page-1 snap-back on filter / size / sort change

**Choice:** Whenever `lastName`, `size`, or `sort` changes, navigate to `page=1` in the same nav event.

**Why:** Page 7 of a 12-page result rarely makes sense after the filter narrows the result to 3 rows. Snapping back avoids the "empty page" surprise and matches user expectation from search UIs.

### D8. Loading UX: dim previous rows, overlay spinner

**Choice:** On a new fetch, keep the previous page rendered with `opacity: 0.5` and an absolutely-positioned spinner overlay; replace rows when the response lands.

**Why:** Flashing the table to empty on every interaction is jarring. Keeping context makes paging feel responsive even on a slow link.

### D9. Test pyramid

**Choice:**
- **Backend `@WebMvcTest`** pinning the sort-chain expansion: for each logical column + direction, assert the controller hands the service a `Pageable` whose `Sort` is the full expanded chain with `id ASC` last.
- **One Playwright E2E** in `petclinic-ui-test/` covering sort, paginate, deep-link load, back-button. CI-only — explicitly excluded from pre-commit (per project memory: pre-commit runs only seconds-level unit tests).
- **No Karma specs** for the component (per project memory: frontend Karma is brittle and not worth the maintenance).

**Why:** The expansion logic is the one piece where a regression silently corrupts pagination, so it gets a tight, fast unit test. Everything else is integration-shaped — one E2E covers the user-visible contract end-to-end without doubling up on flaky Karma.

### D10. Fix the broken Pets cell — comma-separated inline list

**Choice:** Replace the current `<td><tr *ngFor>...</tr></td>` with `<td>{{ owner.pets | map:'name' | join:', ' }}</td>` semantics — i.e. a single inline comma-separated list of pet names inside the cell. The template uses an `*ngFor` with `last`-aware comma insertion, no nested table markup.

**Why:** The current markup is invalid HTML (`<tr>` is only a permitted child of `<thead>`/`<tbody>`/`<tfoot>`/`<table>`, never `<td>`); browsers silently reparent the row out of the cell, which is why the cell renders oddly. Comma-separated inline is the standard "compact collection in a list cell" treatment, costs no vertical real estate, and survives the new dimmed-loading overlay cleanly.

**Alternatives considered:**
- *Inline `<ul>` / bullet list.* Rejected — adds vertical bloat and disagrees with the dense Bootstrap-striped row height.
- *Comma-separated as today but `<span>`-wrapped per pet for hover affordances.* Out of scope — this change is about correctness, not adding pet-link UX.
- *Drop the column entirely.* Rejected — pet visibility is the whole point of the directory row.

## Risks / Trade-offs

- **[Breaking change to `GET /api/owners` shape]** → All known consumers are in-repo; updated in the same PR. External integrators don't exist for this endpoint today.
- **[Page jumps on back-button across filter changes]** → URL state captures `lastName`, `page`, `size`, `sort`, so back-button restores the full prior view; mitigated by D6.
- **[Material bundle adds ~80KB gzipped]** → Acceptable for the screen's value; we import only `MatSortModule` + `MatPaginatorModule`, not the whole `MatTable` package.
- **[Sort-chain drift between backend test and frontend assumption]** → Frontend doesn't know the chain; it sends one column. The backend test is the single source of truth, so drift is impossible by construction.
- **[`id ASC` tiebreaker leaks an internal column into sort]** → The client never sees it; it's only a `Sort.Order` appended server-side. No API surface change.
- **[E2E flake]** → Playwright runs CI-only and uses the existing `petclinic-ui-test/` harness; the same kind of test already exists for owner search per `memory/project_owner_search_lessons.md`, so the pattern is proven.
