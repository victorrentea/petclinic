# Q&A — Issue #25 (Owners grid pagination + sorting)

| # | Question | My recommendation | Decision |
|---|---|---|---|
| 1 | Pagination location: server-side or client-side? | Server-side (scales correctly) | **Server-side** — user expects ~10k owners within a year |
| 2 | Response envelope for `GET /api/owners`? | Custom slim DTO (`{content, totalElements, page, size}`) to keep OpenAPI contract clean | **Spring's `Page<OwnerDto>`** returned directly |
| 3 | Which columns should be sortable? | All 5 scalar columns (firstName, lastName, address, city, telephone) | **Name (lastName+firstName) and City only** |
| 4 | "Name" column sort key: lastName-first or firstName-first? | lastName primary, firstName tiebreak (matches existing "search by last name" behavior) | **lastName primary, firstName tiebreak** |
| 5 | Should the Name column display order change? | (raised as a consequence of #4) | **Yes — swap display to "LastName FirstName"** to match sort key, for UX clarity |
| 6 | Default page size on first load? | 5 (smallest option) | **10** |
| 7 | Default sort when no sort param given? | lastName asc, firstName asc | *(fast-forwarded, not explicitly confirmed by user)* |
| 8 | Should the backend validate/whitelist sortable properties? | Yes — reject anything outside {lastName, city} with 400 | *(fast-forwarded, not explicitly confirmed by user)* |
| 9 | Should the backend validate page size? | Yes — only accept size ∈ {5, 10, 20}, reject others with 400 | *(fast-forwarded, not explicitly confirmed by user)* |
| 10 | Keep existing `lastName` search filter on the same endpoint? | Yes — combine with pagination/sorting on one endpoint | *(fast-forwarded, not explicitly confirmed by user)* |
| 11 | How to handle the null `telephone` value found in the data (owner id 1)? | N/A once telephone was excluded from sortable columns (#3) | Not applicable — non-issue |

## Notes from data inspection (via direct DB query, no MCP)
- `owners` table: 28 rows today, columns `id, first_name, last_name, address, city, telephone` — all plain scalar `text`, no compound/JSON fields.
- One row (id 1, Kevin McCallister) has `telephone = NULL`.
- Sample data is literary/movie character names (Harry Potter, Sherlock Holmes, etc.), all in different cities — good spread for testing sort/pagination.

## Side items raised during the interview
- User asked to record the ~10k-owners-in-a-year scale expectation in `AGENTS.md` — captured in the full plan (`issue-25-pagination-plan.md`, step 0) but **not yet written to AGENTS.md** (no implementation done per this request).

Full implementation plan: see `issue-25-pagination-plan.md` in this same session folder.
