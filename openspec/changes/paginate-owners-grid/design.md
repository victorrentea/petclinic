# Design

## Context

See proposal.md for why; the behaviour is in `specs/owner-list/spec.md`.

- `OwnerRestController.listOwners` calls `OwnerRepository.findByLastNameStartingWith` and maps the
  whole list with `OwnerMapper` into `OwnerDto`, which nests `PetDto`, which nests visits. No
  service layer (ARCHITECTURE.md) — the controller talks to the repository directly.
- `Owner.pets` and `Pet.visits` are lazy `Set`s with no batch fetching, so listing N owners costs
  1 + N + (pets) queries.
- `owners` (V1) has `TEXT` columns and no index besides the primary key. The dev database collates
  `C`, so `Ł`, `Ś`, `Ș` sort after `Z` today. ICU collations are available (`ro-RO-x-icu` checked on
  PostgreSQL 16.2, the version the embedded test database runs too).
- `OwnerRestController` has no class-level `@Validated`, and `ExceptionControllerAdvice` handles
  `ConstraintViolationException`, `MethodArgumentNotValidException`, `ValidationException` — but
  not `HandlerMethodValidationException`, which Spring 6.2 raises for a constrained
  `@RequestParam`. Today that would fall through to the catch-all 500.
- `openapi.yaml`, `api-types.ts` and `docs/generated/**` are generated (`OpenApiExtractorTest`,
  `npm run generate:api`, `DbSchemaExtractorTest`); hand edits are denied.
- `owner-page.ts` already declares `{content, totalElements, totalPages, number, size}`, unused.
- The owner page's Back button does `router.navigate(['/owners'])`, which drops any grid state.

## Impact on the code

- **API (BREAKING):** `GET /api/owners` returns one page (`content` + totals) instead of a list,
  and each owner in it carries its pets as `{id, name}` only — no visits. No unpaged variant is
  kept. Every caller lives in this repo (deployment diagram and code checked) and changes in the
  same commit. `openapi.yaml` and the frontend's generated `api-types.ts` are regenerated.
- **Backend:** `OwnerRestController`, `OwnerRepository`, new `OwnerPageDto` and `OwnerListItemDto`,
  `OwnerMapper`, `ExceptionControllerAdvice`, `@BatchSize` on `Owner.pets`, Flyway
  `V4__owner_list_collation_and_indexes.sql`, `db/seed/R__seed.sql`.
- **Frontend:** `OwnerService`, `OwnerListComponent` (`.ts`, `.html`, `.spec.ts`), `OwnersModule`,
  `owner-page.ts`, `OwnerDetailComponent`'s Back button.
- **Tests that assume a bare list:** backend `OwnerTest`, `AddVisitApiTest`,
  `functional/owners.feature` + `OwnerSteps`, `OwnerSearchThroughLatencyProxyTest`,
  `BasicAuthenticationConfigTest`; frontend owner specs; e2e `owner-search.feature` and its glue,
  `add-owner.spec.ts`, `add-visit.dsl.ts`, and their generated sequence diagrams.
- **Docs:** the API Endpoints section of `AGENTS.md`.

## Goals / Non-Goals

**Goals:**
- A page request touches at most `size` owners plus their pets, in a constant number of queries.
- For each allowed sort, with and without the `lastName` filter, the plan on ~50k owners avoids
  sorting the whole table.

**Non-Goals:**
- Keyset (cursor) pagination — offset paging is fine at 50k rows (`VOLUMETRICS.md`) and keeps
  "jump to page N".
- Case-insensitive or accent-insensitive search; phone normalisation or phone search.
- Cleaning the owners that e2e tests leave behind in the dev database.

## Decisions

1. **Server-side paging, `GET /api/owners` changed in place.** No unpaged variant. The deployment
   diagram shows only the Frontend and the Chatbot calling the Backend, and the chatbot only uses
   `/mcp` and `/api/specialties/feed`. Rejected: a side-by-side `/api/owners/page`, which keeps the
   50k-row liability one stray call away.

