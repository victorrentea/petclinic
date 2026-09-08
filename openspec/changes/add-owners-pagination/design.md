## Context

See `proposal.md` - Why/What Changes for motivation. Relevant current state:

- `OwnerRepository extends Repository<Owner, Integer>` has no `Pageable`/`Sort`-aware methods;
  `findByLastNameStartingWith` returns the full `List`.
- `OwnerRestController.listOwners` maps every result through `OwnerMapper.toOwnerDtoCollection`,
  which walks `Owner.pets` (LAZY) → `Pet.visits` (LAZY) and `Pet.type` (EAGER by default),
  causing a two-level N+1 per page.
- The Postgres database (`petclinic-database`, embedded PG 16.2 in dev/tests) was created
  with `datcollate = C`; `und-x-icu` is available with no extra install.
- The frontend has no `MatTable`/`MatPaginator`/`MatSort` and only one design-system
  single-select widget, `<app-combo>` (`ComboComponent`, a `ControlValueAccessor`).
  `AGENTS.md` requires every single-select in a form to use it.
- `owners.feature:14-17` and `OwnerSteps.java` assert the current bare-array shape.

## Goals / Non-Goals

**Goals:**
- Make `GET /api/owners` return a bounded page regardless of table size.
- Make sorting by `lastName` or `city` correct (Unicode-aware) and indexed.
- Stop the pet visits/type N+1 for the list endpoint specifically.
- Keep `?lastName=` search, paging, and sorting composable on one endpoint.

**Non-Goals:**
- Fixing the same collation/indexing gap on `vets` (tracked separately, out of scope per Q&A).
- A general-purpose paginated grid/table design-system component (only the page-size
  `<app-combo>` select is extracted now; a shared pagination widget waits for a second
  consumer).
- Changing `getOwner`/`getOwnersPet` (single-owner) payload shape - only the list endpoint's
  DTO is slimmed.

## Decisions

**Response shape: hand-written `OwnerPageDto` over raw `Page<OwnerDto>`.**
Serialising Spring Data's `PageImpl` directly is explicitly discouraged for public APIs and
springdoc would emit ~20 extra fields (`pageable`, `sort.sorted/unsorted/empty`, `first`,
`last`, `numberOfElements`, `empty`, ...) into the CODEOWNERS-protected, Spectral-linted
`openapi.yaml`. A slim `OwnerPageDto {content, totalElements, totalPages, number, size}`
keeps the generated contract minimal and stable. Rejected alternative: array response +
`X-Total-Count` header - headers aren't captured by the generated TypeScript client, so the
frontend would read the total outside the typed contract.

**List payload: new `OwnerListItemDto` instead of `@BatchSize` on the existing `OwnerDto`.**
`@BatchSize` would still ship `visits` and `type` per pet even though `owner-list.component.html`
only renders `{{pet.name}}`. A slim DTO (id, firstName, lastName, address, city, telephone,
pet names) removes the unused data at the source instead of just batching the queries that
fetch it.

**Sorting: explicit whitelist mapped to a fixed `Sort`, not a client-supplied `Sort` object.**
Spring's default `Pageable` argument resolver will happily turn `?sort=pets.name` into an
`ORDER BY` across a join - both a 500-risk and an information-disclosure/DoS surface on a
100k-row table with no matching index. The controller/repository maps only `sort=lastName`
and `sort=city` to hand-picked `Sort` objects that always end in `id` as a tie-breaker; any
other value is rejected with 400. Direction (`asc`/`desc`) is still accepted per the standard
`sort=property,direction` convention.

