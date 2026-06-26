## Context

`GET /api/owners` today returns an unbounded `List<OwnerDto>`:
`OwnerRestController.listOwners(lastName)` → `ownerRepository.findByLastNameStartingWith(String)` →
`ownerMapper.toOwnerDtoCollection(...)`. The frontend `OwnerListComponent` mirrors this — it loads
the whole array into `owners: Owner[]` and renders a static Bootstrap table; search re-fetches the
entire (filtered) list. At the project's stated scale (~1M owners, see root `CLAUDE.md` "Scale
Assumptions") this is unviable: it loads the full table into server memory and ships it to the browser.

Existing constraints that shape the design:
- **No service layer** — controllers talk straight to Spring Data repositories (`petclinic-backend/CLAUDE.md`).
- **`openapi.yaml` is generated** by the `OpenApiExtractorTest` guardrail and CI fails on drift, so the
  runtime JSON shape must be a *stable, documented* contract.
- **Owner→Pet is `@OneToMany(fetch = LAZY)`**; `application.properties` has no batch-fetch tuning yet.
- **Angular Material is already a dependency** (used by pets/visits/vets modules), so adopting
  `mat-table` adds no new dependency.
- **Concurrent work exists**: `owner-page.ts` already declares a *flat* page interface
  `{ content, totalElements, totalPages, number, size }` (raw `PageImpl` shape) — left over from
  another session whose design differs from this one. It must be reconciled to the nested envelope.

## Goals / Non-Goals

**Goals:**
- Server-side pagination, filtering, and single-column sorting for the owners list.
- A stable, documented page contract that keeps runtime JSON, `openapi.yaml`, and generated Angular
  types in lock-step.
- Page hydration with no N+1 and no in-memory pagination of the to-many.
- Indexes that keep sort/filter index-backed at 1M rows.
- A Material grid that is visually indistinguishable from the existing Bootstrap screens, with
  URL-as-state so deep-link / back / forward / refresh all work.

**Non-Goals:**
- Sorting by the Pets column (per-owner collection, not a scalar — not well-defined).
- Multi-column sort (single-column only).
- Reworking other list screens (vets, visits) — out of scope for #25.
- Free-text / multi-field search beyond `last_name` prefix.

## Decisions

### D1 — Return a Spring `Page<>`, serialized via `VIA_DTO`, as `PagedModel<OwnerDto>`
The controller builds `PageRequest.of(page, size, Sort.by(direction, column))`, calls
`Page<Owner> findByLastNameStartingWith(String, Pageable)`, maps with `page.map(ownerMapper::toOwnerDto)`,
and returns `PagedModel<OwnerDto>`. We enable `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)`
on `PetClinicApplication`.
- **Why:** raw `PageImpl` logs an "unstable serialization" warning and is explicitly *not* a guaranteed
  JSON contract; the stable mode emits the documented `{ content, page: { size, number, totalElements,
  totalPages } }` envelope. Returning `PagedModel<OwnerDto>` (not `Page<Owner>`) makes the generated
  `openapi.yaml` and Angular types reflect exactly what ships at runtime — essential because CI fails on
  contract drift.
- **Alternatives considered:** (a) hand-written page DTO — rejected, reinvents Spring Data and diverges
  from the framework's documented shape; (b) raw `PageImpl` — rejected, unstable contract + log noise.

### D2 — Explicit `@RequestParam`s, not a Spring-injected `Pageable`
`listOwners(lastName, page, size, sort, direction)` parses params itself and constructs the `PageRequest`.
- **Why:** lets us own validation/caps and the sort whitelist (D3) deterministically, and keeps the
  generated OpenAPI parameter list explicit and documented. An injected `Pageable` would expose
  arbitrary/multi-column sort and unbounded size to a 1M-row table.
- **Alternatives considered:** `@PageableDefault Pageable` — rejected for the openness/whitelist reasons above.

