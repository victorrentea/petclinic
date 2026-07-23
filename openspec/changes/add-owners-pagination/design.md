## Context

`GET /api/owners` currently returns a plain `List<OwnerDto>`; there is no `Pageable`/`Page` anywhere
in the backend, so this is greenfield with no in-house pagination convention to follow.

State established by reading the code and **querying the live database** (not assumed):

| # | Finding | Consequence |
|---|---|---|
| 1 | Exactly 4 consumers of the endpoint, all in this repo: `owner.service.ts`, generated `api-types.ts`, `openapi.yaml`, `petclinic-ui-test/tests/support/api-client.ts` | A breaking change is fully contained — do it now, while that is still true |
| 2 | DB collation is `C` (byte order), PostgreSQL 16.2 | `ORDER BY last_name` yields `Adams, Ionescu, Zorro, de Gaulle, van Helsing, Ștefănescu`. Invisible in the ASCII seed; glaring with 10k Romanian names |
| 3 | `ro-RO-x-icu` is available on this server; verified to produce `Adams, de Gaulle, Ionescu, Ștefănescu, van Helsing, Zorro` | The fix is available in place |
| 4 | No sortable column is unique — `city`: London ×7, Hogsmeade ×3; `last_name`: Potter ×2, Darling ×2 | Non-unique `ORDER BY` + `LIMIT/OFFSET` lets PostgreSQL reorder ties between requests → rows duplicate on one page and vanish from another |
| 5 | `telephone` is nullable `text`, 27/28 populated, lengths 10–13, mixed international formats (`0119084455`, `0442074860707`, `0032225112233`) | Sorting it is deterministic but meaningless to a human |
| 6 | `address` is free text with leading house numbers; real `ORDER BY address` output is `14…, 221B…, 26…, 27…, 30…, 4…, 62…`, and a third have no number at all (`The Burrow`, `Diagon Alley`) | `4` after `30` is correct string sorting that reads as a bug |
| 7 | `OwnerDto` → `List<PetDto>` → `List<VisitDto>`, all `LAZY`, OSIV on (no `open-in-view` set) | Current call ≈ 61 queries at 28 owners; ≈ 22,000 at 10k. The grid renders only pet *names* and never visits |
| 8 | `owners` has only `owners_pkey`; `pets_owner_id_idx` and `visits_pet_id_idx` already exist | Full sort per page request and a seq scan per search at 10k — but batch fetching will be index-served |
| 9 | Zero `mat-table` / `MatSort` / `MatPaginator` usage app-wide, though `@angular/material` 16.2.1 is a dependency with the `indigo-pink` theme imported globally | The app's visual language is Bootstrap 3 + `assets/css/petclinic.css` |
| 10 | An abandoned prior attempt exists: `owners/owner-page.ts` defines an unused `OwnerPage` interface with the flat Spring `Page` shape, and `owner-list.component.css` already has `.owners-controls`, `.owners-pagination`, `.owners-page-size` rules styled with Bootstrap `.form-control` | Someone started this before — server-side, Bootstrap-flavoured. Reuse it |
| 11 | Theme values to match: `.btn-default` = `#34302d` bg / `#6db33f` border / `#f1f1f1` text; stripe `#f9f9f9` | Required by the `frontend-ux` "match existing screens" rule |

The governing constraint is production volume: **~10,000 owners planned**, versus 28 in the dev seed.
At 28 rows client-side paging would have been the right, cheap answer; at 10k it is not. Every
decision below is downstream of that number.

## Goals / Non-Goals

**Goals:**
- Paging, sorting and filtering executed entirely in PostgreSQL, bounded per request.
- An ordering that is *total* — page contents are stable across requests even on tied values.
- An ordering that is *linguistically correct* — the first feature that makes ordering visible is
  the honest moment to fix the `C` collation.
- A bounded query count per page (~3, not ~46).
- A grid that is visually indistinguishable in style from its five sibling list screens.
- Contract regeneration through the existing drift-checked pipeline, never by hand.

**Non-Goals:**
- Sorting Address or Telephone (findings 5–6), despite the issue text saying "any column".
- The other five list grids — same latent problem, different issue.
- Angular Material tables.
- A slim list projection dropping `visits` from the payload. Batch fetching makes it unnecessary
  for now; it remains the more correct long-term shape.
- Keeping the old unpaginated endpoint alive alongside the new one.

## Decisions

### D1 — Paging and sorting are server-side
10,000 owners. Loading all rows into the browser *is* the production incident. *Alternative:*
client-side `mat-sort` over the full list — correct at 28 rows, catastrophic at 10k.

