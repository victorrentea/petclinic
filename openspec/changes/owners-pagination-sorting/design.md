## Context

`GET /api/owners` currently backs onto `OwnerRepository#findByLastNameStartingWith` (Spring Data `Repository`, not `JpaRepository`/`PagingAndSortingRepository`), returning a plain `List<Owner>` mapped to `List<OwnerDto>` and serialized as a bare JSON array. The frontend `OwnerListComponent` calls `OwnerService#getOwners()`/`#searchOwners()`, both typed `Observable<Owner[]>`, and renders the full array in a static table with no paging UI. See `proposal.md` - Why/What Changes for motivation and scope.

**BREAKING API change**: `GET /api/owners` will return Spring's `Page<OwnerDto>` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`, ...) instead of a plain JSON array of `OwnerDto`, plus new `page`, `size`, and `sort` query parameters. `openapi.yaml` must be regenerated via `OpenApiExtractorTest` so the contract change is visible in review. Any consumer of this endpoint outside the Owners screen must be updated to read the new envelope shape.

## Goals / Non-Goals

**Goals:**
- Make `GET /api/owners` paginated and sortable using Spring Data's `Pageable`/`Page<T>`, reusing framework support rather than hand-rolled offset/limit logic.
- Keep the whitelist of sortable properties (`name`, `city`) and page sizes (`5, 10, 20`) enforced server-side, independent of what the frontend sends.
- Update the frontend grid to drive paging/sorting through the new response envelope with minimal UI rework (Angular Material paginator + clickable header sort, consistent with existing Angular Material usage elsewhere in the app).

**Non-Goals:**
- No change to the Address/Telephone columns' display or to the pet-adding/visit workflows.
- No introduction of a generic "sortable API" mechanism reusable by other endpoints (e.g., Vets, Pets) - scope is Owners only for now.
- No caching or search-index layer; ~10k rows is well within plain paginated SQL query performance.

## Decisions

- **Response envelope: Spring's `Page<OwnerDto>` directly**, not a custom slim DTO. Rationale (per the Q&A decision, overriding the initial slimmer-DTO recommendation): reuses Spring's built-in (de)serialization and `PageableHandlerMethodArgumentResolver`, less code to maintain, and OpenAPI can still describe the shape via `springdoc`'s `Page` support. Trade-off accepted: the JSON payload is more verbose (includes `pageable`, `sort`, etc.) than a minimal envelope.
- **Sort whitelist enforced via a `Sort.Order` → property mapping + validation in the controller/service**, not by exposing raw entity property names. `name` maps to `Sort.by("lastName", "firstName")` (with matching direction), `city` maps to `Sort.by("city")`. Any incoming `sort` property outside `{name, city}` triggers `400 Bad Request` (e.g. via a thrown `IllegalArgumentException` caught by the existing `@RestControllerAdvice`, or a custom `HandlerMethodArgumentResolver` — implementer's choice, as long as invalid sort keys never reach the repository query).
- **Page size whitelist enforced explicitly** (size ∈ {5, 10, 20}) rather than relying on Spring's default `maxPageSize`, since the requirement is an exact allowed set, not just a ceiling. Reject other values with `400 Bad Request` before querying.
- **Repository**: extend `OwnerRepository` (currently a bare `Repository<Owner, Integer>`) to also extend `PagingAndSortingRepository<Owner, Integer>` (or switch to `JpaRepository`), and add a paginated finder, e.g. `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`, replacing the existing non-paginated method (its only caller is the controller method being changed).
- **Frontend**: introduce a typed `Page<Owner>` (or similarly named) interface matching the subset of Spring's `Page` fields the UI needs (`content`, `totalElements`, `number`, `size`), update `OwnerService.getOwners()`/`searchOwners()` to accept `page`, `size`, `sort` params and return `Observable<Page<Owner>>`, and use Angular Material's `MatPaginator` (already a project dependency per `AGENTS.md`) plus clickable `<th>` sort handlers for Name/City — consistent with a plain HTML table rather than pulling in `MatTable` wholesale, to keep the diff scoped to pagination/sorting only.
- **Name column**: swap the template's `{{ owner.firstName }} {{ owner.lastName }}` to `{{ owner.lastName }} {{ owner.firstName }}` (no backend field changes needed — `firstName`/`lastName` are already separate fields in `OwnerDto`).

## Risks / Trade-offs

- [Breaking API change for any existing consumer of `GET /api/owners` expecting a bare array] → Documented as **BREAKING** in the proposal; `openapi.yaml` regenerated via `OpenApiExtractorTest` so the contract change is visible in review; no versioned/parallel endpoint is planned since this is a single-consumer (frontend-owned) internal API.
- [Whitelisting logic duplicated between the "reject bad size" and "reject bad sort" checks and Spring's own binding] → Mitigate by keeping both checks in one small, targeted method/class covered by unit tests (see tasks.md), so the whitelist is a single source of truth.
- [Frontend regression risk in `owner-list.component` given it currently has no pagination/sorting state at all] → Mitigate with component-level tests asserting default page/size/sort request params and page/sort interaction behavior before wiring the template.

## Migration Plan

- No data migration needed (no schema change). Deploy backend and frontend together since the response shape change is breaking; there is no dual-write/dual-read period.
- Rollback: revert the backend controller/repository and frontend component/service changes together (single deployable unit per `AGENTS.md`'s full-stack structure).
