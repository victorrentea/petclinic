# Design

## Context

- `OwnerRestController.listOwners` calls `OwnerRepository.findByLastNameStartingWith` and maps
  the whole list. There is no service layer (house style), and the controller talks to repositories directly.
- `OwnerDto` nests `pets`, and each `PetDto` nests `visits`. `Owner.pets` is a lazy `Set`, and
  there is no batch fetching configured, so a page of N owners costs 1 + N + (pets) queries today.
- `owners` has no index besides its primary key. The dev database collates `en_US.UTF-8`.
  Tests run on zonky embedded Postgres, whose locale is whatever the machine's `initdb` defaults to.
- `ExceptionControllerAdvice` already maps `ConstraintViolationException` to 400.
- The frontend already depends on Angular Material. `owners.module.ts` imports neither the paginator
  nor sort. `owner-page.ts` already declares the target shape and is unused.
- Business volume: ~100k owners within a year (`AGENTS.md` → Domain Model).

## API contract (BREAKING)

`GET /api/owners` always returns a single page. No unpaged variant is kept.

```
GET /api/owners?lastName=Pot&page=0&size=10&sort=name,asc
→ 200 {"content":[OwnerDto…], "totalElements":2, "totalPages":1, "number":0, "size":10}
```

| param | default | allowed | otherwise |
|---|---|---|---|
| `lastName` | `""` | case-sensitive prefix of the last name, as today | — |
| `page` | `0` | `≥ 0` (zero-based); past the end → empty `content` | 400 naming `page` |
| `size` | `10` | `1..100` | 400 naming `size` (never clamped) |
| `sort` | `name,asc` | `name` / `city`, optional `,asc` / `,desc` | 400 listing `name`, `city` |

The sort keys expand on the server. The direction applies to the clicked column only, while
the tie-breakers stay ascending and always end with `id`:
- `name,desc` → `first_name desc, last_name desc, id`
- `city,desc` → `city desc, first_name, last_name, id`

`OwnerDto` inside `content` keeps its current shape (pets, and their visits).

## Impact on the code

- **Generated contract:** `openapi.yaml` and `petclinic-frontend/src/app/generated/api-types.ts`
  are regenerated from `OpenApiExtractorTest`, never edited by hand. The MCP tools and the
  chatbot do not call this endpoint.
- **Backend:**
  - `OwnerRestController.listOwners`
  - `OwnerRepository`, which gains a `Pageable` overload
  - a new hand-written `OwnerPageDto`
  - `@BatchSize` on `Owner.pets` and `Pet.visits`
  - Flyway `V4__owner_list_indexes.sql`
- **Frontend:**
  - `OwnerService`: one paged method replaces `getOwners` and `searchOwners`
  - `OwnerListComponent` (`.ts`, `.html`, `.spec.ts`)
  - `owners.module.ts`: `MatPaginatorModule` and `MatSortModule`
  - `owner-page.ts`: becomes a re-export of the generated type
- **Tests that assume a bare list:**
  - `OwnerTest` (its list tests moved to a new `OwnerListTest`), `OwnerCreateTest`, `AddVisitApiTest`,
    `OwnerSearchThroughLatencyProxyTest`
  - `functional/owners.feature` with `OwnerSteps`
  - `owner.service.spec.ts`, `owner-list.component.spec.ts`, `owner-detail.component.spec.ts`
  - `petclinic-test`'s `owner-search.feature` ("empty search lists every owner"), its glue
    and its generated sequence diagram
- **Docs:** the API Endpoints section of `AGENTS.md`.

## Goals / Non-Goals

**Goals:**
- A page request touches at most `size` owners plus their pets and visits, in a bounded number of queries.
- The query plan for each allowed sort, with and without the `lastName` filter, avoids a full sort of the table.

**Non-Goals:**
- Keyset (cursor) pagination. Offset paging is fine at 100k rows and keeps "jump to page N".
- Slimming `OwnerDto` (dropping visits from the list payload). This is worth doing, but it is a separate contract change.
- Case-insensitive search, telephone normalisation, cleaning acceptance-test leftovers in the dev database.

## Decisions

Decisions 1–4 were agreed in the grilling session. Decisions 5–13 were recommended at its
end and confirmed as written before implementation.

1. **Server-side paging, endpoint changed in place.** No unpaged variant, because keeping one
   keeps the 100k-row liability. Every caller is in this repo.
2. **Size capped at 100.**
3. **Hand-written `OwnerPageDto {content, totalElements, totalPages, number, size}`**, matching
   `owner-page.ts`. Rejected: serialising Spring's `PageImpl` (not a stable JSON contract, and
   Spring warns about it), and `VIA_DTO` mode (it nests the totals under `page`).
4. **Name sorts by first name, then last name**, matching the displayed "Kevin McCallister".
   City is the only other sort key.
5. **Sort is a whitelist, not a free `Pageable` sort.** The controller takes `page`, `size`, `sort`
   as plain request params and maps `name|city` + `asc|desc` to an explicit `Sort` that always
   ends in `id`. Rejected: binding `Pageable` directly. It lets a client sort by any entity
   path, unindexed or nested (`pets.visits.description`), and exposes field names in the contract.
