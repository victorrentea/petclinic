## Context

See [proposal.md](proposal.md) — Why. The design decisions below were taken in a recorded
interview; the long form, with what each was traded against, is in [QA.md](../../../QA.md)
(§ numbers below point at it). Facts that constrain the design were read out of the running
system, not assumed:

- The **only** consumer of `GET /api/owners` is the Angular grid and its e2e. The chatbot
  reaches the backend over MCP and `GET /api/specialties/feed`, and `PetClinicMcp` only ever
  does `findById` / `findByIdFetchingPets`.
- `owners` has **no index except the primary key**; `first_name`, `last_name`, `city`,
  `address`, `telephone` are all nullable `text`.
- `last_name` is not unique (`Darling ×2`, `Potter ×2`); one owner has `telephone IS NULL`;
  `telephone` mixes lengths 10–13 with the country prefix first; `address` starts with the
  house number.
- The cluster is `en_US.UTF-8` (libc), not `C` — it already returns `Silver, Śliwiński`.
- Spring Boot 3.5.11 → Spring Data 3.5, which ships `PagedModel<T>`.

## Goals / Non-Goals

**Goals:**
- One `SELECT` per page plus one `COUNT`, servable by an index range scan at 100k rows.
- A sort whitelist that exists *by construction*, not by validation an implementer can forget.
- Keep every existing e2e selector that can be kept, so the suite changes for real reasons only.

**Non-Goals:**
- Reworking the search semantics, the pets column, or `GET /api/owners/count` (§9, §6, §19).
- Approximate counts. `COUNT(*)` stays exact — at 100k it is milliseconds, and
  `reltuples` would make `totalPages` lie (§12).

## Decisions

### Server-side pagination, contract changed in place (§1, §3)
`GET /api/owners` changes shape rather than gaining a paginated sibling. *Alternative:* keep
the array and paginate in the browser — genuinely cheaper today, but shipping 100.000 rows to
the client is a defect, not a shortcut. *Alternative:* add `GET /api/owners/page` — leaves an
OOM waiting for whoever calls the old one at 100k. With a single known consumer, the in-place
break is the honest option. Cost: `openapi.yaml` is CODEOWNERS-protected, so the PR needs
`@victorrentea/elders`.

### `PagedModel<OwnerRowDto>` as the response (§2)
*Alternative:* a hand-written `PageDto` — duplicates a class Spring already has.
*Alternative:* serialize `Page` — `Page` is an interface, what serializes is `PageImpl`, whose
JSON is explicitly not a supported contract (Spring Boot logs a warning). `PagedModel` is
Spring's own fix. Cost: metadata nests under `page` rather than being flat, so the orphan
`petclinic-frontend/src/app/owners/owner-page.ts` is now wrong twice over and gets deleted.

### A slim row DTO, no pets (§5, §6)
`OwnerRowDto` = id, firstName, lastName, address, city, telephone. `JOIN FETCH` on a
collection together with pagination makes Hibernate paginate **in memory** (`HHH000104`) — at
100k that is the whole table in heap. Keeping the row slim also leaves `OwnerDto` untouched,
which matters because its `pets` field is `requiredMode = REQUIRED` in OpenAPI and the detail
endpoint depends on it. *If the column is ever wanted back*, the cheap version is a
`LEFT JOIN … GROUP BY` count in the same query — not the list.

### Only NAME and CITY sortable — the ticket's "any column" is wrong (§4)
`address` sorts as text, so house numbers sort as strings
(`14 Kensington < 221B Baker < 26 Rue < 4 Privet`) — noise. `telephone` is dominated by the
country prefix, mixes lengths, and its `NULL` jumps to one end. Two more indexes on 100.000
rows to power two orderings nobody can read. Recorded as a decision, not an omission; reopen
by normalising `telephone` to E.164 in its own ticket.