### D2 — Replace the unpaginated endpoint; accept the breaking change
An endpoint that can dump 10k owners plus their pets will eventually be called by something. There
are exactly 4 consumers and all are in this repo (finding 1). *Alternative:* add
`GET /api/owners/paged` and leave the old one — leaves the loaded gun on the table forever.

### D3 — Hand-written `PageDto<T>` in `rest/dto/`, flat shape
`{content, totalElements, totalPages, number, size}`. Matches the `OwnerPage` interface the previous
attempt already left in the frontend (finding 10); `CLAUDE.md` says DTOs here are hand-written;
`openapi.yaml` is the contract source of truth, and a named record generates a clean named TS type.
Also sidesteps the Spring Boot 3.5 `PageImpl` serialization warning. *Alternative:* serialize
Spring's `Page` directly — unstable JSON shape and the warning.

### D4 — Only Name and City are sortable
Findings 5 and 6. A sort that produces visible nonsense reads as broken, not as a limitation. Pets
is a 1→N collection with no agreed ordering meaning. This is a **conscious deviation from the
written issue** ("any column") and must be confirmed on the PR.

### D5 — Name displays as `lastName firstName`, sorts `last_name, first_name, id`
Matches the last-name prefix search already on the screen.

### D6 — Fix the `C` collation now, in a Flyway migration
`V9__recollate_and_index_owners.sql` recollates `last_name`, `first_name`, `city` to `ro-RO-x-icu`.
`address` and `telephone` are left alone — they are not sorted (D4). Costs nothing on 28 rows; a
`REINDEX` on 10k+ later is not free. *Alternative:* `ORDER BY x COLLATE "ro-RO-x-icu"` in the query
— pushes the concern into every query site forever and defeats plain indexes.

### D7 — Spring `Pageable` + springdoc `@ParameterObject` for request params
Idiomatic, least code. *Alternative considered and rejected by the owner:* an explicit sort enum,
which would surface the legal sort set in `openapi.yaml` and therefore in the generated TS types.
Spring ergonomics won; D8 closes the holes that choice leaves open.

### D8 — Guard the raw `Pageable`
`spring.data.web.pageable.max-page-size=20`, `default-page-size=10`; map `PropertyReferenceException`
→ 400 in the existing `@RestControllerAdvice`. Closes `?size=100000` (10k rows in one response) and
`?sort=bogus` (500 + stack trace). These two settings are the price of D7.

### D9 — The server expands the sort chain and always appends `id`
The controller expands `lastName` → `lastName, firstName` and appends `id` unconditionally. Page
stability is a correctness property; it must not depend on every client remembering to send three
sort params (finding 4).

### D10 — Batch fetching for pets/visits, never `JOIN FETCH` with `Pageable`
`spring.jpa.properties.hibernate.default_batch_fetch_size=50` turns ~46 queries per page into ~3 in
one line with zero contract change, and is served by the existing `pets_owner_id_idx` /
`visits_pet_id_idx` (finding 8). **Critically:** a collection `JOIN FETCH` combined with `Pageable`
makes Hibernate silently fall back to loading every row into memory (`HHH000104`) — precisely the
10k disaster being avoided here.

### D11 — Keep the Bootstrap table; no `mat-table`
The `frontend-ux` cardinal rule is that a new screen must look like the existing ones. Five sibling
list screens are Bootstrap; the app has never rendered a `mat-table` (finding 9). Introducing
Material's first table here would mean re-theming `.mat-mdc-header-cell` / `.mat-mdc-cell` /
`tr.mat-mdc-row:nth-child(odd)` back to `#34302d` / `#6db33f` / `#f9f9f9` just to look unchanged —
pure cost. The abandoned CSS (finding 10) already assumes Bootstrap controls.

### D12 — `table-layout: fixed` with an explicit width per column
Mandated by `frontend-ux`. Without it, every sort toggle re-measures cell content and column
boundaries jump — a jarring reflow on every click.

### D13 — URL query params are the source of truth for list state
`?page=&size=&sort=&direction=&lastName=`. Back/forward/refresh and deep-linking work for free. The
component reads `ActivatedRoute.queryParams`; every interaction does `router.navigate` with merged
params rather than mutating component state.

### D14 — Defaults: `page=0`, `size=10`, Name ascending
10 is the middle offered size. Name-ascending is the only ordering a user can predict without
clicking. Server and UI defaults are stated in both places and must be kept equal.

### D15 — Page sizes exactly `[5, 10, 20]`, matching `max-page-size=20`
Per the issue. The two must not disagree, or the UI offers an option the server rejects.

### D16 — Changing `lastName` resets `page` to 0, preserving `size` and `sort`
Staying on page 4 after narrowing to 3 results shows a confusing empty grid.

