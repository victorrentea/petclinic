## Context

See `proposal.md` — Why, and [`Q&A.md`](../../../Q&A.md) for the full design interview (Q1–Q15)
this document condenses.

Verified starting state, not assumed:

| | |
|---|---|
| `OwnerRestController.listOwners` | `@GetMapping` returning `List<OwnerDto>`, `?lastName=` prefix filter, `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")` on the class |
| `OwnerRepository` | extends the bare `Repository<Owner,Integer>`, `findByLastNameStartingWith(String)` — case-sensitive prefix |
| `OwnerDto` | nests `pets`, each pet nests `visits`, both LAZY and mapped outside a transaction → N+1 twice over (~60 queries for 20 rows) |
| grid | hand-written Bootstrap 3 `<table class="table table-striped">`; no `MatTable` anywhere in the app |
| DB | `owners` has exactly one index (the PK); collation `en_US.UTF-8`; latest migration `V8` |
| leftovers | `petclinic-frontend/src/app/owners/owner-page.ts` (`OwnerPage`) exists and is unused |

## Goals / Non-Goals

**Goals:**
- Paging, filtering and sorting resolved entirely in the database, correct at 100k owners.
- A sort contract narrow enough that no client input can reach an arbitrary entity path.
- A DOM the existing e2e suite, sequence diagrams and manual screenshots can keep addressing.

**Non-Goals:**
- Fixing the `pets`/`visits` N+1 (Q2 — deliberate teaching material).
- A generic pagination abstraction for other endpoints; `vets`, `visits` etc. stay as they are.
- Persisting the user's page-size choice across sessions.
- Fixing `vets_last_name_idx`, which has the same collation problem (noted in Q11, out of scope).

## Decisions

**D1 — Server-side paging via `Pageable`** (Q1). Alternative: client-side paging over the existing
array — no contract change, but at 100k owners it downloads every owner with pets and visits, and it
would make this repo's observability material lie about what the DB does.

**D2 — The row stays the full `OwnerDto`** (Q2). Alternatives: a slim `OwnerRowDto` with one batched
pets query (kills the N+1, much bigger contract diff), or dropping the Pets column (one query, one
fewer column). Keeping `OwnerDto` confines the contract diff to the envelope and preserves the ~60-query
sequence diagram that this repo teaches from. **Knowingly accepted debt**, not an oversight — first
thing to revisit if this stops being a demo.

**D3 — Return the raw `Page<OwnerDto>`** (Q3). Alternatives: `PagedModel` via
`spring.data.web.pageable.page-serialization-mode=VIA_DTO`, or a hand-rolled `PageDto<T>`. Raw `Page`
is zero code and its JSON already carries `content` / `totalElements` / `totalPages` / `number` /
`size` — which is exactly the orphan `OwnerPage` TS interface, so that file stops being dead code.
Cost: Boot 3.5 logs "serializing PageImpl as-is is not supported" and `openapi.yaml` inherits the
`pageable`/`sort`/`unpaged` noise.

**D4 — Sortable columns are Name and City only** (Q4), decided from the real 28 rows: Address is
house-number-first (`221B` sorts before `27`), Telephone is a 10–13-digit string with a leading zero
and one empty cell, Pets is only meaningful as an aggregate count on the paged query. The issue's
"sortable by any column" is therefore **not honoured literally** and the issue should be updated to say so.

**D5 — Name displays as `Potter, Harry`** (Q4, business approved). The cell renders
`firstName lastName` today, but the only sensible sort key is the last name — which is also what the
search box filters on. Sorted by `last_name`, the column would read *Baskerville, Bond, Carraclough,
Darling* rendered as `Henry Baskerville, James Bond, …` — H, J, S, C — and look broken. Sorting by
first name instead would divorce the sort key from the search key. European order kept:
`last_name`, then `first_name`.

