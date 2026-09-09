# Design — owners grid pagination

> `proposal.md` is written for a **non-technical** product owner. It carries no contract, no
> file names, no mechanics. **This file is the only place they exist.** Interview log:
> `Q&A.md` on `nice26` (11 facts, 9 decisions, 11 recommendations).

## TL;DR

- `GET /api/owners` returns a **page envelope**, not an array. Breaking, single release unit.
- **`@BatchSize`, never `JOIN FETCH` + `Pageable`** — the latter pages in memory. That's the whole point of this change.
- **Whitelist the sort**, don't pass client strings to `Sort.by`. Append **`id` to every sort** or pages leak rows.
- The **e2e glue is a second consumer** — `Q&A.md` F1 says otherwise and is wrong. Fixing it is in scope.
- The **`.feature` gets signed off before any code** (D13). Nothing starts until then.

## Constraints in play

| Constraint | Consequence |
|---|---|
| `OwnerRepository extends Repository<>` (narrow marker) | No `Pageable` today, nothing to inherit it from → D4 |
| `Owner.pets` LAZY `Set`; mapper walks `getPets()` per row | N+1 now, still N+1 after paging unless batched → D3 |
| Boot 3.5.11: *"Serializing PageImpl as-is is not supported"* | Wire contract must be ours → D2 |
| `owners` has **zero indexes** (`V1` indexes types/pets/visits, skips owners) | → D7 |
| **DB collation is `C`** (verified 9 Sep 2026 — `Q&A.md` F7 says `en_US.UTF-8` and is wrong) | Byte order: `Śliwiński` sorts **after Wensleydale**, not among the S's → D7 pins the collation per column |
| 28 seeded owners; ties: Potter ×2, Darling ×2, **London ×7** | Tiebreak is load-bearing → D5. Only the London tie straddles a page boundary at an offered size |

**Guardrails that go red if artifacts aren't regenerated:** `OpenApiExtractorTest`, TS↔OpenAPI
sync, `DbSchemaExtractorTest`, `DB.sql`↔`DB.puml` pre-push, Spectral, Spotless, SonarCloud.

## Goals / Non-Goals

**Goals** — page cost independent of table size · a contract we own · server-decided sort
vocabulary · paging stable across duplicate surnames · linkable, reload-proof grid state.

