## Context

See `proposal.md` — Why. The constraints that actually shape the approach:

- `GET /api/owners` today is `List<OwnerDto> listOwners(String lastName)` over
  `ownerRepository.findByLastNameStartingWith(lastName)`, with no `ORDER BY` at all: the rows
  come out in physical order, which happens to look like `id` and is guaranteed to be nothing.
- The `owners` table, verified in `V1__core_owners_pets.sql` and in the committed
  `petclinic-backend/DB.sql`, carries **no index other than `owners_pkey`**. All four text
  columns are nullable. Sibling tables do have indexes (`pets_owner_id_idx`,
  `vets_last_name_idx`), created with the repo's unnamed `CREATE INDEX ON t (col)` idiom.
- The database is Postgres 16 with collation `en_US.UTF-8`.
- `Owner.pets` is a `LAZY` `@OneToMany` with no batching, and the grid renders pet names.
- The deployment diagram declares exactly one traced arrow into the Backend, from the browser.
  `DeploymentDiagramTest` compares those declared arrows against the generated
  `*.genseq.puml`, so the e2e scenario that produces `owner-search.feature.genseq.puml` has to
  keep making a `Browser -> Backend` call.
- `openapi.yaml`, `api-types.ts`, `DB.sql` and `docs/generated/DB.puml` are all guardrailed
  generated artifacts; CI auto-commits regenerated ones, and CODEOWNERS routes `openapi.yaml`
  and `db/migration/` to `@victorrentea/elders`.

## Goals / Non-Goals

**Goals:**
- One SQL statement per page, bounded by `LIMIT`, with a total order that survives ties.
- A rejection surface narrow enough that no client can ask the database for a full scan.
- Indexes that let the default ordering and the prefix filter both be served by an index,
  not by a sort of 100k rows.
- Guardrail artifacts regenerated *before* the push, not by CI's auto-commit.

**Non-Goals:**
- Keyset ("seek") pagination. Offset paging degrades on deep pages, but the UI is a numbered
  paginator with a total count, which keyset cannot draw. Revisit if deep pages become real.
- Avoiding the `COUNT(*)` behind `totalElements` (see Decisions).
- Any change to how owners are searched (fuzzy, `ILIKE`, `pg_trgm`) — different issue.
- **Any other grid.** Nothing outside the owners listing changes: no other endpoint gains a
  `Pageable`, no other component gains a paginator, no shared "paged grid" abstraction is
  extracted. The whitelist, the tie-breaker and the page defaults live in the owners
  controller, not in a base class waiting for a second caller. A pattern generalized from one
  example is a guess; the second grid to be paged is what earns the abstraction.

## Decisions

### Page payload: Spring Data's `PagedModel<OwnerDto>`

`{content, page:{size, number, totalElements, totalPages}}`.

*Why:* it is the shape Spring Boot 3.x produces from a `Page` without a serialization
warning, it is stable across Spring versions (unlike serializing `PageImpl` directly, which
Boot logs a warning for), and openapi-typescript derives a usable type from it, so the
frontend page type comes from `generated/api-types.ts` like `Owner` already does.

*Alternatives:* serializing `Page<OwnerDto>` directly — unstable JSON contract, warned about
by Spring itself. A hand-rolled `OwnerPageDto` — one more DTO to maintain and to keep in sync
with the paginator, for no gain. `Slice` — see the count decision below.

### The API breaks; no compatibility variant

`listOwners` changes return type in place. *Why:* the deployment diagram says the Backend has
exactly one client, the SPA, and both ship in the same release. A `/api/owners/paged` twin
would leave the unbounded endpoint alive — which is precisely the thing this change exists to
remove — and would have to be deleted in a follow-up nobody schedules.

*Consequence:* every in-repo consumer of the array shape moves to `data.content` in the same
commit (glue, DSL, scratchpad film scripts) — enumerated in `proposal.md` — Impact.

### Sort whitelist enforced in the controller, before Spring Data sees it

The controller reads `Pageable` and rejects any sort property outside
`{lastName, firstName, city}` with `IllegalArgumentException`, which
`ExceptionControllerAdvice` already maps to a 400 ProblemDetail — the idiom `PetClinicMcp`
uses. No new exception type.

*Why not `@SortDefault` / a `PageableHandlerMethodArgumentResolver` customization:* neither
rejects; they silently substitute a default, so a client asking for
`sort=pets.visits.description` would get a successful response to a question the server
refused to answer. A 400 is the honest reply. Whitelisting also protects the JPA property
path from being used to reach through relations into unindexed columns.

Same treatment for `size` (`5|10|20`) — an allowed-values check, not a clamp, for the same
reason: silently serving 20 rows to a request for 100000 hides the refusal.

### Every sort ends in `id`

The controller appends `firstName` then `id` to a `lastName` sort, and `id` to a `city` sort,
before handing the `Pageable` to the repository.