**Collation: `COLLATE "und-x-icu"` on the column type, not `COLLATE` in each query.**
Verified against the dev database (rolled back) that `ALTER TABLE owners ALTER COLUMN
last_name TYPE varchar(30) COLLATE "und-x-icu"` (same for `first_name`, `city`) makes a plain
`ORDER BY last_name` - with no query-level `COLLATE` clause - sort correctly, and lets an
index created afterward inherit the collation so `ORDER BY` can use it. Rejected: changing
`ALTER DATABASE ... SET COLLATE` (no such command; would require a new database, dump/restore,
and a maintenance window - a much bigger infrastructure change) and adding `COLLATE
"und-x-icu"` per-query (would require abandoning Spring Data's standard `Sort` for native
`@Query` on every sortable field).

**Migration cost:** `ALTER COLUMN TYPE` takes an `ACCESS EXCLUSIVE` lock and rewrites the
table - instant at dev volumetry, but seconds at 100k rows in production. This migration
should run in a deploy window; call this out in the PR description for `@victorrentea/elders`
review (the file lives under `db/migration/`, which is CODEOWNERS-protected).

**Indexes:** one composite index per sortable column, each ending in `id` for the
tie-breaker: `(last_name, first_name, id)` and `(city, last_name, first_name, id)`. Two
indexes instead of one-per-column-in-the-issue (`address`/`telephone` are excluded - see
Q&A Q2: `telephone` is 27/28 distinct with mixed formats and a NULL; `address` is 27/28
distinct and sorts lexicographically on house-number text; neither groups anything
meaningful, so no index is added for them and they stay plain, unsortable headers).

**Display order:** the Name column renders `{{lastName}} {{firstName}}` (flipped from
today's `{{firstName}} {{lastName}}`), so a header that sorts by last name visibly matches
what's displayed - see Q&A. This is a one-line template change, not a new capability.

**Frontend paging control:** the 5/10/20 page-size selector is a single-select, so it goes
through `<app-combo>` per `AGENTS.md`, not a hand-written `<select>` and not `MatPaginator`
(which would drag in `mat-select` and a second UI vocabulary for one screen). Next/previous
page and sort-by-column-header controls are plain buttons/links, matching the existing
Bootstrap 3 table markup - no new design-system component is introduced for those.

**State in the URL:** `page`, `size`, and `sort` are read from and written to the route's
query parameters (Angular `Router`/`ActivatedRoute`), making a given page bookmarkable and
back-button-navigable. Changing the `lastName` search term resets `page` to 0.

**`owner-page.ts` deletion:** it is unused (verified: nothing imports `OwnerPage`), predates
any real consumer, and happens to already match the chosen shape - reassuring, but not a
reason to keep hand-maintained dead code once `api-types.ts` regenerates the real type from
`openapi.yaml`.

## Risks / Trade-offs

- [`ALTER TABLE ... ALTER COLUMN TYPE` locks `owners` exclusively during migration] →
  Mitigation: call out the deploy-window requirement explicitly in the PR; table is small
  enough today that dev/CI runs are instant, and the risk is documented for the CODEOWNERS
  reviewer before it matters at 100k rows.
- [Response-shape change is breaking for any external consumer of `GET /api/owners`] →
  Mitigation: per Q&A, no MCP or chatbot consumer touches `listOwners`; only
  `owner-list.component.ts`/`OwnerService` are in-repo consumers, and both are updated in
  this change.
- [Whitelisting sort properties in application code, rather than deriving them from the
  entity, could drift from the DTO if new sortable fields are added later] → Mitigation: the
  whitelist is small (2 entries) and directly tested (see spec: "Sorting by a disallowed or
  unknown property"), so drift surfaces immediately as a failing test, not silently in
  production.

## Migration Plan

1. Add `V9__owners_icu_collation_and_sort_indexes.sql` (collation `ALTER`s + two composite
   indexes). Runs automatically via Flyway on next backend boot, in dev/test as it already
   does for `V1`-`V8`.
2. No data backfill needed - collation and indexes apply to existing rows in place.
3. Rollback: a new `V10__` migration reverting the column types/dropping the indexes if
   needed; Flyway migrations already applied are not un-applied automatically.
4. No feature flag - the response shape change ships atomically with the updated frontend in
   the same deploy, since they share the same PR/change.