6. **Validation is 400, never a clamp.** The controller is `@Validated`, so the constraints
   `@Min(0)` on `page`, `@Min(1) @Max(100)` on `size` and a `@Pattern` on `sort` (its message
   names `name` and `city`) all go through the existing `ConstraintViolationException` handler.
   No new exception or handler is needed. Rejected: `spring.data.web.pageable.max-page-size`,
   which clamps silently.
7. **A page past the end returns an empty `content` with correct totals** (Spring's natural
   behaviour). The grid then moves to the last page.
8. **Pets and visits load in batches, never by fetch join.** The page query selects owners only.
   `@BatchSize` on `Owner.pets` and `Pet.visits` (or `hibernate.default_batch_fetch_size`) turns
   N+1 into roughly 3 queries per page. Rejected: `JOIN FETCH` of a collection combined with
   `Pageable`, which makes Hibernate page in memory over every row (warning HHH90003004).
9. **Indexes in a new migration `V4__owner_list_indexes.sql`:**
   - `(first_name, last_name, id)` for the name sort,
   - `(city, first_name, last_name, id)` for the city sort,
   - `(last_name text_pattern_ops)` for `LIKE 'x%'`. Under a non-C collation, a plain btree
     cannot serve a prefix `LIKE`.

   A filtered query uses the pattern index and sorts only the few matches. An unfiltered one walks a sort index and stops after `size` rows.
   Keep each index only if `EXPLAIN ANALYZE` shows the plan uses it. Check the plans on about 100k
   generated owners in a throwaway database, never in the seed (the seed stays small).
10. **Grid widgets: `MatPaginator` (`[5, 10, 20]`) and `matSort` on the existing Bootstrap
    table.** The design system has no paginator yet. If a second paged grid appears, promote
    this into `design-system/`.
11. **Query state lives in the URL as query params** (`page`, `size`, `sort`, `lastName`),
    and defaults are omitted. The component derives its request from `ActivatedRoute.queryParamMap`
    and only ever *navigates* (`router.navigate([], {queryParams, queryParamsHandling: 'merge'})`).
    That way Back, refresh and the "Find Owner" button share one code path. Search, size and sort
    changes navigate with the page reset to 0.
    In the URL, `page` is 1-based for humans and 0-based on the API, and the component converts between them.
12. **The "no owners" message checks `totalElements === 0` after a successful response.** Errors
    show the existing error output. This also fixes today's behaviour, where a failed request
    looked like "no match".
13. **`owner-page.ts` becomes a re-export of the regenerated `api-types.ts` page type**, so
    there is only one source for the shape.

### Measured plans (100k generated owners, `en_US.UTF-8`, Postgres via zonky)

| query | plan | time |
|---|---|---|
| name, page 0 | Index Scan `owners_name_idx` | 0.02 ms |
| name, offset 99,990 | same index, walks 100k entries | 24 ms |
| name desc, page 0 | backward scan + incremental sort | 0.03 ms |
| city desc, page 0 | backward scan `owners_city_idx` + incremental sort | 0.27 ms |
| city asc, page 0 | Index Scan `owners_city_idx` | 0.01 ms |
| `lastName` `Pot%` / `L0012%`, any sort | Index Scan `owners_last_name_prefix_idx` + small sort | 0.01–0.08 ms |
| count, unfiltered | Seq Scan | 10 ms |
| count, `Pot%` | prefix index | 0.01 ms |

## Risks / Trade-offs

- **[The sort collation differs between dev, CI and prod]** The accented-name scenario passes
  only under a linguistic collation, and zonky's `initdb` follows the machine locale.
  → The scenario runs in CI. If CI collates `C`, pin zonky's locale in the shared test
  config rather than weakening the scenario.
- **[`count(*)` on every page request]** At 100k rows, a filtered or unfiltered count is in the low
  milliseconds. → Accept it, because the total is what the paginator shows. Revisit at millions of rows.
- **[Deep offsets get slower]** `OFFSET 99990` still walks 99,990 index entries. → It stays acceptable at
  100k. Keyset pagination is the escape hatch, listed as a non-goal.
- **[The list payload still carries every pet's visits]** → Batching bounds the query count but
  not the bytes. A slimmer list DTO is a follow-up.
- **[`add-owner.spec.ts` asserts `toHaveURL(/\/owners$/)`]** → It stays true because defaults are
  omitted from the URL (decision 11). The test is a regression check for that rule.
- **[Breaking API change]** → Every consumer is in the repo and changes in the same commit.
  The generated `openapi.yaml` diff makes the break visible in review.

## Migration Plan

Backend and frontend ship together, so there is no compatibility window. `V4` only adds indexes,
so rolling back means reverting the code. The indexes can stay.
On 100k rows, `CREATE INDEX` takes seconds and locks writes to `owners` while it runs. If
production already has volume at deploy time, switch to `CREATE INDEX CONCURRENTLY` in a
non-transactional Flyway migration.

## Open Questions

- What collation does the production database use? If it is `C`, accented names sort after Z
  in production even though the tests pass. Settle it before go-live. It changes neither the code nor the tasks.
