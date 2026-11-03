# Q&A — #25 Add pagination to Owners grid

Status: **approved** (2026-11-03). Q1–Q9 decided by Victor; Q10–Q22 accepted as recommended.

| # | Question | Approved answer |
|---|---|---|
| 1 | Paging/sorting on server or in browser? | **Server-side** — ~100k new owners/year, see [VOLUMETRY.md](VOLUMETRY.md) |
| 2 | Contract of `GET /api/owners` | **Replace**: always returns a page |
| 3 | Is Pets sortable? | **No** |
| 4 | Name sort order | **`firstName, lastName, id`** (as displayed) |
| 5 | Defaults | **size 10, sorted by Name asc** |
| 6 | Allowed `size` | **Whitelist 5/10/20**, else 400 |
| 7 | Sortable columns | **name, city** (address is free text; telephone has mixed formats) |
| 8 | Diacritics / case | **ICU collation `und-x-icu` on the columns** via migration, plus indexes (today `C.UTF-8` compares bytes, so `Śliwiński` sorts after every `A–Z` name) |
| 9 | Response shape | **Hand-written page DTO** `{content, totalElements, totalPages, number, size}`, matching `owner-page.ts` |
| 10 | `sort` format | `?sort=name,asc` / `?sort=city,desc`; `name` maps to `firstName,lastName,id`; other keys → 400 |
| 11 | Page index base | **0-based** (Spring) |
| 12 | `lastName` filter | Kept, combined with paging; a new search resets to page 0 |
| 13 | Tie-breaker for city | `city, firstName, lastName, id` — stable order across pages |
| 14 | Indexes | `(first_name, last_name, id)`, `(city, first_name, last_name, id)`, `last_name text_pattern_ops` (prefix `LIKE` under ICU) |
| 15 | Loading pets per page | `hibernate.default_batch_fetch_size`; no collection fetch-join (in-memory paging, HHH90003004) |
| 16 | UI | `mat-paginator` `[5,10,20]` + `matSort` on Name and City only |
| 17 | State in URL | `page`, `size`, `sort`, `lastName` as query params (refresh/Back keep the page) |
| 18 | Page beyond the end | Empty `content` with correct totals; UI jumps to the last page |
| 19 | Invalid `size`/`sort` | 400 `ProblemDetail` via `@RestControllerAdvice` |
| 20 | Impacted code | `OwnerTest`, `AddVisitApiTest`, `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`, `owners.feature`/`OwnerSteps`; regenerate `openapi.yaml` + `api-types.ts` via `OpenApiExtractorTest` |
| 21 | Tests | Backend TDD with MockMvc (validation, diacritic sort, paging) + Playwright e2e on the grid |
| 22 | Risk to verify first | ICU in Zonky embedded Postgres on Linux (tests/CI); if absent, revisit Q8 |