**D6 — `id` is appended to every sort, unconditionally** (Q4). Six owners live in London;
`ORDER BY city` alone is non-deterministic under `LIMIT/OFFSET`, so the same owner can appear on both
page 1 and page 2 while another is never shown. The tiebreaker is not conditional on the chosen key.

**D7 — Logical sort keys, whitelisted server-side** (Q10). The client sends `name` or `city`; the
server maps them to `last_name, first_name, id` and `city, id`. An unknown key is rejected by the
controller itself with a `ResponseStatusException` 400 (per `petclinic-backend/CLAUDE.md`: a controller
rejects requests itself, it does not lean on `rest.error`). A client-supplied `Sort` is **never** passed
to Spring Data raw — that would let anyone sort by `pets.visits.description` and turn the paged query
into a cartesian join.

**D8 — Keep the Bootstrap table** (Q5, FE dev consulted). Alternative: `MatTable` + `MatSort` +
`MatPaginator` gives free arrows and a page-size dropdown, but plants a Material island in a Bootstrap 3
app and changes `#ownersTable` / `td.ownerFullName` — forcing a re-record of the e2e suite, the generated
sequence diagrams and the `user-manual/` screenshots for a cosmetic gain. Instead: clickable `<th>` with
▲/▼ and a small pager strip with a 5/10/20 `<select>`, ~40 lines, no new modules.

**D9 — Replace `GET /api/owners`, don't add a second endpoint** (Q6). Alternatives: a parallel
`/api/owners/page` (two shapes for the same rows, and the unpaged one is the loaded gun at 100k), or
switching shape on the presence of `page` (a contract neither OpenAPI nor a generated TS client can
express honestly). Every caller is inside this repo and is fixed in this change.

**D10 — Grid state lives in the URL** (Q8): `/owners?lastName=&page=&size=&sort=`, synced through the
Angular `Router`. At 100k owners the grid is ~10,000 pages deep; without this, opening an owner and
pressing Back drops the user on page 1, and no one can be sent a link to what they are looking at.

**D11 — Search resets to page 0, keeps the sort** (Q9). An empty response with `number > 0` — a deep
link to a page the filter shrank away — makes the grid re-request page 0 instead of rendering an
empty table.

**D12 — Three indexes in a new Flyway migration** (Q11), against a table that today has only its PK:

```sql
CREATE INDEX ON owners (last_name, first_name, id);   -- default sort, and filtered sort
CREATE INDEX ON owners (last_name text_pattern_ops);  -- the LIKE 'Pot%' prefix search
CREATE INDEX ON owners (city, id);                    -- city sort
```

`text_pattern_ops` is **not optional**: under this database's `en_US.UTF-8` collation a plain btree
cannot serve a `LIKE 'prefix%'` predicate. The filter therefore stays case-sensitive prefix matching —
switching it to `ILIKE` would make this index useless and is a separate decision.

**D13 — `Page`, not `Slice`** (Q12). The pager renders page numbers, which needs `totalElements`. Cost:
a `count(*)` per request — a full scan at 100k rows, tens of milliseconds, accepted. `Slice`
(next/prev only) is the escape hatch if it ever hurts.

**D14 — `GET /api/owners/count` stays** (Q13). It is consumed by `welcome.component.ts`, not by the
grid; `totalElements` does not replace it.

**D15 — TDD, failing test first** (Q14). Backend: page shape and default sort; the **tiebreaker test —
walk every page and assert no owner is seen twice and none is missed** (the 6-Londons bug); rejection
of an unknown sort key; `lastName` combined with paging. Frontend: `owner-list.component.spec.ts` for
page/sort/size changes and the search-resets-to-page-0 rule. E2E: the scenario *"Searching with an
empty last name lists every owner"* no longer holds — with 28 owners and size 10 the first page shows
10; it becomes *"the first page lists the first 10 owners, and paging to the last page lists all 28"*.

## Risks / Trade-offs

- **The N+1 survives** (D2) → accepted debt; it is the single biggest reason this endpoint will not
  survive 100k owners. Recorded here and in `Q&A.md` so it is never mistaken for an oversight.
