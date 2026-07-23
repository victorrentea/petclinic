# Brainstorming Handover — gh #25 "Add pagination to Owners grid"

Outcome of a design interview on issue [#25](https://github.com/victorrentea/petclinic/issues/25).
**Nothing has been implemented yet** apart from two `CLAUDE.md` memory entries (see §9).

> Issue text:
> - The grid should be sortable by any column
> - The grid should be paginated in pages of 5, 10, or 20 rows per page

---

## 1. The fact that reframed everything

Victor disclosed mid-interview: **production is planned for ~10,000 owners.** The dev seed
(28 owners) is not representative. Every decision below is downstream of that number — at 28 rows
client-side paging would have been the right, cheap answer; at 10k it is not.

Recorded permanently in `CLAUDE.md` so it is never re-litigated.

## 2. What the investigation actually found

Facts established by reading the code and **querying the live database** (not assumed):

| # | Finding | Why it matters |
|---|---|---|
| 1 | `GET /api/owners` returns a plain `List<OwnerDto>`. No `Pageable`/`Page` anywhere in the backend. | Greenfield; no existing pagination convention to follow. |
| 2 | Only 4 consumers of the list endpoint, **all in this repo**: `owner.service.ts`, generated `api-types.ts`, `openapi.yaml`, `petclinic-ui-test/tests/support/api-client.ts`. | A breaking change is fully contained. Do it now while that is true. |
| 3 | **DB collation is `C`** (byte order), Postgres 16.2. | `ORDER BY last_name` yields `Adams, Ionescu, Zorro, de Gaulle, van Helsing, Ștefănescu` — lowercase-initial names sort after *all* uppercase, diacritics sort dead last. Invisible in the ASCII seed, glaring with 10k Romanian names. |
| 4 | `ro-RO-x-icu` collation **is available** on this server. Verified: it produces `Adams, de Gaulle, Ionescu, Ștefănescu, van Helsing, Zorro`. | The fix is available in-place. |
| 5 | **No column is unique.** `city`: London ×7, Hogsmeade ×3. `last_name`: Potter ×2, Darling ×2. | Non-unique `ORDER BY` + `LIMIT/OFFSET` lets Postgres reorder ties between queries → rows duplicate on page 2 and vanish. Needs a unique tiebreaker. |
| 6 | `telephone` is `text`, nullable (27/28 populated), lengths 10–13, mixed international formats (`0119084455`, `0442074860707`, `0032225112233`). | Sorting it is deterministic but meaningless to a human. |
| 7 | `address` is free text with leading house numbers. Real `ORDER BY address` output: `14…, 221B…, 26…, 27…, 30…, 4…, 62…`. A third have no number (`The Burrow`, `Diagon Alley`). | `4` after `30` is correct string sorting that reads as a bug. |
| 8 | `OwnerDto` → `List<PetDto>` → `List<VisitDto>`, all `LAZY`, OSIV **on** (no `open-in-view` set). | Current call = 1 + 28 + 32 ≈ **61 queries**. At 10k unpaginated ≈ **22,000**. The grid renders only pet *names* and never visits. |
| 9 | `owners` has **only the PK index** — nothing on `last_name`, `first_name`, `city`. | At 10k: full sort per page request, seq scan per search. |
| 10 | Zero `mat-table`/`MatSort`/`MatPaginator` usage in the whole app, though `@angular/material` 16.2.1 is a dependency and its `indigo-pink` theme is imported globally. | The app's visual language is Bootstrap 3 + `assets/css/petclinic.css`. |
| 11 | **Abandoned prior attempt exists**: `owners/owner-page.ts` defines an unused `OwnerPage` interface with the flat Spring `Page` shape, and `owner-list.component.css` already contains `.owners-controls`, `.owners-pagination`, `.owners-page-size` rules styled with Bootstrap `.form-control`. | Someone started this before, server-side, Bootstrap-flavoured. Aligns with the decisions below — reuse it. |
| 12 | Theme values to match: `.btn-default` = `#34302d` bg / `#6db33f` border / `#f1f1f1` text; stripe `#f9f9f9`. | Required by the `frontend-ux` skill's "match existing screens" rule. |

## 3. Decisions Victor made

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Paging/sorting location | **Server-side** | 10k owners. Loading all rows is the production incident. |
| D2 | Existing unpaginated endpoint | **Replace — breaking** | An endpoint that can dump 10k owners+pets will eventually be called. Only 4 in-repo consumers to fix. |
| D3 | JSON envelope | **Hand-written `PageDto<T>`** in `rest/dto/`, flat shape `{content, totalElements, totalPages, number, size}` | Matches the existing `OwnerPage` frontend interface; `CLAUDE.md` says DTOs here are hand-written; `openapi.yaml` is the contract source of truth so a named record generates a clean TS type. Avoids the Spring Boot 3.5 `PageImpl` serialization warning. |
| D4 | Which columns sort | **Name + City only** | Address sorts into visible nonsense (finding 7); Telephone is a formatless blob (finding 6); Pets is a 1→N collection with no agreed meaning. A sort that produces gibberish reads as broken, not as a limitation. Pushes back on the issue's literal "any column". |
| D5 | Name column | **Display flipped: `lastName firstName`**; sorts `last_name, first_name, id` | Victor's explicit call. Matches the lastName-prefix search already on the screen. |
| D6 | `C` collation | **Fix it — Flyway migration recollating the sorted columns to `ro-RO-x-icu`** | #25 is the first feature that makes ordering user-visible, so it is the honest moment. Costs nothing on 28 rows; a `REINDEX` on 10k+ later is not free. |
| D7 | Request params | **Spring `Pageable` + springdoc `@ParameterObject`** | Idiomatic, least code. *(This was against my recommendation of an explicit sort enum — I argued the enum would surface the legal sort set in `openapi.yaml` and therefore in the generated TS types. Victor chose Spring ergonomics; D8 closes the resulting holes.)* |
| D8 | Guards on raw `Pageable` | **Cap size + map bad sort to 400** | `spring.data.web.pageable.max-page-size=20`, `default-page-size=10`; `PropertyReferenceException` → 400 in the existing `@RestControllerAdvice`. Closes `?size=100000` (10k rows) and `?sort=bogus` (500 stack trace). |
| D9 | Tiebreaker chain | **Server expands and appends** | Controller expands `lastName` → `lastName, firstName` and always appends `id`. Page stability is a correctness property; it must not depend on every client remembering to send three sort params. |
| D10 | Pets/visits N+1 | **Batch fetching** — `spring.jpa.properties.hibernate.default_batch_fetch_size=50` | Turns ~46 queries/page into ~3, one line, zero contract change. **Critically: do NOT `JOIN FETCH` pets with a `Pageable`** — Hibernate cannot paginate a collection join in SQL and silently falls back to loading every row into memory (`HHH000104`), which is exactly the 10k disaster being avoided. |

## 4. Decisions I made by default (Victor fast-forwarded)

These are mine, not Victor's. Each is reversible; flag any you disagree with.

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D11 | Table technology | **Keep the hand-rolled Bootstrap `<table class="table table-striped">`.** Add clickable `<th>` sort toggles + a Bootstrap pager. **No `mat-table`.** | The `frontend-ux` skill's cardinal rule is that a new screen must look like the existing ones. Five sibling list screens are Bootstrap; the app has never rendered a `mat-table`. Introducing Material's first table here would need re-theming `.mat-mdc-header-cell` / `.mat-mdc-cell` / `tr.mat-mdc-row:nth-child(odd)` back to `#34302d`/`#6db33f`/`#f9f9f9` just to look unchanged — pure cost. The abandoned CSS (finding 11) already assumes Bootstrap controls. |
| D12 | Column widths | **`table-layout: fixed` + explicit per-column width for all 5 columns** | Mandated by `frontend-ux`. Without it, every sort toggle re-measures cell content and column boundaries jump left/right — a jarring reflow on every click. |
| D13 | List state location | **URL query params are the source of truth**: `?page=&size=&sort=&direction=&lastName=` | `frontend-ux` bonus convention. Makes back/forward/refresh and deep-linking work. Component reads `ActivatedRoute.queryParams`; every interaction does `router.navigate` with merged params rather than mutating component state. |
| D14 | Defaults | `page=0`, `size=10`, sort = Name ascending | 10 is the middle of the offered sizes. Name-ascending is the only ordering a user can predict without clicking. Server defaults and UI defaults must be stated in both places and kept equal. |
| D15 | Page size options | **Exactly `[5, 10, 20]`** per the issue; server `max-page-size=20` agrees with the UI | The two must not disagree, or the UI offers an option the server rejects. |
| D16 | Search ↔ paging interaction | **Changing `lastName` resets `page` to 0**; preserves `size` and `sort` | Staying on page 4 after narrowing to 3 results shows a confusing empty grid. |
| D17 | Empty-state bug this change introduces | Rework `<div *ngIf="!owners">` to test `totalElements === 0` | Today `owners` is `null` on no-results. It becomes `page.content`, and `[]` is **truthy** — so the "No owners with LastName…" message would silently never render again. Easy to miss. |
| D18 | Pets column | Header inert — not clickable, no sort affordance | Per D4. Must look deliberately non-interactive, not broken. |
| D19 | Indexes (see §5) | Add to the same migration as D6 | `owners` has only a PK today (finding 9). |
| D20 | Contract regeneration | `OpenApiExtractorTest` regenerates `openapi.yaml`; `npm run generate:api` regenerates `api-types.ts`. Never hand-edit either. | Both are CI drift-checked per `GUARDRAILS.md`. |
| D21 | `petclinic-ui-test` | Update `api-client.ts` (`get<OwnerDto[]>('/owners')` → unwrap `.content`); keep `owner-search.feature` green; consider a new pagination scenario | It is a real consumer of the broken contract (finding 2). |
| D22 | Scope | **Owners grid only.** Vets / Pets / Visits / Specialties / PetTypes grids untouched. | They have the same latent problem; they are not this issue. File separately. |
| D23 | Method | TDD, per `CLAUDE.md` | See §6. |

## 5. Database changes (verified against the real schema, per the `db` skill)

Current state confirmed via `pg_indexes`: `owners` has **only** `owners_pkey`. `pets_owner_id_idx`
and `visits_pet_id_idx` already exist, so D10's batch fetching will be index-served.

New Flyway migration `V9__recollate_and_index_owners.sql`:

1. **Recollate** `last_name`, `first_name`, `city` → `ro-RO-x-icu` (D6). Leave `address` and
   `telephone` alone — they are not sorted (D4).
2. **Index** `owners (last_name, first_name, id)` — serves the default sort chain exactly.
3. **Index** `owners (city, last_name, id)` — serves the City sort chain exactly.

### ⚠️ Open risk that needs resolving during implementation

**Recollation can break the existing prefix search.** `findByLastNameStartingWith` compiles to
`LIKE 'x%'`. Under a **non-`C`** collation a plain b-tree index cannot serve `LIKE 'prefix%'` — it
needs a `text_pattern_ops` index. But a `text_pattern_ops` index cannot serve the ICU-collated
`ORDER BY`. So D6 and the search may require **two separate indexes** on `last_name`:

```sql
CREATE INDEX owners_sort_idx    ON owners (last_name, first_name, id);              -- ICU order
CREATE INDEX owners_search_idx  ON owners (last_name text_pattern_ops);             -- LIKE 'x%'
```

At 28 rows Postgres will seq-scan regardless and this is invisible. **Verify with `EXPLAIN` against
a 10k-row dataset before considering #25 done** — otherwise the fix for one problem quietly creates
another. This is the single largest unresolved item.

**Also verify:** the embedded Postgres used by the *test* suite exposes the `ro-RO-x-icu` collation.
It is the same 16.2 jar as dev, so it should, but a migration that fails in CI is a bad surprise.

## 6. Test plan (TDD)

**Backend**
- Paged envelope shape; `totalElements` / `totalPages` correct across pages.
- Default sort applied when no `sort` param is given.
- **Page stability across ties** — the seed data is an ideal fixture: sort by `city` (London ×7) and
  assert no owner appears on two pages and none is skipped. This is the D9 regression test.
- Name sort expands to `last_name, first_name, id` — assert Beatrix Potter precedes Harry Potter.
- `?size=100000` is clamped/rejected; `?sort=bogus` → **400**, not 500 (D8).
- Collation ordering: insert `van Helsing` / `Ștefănescu` / `Zorro` and assert ICU order (D6).
- N+1: assert query count per page is ~3, not ~46 (D10).

**Frontend** (`owner-list.component.spec.ts`)
- Reads initial state from query params; navigates with merged params on sort/page/size change.
- Search resets `page` to 0 (D16).
- Empty result renders the no-owners message (D17 — this is a regression test for a bug the change introduces).
- Name cell renders `lastName firstName` (D5).

**UI tests** — keep `owner-search.feature` green after the `api-client.ts` fix (D21).

## 7. Suggested implementation order

1. `V9` migration (collation + indexes) + its test.
2. `PageDto<T>` record.
3. Controller: `Pageable` + `@ParameterObject`, sort expansion + `id` tiebreaker, guards, advice handler.
4. `application.properties`: `max-page-size`, `default-page-size`, `default_batch_fetch_size`.
5. Backend tests green → regenerate `openapi.yaml` via `OpenApiExtractorTest`.
6. `npm run generate:api` → `api-types.ts`.
7. `owner.service.ts` + `owner-list` component/HTML/CSS (reuse the abandoned `OwnerPage` + CSS).
8. Frontend tests green.
9. `petclinic-ui-test/tests/support/api-client.ts`; full UI suite green.
10. **`EXPLAIN` against 10k rows** — the §5 open risk.

## 8. Things I deliberately did not do

- Did not sort Address or Telephone, despite the issue saying "any column" (D4) — this is a
  **conscious deviation from the written issue** and should be confirmed on the PR.
- Did not touch the other five list grids (D22).
- Did not introduce Angular Material tables (D11).
- Did not add a slim list projection dropping `visits` from the payload — batch fetching (D10)
  makes it unnecessary for now, but it remains the more correct long-term shape.

## 9. `CLAUDE.md` entries added during this session

Two, both under `## Domain Model (ER Model)`:

1. **"Query the data, don't guess"** — a `postgres-db` MCP connector is wired to the dev DB; query
   it whenever there is doubt about types, nullability, cardinality, duplicates, formats, collation
   or row counts. *(Added at Victor's explicit request, after assuming the data shape produced a
   wrong recommendation about which columns were sortable.)*
2. **"Production data volumes"** — ~10,000 owners planned; never load all owners into memory;
   paginate/sort/filter server-side; watch for N+1 on `Owner.pets`.

---

## Status

**Design agreed, not yet confirmed as complete. No implementation started.**
Awaiting Victor's sign-off — particularly on §4 (my default decisions), §5's index/collation risk,
and §8's deviation from the issue text.
