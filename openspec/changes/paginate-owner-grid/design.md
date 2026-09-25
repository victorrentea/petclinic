# Design

## Context

See `proposal.md` for motivation and `specs/owner-grid-browsing/spec.md` for observable behavior.

`GET /api/owners` currently returns `List<OwnerDto>`. Mapping each owner traverses lazy pets and their visits, so the endpoint is both unbounded and prone to N+1 queries. The Angular Owners grid consumes that array directly and keeps search state only in component memory.

The deployment diagram identifies the Angular Frontend as the only deployed inbound REST consumer. In-repository tests also consume the endpoint and can migrate with it. OpenAPI and frontend API types are generated artifacts. The database currently has no owner-field indexes and already indexes `pets(owner_id)`.

## Goals / Non-Goals

**Goals:**

- Bound database work and response size for every Owners-grid request.
- Make ordering stable across page boundaries.
- Keep pet names visible without loading visits or issuing one query per owner.
- Make browser navigation and refresh restore grid state.
- Preserve the repository's generated-contract and design-system conventions.
- Use measurement, rather than assumption, to justify database indexes.

**Non-Goals:**

- Cursor pagination or compatibility with the old unbounded response.
- Changes to owner-detail payloads or last-name matching semantics.
- Removal of `/api/owners/count`.
- Permanent 100,000-owner development seed data.
- Broad Angular Material table restyling.

## Decisions

### Use an explicit page contract and lightweight row DTO

`GET /api/owners` returns `OwnerPageDto` with `content`, `number`, `size`, `totalElements`, and `totalPages`. `content` contains `OwnerRowDto` values with contact fields and pet names only.

This avoids exposing Spring Data's `Page` serialization and keeps full `OwnerDto` semantics isolated to detail flows. Returning the existing nested DTO was rejected because it would continue loading irrelevant visits.

### Whitelist and validate the public query vocabulary

The controller accepts explicit `lastName`, `page`, `size`, `sort`, and `direction` parameters. A small owner-list query type maps the public sort keys to known repository ordering and rejects unsupported values with HTTP 400.

Passing arbitrary client strings into framework sorting was rejected because it leaks persistence property names and weakens validation.

### Execute bounded owner and pet-name queries

Scalar sorts use a paged owner query with deterministic secondary ordering. Pets sorting uses an aggregate owner query ordered by pet count. A second bounded query fetches pet names for only the owner IDs in the selected page, ordered by owner and pet name. The mapper assembles the response without traversing lazy visits.

Fetch-joining pets in the paged owner query was rejected because collection joins distort pagination and counts. Per-owner lazy loading was rejected because it creates N+1 queries.

### Define deterministic sort semantics

Name means last name, first name, then ID. Pets means pet count, followed by owner last name, first name, and ID. Other columns use the selected field and direction, then owner last name, first name, and ID ascending.

Using only the selected field was rejected because equal values can move between pages. Lexicographically sorting a collection of pet names was rejected because it lacks a stable, intuitive scalar meaning.

### Make URL query parameters the frontend source of truth

The component normalizes `ActivatedRoute.queryParamMap` into a typed owner query. Search, sort, page-size, Previous, and Next interactions update the URL. The route stream uses `switchMap` to load pages, canceling stale HTTP requests.

Local-only state was rejected because refresh and browser history would lose the user's position. Manual subscription cancellation was rejected in favor of one declarative request stream.

### Keep the existing table and use focused controls

The Bootstrap-styled table remains. `MatSort` supplies accessible sortable headers, `<app-combo>` supplies the required page-size selector, and compact Previous/Next controls show current-page and total information.

`MatTable` and `MatPaginator` were rejected because they would introduce a second visual system and bypass the repository's standard single-select component.

### Add indexes only after a representative benchmark

A disposable local dataset supplies 100,000 owners for first, middle, and final-page measurements across filtered and unfiltered sort modes. `EXPLAIN ANALYZE` identifies the expensive path. A new Flyway migration adds only the smallest index demonstrated to protect the 10-second objective, followed by the same benchmark.

Adding one index per sortable column was rejected because write and storage costs would be accepted without evidence that those indexes improve the real query plans.

### Regenerate contracts and traced acceptance artifacts

Java annotations and DTOs remain the source of the OpenAPI contract. `OpenApiExtractorTest` regenerates `openapi.yaml`; the frontend generator then updates TypeScript types. A Gherkin scenario exercises pagination and sorting through the UI and regenerates its trace-backed sequence artifacts.

Hand-editing generated contract or trace files was rejected because repository guardrails intentionally detect that drift.

## Risks / Trade-offs

- **Breaking API response** -> Migrate the Angular client and all in-repository test consumers in the same change; the deployment model shows no other deployed inbound client.
- **Offset cost on deep pages** -> Benchmark middle and final pages at 100,000 owners and add a measured index if needed; cursor complexity remains available for a later requirement.
- **Concurrent writes can shift rows between requests** -> Deterministic tie-breakers prevent ambiguous ordering, while snapshot pagination is intentionally outside scope.
- **Pet-count sorting requires aggregation** -> Keep it in explicit repository queries and benchmark both directions.
- **URL updates can trigger request races** -> Derive one request stream from route state and use `switchMap`.
- **Retaining rows while loading can show stale values briefly** -> Disable navigation and sort controls and expose a clear loading state until the latest request completes.

## Migration Plan

1. Introduce backend contract tests, DTOs, validated query mapping, and bounded repository queries.
2. Regenerate OpenAPI and frontend TypeScript contracts.
3. Migrate the Angular Owners grid and all test consumers to the page envelope.
4. Update the Gherkin journey and regenerate trace artifacts.
5. Benchmark 100,000 owners and add a targeted forward-only Flyway migration only if measurements justify it.
6. Deploy backend and frontend together because the endpoint response is intentionally breaking.

Rollback requires deploying the previous backend and frontend together. If an index migration was added, it may remain during rollback because it does not change data semantics.
