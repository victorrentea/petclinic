# QA — issue #25: Add pagination to the Owners grid

The design interview behind [#25](https://github.com/victorrentea/petclinic/issues/25)
("The grid should be sortable by any column / paginated in pages of 5, 10 or 20 rows").

Each entry is **the question**, **the decision**, **why**, and **what it costs** — so the
next person can reopen a decision knowing what it was traded against rather than guessing.

Decisions 1–8 were answered by Victor in the interview. Decisions 9–20 were taken on the
recommended option, on his instruction to continue without him.

Sizing throughout assumes [volumetrie.md](volumetrie.md): **100.000 owners within a year**.

---

## Facts established before deciding

Not assumptions — each was read out of the running system.

| Fact | Where it came from |
|---|---|
| The **only** consumer of `GET /api/owners` is the Angular grid (+ its e2e) | `grep` over the repo, and the edges of `petclinic-backend/docs/deployment.drawio.png`: `frontend → backend` is `REST · HTTPS/JSON`, while `chatbot → backend` is `MCP tools · /mcp` + `GET /api/specialties/feed` |
| `PetClinicMcp` never lists owners — it only does `findById` / `findByIdFetchingPets` | `petclinic-backend/.../mcp/PetClinicMcp.java` |
| `owners` has **no index except the primary key** | `pg_indexes` |
| `first_name`, `last_name`, `city`, `address`, `telephone` are all `text` **nullable** | `information_schema.columns` |
| `last_name` is **not unique**: `Darling ×2`, `Potter ×2` | `GROUP BY last_name HAVING count(*)>1` |
| `first_name` is 28/28 distinct; `last_name` only 26/28 | `count(DISTINCT …)` |
| One owner has **`telephone IS NULL`** (Kevin McCallister, cleared by `V5`) | row dump |
| `telephone` mixes lengths 10–13, country prefix first (`0442079351269` vs `0032225112233`) | row dump |
| `address` starts with house numbers (`4 Privet Drive`, `221B Baker Street`) | row dump |
| The DB is `en_US.UTF-8` (libc), **not `C`** — it already sorts `Śliwiński` right after `Silver` | `pg_database` + `ORDER BY last_name` |
| 785 ICU collations are available, including `ro-x-icu` | `pg_collation` |
| 28 owners seeded, 2 of them with **0 pets**, max 2 pets each | row dump |
| Spring Boot **3.5.11** → Spring Data 3.5, which ships `PagedModel<T>` | `petclinic-backend/pom.xml` |

---

## 1. Server-side or client-side pagination?

**Decision: server-side.** The backend paginates and sorts; the grid asks for one page.

**Why:** the business is aiming at 100.000 owners. Shipping the whole table to the
browser is not a shortcut at that size, it is a defect.

**What it costs us — stated explicitly, because the client-side option was genuinely cheaper today:**
1. The contract breaks — `GET /api/owners` stops returning a bare array, so `openapi.yaml`,
   the generated `api-types.ts`, the frontend service and the e2e glue all move.
2. Every sort click and page click is now an HTTP round-trip, no longer instant.
3. Only what SQL can order is sortable — which is what killed the Pets column (§4).
4. A `COUNT(*)` per page, to know `totalElements`.

## 2. What shape does the response have?

**Decision: `PagedModel<OwnerRowDto>`, Spring Data's own DTO, on the same URL.**

```json
{ "content": [ … ], "page": { "size": 20, "number": 0, "totalElements": 100000, "totalPages": 5000 } }
```

**Why:** the first draft of this question offered a hand-written `PageDto`, and Victor
rightly asked why duplicate a class Spring already has. The answer is that `Page` is an
*interface* — what serializes is `PageImpl`, whose JSON is explicitly not a supported
contract (Spring Boot logs a warning about it). Spring's own fix is `PagedModel`. So the
correct answer was neither "write your own" nor "serialize `Page`".

**Cost:** metadata sits nested under `page`, not flat — the orphan
`petclinic-frontend/src/app/owners/owner-page.ts` describes a *flat* shape and is now
wrong twice over. Delete it (§13).

## 3. Is changing the contract dangerous?

**Decision: no.** Change `GET /api/owners` in place; do not add a parallel endpoint.

**Why:** one consumer, and the deployment diagram proves the chatbot reaches the backend
over MCP and the specialties feed, never over the owners list. A second, unpaginated
endpoint left behind would be an OOM waiting for someone to call it at 100k.

**Cost:** `openapi.yaml` is CODEOWNERS-protected — the PR needs `@victorrentea/elders`.

## 4. Which columns become sortable?

**Decision: only `Name` and `City`.** `Address` and `Telephone` stay display-only.

**Why — this is the ticket's "any column" being wrong, and the data says so:**
- `address` sorts as text, so the house number sorts as a string:
  `14 Kensington` < `221B Baker` < `26 Rue` < `4 Privet`. That ordering is noise.
- `telephone` is dominated by the country prefix, mixes lengths 10–13, and has a `NULL`
  that jumps to one end. Nobody can read meaning into that order.
- Two indexes maintained on 100.000 rows to power two orderings nobody wants.

**Cost:** we ship less than the ticket literally asks. Recorded here so it is a decision,
not an omission. Reopen it by normalising `telephone` to E.164 in its own ticket.

## 5. Sorting the Pets column

**Decision: dropped — the column leaves the grid entirely (see §6).**

**Why:** "sort by Pets" has no meaning without inventing a key (count? first pet's name?),
and neither was asked for. With the column gone the question dissolves.

## 6. What does one row carry?

**Decision: a slim `OwnerRowDto` — id, firstName, lastName, address, city, telephone. No pets.**

**Why:** one `SELECT` per page, no N+1. `JOIN FETCH` on a collection plus pagination makes
Hibernate paginate **in memory** (`HHH000104`) — at 100k that is the whole table in heap.
It also leaves `OwnerDto` untouched, which matters: its `pets` field is
`requiredMode = REQUIRED` in OpenAPI and the detail endpoint depends on it.

**Cost:** the Pets column disappears from the grid. If it is wanted back, the cheap version
is a `LEFT JOIN … GROUP BY` count in the same query — not the list.

## 7. Collation for `ORDER BY last_name`

**Decision: no explicit `COLLATE`. Plain `ORDER BY`, plus a test that guards the ordering.**

**Why:** I raised `Śliwiński` as a risk and the database disproved me. The cluster is
`en_US.UTF-8`, and already returns `… Silver, Śliwiński, Tremaine …`. The `C`-collation
failure mode I warned about does not exist here. Adding `COLLATE "ro-x-icu"` would buy
nothing and cost real things: **JPQL cannot express `COLLATE`**, so it forces a hand-written
native query *plus* a second one for the count, and the sort index would have to be created
with the matching collation or be silently unusable.

**Cost:** the ordering now depends on how the cluster was initialised. That is exactly what
the guard test is for — a re-`initdb` with a different locale fails the build, not the client.

**Correction, found while implementing (2026-09-03):** the fact above — "the DB is `en_US.UTF-8`"
— was read from a cluster that no longer existed. Zonky's `initdb` defaults to byte-wise `C`, and
that is what `start-database.sh` and CI were both running: `Śliwiński` sorted *after*
`Wensleydale`, dead last. The decision stands — dictionary ordering is what a reader expects — so
the fix was to make the premise true: both clusters are now pinned to `en_US.UTF-8`, the dev one in
`PostgresLauncher`, the test one on `OwnerPaginationTest`. The guard test caught this in CI on the
first push, which is precisely the job it was written for.

## 8. How do `page` / `size` / `sort` arrive?

**Decision: explicit parameters with an enum.**

```
GET /api/owners?lastName=Pot&page=0&size=20&sort=NAME&dir=ASC
```

`enum SortField { NAME, CITY }` as an **inner enum** of the controller; `dir` reuses
Spring's `org.springframework.data.domain.Sort.Direction` rather than a new enum.

**Why:** the whitelist exists by construction. A raw `Pageable` accepts *any* entity
property, so `sort=telephone` or `sort=pets.name` would trigger an unindexed sort over
100.000 rows, and `size=1000000` would drain the table through one GET. OpenAPI also
documents the permitted values instead of a free-text string.

**Cost:** the handler now takes 5 parameters — **exactly SonarCloud's `java:S107` limit**
under this repo's `petclinic agentic (extend)` profile. A sixth parameter fails the gate;
group them into a criteria object at that point.

## 9. Does the search change?

**Decision: no.** `lastName` stays a **case-sensitive prefix** match; it only learns to
compose with paging.

**Why:** #25 is about pagination and sorting. `owner-search.feature` currently asserts, as
*expected* behaviour, that `potter` finds nothing and `otter` finds nothing. Changing that
is a different ticket with its own e2e and its own index (`ILIKE` cannot use a plain btree;
substring search would need `pg_trgm`, which the memory notes Zonky lacks).

**Cost:** at 100k, `potter` not matching `Potter` will generate complaints. Expected, and
deliberately left for its own ticket.

## 10. Stable ordering

**Decision: every sort ends in `id`.**

- `NAME` → `ORDER BY last_name, first_name, id`
- `CITY` → `ORDER BY city, id`

**Why:** `Darling ×2` and `Potter ×2` are in the seed today. Without a unique tie-breaker,
`LIMIT/OFFSET` may repeat a row on one page and skip it on the next, because the database
is free to order ties differently between the two queries.

**Cost:** the sort index has to carry `id` as its last column to stay usable (§12).

## 11. Defaults, bounds and out-of-range

**Decisions:**

| | Value |
|---|---|
| `page` | 0-based on the wire (matches `PagedModel.page.number` and `mat-paginator`); default `0` |
| `size` | default `10`; **hard cap 20**, validated server-side |
| `sort` / `dir` | default `NAME` / `ASC` |
| page past the end | `200` with empty `content` and correct totals — **not** `404` |
| invalid `sort` / `dir` value | `400`, see §14 |

**Why:** the cap is the real protection — the frontend offering only 5/10/20 is a UI
convention, not a guarantee, and the endpoint is reachable without the UI. `200`-with-empty
is what Spring does naturally and what a client that just narrowed a search expects.

**Cost:** a client that deep-links `page=900` after the result set shrank sees an empty
grid rather than an error. The frontend clamps back to the last page (§15).

## 12. Indexes

**Decision — one Flyway migration, `V9__index_owners_for_paging.sql`:**

```sql
CREATE INDEX owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx ON owners (city, id);
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
```

**Why each one:**
- `owners_name_idx` — the default ordering, including the `id` tie-breaker, so a page is an
  index range scan instead of sorting 100.000 rows on every request.
- `owners_city_idx` — the same for `sort=CITY`.
- `owners_last_name_prefix_idx` — **this is not redundant.** The database collation is
  `en_US.UTF-8`, and under a non-`C` collation a plain btree **cannot** serve
  `LIKE 'Pot%'`. Only a `text_pattern_ops` index can. Conversely that index cannot serve
  `ORDER BY last_name`, because its ordering is byte-wise. The two indexes do genuinely
  different jobs.

No extension is needed, so unlike the `pg_trgm` case in the memory notes this migration
runs unmodified on Zonky's embedded Postgres.

**Cost:** three indexes to keep on a write path, and `petclinic-backend/DB.sql` +
`docs/generated/DB.puml` regenerate — both CODEOWNERS-protected.

**Explicitly not done:** `COUNT(*)` per page is left exact. At 100k it is milliseconds;
an approximate count from `pg_class.reltuples` would be premature and would make
`totalPages` lie.

**Noted, out of scope:** `first_name` / `last_name` are nullable in the schema while
`OwnerDto` marks them `@NotNull`. Worth a ticket; not this one.

## 13. Frontend rendering

**Decision: keep the existing Bootstrap `<table>`; add `<mat-paginator>` under it; hand-roll
the two sortable headers.**

**Why:** `mat-paginator` gives the 5/10/20 selector, next/previous and "1 – 10 of 28" for the
cost of one module import — Angular Material 16.2.1 is already a dependency. Converting the
table to `mat-table` + `matSort` would instead rewrite the markup and destroy
`#ownersTable td.ownerFullName`, the selector every existing e2e step depends on.

**Also:** delete `owners/owner-page.ts` (orphan, never imported, and now describes the wrong
shape) and collapse `OwnerService.getOwners()` + `searchOwners()` into one
`findOwners(criteria)` — they were already the same call with and without a query string.

**Cost:** one Material import for a page that is otherwise Bootstrap 3, and sort arrows
written by hand.

## 14. Invalid enum values

**Decision: add an `@ExceptionHandler(MethodArgumentTypeMismatchException.class)` to
`ExceptionControllerAdvice`, returning `400` as a `ProblemDetail`.**

**Why:** without it, `?sort=BANANA` falls through to the catch-all `Exception` handler and
returns **500** — a client error reported as a server error, and it pages whoever is on call.
This is lesson 6 from the JIRA-12415 session, repeating itself.

**Cost:** none. It is strictly a bug fix that the new enum parameters would otherwise expose.

## 15. URL state

**Decision: `lastName`, `page`, `size`, `sort`, `dir` live in the Angular route's query
params.** Searching or changing sort resets `page` to 0.

**Why:** reload, back button and a shared link all keep the grid where it was. It also makes
the e2e deterministic — a scenario can navigate straight to a page instead of clicking to it.

**Cost:** the component subscribes to `ActivatedRoute.queryParams` instead of loading once in
`ngOnInit`; the "reset to page 0" rule has to be honoured in three places (search, sort, size).

## 16. How the Name column reads

**Decision: `Last, First`** — `Potter, Harry`. Sorting follows it: `last_name, first_name, id`.

**Why:** Victor's call, made during the interview: at hundreds of thousands of rows he wants
the higher-cardinality field first so the eye can disperse the list.

**On the record, because the data disagrees with the stated reason:** in the seed,
`first_name` is 28/28 distinct and `last_name` only 26/28 — so *today* first names disperse
better. The decision stands (real-world surname distribution at 100k is a fair bet, and it
matches phone-book convention), but the argument it was made on is not supported by the
current data.

**Cost:** the CSS class `.ownerFullName` is **kept** so e2e selectors survive; only the text
inside changes. That still breaks the assertions themselves (§17).

## 17. Tests

Per `AGENTS.md`, non-trivial code is written test-first.

**Backend**
- Page boundaries: first, middle and last page; `size` at the 20 cap; `size=21` → `400`.
- **Stability:** with `Darling ×2` / `Potter ×2` in the seed, walking every page at `size=5`
  yields all 28 owners with no repeat and no gap. This is the test that would have caught a
  missing `id` tie-breaker.
- Sorting by `NAME` and by `CITY`, both directions.
- `?sort=BANANA` → `400`, not `500` (§14).
- **Collation guard (§7):** `Śliwiński` sorts immediately after `Silver`. Fails loudly if the
  cluster is ever re-initialised with a different locale.

**e2e — mandatory, never skipped**
- `owner-search.feature.glue.ts` must change: `axios.get('/api/owners')` now returns an
  object, so `Array.isArray(data)` fails and the read becomes `data.content`; `fullName`
  becomes `Last, First`; the Examples table becomes `Potter, Harry` / `Potter, Beatrix`.
- `Then every owner in the clinic is listed` is **no longer true under pagination** — 28
  owners do not fit a 10-row page. It becomes an explicit request for a page large enough,
  or an assertion over the first page plus `totalElements`.
- New `owner-pagination.feature`: page sizes 5/10/20, next/previous, sort toggling, and a
  deep-linked URL (§15).

**Seed data:** unchanged. 28 owners give 6 pages at `size=5` and 2 at `size=20` — enough to
exercise every boundary without inflating the fixture.

## 18. Guardrails that will fire

Regenerate **before** pushing, so CI does not race to auto-commit them
(`feedback_push_progresiv`):

| Artifact | Why it moves |
|---|---|
| `openapi.yaml` | new query params + new response schema — **CODEOWNERS, elders review** |
| `petclinic-frontend/src/app/generated/api-types.ts` | regenerated from the spec |
| `petclinic-backend/DB.sql` + `docs/generated/DB.puml` | the index migration — **CODEOWNERS** |
| `docs/generated/endpoint-complexity.{html,json}` | the handler signature changes |
| Spectral (`npm run lint:openapi`) | must still pass on the regenerated spec |
| `DeploymentDiagramTest` | unaffected — `frontend → backend` stays a traced REST edge |

## 19. `GET /api/owners/count` is now redundant

**Decision: leave it.** `totalElements` supersedes it, but it is `permitAll()` while the rest
of the controller is `@PreAuthorize(OWNER_ADMIN)`, so something may rely on that asymmetry.
Removing it is a separate, deliberate change.

## 20. Commit strategy

Small logical commits, each pushed and each green, rather than one drop
(`feedback_push_progresiv`): migration + indexes → repository + controller + tests →
OpenAPI/type regeneration → frontend → e2e.