**Non-Goals** — keyset pagination (Q20: `mat-paginator` needs jump-to-page + `totalPages`) ·
dropping the per-request `count(*)` (Q19: index-only, single-digit ms at 100k) · seeding 100k
rows (Q17) · sorting/filtering on address, telephone, pets · changing the database's own
collation (D7 pins it per column instead, so the server's locale stops mattering).

## Contract

**BREAKING.** `GET /api/owners` stops returning `List<OwnerDto>`.

| | before | after |
|---|---|---|
| request | `?lastName=` | `?lastName=&page=&size=&sort=<prop>,<dir>` |
| response | `[OwnerDto, …]` | `{content: [OwnerDto], totalElements, totalPages, number, size}` |
| defaults | — | `page=0`, `size=10`, `sort=name,asc` |
| unknown sort prop **or** direction | — | **400** |
| `size` ∉ {5,10,20} | — | **400** (D6) |

`sort=name` → `lastName, firstName`. **`id` appended to every resolved sort.**
Untouched: `POST`, `PUT`, `DELETE`, `/count`, `/{ownerId}`, nested pet/visit routes.

## Affected surface

**Backend**
- `rest/OwnerRestController.listOwners` — signature, `@Operation`/`@ApiResponse`, `ApiExamples.OWNERS`
- `rest/dto/OwnerPageDto` — new record · `repository/OwnerRepository` — paged overload
- `domain/Owner.pets` — `@BatchSize` · `db/migration/V9__index_owners.sql` — 3 indexes
- sort + page-size 400s via `ExceptionControllerAdvice`

**Frontend** — `owners/owner.service.ts`, `owner-page.ts`, `owner-list/*`, `owners.module.ts`
(Material is a dependency already; `MatTable`/`MatSort`/`MatPaginator` modules imported nowhere yet).

**Tests** — backend `@SpringBootTest`+MockMvc · Karma on `owner-list` · new
`owners-pagination.feature` + glue · trimmed `owners-pagination.spec.ts` · **`owner-search.feature`
+ glue, which break in three places** (D8).

**Regenerate before commit** — `openapi.yaml`, `api-types.ts`, `DB.sql`, `docs/generated/DB.puml`.
⚠️ `openapi.yaml`, `DB.sql`, `db/migration/` are **CODEOWNERS-protected** → book an elder.

---

## Decisions

### D1 · Change `GET /api/owners` in place (Q10)
**Why:** every consumer is in this repo (D8), so nobody to migrate. A parallel endpoint leaves
the unpaged one alive as the path of least resistance — exactly what 100k owners can't afford.
**Not:** versioned/parallel endpoint — dead code + two contracts in `openapi.yaml`.

### D2 · `OwnerPageDto` record, not `Page<OwnerDto>` (Q4)
`record OwnerPageDto(List<OwnerDto> content, long totalElements, int totalPages, int number, int size)`,
built from `Page` in the controller.
**Why:** Boot 3.5 refuses to guarantee `PageImpl`'s JSON. Our contract feeds **generated TS** —
an unstable upstream shape becomes a silent frontend break. Also matches the other 13 DTOs, gives
springdoc a named schema, and revives the orphan `owner-page.ts` shape (F2).
**Not:** raw `Page<>` (warning + unstable) · `PagedModel`/HATEOAS (new dep, nobody asked).

### D3 · `@BatchSize(size = 10)` on `Owner.pets` (Q2, Q11)
**Why:** `LEFT JOIN FETCH o.pets` + `Pageable` → **HHH000104, pages in memory** — reads the whole
join, then slices. At 100k that's the exact failure this change exists to prevent. Batching
collapses the lazy selects into `… WHERE owner_id IN (?,…)`: a page of 10 costs **2 queries + count,
regardless of table size**.
**On the field, not `default_batch_fetch_size`:** visible where it applies; doesn't silently
re-tune every other collection.
Size 10 = default page size → one batch in the common case. 5 and 20 cost 1 and 2. Not worth configuring.
`findByIdFetchingPets` keeps its `JOIN FETCH` — single row, no `Pageable`, fine.

### D4 · Widen the repo with an explicit paged method, keep the narrow marker (F3)
`Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`.
**Why:** the narrow `Repository<>` deliberately keeps `deleteAll`/`flush` off the surface;
switching to `JpaRepository` for paging imports all of it as a side effect. Spring Data derives
the paged query from the signature.
Empty `lastName` still matches everything, so filtered and unfiltered stay one method — as today.

### D5 · Sort whitelist in the controller layer, `id` always appended (Q12)
Accept `sort=<prop>,<dir>` → map through an explicit whitelist (`name` → `lastName, firstName`;
`city` → `city`) → **400** on anything else, direction included → append `id`.
**Why whitelist:** raw string into `Sort.by` throws `PropertyReferenceException` — a **500 that
enumerates the entity's properties**. Wrong status *and* an info leak. It also decouples API sort
vocabulary from field names: one API sort, two columns underneath.
**Why the tiebreak is not optional:** a page boundary inside a tie lets Postgres return either
order per query → **same owner on two pages, another on none**. Reads as data loss, not a paging
bug. Nobody reports it. Tested at backend *and* e2e level.

**Which tie to test with (verified against the live seed):** *not* the Potters — they sit at
positions 16–17 in name order, so they land on the same page at 5, 10 **and** 20. Nothing splits
them. Use **City sort at size 5**: London holds 7 owners at positions 13–19, so the page-3/page-4
boundary falls inside the tie. Stronger than the 2-row Potter case, and no seed mutation.

### D6 · `size` ∉ {5,10,20} → **400**, not clamped
**Decided by Victor, 9 Sep 2026.** The issue says "5, 10 or 20"; the interview never covered
`size=1000`. Raised as the one open call in the proposal, answered: refuse.
**Why:** Spring clamps silently at `max-page-size` (2000) — client believes it got what it asked
for, and a 2000-row page stays reachable at 100k. Same logic as D5.
**Not:** clamp to nearest — silent, indistinguishable from a client-side bug.

### D7 · Three indexes, one migration `V9__index_owners.sql` (Q7)

| Index | Serves | Why this shape |
|---|---|---|
| `(last_name COLLATE "en_US.UTF-8", first_name COLLATE "en_US.UTF-8", id)` | default sort | index order **is** the ORDER BY, tiebreak and collation included → plain index walk, no Sort node |
| `(city COLLATE "en_US.UTF-8", id)` | City sort | same, other allowed sort |
| `(last_name text_pattern_ops)` | existing `LIKE 'Pot%'` | **now required**: once the column sorts linguistically, a plain btree can no longer serve a prefix LIKE |

**Collation is pinned per column, deliberately.** The database was created `C` (byte order), which
sorts `Śliwiński` after `Wensleydale` — wrong for users, who expect him between `Silver` and
`Tremaine`. Rather than rebuild the database, the sort columns and their indexes carry
`COLLATE "en_US.UTF-8"` explicitly, so **ordering is a property of our schema, not of whatever
locale the server happened to be created with.** Verified on the live DB: the collation exists
and produces `… Schroedinger, Silver, Śliwiński, Tremaine, Weasley, Wensleydale`.

Every `ORDER BY` must use the same collation as the index, or the index stops serving it and a
Sort node reappears. That coupling lives in D5's whitelist — it emits collated sort expressions,
which is the whole reason the whitelist maps names to expressions rather than to bare properties.

Three indexes on a table that had none is a big *relative* change, small absolute one — owners
change rarely, write amplification isn't a concern. `V8` is current, so `V9`.

### D8 · The e2e Gherkin suite is a second consumer — `Q&A.md` **F1 is wrong**
F1 records `owner-list.component` as the only consumer. `owner-search.feature.glue.ts` is another,
and breaks three ways:

1. `Given` does `axios.get(…/owners)` + `Array.isArray(data)` → must read `data.content`, sized to hold the seed.
2. `Then every owner in the clinic is listed` compares the **whole** table — impossible at 10 rows / 28 owners. Becomes *first page*, or `size=20`+ via URL (D9 makes that one line).
3. Its `fullName` builds `Harry Potter`; the cell now renders `Potter, Harry` (Q3). Helper **and** Examples table change.

**Scope, not follow-up** — the change isn't shippable with a red e2e, and "never skip e2e" is standing policy here.

### D9 · URL query params are the single source of grid state (Q6, Q13)
Component reads `lastName/page/size/sort` from `queryParamMap` and reloads on emission; every
action (`matSort`, paginator, search) calls `router.navigate` with merged params instead of the
service directly.
**Why:** one direction of flow — URL *is* the state, component is a projection. Refresh, Back and
a pasted link take the same path as a click → **one behaviour to test, not three**. Bonus: e2e
jumps straight to `?page=2&size=5`.
Search resets `page=0`, keeps `sort` (Q13) — otherwise a 2-hit search viewed from page 5 renders empty and reads as broken.

### D10 · `matSort` + `mat-paginator` **on the existing Bootstrap table** (Q5)
**Not `mat-table`:** it replaces the markup wholesale, taking Bootstrap striping, `#ownersTable`,
`.ownerFullName` and the e2e selectors with it. `matSort` is a *directive* — works on a plain
`<table>`; paginator is a sibling. Accessible arrows + real page-size picker, diff confined to the header row.
**Design system:** the paginator's size control is a `mat-select`, not a raw `<select>` — rule
satisfied. Not in a form, not a domain field, so not `<app-combo>`. No paginator widget exists in
the DS and this change doesn't add one.

### D11 · `owner-page.ts` derives from generated types (Q15)
`Omit<components['schemas']['OwnerPageDto'], 'content'> & { content: Owner[] }`, mirroring `owner.ts`.
**Why:** the hand-written duplicate then can't drift — an envelope change becomes a **TS compile
error** after `npm run generate:api`.

### D12 · Empty state on `totalElements === 0` (Q14)
`*ngIf="!owners"` can never be true once the component holds a page object — the message would
just stop appearing. Also separates "no matches" from "not loaded yet", which the falsy check conflates.

### D13 · Gherkin `.feature` is the acceptance contract, **signed off before any code**
`owners-pagination.feature` + `.glue.ts` bound directly (steps do the work, no DSL — matching
`owner-search.feature.glue.ts`). `owners-pagination.spec.ts` survives but shrinks to what no
business reader should review: URL deep-linking, reload, Back.
**Why Gherkin, not another spec:** the stability rule (D5) fails **invisibly** — an owner shown
twice while another vanishes looks like a data problem, so nobody reports it. That deserves a
sentence the business can confirm: *"no owner is shown twice, and none is missed."* A TS
sorted-concatenation invariant says it to engineers only, and can't be signed off.
**Why first:** sign-off shapes the implementation instead of ratifying it. A scenario needing
edits to go green later ⇒ the code missed something agreed. **Fix the code, not the feature.**
**Not:** extend `owner-search.feature` (its subject is the filter; fixed two-owner Background;
one `.feature` per concern here) · sign off `spec.md` alone (right normative artifact, but nobody
reads SHALL-prose willingly and it doesn't execute — task 1.3 keeps both in sync).

---

## Risks

| Risk | Mitigation |
|---|---|
| e2e breaks in **three** places at once (D8) | Feature + glue + Examples in the same commit as the contract; run `owner-search.feature` locally — a red e2e is not CI's job to discover |
| `Potter, Harry` is a visible UI change nobody outside the interview asked for | Agreed with the business precisely so the sort key isn't hidden (Q3; F8 — first names here are often titles: *Mister* Geppetto, *Lady* Tremaine). Call it out in the release note |
| **Collation drift between environments** | **Solved, not deferred** (D7): sorts and indexes pin `COLLATE "en_US.UTF-8"`, so prod's own locale is irrelevant. `Q&A.md` F7 claimed dev was `en_US.UTF-8`; it is `C` — the ordering it called a future prod risk was already the dev behaviour. Residual risk: a hand-written `ORDER BY` that forgets the COLLATE silently drops the index |
| Deep-offset paging (Q20) | Accepted ceiling — `OFFSET 50000` scans and discards 50k index entries. Documented, revisit if anyone ever pages that deep |
| `@BatchSize` is **easy to delete silently** — page still renders, just N+1 | No fail-gate. A statement-count test would catch it; GUARDRAILS.md already lists "Performance / N+1 drift" as *considered, not scheduled*. Out of scope — backend test asserts contents, not statement count |
| Four generated artifacts drift at once (Q18) | Regenerate **before** committing so CI doesn't race an auto-commit. Three are CODEOWNERS-protected → factor the elder review into timing |
| SonarCloud new-code gate | Keep the whitelist out of the controller body (mapper or enum) rather than growing `listOwners` into branches; **≤5 params** (`java:S107` overridden to 5 in this profile) |

## Order of work

0. **`owners-pagination.feature` signed off** (D13). Nothing below starts first — a correction here costs a paragraph; after step 3 it costs a rewrite.
1. Backend TDD: failing MockMvc → `OwnerPageDto` → repo → controller → whitelist → `@BatchSize` → migration.
2. Regenerate `openapi.yaml` + `api-types.ts` → frontend now compiles against the real contract, not a hand-written type.
3. Frontend: service → `owner-page.ts` → component → template → module.
4. e2e: fix `owner-search.feature` + glue, then the pagination feature goes green.
5. Regenerate `DB.sql` + `DB.puml`; guardrail tests + Spectral before pushing.

**Rollback:** one release unit — new frontend can't read an array, old frontend can't read the
envelope. **Revert the whole commit, never one side.** The migration is additive (3 `CREATE INDEX`)
and correct against both query shapes — leave it.