- **Breaking REST contract** (D9) → every caller is in this repo and is fixed in the same change;
  the full list is under *Technical Impact* below.
- **Raw `Page` serialization** (D3) → a Boot warning in the log and a noisy OpenAPI schema; revisit if
  the noise or a Boot upgrade bites.
- **`count(*)` per request** (D13) → tens of ms at 100k rows; `Slice` is the documented escape hatch.
- **"Any column" is not delivered** (D4) → the issue text is wrong about the data, not the design;
  update issue #25 to say Address, Telephone and Pets are unsortable by design.
- **Guardrail drift** → the change touches generated artifacts (`openapi.yaml`, `api-types.ts`,
  `endpoint-complexity.*`, `DB.sql`, `DB.puml`); regenerate them in the same commits or CI auto-commits
  and races the push.
- **The e2e step delimiter collides with the new name format** → `owner-search.glue.ts` parses expected
  owners from a comma-separated string (`namesIn` splits on `,`). Once a name *is* `Potter, Harry`, that
  cell can no longer be parsed. The affected steps must move from a `{string}` cell to a Gherkin data
  table (one owner per row); the acceptance feature under `acceptance/` is already written that way.
- **A stale sequence-diagram recording** → the grid's DOM and query volume both change; the
  `user-manual/` owners screenshot and any recorded trace must be refreshed.

## Technical Impact

The proposal states the business consequences; this is the code-level list.

**REST contract (BREAKING).** `GET /api/owners` stops returning a bare `List<OwnerDto>` and returns a
Spring `Page<OwnerDto>` — `content` / `totalElements` / `totalPages` / `number` / `size` — and accepts
`page`, `size` and `sort` alongside the existing `lastName` filter. The unpaged shape is *replaced*
(D9), not kept beside a second endpoint. No consumer outside this repository exists.

**Backend.** `OwnerRestController.listOwners` (paged signature, logical-sort-key mapping, 400 on an
unknown key), `OwnerRepository` (a `Pageable` prefix-filter finder), a new `db/migration` Flyway
migration for the three indexes of D12. `OwnerDto` and `OwnerMapper` are untouched (D2).

**Frontend.** `owner-list.component.*` (sort arrows on two headers, pager strip, `Potter, Harry`
rendering, Router-synced query params), `owner.service.ts`, and `owner-page.ts` — the orphan
`OwnerPage` interface, which the raw `Page` JSON fits as-is, so it stops being dead code (D3).

**Callers to fix in the same change.** `owner.service.ts`; `owner-search.glue.ts` (it asserts
`Array.isArray(data)`); `owners.feature`; `OwnerSearchThroughLatencyProxyTest`;
`BasicAuthenticationConfigTest`; `petclinic-test/scripts/record-bug40.js`; the
`docker-compose.test.yml` healthcheck.

**Generated artifacts to regenerate.** `openapi.yaml` (`OpenApiExtractorTest`), `api-types.ts`
(`npm run generate:api`), `endpoint-complexity.*`, and — because of the migration —
`petclinic-backend/DB.sql` plus `docs/generated/DB.puml`.

**Docs.** The owners-grid screenshot in `user-manual/`; the REST Contract line in `CLAUDE.md`.

**Explicitly unaffected.** `GET /api/owners/count`, consumed by `welcome.component.ts` (D14); the
class-level `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`; the MCP tools — `PetClinicMcp` only uses
`findByIdFetchingPets`; the chatbot.

## Migration Plan

The migration is forward-only and additive at the DB level (`CREATE INDEX`, no data change), so a
rollback is a code revert; the indexes are harmless if left behind. Backend and frontend must ship
together — the response shape changes in one step. No API versioning is introduced.

## Open Questions

None. Q7–Q15 in `Q&A.md` are recommendations that remain open to challenge, but each has a decided
default recorded above, so none blocks implementation.