2. **API contract**

   ```
   GET /api/owners?lastName=Pot&page=0&size=10&sort=city,desc
   → 200 {"content":[OwnerListItemDto…], "totalElements":2, "totalPages":1, "number":0, "size":10}
   ```

   | param | default | allowed | otherwise |
   |---|---|---|---|
   | `lastName` | `""` | case-sensitive prefix, as today | — |
   | `page` | `0` | `≥ 0`, zero-based; past the end → empty `content` | 400 naming `page` |
   | `size` | `10` | `1..100` | 400 naming `size` (never clamped) |
   | `sort` | `name,asc` | `name` or `city`, optional `,asc` / `,desc` | 400 listing `name`, `city` |

3. **Hand-written `OwnerPageDto {content, totalElements, totalPages, number, size}`.** Matches
   `owner-page.ts` and the house style of hand-written DTOs. Rejected: serialising Spring's
   `PageImpl` (not a stable JSON contract; Spring logs a warning about it) and
   `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)`, which nests the totals under
   `page` and couples the contract to Spring's choice.

4. **A slim `OwnerListItemDto`: the owner's fields plus `pets: [{id, name}]`, no visits.**
   `GET /api/owners/{id}` keeps `OwnerDto` with visits. We break the contract once rather than
   twice; the grid only shows pet names, and the callers that need a pet (`AddVisitApiTest`,
   `add-visit.dsl.ts`) only read `pets[].id`. Rejected: keeping `OwnerDto` — batching would bound
   the queries but not the bytes.

5. **Sort is a fixed list mapped to an explicit `Sort`, not a bound `Pageable`.** The controller
   takes `page`, `size`, `sort` as plain request params and maps them:
   - `name,asc` → `lastName ASC, firstName ASC, id ASC`; `name,desc` → all three `DESC`
   - `city,asc` → `city ASC, lastName ASC, firstName ASC, id ASC`
   - `city,desc` → `city DESC, lastName ASC, firstName ASC, id ASC` (names stay A→Z)

   `id` last makes every order total, so no owner repeats or vanishes between pages. Rejected:
   binding `Pageable`, which lets a client sort by any entity path (`pets.visits.description`),
   unindexed, and exposes field names in the contract.

6. **Validation answers 400, never clamps.** `@Min(0)` on `page`, `@Min(1) @Max(100)` on `size`;
   `ExceptionControllerAdvice` gains a `HandlerMethodValidationException` handler shaped like the
   existing `ConstraintViolationException` one (problem detail + `errors` naming the parameter).
   An unknown sort raises a `ValidationException` whose message lists `name`, `city` (the existing
   handler already maps it to 400). Rejected: `spring.data.web.pageable.max-page-size`, which
   clamps silently.

7. **Romanian collation on the columns, in the schema.** A new migration
   `V4__owner_list_collation_and_indexes.sql` alters `first_name`, `last_name` and `city` to
   `COLLATE "ro-RO-x-icu"`. Declared on the columns, not left to the database default, so dev,
   tests and production order the same way whatever locale each cluster was created with.
   Rejected: `und-x-icu` (language-neutral; the user chose Romanian rules) and changing the
   database collation (environment-specific, needs a re-create).

8. **Indexes, in the same migration:**
   - `(last_name, first_name, id)` — name sort, both directions (read backwards for `desc`)
   - `(city, last_name, first_name, id)` — city ascending
   - `(city DESC, last_name, first_name, id)` — city descending with names ascending; a mixed
     direction cannot be served by reading the ascending index backwards
   - `(last_name text_pattern_ops)` — the prefix `LIKE 'Pot%'`; a btree under an ICU collation
     cannot serve a prefix match

   Each index stays only if `EXPLAIN ANALYZE` shows the plan using it on ~50k generated owners in
   a throwaway database — never in the seed.