### Explicit parameters with an inner enum, not a raw `Pageable` (§8)
`enum SortField { NAME, CITY }` as an inner enum of the controller; `dir` reuses
`org.springframework.data.domain.Sort.Direction` rather than a new enum. A raw `Pageable`
accepts *any* entity property, so `sort=telephone` or `sort=pets.name` would trigger an
unindexed sort over 100.000 rows, and `size=1000000` would drain the table through one GET.
OpenAPI also documents the permitted values instead of a free-text string. Cost: the handler
takes 5 parameters — **exactly SonarCloud's `java:S107` limit** under this repo's profile. A
sixth fails the gate; group them into a criteria object at that point.

### `id` as the last sort key (§10)
`NAME` → `ORDER BY last_name, first_name, id`; `CITY` → `ORDER BY city, id`. With `Darling ×2`
and `Potter ×2` in the seed, an unstable order lets `LIMIT/OFFSET` repeat a row on one page and
skip it on the next, because the database may order ties differently between the two queries.

### No explicit `COLLATE` (§7)
The `Śliwiński`-sorts-after-`Z` risk was raised and the database disproved it: the cluster is
`en_US.UTF-8` and already returns `Silver, Śliwiński, Tremaine`. `COLLATE "ro-x-icu"` would buy
nothing and cost real things — **JPQL cannot express `COLLATE`**, forcing a hand-written native
query plus a second one for the count, and the sort index would have to be created with the
matching collation or be silently unusable. The ordering therefore depends on how the cluster
was initialised, which is precisely what the collation guard test defends.

### Three indexes, one migration (§12)
`V9__index_owners_for_paging.sql`:
```sql
CREATE INDEX owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx ON owners (city, id);
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
```
The third is **not redundant**: under a non-`C` collation a plain btree cannot serve
`LIKE 'Pot%'`, only `text_pattern_ops` can; conversely `text_pattern_ops` cannot serve
`ORDER BY last_name`, because its ordering is byte-wise. No extension is needed, so unlike
`pg_trgm` this migration runs unmodified on Zonky's embedded Postgres.

### `400` for a bad enum value (§14)
`@ExceptionHandler(MethodArgumentTypeMismatchException.class)` in `ExceptionControllerAdvice`,
returning a `ProblemDetail`. Without it, `?sort=BANANA` falls through to the catch-all
`Exception` handler and returns **500** — a client error reported as a server error, paging
whoever is on call. This is lesson 6 from the JIRA-12415 session repeating itself.

### Frontend: Bootstrap table + `mat-paginator`, not `mat-table` (§13, §15, §16)
`mat-paginator` gives the 5/10/20 selector, next/previous and "1 – 10 of 28" for one module
import — Angular Material 16.2.1 is already a dependency. Converting to `mat-table` + `matSort`
would rewrite the markup and destroy `#ownersTable td.ownerFullName`, the selector every
existing e2e step depends on; the two sort headers are hand-rolled instead. State lives in
`ActivatedRoute.queryParams` so reload, back button and shared links all work and the e2e can
navigate straight to a page. Name renders `Last, First` (Victor's call: higher-cardinality
field first, phone-book convention) — *on the record, the seed disagrees with the stated
reason*: `first_name` is 28/28 distinct and `last_name` only 26/28, so today first names
disperse better. Decision stands on the 100k bet, not on today's data. The `.ownerFullName`
class is kept; only the text inside changes.

## Risks / Trade-offs

- **Contract break reaches four places at once** (openapi.yaml, api-types.ts, the frontend
  service, the e2e glue) → land them in one push each, in the §20 order, each green.
- **Ordering depends on cluster locale** → the collation guard test fails the build, not the
  client, if the cluster is ever re-`initdb`'d with a different locale.
- **`potter` still finds nothing** → known and deliberate (§9); at 100k it will generate
  complaints, which is what will fund the `pg_trgm` ticket.
- **Deep link to a page that no longer exists** → `200` with empty `content` (Spring's natural
  behaviour, and what a client that just narrowed a search expects); the frontend clamps back
  to the last page.