### D17 — Rework the empty state to test the result count
Today `owners` is `null` when there are no results and the template tests `*ngIf="!owners"`. It
becomes `page.content`, and `[]` is **truthy** — the "No owners with LastName…" message would
silently never render again. This is a bug the change itself introduces; it needs its own
regression test.

### D18 — Indexes in the same migration as D6
`owners` has only a PK today (finding 8). Add `(last_name, first_name, id)` for the default chain
and `(city, last_name, id)` for the City chain.

### D19 — Regenerate both contract artifacts; never hand-edit
`OpenApiExtractorTest` regenerates `openapi.yaml`; `npm run generate:api` regenerates
`api-types.ts`. Both are CI drift-checked per `GUARDRAILS.md`.

### D20 — Update `petclinic-ui-test` as a first-class consumer
`api-client.ts` `get<OwnerDto[]>('/owners')` becomes an unwrap of `.content`; `owner-search.feature`
must stay green; a pagination scenario is worth adding.

### D21 — TDD, per `CLAUDE.md`
Test-first for each of: envelope shape and totals across pages; default sort when no `sort` given;
**page stability across ties** (sort by `city`, London ×7 — assert no owner on two pages and none
skipped; this is the D9 regression test); name-sort expansion (Beatrix Potter before Harry Potter);
`?size=100000` clamped and `?sort=bogus` → 400; ICU ordering with `van Helsing` / `Ștefănescu` /
`Zorro` inserted; query count per page ≈3 not ≈46. Frontend
(`owner-list.component.spec.ts`): reads initial state from query params, navigates with merged
params, search resets page (D16), empty result renders the message (D17), Name cell renders
`lastName firstName` (D5).

## Risks / Trade-offs

**[Recollation can break the existing prefix search]** — `findByLastNameStartingWith` compiles to
`LIKE 'x%'`. Under a **non-`C`** collation a plain b-tree index cannot serve `LIKE 'prefix%'`; it
needs `text_pattern_ops`. But a `text_pattern_ops` index cannot serve the ICU-collated `ORDER BY`.
So D6 plus the search likely requires **two** indexes on `last_name`:

```sql
CREATE INDEX owners_sort_idx   ON owners (last_name, first_name, id);      -- ICU order
CREATE INDEX owners_search_idx ON owners (last_name text_pattern_ops);     -- LIKE 'x%'
```

At 28 rows PostgreSQL seq-scans regardless and this is completely invisible.
→ **Mitigation: `EXPLAIN` against a 10,000-row dataset before considering #25 done.** This is the
single largest unresolved item; without it, the fix for one problem quietly creates another.

**[The embedded test PostgreSQL may lack `ro-RO-x-icu`]** — it is the same 16.2 jar as dev, so it
should have it, but a migration that fails only in CI is a bad surprise.
→ Mitigation: assert collation availability in a migration test as the first task of implementation.

**[`JOIN FETCH` regression risk]** — a future well-meaning "fix the N+1 properly" commit that adds
`JOIN FETCH pets` to the paged query reintroduces in-memory pagination silently.
→ Mitigation: the query-count test (D21) plus an explicit comment at the repository method.

**[Breaking API change]** — mitigated only by the fact that all four consumers are in this repo and
are updated in the same change; CI drift checks on `openapi.yaml` and `api-types.ts` catch a
half-finished migration.

**[Server/UI default and page-size drift]** — defaults (D14) and page sizes (D15) are stated in two
places by design. If they diverge, the UI offers something the server rejects.
→ Mitigation: a test asserting each offered size is accepted, and the clamp test.

**[Deviation from the issue text]** — D4 does not deliver "sortable by any column".
→ Mitigation: call it out explicitly on the PR for confirmation.

## Migration Plan

1. `V9__recollate_and_index_owners.sql` — recollate the three columns, create the sort and search
   indexes. Forward-only; on 28 dev rows it is instantaneous. At production scale the recollation
   rewrites and reindexes the affected columns, which is exactly why it is being done now rather
   than after the table grows.
2. Backend changes and contract regeneration land together with the frontend and UI-test consumer
   updates in one change — the API break is not deployable in halves.
3. Rollback: the migration is not designed to be reverted; reverting the application code alone is
   safe, since a recollated column and two extra indexes are harmless to the old code path.

## Open Questions

1. **The `EXPLAIN`-at-10k verification** (first risk above) — the one item that must be resolved
   during implementation, not deferred.
2. Sign-off on D4's deviation from the issue's "any column".
3. Whether to add a dedicated pagination scenario to `owner-search.feature` or only keep the
   existing scenarios green (D20).