9. **Pets load in batches, never by fetch join.** The page query selects owners only;
   `@BatchSize` on `Owner.pets` turns N+1 into one extra query per page. With visits gone from the
   list (decision 4), `Pet.visits` is not touched by the list at all. Rejected: `JOIN FETCH` of a
   collection with a `Pageable`, which makes Hibernate page in memory over every row
   (HHH90003004).

10. **Grid widgets: `MatPaginator` (`[5, 10, 20]`, showing the total) and `matSort` on the existing
    Bootstrap table**, `mat-sort-header` on Name and City only. Their arrows always show (gray at rest, white on the
    sorted column), so it is visible which headers sort without hovering — Material shows them only on hover.
    Column widths are fixed (`table-layout: fixed`): sized by the rows on screen, every header
    jumped sideways on each sort or page. Not promoted into `design-system/`
    while this is the only paged grid.

11. **Grid state lives in the URL query** — `page`, `size`, `sort`, `lastName`, defaults omitted;
    `page` is 1-based in the URL, 0-based on the API. The component derives every request from
    `ActivatedRoute.queryParamMap` and only ever *navigates*, so the Find button, paginator, sort,
    refresh and browser Back share one code path; search, size and sort changes navigate with the
    page reset. A response past the end (another user deleted owners) navigates to the last page.
    The owner page's Back button returns to the grid's last URL, which the grid records in a
    root-provided `OwnerGridState` each time it loads (`/owners` until then). Rejected: browser
    history back, which loses the place once the user went Owner → Edit → Owner.

12. **Search as you type, debounced 300 ms** (`debounceTime` on the input's changes), replacing
    the Find Owner button; a value equal to the current search does not navigate. Each pause
    costs one request, not one per keystroke.

13. **One paged `OwnerService.listOwners({lastName, page, size, sort})` replaces `getOwners` and
    `searchOwners`.** Its error is surfaced instead of being swallowed into an empty list, so the
    grid can tell "no match" (`totalElements === 0`) from a failure.

14. **`owner-page.ts` becomes a re-export of the generated page type** from `api-types.ts`, so
    there is one source for the shape.

15. **Seed: one more owner, Ana Șerban of Brașov**, appended so existing ids stay put (owner 1 =
    Kevin McCallister, pet 3 = Milton). It is the only seed name the Romanian rules order
    differently from a neutral collation, so the scenarios can tell them apart.

## Risks / Trade-offs

- **[`count(*)` on every page]** → Milliseconds at 50k, filtered or not; the total is what the
  paginator shows. Revisit at millions of rows.
- **[Deep offsets]** `OFFSET 49990` walks the index to that row → acceptable at 50k; keyset is
  the escape hatch.
- **[Three index variants on a small table]** → Writes to `owners` are rare (a new owner), so the
  write cost is negligible; dropped if `EXPLAIN` shows one unused.
- **[`ro-RO-x-icu` depends on ICU in every Postgres]** → Embedded dev and test Postgres have it; a
  production cluster built without ICU fails the migration loudly at deploy, not silently later.
- **[ICU version upgrades can change collation order and invalidate indexes]** → Postgres warns
  on a collation version mismatch; `REINDEX` the three indexes after an OS/ICU upgrade.
- **[e2e tests share the dev database with leftover owners]** → e2e scenarios assert relative
  order and paging behaviour, never exact totals; exact rows are asserted in backend tests on the
  fresh embedded database.
- **[Breaking API change]** → Every consumer changes in the same commit; the regenerated
  `openapi.yaml` diff shows the break in review.

## Migration Plan

Backend and frontend ship together — no compatibility window. `V4` alters column collations and
adds indexes; at 50k rows it runs in seconds but locks `owners` meanwhile. If production already
holds volume at deploy time, split the index creation into a non-transactional migration using
`CREATE INDEX CONCURRENTLY`. Rollback = revert the code; the collation and indexes can stay.