*Why:* measured on the real database, `ORDER BY city LIMIT 5 OFFSET 5` (top-N heapsort) and a
full sort of the same data return different rows for the same logical page; scaled to 100k
rows with the same tie density the two plans return **completely disjoint id sets**. Without a
unique final tie-breaker, paging is not a partition of the collection and an owner can be
skipped entirely. This is the requirement "Paging is stable across pages" in the spec.

### Indexes: three, and each ends in the tie-breaker

In one Flyway migration (`V9__index_owners.sql`), following the repo's unnamed
`CREATE INDEX ON owners (...)` idiom:

| index | serves |
|---|---|
| `(last_name, first_name, id)` | the default ordering, fully — no sort node at all |
| `(city, id)` | `ORDER BY city, id` |
| `(last_name text_pattern_ops)` | the `LIKE 'Pot%'` prefix filter |

*Refinement of the decision recorded in `QA.md` #5:* the first two carry a trailing `id`.
`QA.md` proposed `(last_name, first_name)` and `(city)`, which was written before the
tie-breaker was fixed. With `ORDER BY city, id`, a plain `(city)` index leaves Postgres an
incremental sort on every page; `(city, id)` makes the index order *be* the query order, so a
deep page is an index scan with an offset and nothing else. The extra column is 4 bytes on a
btree that is already carrying the heap tid.

*Why the third index is separate and cannot be merged:* with collation `en_US.UTF-8`, a
default btree is not usable for a `LIKE 'prefix%'` predicate — that needs `text_pattern_ops`.
The converse also holds: a `text_pattern_ops` index sorts by C-collation byte order, so it
cannot serve `ORDER BY last_name` under the database's collation. Filter and sort therefore
need different indexes, and a filtered *and* sorted query will use one of them plus a sort of
the (small) matching set. That is acceptable: the filter is what makes the set small.

*Alternative considered:* `COLLATE "C"` on the column, which would let one index do both.
Rejected — it changes the user-visible alphabetical order of every existing listing.

*Not done:* a `pg_trgm` GIN index. It serves infix/fuzzy matching, which this change does not
introduce.

### `@BatchSize` on `Owner.pets`, not `JOIN FETCH`

*Why not `JOIN FETCH` with `Pageable`:* Hibernate cannot apply `LIMIT` to a join-fetched
collection query, so it fetches **all** rows and paginates in memory, warning `HHH90003004` —
which at 100k owners is exactly the failure this change is removing, dressed as a fix.

*Why not `@EntityGraph`:* same trap; it becomes the same join.

`@BatchSize` makes the pets of a whole page load in one extra `IN (...)` query: 2 queries per
page instead of 1 + N. The spec states the bound; the test asserts it via the repo's existing
query-counting instrumentation.

### `COUNT(*)` stays

`Page` issues a count query per request. On 100k rows with the filter's index available that
is single-digit-to-tens of milliseconds, and `totalElements` is what lets `<mat-paginator>`
draw page numbers at all. `Slice` would turn the UI into bare next/prev, which is not what the
issue asks for. If the count ever hurts, it is a later optimization behind an unchanged API.

### Grid state in route query params

`/owners?page=2&size=10&sort=city,asc&lastName=Pot`. The component reads `queryParamMap` and
fetches; every interaction navigates rather than mutating local state.

*Why:* one source of truth, back/forward and reload work, a grid view is shareable, and the
e2e steps can deep-link straight into a page instead of clicking their way there.

### The grid stays a Bootstrap table

`matSort` directives go on the existing `<th>`s and a `<mat-paginator>` is added below;
the table is not converted to `<mat-table>`.

*Why:* `#ownersTable` and `td.ownerFullName` are the selectors `owner-search.glue.ts` polls on.
Keeping them keeps the existing scenarios meaningful and the diff about pagination rather than
about a table rewrite. Material is already a dependency, so `MatSortModule` and
`MatPaginatorModule` add no new one.

### The Name column is rendered `lastName, firstName`

`{{owner.firstName}} {{owner.lastName}}` becomes `{{owner.lastName}}, {{owner.firstName}}`.
The **Name** header sorts by `lastName, firstName, id` — the default ordering, the one
`owners (last_name, first_name, id)` serves without a sort node.

*Why:* sorting a column by a word that is not the first word in the cell reads as unsorted.
Surname-first is also the register convention (phone book, patient list), and it is the same
axis as the grid's existing search, which filters on a last-name prefix — filter and sort
should not talk about different fields on one screen.

*Alternatives:* splitting into `Last Name | First Name` columns — equally correct, larger
diff in the table and in every e2e assertion, and the extra column buys nothing once the
single cell is already surname-first. Sorting by `firstName` to match today's rendering —
rejected: it contradicts the search and needs a fourth index.

⚠️ **This changes the text of `td.ownerFullName`, which the e2e suite asserts on.** Three
places move together:
- `owner-search.glue.ts` — the `fullName` helper (`${firstName} ${lastName}`) and the
  Background data table (`| Harry Potter |` → `| Potter, Harry |`)