- **Handler sits exactly at `java:S107`** → the next parameter fails the quality gate; that is
  the signal to introduce a criteria object.
- **Three indexes on a write path** → accepted; the owners table is read-heavy.
- **CODEOWNERS artifacts regenerate** (`openapi.yaml`, `DB.sql`, `DB.puml`) → regenerate
  *before* pushing so CI does not race to auto-commit them.

## Impact — code and artifacts that move

- **Backend:** `OwnerController` (new `lastName`, `page`, `size`, `sort`, `dir` parameters,
  inner `SortField` enum, `Sort.Direction` reused), `OwnerRepository` (paged query + count),
  new `OwnerRowDto`, `ExceptionControllerAdvice`, `db/migration/V9__index_owners_for_paging.sql`.
- **Frontend:** the owners grid component and template, `OwnerService`
  (`getOwners()` + `searchOwners()` → one `findOwners(criteria)`), routing query params,
  `MatPaginatorModule` import; `petclinic-frontend/src/app/owners/owner-page.ts` deleted
  (orphan, never imported, and describes a flat page shape that was already wrong).
- **Contract:** `openapi.yaml` (**CODEOWNERS — the PR needs `@victorrentea/elders`**) and the
  regenerated `petclinic-frontend/src/app/generated/api-types.ts`.
- **Guardrails that will fire** — regenerate *before* pushing so CI does not race to
  auto-commit them (`feedback_push_progresiv`):

  | Artifact | Why it moves |
  |---|---|
  | `openapi.yaml` | new query params + new response schema — **CODEOWNERS** |
  | `petclinic-frontend/src/app/generated/api-types.ts` | regenerated from the spec |
  | `petclinic-backend/DB.sql` + `docs/generated/DB.puml` | the index migration — **CODEOWNERS** |
  | `docs/generated/endpoint-complexity.{html,json}` | the handler signature changes |
  | Spectral (`npm run lint:openapi`) | must still pass on the regenerated spec |
  | `DeploymentDiagramTest` | unaffected — `frontend → backend` stays a traced REST edge |

- **e2e:** `owner-search.feature.glue.ts` — `axios.get('/api/owners')` now returns an object, so
  `Array.isArray(data)` fails and the read becomes `data.content`; `fullName` becomes
  `Last, First` and the Examples table becomes `Potter, Harry` / `Potter, Beatrix`.
  `Then every owner in the clinic is listed` is no longer true under pagination (28 owners do
  not fit a 10-row page) and becomes an assertion over the first page plus `totalElements`.
  New `owner-pagination.feature`. Seed data unchanged — 28 owners give 6 pages at `size=5` and
  2 at `size=20`, enough to exercise every boundary without inflating the fixture.

## Explicitly out of scope — each its own ticket

- Normalising `telephone` to E.164, which is what would make it sortable (§4).
- Case-insensitive / substring last-name search: `ILIKE` cannot use a plain btree and
  substring search needs `pg_trgm`, which Zonky's embedded Postgres lacks (§9).
- `first_name` / `last_name` are nullable in the schema while `OwnerDto` marks them
  `@NotNull` (§12).
- `GET /api/owners/count` is superseded by `totalElements` but stays: it is `permitAll()`
  while the rest of the controller is `@PreAuthorize(OWNER_ADMIN)`, so something may rely on
  that asymmetry. Removing it is a separate, deliberate change (§19).
- Bringing the Pets column back as a `LEFT JOIN … GROUP BY` count (§6).

## Migration Plan

Small logical commits, each pushed and each green (§20): migration + indexes → repository +
controller + tests → OpenAPI / type regeneration → frontend → e2e. The Flyway migration is
additive (`CREATE INDEX` only) and rolls back by dropping the three indexes; the API break
rolls back with the code, since frontend and backend deploy together.

## Open Questions

None. The one genuinely deferred item — whether the Pets column returns as a count — is out of
scope and has its own cheap path recorded above.
