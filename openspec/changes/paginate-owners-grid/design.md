# Design

## Context

See proposal.md for why; the decisions below come from the design Q&A in `Q&A.md` (GH #25).

What exists today:
- `GET /api/owners?lastName=` → `OwnerRestController.listOwners` →
  `OwnerRepository.findByLastNameStartingWith` → the whole table as `List<OwnerDto>`, each
  carrying `PetDto` → `VisitDto` (the grid only renders pet names).
- `Owner.pets` is a lazy `@OneToMany`, so mapping a list of owners already runs N+1 pet queries.
- `owners` has only its primary key; `pets(owner_id)` exists. The DB collation is
  `en_US.UTF-8` (checked in `pg_database`), so a btree on `last_name` cannot serve
  `LIKE 'x%'` without `text_pattern_ops`.
- The seed has 28 owners (30 in the dev DB), so the default page size of 10 gives 3 pages.
- `petclinic-frontend/src/app/owners/owner-page.ts` already declares an `OwnerPage` shape,
  unused so far.
- `Deployment.drawio.png` shows the Frontend is the Backend's only inbound client.

## Goals / Non-Goals

**Goals:**
- Filter, sort, page and count in PostgreSQL; a request touches at most 20 owners.
- A bounded number of SQL statements per page, independent of page size.
- One contract for the whole chain: Java → `openapi.yaml` → `api-types.ts`, all generated.

**Non-Goals:**
- Keyset (seek) pagination. At 100k rows, `OFFSET` at page 5,000 is still a sub-10ms
  index scan; revisit only if deep paging shows up in traces.
- An ICU collation to make alphabetical order identical across environments.

## Decisions

### D1. Change `GET /api/owners` in place, no v2
It now returns `OwnerPageDto`. No compatibility endpoint: the Frontend is the only client,
and keeping an unbounded list endpoint around is exactly the risk we're removing.
*Alternative:* `/api/owners/page` next to the old one. Rejected because it leaves the unsafe path alive.

### D2. An app-owned page DTO, not Spring's `Page`
`OwnerPageDto(List<OwnerRowDto> content, long totalElements, int totalPages, int number, int size)`.
Serializing `PageImpl` leaks Spring internals (`pageable`, `sort`, `empty`…) into the
OpenAPI schema and Spring warns against it. The frontend's existing `OwnerPage` is replaced
by the generated type.

### D3. Slim row: `OwnerRowDto`
`id, firstName, lastName, address, city, telephone, petNames: List<String>` (pet names sorted
alphabetically, like `Owner.getPets()`). `GET /api/owners/{id}` keeps returning the full `OwnerDto`.

### D4. Validated request record, not raw `Pageable`
`@ModelAttribute @Validated OwnerListRequest(lastName="", @Min(0) page=0, size=10, sort=NAME, direction=ASC)`,
with `size` checked against `{5,10,20}` by a small custom constraint. `sort` and `direction`
are enums inside the controller. Their wire values are lowercase (`name|city`, `asc|desc`),
matched exactly. A bad value is a binding error, so it surfaces as a
`MethodArgumentNotValidException`. `ExceptionControllerAdvice` already maps that to a 400
`ProblemDetail`. A test pins each rejection, because an unmapped
`MethodArgumentTypeMismatchException` would come back as a 500.
*Alternative:* `Pageable` + `@PageableDefault`. Rejected: it accepts any size and any
property name, and clamps silently.

### D5. Tie-safe sort chains, built server-side
- `name` → `last_name, first_name, id`
- `city` → `city, last_name, first_name, id`

The requested direction applies to every key. Without the unique `id` suffix, owners
tying on the visible keys can repeat or vanish across page boundaries.

### D6. Pet names via `@BatchSize(size = 20)` on `Owner.pets`
This was your call (Q7). Owners come from a Spring Data `Page<Owner>` query (plus its
count query). Touching `pets` then loads the pets of up to 20 owners in a single `IN`
query, served by `pets(owner_id)`. That is 3 statements per page, whatever the page size.
No `JOIN FETCH`: combined with `LIMIT`, Hibernate pages in memory (HHH90003004).
*My original recommendation* was one explicit `SELECT owner_id, name FROM pets WHERE owner_id IN (:ids)`.
`@BatchSize` also affects every other lazy `pets` load (e.g. `GET /api/owners/{id}`,
harmlessly). A query-count test guards it (see D10).

### D7. Migration `V4__owner_list_indexes.sql`: three indexes, no seed changes
```sql
CREATE INDEX owners_name_sort_idx   ON owners (last_name, first_name, id);
CREATE INDEX owners_city_sort_idx   ON owners (city, last_name, first_name, id);
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
```
Postgres scans the sort indexes backwards for `desc`. `text_pattern_ops` is core, so there
is no extension and nothing to guard for the embedded test Postgres. The plan must be
checked with `EXPLAIN` on 100k generated owners, for a name/city sort × asc/desc × with/without
prefix.
Filtered plus sorted pages may pick between the prefix index and the name index depending on
selectivity. Both are fine at page ≤ 20.

### D8. Frontend: URL is the state, `switchMap` is the concurrency
`OwnerListComponent` derives everything from `ActivatedRoute.queryParamMap`:
sanitize → `OwnerService.listOwners(query)` → `switchMap`. A newer query cancels the older
HTTP call, which replaces the hand-rolled `unsubscribe` added in 925b56d5. User actions only
`router.navigate` with merged query params. Default values are omitted, and filter, sort,
size and direction reset `page` to 0. A response with `number >= totalPages > 0` triggers a
one-shot `navigate(replaceUrl)` to the last page.
*Alternative:* component fields as state plus a URL sync. Rejected: two sources of truth,
and Back/Forward would need its own code.

### D9. Keep the Bootstrap table, no `mat-table`
Existing selectors (`#ownersTable`, `td.ownerFullName`, `#lastName`,
`#search-owner-form`) stay, so the e2e glue and user-manual screenshots keep their anchors.
Name/City headers become `<button>`s carrying `aria-sort`. The page-size selector is an
`<app-combo>`, per AGENTS.md: a raw `<select>` is a bug. Previous/next are icon buttons,
disabled at the ends. Loading uses a fixed-height tbody, so rows don't jump. The error banner
and the "No owners with LastName starting with…" text are separate `*ngIf`s. The name cell
renders `{{lastName}}, {{firstName}}`.

### D10. Tests per layer
- **Backend (TDD, MockMvc on embedded Postgres):** defaults; sizes 5/10/20; `name`/`city` × `asc`/`desc`;
  filter + page; 400s for `size=7`, `page=-1`, `sort=telephone`, `direction=up`; slim payload
  (no `visits` key); duplicate names crossing a page boundary; walking all pages yields every
  owner once; query count ≤ 3, via Hibernate `Statistics` with `generate_statistics`
  switched on for that test class only.
- **Existing callers updated in the same commit:** `OwnerTest`, `OwnerSteps` +
  `owners.feature` (`$.content`), `OwnerSearchThroughLatencyProxyTest` (asserts
  `$.content` size 10), `ValidationErrorRenderingTest`/`ExceptionControllerAdviceTest`/
  `BasicAuthenticationConfigTest` wherever they call the list.
- **Frontend (Karma):** `OwnerService` query building; component: URL → request, resets,
  stale-response cancellation (`switchMap`), out-of-range redirect, loading/error/empty.
- **E2e (Playwright, mandatory):** `owner-search.feature` gains the scenarios sketched in the spec.
  Its `Given the clinic has these owners` walks every page at `size=20` instead of reading one
  array. "Every owner in the clinic is listed" becomes "paging through lists every owner once".
  `exactly these owners are listed` switches its separator to `;`.

## Risks / Trade-offs

- [`@BatchSize` silently loses its effect if someone adds `JOIN FETCH` or changes the mapping] → the query-count test fails.
- [Alphabetical order differs between a C-collated CI DB and `en_US` dev] → tests assert order relative to known seed rows sharing one case/charset, and the `id` tie-break keeps paging stable within an environment either way.
- [Breaking change to `GET /api/owners` for any unknown external client] → the deployment diagram shows none. MCP tools use `get_owner_profile`, not the list.
- [`OFFSET` cost grows with page depth] → acceptable at 100k (D7). Keyset is the escape hatch, out of scope.
- [Name now reads "Potter, Harry" in the grid only] → user-manual screenshots of the Owners page need regenerating (`/regen-user-manual`).

## Migration Plan

Single deploy: Flyway applies V4 (creating indexes on ≤100k rows takes seconds; no
`CONCURRENTLY` needed at this size). The backend and frontend ship together, since the
contract change is breaking. Rollback = redeploy the previous build. The V4 indexes are
harmless to the old code and can stay.