- `owner-search.feature` — the `Examples` column listing expected owners is **comma-separated**
  (`Harry Potter, Beatrix Potter`) and `namesIn` splits on `,`. With commas now inside each
  name that parser breaks silently into four entries. Change the separator (`;`) or move the
  expectation into a DataTable — do not leave `split(',')` in place.
- `owner-list.component.spec.ts` — the `.ownerFullName` innerText assertion

*Note:* `owner-list.component.css` already contains unused `.owners-controls`,
`.owners-pagination` and `.owners-page-size` rules — leftovers from an earlier attempt. Reuse
them or delete them; do not leave a third set of pagination styles behind.

### The e2e scenario is rewritten, not deleted

"every owner in the clinic is listed" becomes "the first page of owners is listed", asserting
the first 10 owners of the default order plus the reported total.

*Why not delete:* it is the `@generate_sequence` scenario. Deleting it removes
`owner-search.feature.genseq.puml`, and with it the `Browser -> Backend` arc that
`DeploymentDiagramTest` requires the traces to show — the guardrail would fail on an arrow the
diagram declares as `traced="yes"` and nothing traces.

### Concrete contract

`GET /api/owners?page={n}&size={5|10|20}&sort={lastName|firstName|city},{asc|desc}&lastName={prefix}`
→ `PagedModel<OwnerDto>`: `{content:[...], page:{size, number, totalElements, totalPages}}`.
Defaults: `page=0`, `size=10`, `sort=lastName,asc`. Frontend route mirrors it:
`/owners?page=2&size=10&sort=city,asc&lastName=Pot`.

`petclinic-frontend/src/app/owners/owner-page.ts` is **deleted**: a hand-written, unreferenced
interface whose shape (`{content, totalElements, totalPages, number, size}`) is not the one
above. The page type is derived from `generated/api-types.ts`, as `owner.ts` already does for
`Owner`.

## Affected surface

**Backend** (`petclinic-backend/`)
- `rest/OwnerRestController#listOwners` — signature, return type, OpenAPI annotations, validation
- `repository/OwnerRepository#findByLastNameStartingWith` — `Pageable` + `Page<Owner>`
- `domain/Owner#pets` — `@BatchSize`
- new `db/migration/V9__index_owners.sql` — **CODEOWNERS: `@victorrentea/elders`**
- `openapi.yaml` — regenerated, **CODEOWNERS: elders**
- `petclinic-backend/DB.sql` + `docs/generated/DB.puml` — regenerated (drift guardrails)

**Frontend** (`petclinic-frontend/`)
- `owners/owner.service.ts` — `getOwners`/`searchOwners` collapse into one paged call
- `owners/owner-list/owner-list.component.{ts,html,css,spec.ts}` — matSort + mat-paginator,
  query-param-driven state
- `owners/owners.module.ts` — `MatSortModule`, `MatPaginatorModule`
- `owners/owner-page.ts` — **deleted**
- `generated/api-types.ts` — regenerated from `openapi.yaml`

**Consumers of the old array shape, all moving to `data.content`**
- `petclinic-test/src/owner-search.glue.ts` (`the clinic has these owners`)
- `petclinic-test/src/visit-date-validation.dsl.ts` (`aPetWithAKnownBirthDateExists`)
- the scratchpad film scripts `bug-before.js` / `bug-after.js`

**Regenerated test artifacts**
- `owner-search.feature.genseq.puml` / `.json` — via `./run-tests-with-tracing.sh`

## Risks / Trade-offs

- **The frontend and backend break in lockstep** → they ship in one commit; the e2e suite is
  the gate that proves both sides moved.
- **Offset paging degrades on deep pages** (`OFFSET 90000` still walks 90k index entries) →
  accepted: the UI is a numbered paginator, and nobody browses to page 9000 of an alphabetical
  list; they search. Keyset paging is the escape hatch if that assumption breaks.
- **Three new indexes slow down owner writes and add storage** → owners are written rarely and
  read constantly; two of the three are directly on the default read path.
- **A whitelist is a maintenance point**: adding a sortable column means touching the
  whitelist, the index set and the header — deliberately, since each new sortable column is a
  new full-scan risk.
- **`text_pattern_ops` is unused if search moves to `ILIKE`** → then it is dropped by whatever
  change introduces `pg_trgm`; noted as such in the migration.
- **Regenerated artifacts race CI's auto-commit** → regenerate `openapi.yaml`, `api-types.ts`,
  `DB.sql`, `DB.puml` and the genseq pair locally and push them in the same commits.

## Migration Plan

1. `V9__index_owners.sql` is additive (`CREATE INDEX` only) — no data migration, no downtime
   concern at today's volume. On a 100k-row production table the indexes build in seconds; if
   this ever needs to run against a live database, `CREATE INDEX CONCURRENTLY` (outside a
   transaction, hence its own migration) is the variant to switch to.
2. Rollback is `DROP INDEX` plus reverting the code; nothing about the schema change is
   irreversible and nothing reads the indexes but the planner.
3. The API break has no phased rollout: backend and SPA are one deployable release.
4. `openapi.yaml` and `db/migration/` changes require `@victorrentea/elders` review — this is
   the PR that needs a human.
