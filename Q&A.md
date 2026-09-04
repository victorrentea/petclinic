# Q&A — GH #25: Add pagination to Owners grid

Design interview log. Issue: *the grid should be sortable by any column; paginated in pages of 5, 10 or 20 rows*.

**Q1–Q9 were decided by Victor. Q10–Q20 are my recommendations, taken as decided unless he says otherwise.**

## Facts established before deciding

| # | Finding | Where it came from |
|---|---|---|
| F1 | `listOwners` returns a bare `List<OwnerDto>`; its **only** consumer is `owner-list.component` — no MCP tool, no chatbot, no e2e | grep across all 5 modules |
| F2 | `owner-page.ts` declares an `OwnerPage` interface with **zero references** — an abandoned earlier attempt | grep |
| F3 | `OwnerRepository extends Repository<>` (the narrow marker), so no `Pageable` support today | source |
| F4 | The `owners` table has **no index at all** — not even on `last_name`, despite `findByLastNameStartingWith` | `V1__core_owners_pets.sql` |
| F5 | 28 owners live; **duplicate last names**: Potter ×2 (Harry, Beatrix), Darling ×2 (George, Wendy) | Postgres MCP |
| F6 | `telephone` is **NULL** for Kevin McCallister (id 1) | Postgres MCP |
| F7 | `Śliwiński` (id 22) sorts correctly *only* because this DB is `en_US.UTF-8`; under `C` collation it jumps to the end | `pg_database.datcollate` |
| F8 | First names are often titles — *Mister* Geppetto, *Lady* Tremaine, *Long* Silver | Postgres MCP |
| F9 | Boot 3.5.11 — returning a raw `Page<>` logs *"Serializing PageImpl instances as-is is not supported"*; contract documented as unstable | `pom.xml` + Spring docs |
| F10 | Material is already a dependency (datepicker, select) but no table/sort/paginator module | grep |
| F11 | No design-system fail-gate exists — only the `combo` unit spec | grep `data-ds` |

## Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| **Q1** | Server-side or client-side paging? | **Server-side** | Business expects **100,000 owners within a year**. Recorded in `CLAUDE.md`. |
| **Q2** | How is the Pets column fed once paging forbids `JOIN FETCH`? | **Batch-fetch** | `LEFT JOIN FETCH o.pets` + `Pageable` = HHH000104 in-memory paging, fatal at 100k. Batch loading collapses 10 lazy selects into 1 `... WHERE owner_id IN (?,…)`. |
| **Q3** | What does the Name column sort by? | **`(lastName, firstName)`**, and the cell now renders **`Potter, Harry`** | Phone-book order keeps the two Potters adjacent; business agreed to change the UI layout so the sort key is no longer hidden (F5, F8). |
| — | Tiebreak | **`id` appended to every sort** | Without it, ties + `OFFSET` make rows repeat or vanish between pages (F5). |
| **Q4** | Response envelope | **Custom `OwnerPageDto`** record: `{content, totalElements, totalPages, number, size}` | Matches the other 13 DTOs, springdoc generates clean types, contract is ours (F9) — and it revives the orphan `owner-page.ts` shape (F2). |
| **Q5** | Sort/pager widgets | **`matSort` + `mat-paginator` on the existing Bootstrap table** | Accessible arrows and a real pager for free; Bootstrap striping and existing selectors (`#ownersTable`, `.ownerFullName`) survive (F10, F11). |
| **Q6** | Where does grid state live? | **URL query params** — `?lastName=&page=&size=&sort=` | Refresh and Back keep your place, a search result is a shareable link, and e2e can jump straight to a state. |
| **Q7** | Indexes | New Flyway migration | `owners` has none (F4). |
| **Q8** | Which columns are sortable? | **Name and City only** | Address and Telephone were ruled out — telephone is TEXT of mixed formats, so its order is country-code-by-accident, and it has a NULL (F6). Pets is a collection, never sortable. |
| **Q9** | Landing state | **10 rows, sorted by Name asc** | Middle of 5/10/20; backend applies the same defaults so a bare `GET /api/owners` is deterministic. |

### Indexes, concretely (Q7)

| Index | Serves |
|---|---|
| `owners (last_name, first_name, id)` | default sort — index order *is* the ORDER BY, so paging is a plain index walk with no Sort node |
| `owners (city, id)` | City sort |
| `owners (last_name text_pattern_ops)` | the existing `LIKE 'Pot%'` search — a plain btree **cannot** serve it under `en_US.UTF-8` (F7) |

## My recommendations for the rest

| # | Question | Recommendation | Why |
|---|---|---|---|
| **Q10** | `GET /api/owners` changed in place, or a new endpoint? | **In place** | Single consumer (F1); a parallel endpoint would leave dead code behind. |
| **Q11** | Batch-fetch mechanism | **`@BatchSize(size = 10)` on `Owner.pets`** | Scoped and self-documenting on the field it affects, rather than a global `default_batch_fetch_size` that silently changes every other collection in the app. |
| **Q12** | Sort parameter format | Spring's `sort=lastName,asc`, mapped through a **server-side whitelist** of `lastName`/`city`, anything else → **400** | Passing a raw client string into `Sort.by` throws `PropertyReferenceException` (500) and leaks entity internals. |
| **Q13** | Search + paging interaction | Changing `lastName` **resets to page 0**, keeps the sort | Otherwise a 2-result search on page 5 shows an empty grid. |
| **Q14** | Empty state | Drive the existing "No owners…" message off `totalElements === 0` | Today it keys off a falsy `owners`, which a page object never is. |
| **Q15** | The orphan `owner-page.ts` | Rewrite it to derive from the generated types — `components['schemas']['OwnerPageDto']` — same convention as `owner.ts` | Kills the hand-maintained duplicate; the type then drifts with the API automatically. |
| **Q16** | Tests | **TDD, three levels**: backend `@SpringBootTest`+MockMvc (page size, totalElements, the Potter tiebreak, 400 on unknown sort); Karma spec on `owner-list`; **Playwright `owners-pagination.spec.ts`** | e2e is never optional here. The tiebreak case is the one that would silently rot. |
| **Q17** | Seed 100k rows? | **No** | 28 rows exercise 3 pages at size 10. Paging arithmetic belongs in a test fixture, not in the dev seed. |
| **Q18** | Guardrail artifacts to regenerate before commit | `openapi.yaml`, `api-types.ts`, `DB.sql`, `DB.puml` | `OpenApiExtractorTest`, the TS↔OpenAPI sync, `DbSchemaExtractorTest` and the DB.puml pre-push gate all fail on drift; Spectral lints the new endpoint. |
| **Q19** | Count query on every page request? | **Accept it** | An index-only `count(*)` over 100k rows is single-digit ms. Revisit only if the table reaches tens of millions. |
| **Q20** | Deep-offset paging (page 5,000) | **Accept `OFFSET`** | Keyset pagination is faster but cannot do "jump to page N" or `totalPages`, both of which `mat-paginator` needs. Note it as a known ceiling. |

## Open ceiling, deliberately not solved

`Śliwiński` sorts correctly here only because the dev DB is `en_US.UTF-8` (F7). If production runs `C` collation, name sorting silently changes. Worth confirming with ops before go-live.
