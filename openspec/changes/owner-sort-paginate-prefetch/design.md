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

### D1: Response shape change — breaking API (most critical)

The `GET /owners` response changes from `array of OwnerDto` to an inline page object schema with `content`, `totalElements`, `totalPages`, `number`, `size`. This is a **breaking** API change that affects every layer simultaneously — backend, openapi.yaml, and frontend must move together. The frontend's existing `OwnerPage` interface already matches this shape. Since both backend and frontend live in this monorepo and are deployed together, no versioning or compatibility shim is needed.

### D2: Sort field whitelist (security-critical)

Allowed sort fields are `firstName`, `lastName`, `city` — the backend must validate and reject anything else with HTTP 400 to prevent JPQL injection via sort field names. The frontend sends Spring-style multi-value sort params (e.g., `sort=firstName,asc&sort=lastName,asc`). The Name column always sends both `firstName` and `lastName` in the same direction.

_Alternative considered:_ A single `sortBy=name|city` param mapped server-side — rejected: non-standard, loses Spring `Pageable` auto-binding.

### D3: Spring Data Pageable for backend pagination

Pass `Pageable` as a parameter to the existing `@Query` method, replacing the old `searchByText(String)` signature entirely — no overload is kept. Spring Data JPA supports `Pageable` on `@Query` methods and automatically applies `LIMIT`/`OFFSET` and wraps the result in `Page<T>`. The repository will extend `PagingAndSortingRepository<Owner, Integer>` (instead of bare `Repository`) to get access to pageable infrastructure.

_Alternative considered:_ Manual `LIMIT`/`OFFSET` in raw JPQL — rejected: verbose, error-prone, no `totalElements` count without a second query.

### D4: Stale response discard via generation counter

On each cache-invalidating event (resize, sort change, search change), the service increments a `generation` counter. Any in-flight pre-fetch response belonging to a previous generation is silently discarded. Without this, a slow pre-fetch response arriving after a resize would corrupt the new cache with wrong-sized data.

### D5: OwnerPaginationService on the frontend

All cache, pre-fetch, resize, and sort/filter state lives in a new `OwnerPaginationService`. `OwnerListComponent` only subscribes to the service's `currentPage$` observable and dispatches user actions (next, prev, sort click, search input). This keeps the component thin and the logic independently testable.

The cache key is `{ page, size, sort, q }` serialized as a string. Any change to sort, q, or size clears the entire cache and resets to page 0.

### D6: Viewport-based page size calculation (least critical)

On init and on window resize (debounced 1000ms), the component measures the available table body height (viewport height minus header/footer/search bar/table header heights) and divides by a fixed row height constant (e.g., 41px). The result is sent as the `size` param. Minimum page size is capped at 5 to avoid a degenerate tiny viewport.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Race condition: resize fires while a pre-fetch is in-flight | On resize, increment a `generation` counter; responses from stale generations are discarded |
| Sort field injection via `sort` param | Backend whitelists allowed sort fields (`firstName`, `lastName`, `city`) and throws 400 for unknown fields |
| Page size flicker on load (size unknown until DOM measured) | Component shows a loading spinner until first page size is calculated; no request is sent before then |
| Pre-fetch on slow connections wastes bandwidth | Pre-fetch only if connection is not `saveData` (check `navigator.connection?.saveData`) |
| Breaking API change breaks other consumers | Only the Angular frontend consumes this endpoint in this project; note the change in commit message |

## Migration Plan

1. Update Java code (controller, DTOs, repository) to implement paginated, sorted response
2. Start the app — springdoc regenerates the OpenAPI YAML from Java annotations
3. Sync the generated YAML back into the committed `openapi.yaml`
4. `MyOpenAPIDidNotChangeTest` will pass once the committed YAML matches the live app output
5. Update the Angular frontend

No database migrations required — sorting and pagination are query-time operations only.

## Open Questions

- None — all decisions made during brainstorming.
