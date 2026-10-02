# Issue #25 — Paginate & sort the Owners grid: design Q&A

Q1–Q4 and the updated Q11 were answered by Victor. The other answers from Q5 onward are **recommended answers adopted by assumption**: challenge any of them before implementation.

## Facts gathered

- **Issue comment is stale.** A 2026-07-03 comment claims server-side paging was implemented. Nothing of it is on `main`: no `Pageable`, `listOwners` returns `List<OwnerDto>`, and the UI is a plain `<table>`.
- **Live DB** (via db-cli):
  - 26 owners, 24 distinct last names (Potter ×2, Darling ×2), 20 cities (London ×6), 33 pets, at most 2 per owner.
  - Collation is `en_US.UTF-8`, so `Śliwiński` sorts between `Silver` and `Tremaine`, as a human expects.
  - The only index on `owners` is the PK. There are no indexes on `last_name` or `city`.
  - Phones come in mixed formats (`+44…`, `(0044)…`, `0146…`).
- **Deployment diagram** (XML decoded from `Deployment.drawio.png`):
  - Containers: Frontend → Backend → DB, and Backend → NotificationService.
  - **Frontend is the only drawn consumer of the backend.**
  - The diagram leaves out `petclinic-chatbot`, which calls the backend over MCP and `GET /api/owners/{id}`. That's diagram drift the guardrail can't catch, because no traced scenario exercises the chatbot.
  - The chatbot doesn't call the list endpoint, so this contract change doesn't affect it.
- **Volumetry:** about 100k owners expected within a year.

## Decisions

### Q1. Where do paging and sorting happen?
**Server-side.** At 100k owners, today's `GET /api/owners` with no filter returns every owner with their pets and visits.

### Q2. API contract shape?
**Change the existing contract (breaking).** `GET /api/owners?lastName=&page=&size=&sort=` returns `OwnerPageDto { content: OwnerDto[], totalElements: long }`, our own record rather than Spring's `PageImpl`. There's no parallel endpoint. Update every consumer in the same change: `OwnerTest`, `OwnerSteps` + `owners.feature`, `AddVisitApiTest`, `OwnerSearchThroughLatencyProxyTest`, `BasicAuthenticationConfigTest`, the JMeter plan, `openapi.yaml`, the generated `api-types.ts`, and the Playwright/Cucumber e2e tests.

### Q3. Which columns are sortable?
**Name and City only.**
- Name sorts by `lastName, firstName, id`.
- City sorts by `city, lastName, firstName, id`.
- Address (starts with house numbers), Telephone (mixed formats) and Pets (a nested list) aren't sortable.

Tell Bizu and update the issue: "any column" is narrowed.

### Q4. How does the client pass the sort?
**Business keys from a whitelist:** `sort=name|city,asc|desc`. The backend maps each key to its full ORDER BY chain. An unknown key or direction returns **400**. Entity property names never appear in the API.

### Q5. Defaults and limits? *(assumed)*
- `page` defaults to 0 (0-based on the wire, shown as 1-based in the UI).
- `size` defaults to 10 and **must be one of 5, 10, 20**; anything else returns 400.
- `sort` defaults to `name,asc`.
- A `page` past the end returns 200 with empty `content` and the real `totalElements`.

### Q6. How are pets loaded for a page? *(assumed)*
Run two queries:
1. Select the page of owners with ORDER BY + LIMIT/OFFSET, plus the count query.
2. Fetch the pets and visits for those IDs only.

Never use `JOIN FETCH` together with pagination. Hibernate would then page in memory (HHH90003004) and pull all 100k rows. Assert the statement count in a test.

### Q7. Which indexes? *(assumed, checked against the real schema)*
Add a new versioned migration `V4__owner_list_indexes.sql` that creates:
- `owners (last_name text_pattern_ops)` for the `LIKE 'prefix%'` filter. Under `en_US.UTF-8`, a plain btree can't serve `LIKE`.
- `owners (last_name, first_name, id)` for sorting by name.
- `owners (city, last_name, first_name, id)` for sorting by city.

Before merging, verify with `EXPLAIN` on 100k generated rows.

### Q8. Is `totalElements` worth a `COUNT(*)` per request? *(assumed)*
Yes. At 100k rows with the prefix index it's cheap, and the paginator needs it to show "1–10 of N". Revisit only if the latency proxy test complains.

### Q9. Search interaction? *(assumed)*
- Last-name filter semantics stay unchanged: prefix match, case-sensitive as today. Changing that is out of scope.
- A new search, a page-size change, or a sort change resets to page 0.
- The current sort is kept across searches.
- Only the latest request may answer: keep the existing `unsubscribe` guard.

### Q10. Frontend widgets? *(assumed)*
- Use Angular Material `MatPaginator` (`pageSizeOptions=[5,10,20]`) and `MatSort` with `mat-sort-header` on Name and City only. Material is already a dependency.
- Keep the Bootstrap table styling.
- Add the paginator to `design-system/` only if a second grid needs it.

### Q11. Should page and sort live in the URL (deep link / back button)?
**Yes, confirmed by Victor on 2026-10-02**, superseding the original out-of-scope assumption.
Keep `page`, `size`, `sort`, and the submitted `lastName` prefix in the URL. Refresh,
shared links, and Back/Forward restore the same view. Invalid or repeated settings
reset all settings to defaults with a visible explanation and replace the invalid URL.

### Q12. Empty state? *(assumed)*
Show "No owners with last name starting with …" when `totalElements == 0`, and hide the paginator.

### Q13. How do we test it (TDD)? *(assumed)*
- **Backend MockMvc, written first:**
  - The defaults apply.
  - A size of 7 returns 400, and an unknown sort key returns 400.
  - Name sort breaks ties on `id` (Potter ×2).
  - City desc gives a stable order.
  - Filter + page gives the right `totalElements`.
  - A page past the end returns empty `content`.
  - Statement count stays bounded (no N+1).
- **Frontend spec:** the service builds the query params, and a page, sort or search event triggers exactly one request.
- **E2E:** update `owner-search.feature`, which regenerates the trace-derived diagrams that `DeploymentDiagramTest` reads.

### Q14. Rollout? *(assumed)*
The contract is breaking, so the frontend and backend ship in **one PR and one deploy**. The chatbot isn't affected.

### Q15. Housekeeping? *(assumed)*
- Comment on #25 that the earlier "implemented" claim never reached `main`, and record the narrowed sortable columns.
- Add `petclinic-chatbot` to `Deployment.drawio.png` in a separate change.
- Update `AGENTS.md` if anything drifts.