### D3 — Sort whitelist with safe fallback (never 500)
A small server-side map translates the `sort` key → `Sort`: `name` → `Sort.by("lastName", "firstName")`;
`address`/`city`/`telephone` → 1:1. Unknown key → `name, asc`. `direction` parsed case-insensitively;
invalid → `ASC`. `page` clamped `>= 0`; `size` clamped to `[1, 20]`, invalid → 10.
- **Why:** `name` is not a column (it's `last_name, first_name`), the Pets column isn't a scalar, and a
  malicious/buggy client must never trigger a 500 or an unindexed sort. Whitelisting also guarantees every
  sortable path is index-backed (D5).
- **Display consistency (resolved with business):** today the Name cell renders `firstName lastName`
  ("George Franklin"), so sorting by `last_name` would leave the *visible* leading token (first name)
  looking unsorted. We flip the Name cell to **surname-first** ("Franklin, George") so the visible
  leading text *is* the sort key — coherent with the last-name search box. This is option A of the
  three considered (B = keep "First Last" + sort by `first_name, last_name`; C = the mismatched
  display-vs-sort that this change explicitly avoids).
- **Alternatives considered:** pass `sort` straight to `Sort.by(sort)` — rejected, 500s on bad input and
  allows sorting unindexed/derived fields.

### D4 — Batch-fetch pets; never `JOIN FETCH` a to-many with pagination
Set `spring.jpa.properties.hibernate.default_batch_fetch_size=20` (≥ max page size). The page query selects
owner roots scalar-only with SQL `LIMIT/OFFSET`; Hibernate then loads the page's pets in one batched
`IN (...)` query when the lazy collections are first touched (during mapping).
- **Why:** `JOIN FETCH o.pets` + `Pageable` makes Hibernate fetch *all* matching rows and paginate in
  memory (the documented HHH000104 trap) — fatal at 1M rows. Per-owner lazy access would be N+1. Batch
  fetch gives a bounded, page-sized `IN (...)` load. This is now a permanent rule in root `CLAUDE.md`.
- **Alternatives considered:** `@EntityGraph`/`JOIN FETCH` with pagination (in-memory pagination — rejected);
  `@BatchSize` on the collection (works too, but a global default is simpler and benefits other reads).

### D5 — `V9` migration indexes every sortable/filterable path
New `V9__index_owners_sort_columns.sql` adds `(last_name, first_name)`, `city`, `address`, `telephone`,
plus a `text_pattern_ops` index on `last_name` so `LIKE 'prefix%'` is index-backed. The `owners` table
currently has only its PK.
- **Why:** at 1M rows every sort and the prefix filter would otherwise be a full scan + sort. The
  `text_pattern_ops` variant is required because the default B-tree operator class does not serve
  pattern (`LIKE 'x%'`) predicates on `text` in the default (non-C) collation.

### D6 — Material grid, server-driven, Bootstrap-themed
Replace the static table with `mat-table` + `matSort` + `mat-paginator`. The component is **server-driven**:
`length = totalElements`, `pageSizeOptions = [5, 10, 20]`, and `(matSortChange)`/`(page)` navigate +
refetch — we do NOT bind a client-side `MatTableDataSource` that would sort/paginate the loaded rows.
`matSort` is wired only to the four sortable columns. CSS re-themes Material to match Bootstrap (header
bg/bold/border, odd-row striping, cell borders, `table-layout: fixed` + explicit `.mat-column-*` widths).
- **Why:** server-driven is mandatory given scale; theming keeps the app visually consistent (see the
  `frontend-ux` rule about new Material tables matching existing Bootstrap screens).
- **Alternatives considered:** keep the Bootstrap table and hand-roll paginator/sort controls — more code,
  reinvents Material; client-side `MatTableDataSource` — violates the server-side rule.

### D7 — URL query params are the single source of truth
`?lastName=&page=&size=&sort=&direction=`. The component reads `ActivatedRoute.queryParams`, initializes
sort + paginator from the URL, and every sort/page/search action `router.navigate`s with merged params and
refetches. Changing `lastName` resets `page=0`.
- **Why:** makes back/forward/refresh/deep-link all work for free and keeps a single state owner (the URL)
  rather than duplicating state in component fields.
- **Alternatives considered:** component-local state — rejected, breaks deep-linking and browser navigation.

### D8 — Reconcile the concurrent `owner-page.ts`
Correct `owner-page.ts` (and any `owner-list.component.css` pagination scaffolding from the other session)
to the nested `{ content, page: { size, number, totalElements, totalPages } }` envelope from D1 — prefer
regenerating the Angular type from `openapi.yaml` over hand-editing.
- **Why:** the leftover flat shape encodes the rejected raw-`PageImpl` contract and would silently diverge
  from the server. Reconcile before implementation to avoid two competing designs landing.

## Risks / Trade-offs

- **Breaking response shape** (array → page envelope) → every consumer of `GET /api/owners` must migrate.
  Mitigation: regenerate `openapi.yaml` + Angular types in the same change; the guardrail test fails the
  build if anything is left inconsistent.
- **`text_pattern_ops` is collation/operator-class specific** → wrong index won't serve `LIKE`.
  Mitigation: `EXPLAIN` the prefix query in a `@DataJpaTest` (or manual check) to confirm index usage.
- **`default_batch_fetch_size` is global** → changes fetch behavior for other lazy collections too.
  Mitigation: 20 is conservative and broadly beneficial; verify no read regresses via existing tests.
- **Forgetting `PagedModel` and returning `Page<Owner>`** → reintroduces the unstable shape and drifts the
  contract. Mitigation: assert the nested `page` envelope in the MockMvc test; rely on the OpenAPI guardrail.
- **Two sessions editing the owners screen concurrently** → merge conflicts / contradictory designs.
  Mitigation: D8 reconciliation step done first; ideally implement on an isolated branch/worktree.
- **Material grid drifting visually from Bootstrap** → inconsistent UI. Mitigation: Playwright e2e plus a
  side-by-side visual check against an existing list screen.

## Migration Plan

1. Backend contract first (TDD): add `@EnableSpringDataWebSupport(VIA_DTO)`, repository `Page<>` overload,
   controller params + whitelist + caps, `default_batch_fetch_size`, `V9` migration. Regenerate `openapi.yaml`.
2. Regenerate Angular API types; reconcile `owner-page.ts` (D8).
3. Frontend: Material grid + service `getOwners(params): Observable<OwnerPage>` + URL-as-state component.
4. Tests: MockMvc (envelope, whitelist, caps), `@DataJpaTest` (paging + batch + index), frontend component
   unit test, one Playwright e2e.
5. **Rollback:** revert is clean — `V9` only *adds* indexes (drop them to roll back the DB); the controller/
   frontend revert restores the list contract. No data migration, so no data-loss risk.

## Open Questions

- Should `lastName` filtering be case-insensitive (`ILIKE` / `findByLastNameStartingWithIgnoreCase`)? The
  brief specifies `findByLastNameStartingWith` (case-as-stored); confirm before implementation if the UX
  expects case-insensitive search (would need a functional index on `lower(last_name)` instead).
- Confirm the exact `pageSizeOptions` default selection (10) is the desired initial page size in the UI.
- Surname-first display format: comma form ("Franklin, George") vs space ("Franklin George"). Assumed
  comma (phonebook convention); trivially adjustable.

**Resolved:** the Name column displays surname-first and sorts by `last_name, first_name` (option A,
confirmed with business) — see D3.
