# Issue #25 — Add pagination to Owners grid: design Q&A

Decisions from the grill-me session on [issue #25](https://github.com/victorrentea/petclinic/issues/25)
("sortable by any column", "paginated in pages of 5, 10, or 20 rows").
Q1, Q3–Q5 are **decided**; Q2 was folded into Q3; Q6–Q25 are **recommendations** awaiting review.

| # | Question | Recommended answer | Why |
|---|---|---|---|
| **Decided** | | | |
| Q1 | Page and sort in the browser or on the server? | **On the server** | 100k owners expected ([VOLUMETRY.md](VOLUMETRY.md)) |
| Q3 | Which columns get a sort header? | **Name, City** | Address and Telephone formats are mixed in the live data; Pets is a list |
| Q4 | How do names with diacritics sort correctly? | **Set the column collation to `und-x-icu`** | `C.UTF-8` puts `Śliwiński` after every A–Z name |
| Q5 | Change the endpoint's response? | **Yes, breaking change** | Only the Frontend calls it, and it's in the same repo |
| **API** | | | |
| Q6 | What does the response look like? | Hand-written `OwnerPageDto {content, totalElements, totalPages, number, size}`, never Spring's `Page` | House rule: DTOs are hand-written. Spring warns that the JSON shape of `PageImpl` isn't stable. The fields match the existing [owner-page.ts](petclinic-frontend/src/app/owners/owner-page.ts) |
| Q7 | Query parameters? | `?lastName=&page=0&size=10&sort=name,asc` | Follows Spring's naming conventions |
| Q8 | Which `sort` values are accepted? | Only `name` and `city`, with `asc`/`desc`; anything else → **400** | Stops anyone sorting by an unindexed column, or by `pets.visits.description` |
| Q9 | Which page sizes are accepted? | Only **5, 10, 20**, otherwise **400**; default **10** | As the issue says, and nobody can request `size=100000` |
| Q10 | How is "sort by Name" defined? | `last_name, first_name, id` | The column shows both names, and the `id` tie-breaker stops rows repeating or vanishing between pages (the two Potters, the two Darlings) |
| Q11 | Default sort when none is given? | `name,asc` | A page without an order has no reliable content |
| **Database / performance** | | | |
| Q12 | What does the migration contain? | A new `V…__owners_sort_collation.sql`: `COLLATE "und-x-icu"` on `first_name`, `last_name`, `city`, plus indexes | Schema only, no rows, per the rule for `db/migration/` |
| Q13 | Which indexes? | `(last_name, first_name, id)`, `(city, id)`, and `last_name text_pattern_ops` for the `LIKE 'Pot%'` search | The search can't use the ICU indexes |
| Q14 | How are pets loaded? | Global `hibernate.default_batch_fetch_size=20` (design D6, refining the original `@BatchSize` on `Owner.pets`), never `JOIN FETCH` together with `Pageable` | `JOIN FETCH` plus paging makes Hibernate load everything and page in memory (HHH90003004). `Owner.pets` and `Pet.visits` are both LAZY, so a page of 20 would otherwise run dozens of extra queries; batching keeps it at ~4 |
| Q15 | Trim the list payload (pets come with all their visits)? | **No**, keep `OwnerDto` | Out of scope for #25. 20 owners per page is a small payload. Could be its own issue |
| Q16 | Does the search become case-insensitive? | **No** | Today's behaviour stays the same; separate issue if wanted |
| **Frontend** | | | |
| Q17 | Which widgets? | `mat-paginator` (`[5,10,20]`) and `matSort` on the existing `<table>`, with sort headers only on Name and City | Angular Material is already a dependency; `MatPaginator` and `MatSort` aren't used anywhere yet |
| Q18 | Add them to `design-system/`? | **No**, not for a single use | Wrap them when a second grid needs paging |
| Q19 | Keep page and sort in the URL (`?page=2&sort=city,desc`)? | **Yes** | Back from an owner's detail page and refresh both return you to the same page |
| Q20 | When does it go back to page 0? | On a new search, a sort change, or a page-size change | Otherwise you can land on page 7 of a 1-page result |
| Q21 | Empty-results message? | Shown when `totalElements === 0`, not on `owners == null` | Today an HTTP error displays "No owners…" |
| **Tests and delivery** | | | |
| Q22 | Test approach? | TDD on the backend: MockMvc for paging, sort, the 400 cases, and diacritics order (`Śliwiński` between `Silver` and `Wensleydale`) | The collation is the riskiest part |
| Q23 | Existing tests that break? | Update `OwnerTest`, `AddVisitApiTest`, `OwnerSearchThroughLatencyProxyTest`, `owners.feature`, and Playwright `owner-search.feature`; `openapi.yaml` regenerates via `OpenApiExtractorTest` | They read an array today |
| Q24 | Does ICU work in CI? | **Check it on the first CI run** | The embedded Postgres on macOS (16.2) has ICU. The Linux binaries used in CI may not, and the migration would fail there |
| Q25 | Add the missing AI agents → Backend `/mcp` arrow to the deployment diagram? | **Yes, as a separate commit on `main`** | It's drift, unrelated to #25 (`.mcp.json` → `petclinic-mcp`). The tooling rule says such changes go to `main` first |
