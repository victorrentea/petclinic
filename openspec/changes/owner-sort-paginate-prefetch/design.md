## Context

The owners list currently loads all records in a single `GET /owners` request returning `List<OwnerDto>`. There is no sorting or pagination. Users in high-latency regions suffer slow page loads and have no way to navigate large datasets efficiently. The frontend already has an unused `OwnerPage` interface matching Spring's `Page<T>` shape — it was scaffolded in anticipation of this work.

The backend uses a custom JPQL `@Query` on `OwnerRepository` (which extends `Repository<Owner, Integer>`). The OpenAPI spec is the source of truth for DTOs — changing the response shape requires updating `openapi.yaml` and regenerating code.

## Goals / Non-Goals

**Goals:**
- Server-side pagination with dynamic page size driven by the client's viewport
- Server-side sorting on Name (`firstName`, then `lastName`) and City; default: `firstName ASC, lastName ASC`
- Frontend page cache (±1 pages pre-fetched, further pages evicted) to hide latency
- Debounced resize resets to page 1 and clears cache
- Pagination controls showing current page, total pages, prev/next buttons
- Clickable sortable column headers with sort direction indicator

**Non-Goals:**
- Client-side sorting or filtering
- Jump-to-page input
- Infinite scroll
- Remembering sort/page across browser sessions

## Decisions

### D1: Spring Data Pageable for backend pagination

Pass `Pageable` as a parameter to the existing `@Query` method. Spring Data JPA supports `Pageable` on `@Query` methods and automatically applies `LIMIT`/`OFFSET` and wraps the result in `Page<T>`. The repository will extend `PagingAndSortingRepository<Owner, Integer>` (instead of bare `Repository`) to get access to pageable infrastructure.

_Alternative considered:_ Manual `LIMIT`/`OFFSET` in raw JPQL — rejected: verbose, error-prone, no `totalElements` count without a second query.

### D2: Response shape change in openapi.yaml (breaking)

The `GET /owners` response changes from `array of OwnerDto` to an inline page object schema with `content`, `totalElements`, `totalPages`, `number`, `size`. This is a **breaking** API change. The frontend's existing `OwnerPage` interface already matches this shape. Since both backend and frontend live in this monorepo and are deployed together, no versioning or compatibility shim is needed.

### D3: Sort parameter mapping

The frontend sends `sort=firstName,asc` and `sort=lastName,asc` (Spring-style multi-value sort params). The Name column sorts by `firstName` first, then `lastName`. Allowed sort fields are `firstName`, `lastName`, `city` — the backend must validate or whitelist these to prevent JPQL injection via sort field names.

_Alternative considered:_ A single `sortBy=name|city` param mapped server-side — rejected: non-standard, loses Spring `Pageable` auto-binding.

### D4: OwnerPaginationService on the frontend

All cache, pre-fetch, resize, and sort/filter state lives in a new `OwnerPaginationService`. `OwnerListComponent` only subscribes to the service's `currentPage$` observable and dispatches user actions (next, prev, sort click, search input). This keeps the component thin and the logic independently testable.

The cache key is `{ page, size, sort, q }` serialized as a string. Any change to sort, q, or size clears the entire cache and resets to page 0.

### D5: Viewport-based page size calculation

On init and on window resize (debounced 400ms), the component measures the available table body height (viewport height minus header/footer/search bar/table header heights) and divides by a fixed row height constant (e.g., 41px). The result is sent as the `size` param. Minimum page size is capped at 5 to avoid a degenerate tiny viewport.

### D6: Pre-fetch timing

Immediately after setting `currentPage$`, the service fires background requests for `page+1` and `page-1` (if within bounds and not already cached). These requests are fire-and-forget — errors are swallowed silently (pre-fetch is best-effort). Pages beyond current±1 are removed from the cache map on each navigation.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Race condition: resize fires while a pre-fetch is in-flight | On resize, increment a `generation` counter; responses from stale generations are discarded |
| Sort field injection via `sort` param | Backend whitelists allowed sort fields (`firstName`, `lastName`, `city`) and throws 400 for unknown fields |
| Page size flicker on load (size unknown until DOM measured) | Component shows a loading spinner until first page size is calculated; no request is sent before then |
| Pre-fetch on slow connections wastes bandwidth | Pre-fetch only if connection is not `saveData` (check `navigator.connection?.saveData`) |
| Breaking API change breaks other consumers | Only the Angular frontend consumes this endpoint in this project; note the change in commit message |

## Migration Plan

1. Update `openapi.yaml` — change `GET /owners` response schema and add `page`, `size`, `sort` params
2. Run `mvn clean install` to regenerate DTOs
3. Update backend: repository, service, controller
4. Update frontend: `OwnerService`, create `OwnerPaginationService`, update `OwnerListComponent` and template
5. Deploy backend and frontend together (same monorepo pipeline)

No database migrations required — sorting and pagination are query-time operations only.

## Open Questions

- None — all decisions made during brainstorming.
