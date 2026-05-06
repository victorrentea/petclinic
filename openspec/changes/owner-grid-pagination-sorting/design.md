## Context

The owner list currently uses `GET /api/owners?q=` (optional search term) returning a flat `List<OwnerDto>`. The frontend loads everything into memory. With 100k+ owners this is unusable. We need DB-level pagination and sorting, with state reflected in the URL.

## Goals / Non-Goals

**Goals:**
- Add `page`, `size`, `sort`, `direction` params to backend `GET /api/owners`
- Return `Page<OwnerSummary>` (total count + content slice)
- Frontend pagination controls: page sizes [5, 10, 25], butoane First/Prev + fereastră glisantă de 5 numere (p-2, p-1, p, p+1, p+2) + Next/Last
- Sort by full name (as displayed: `firstName + ' ' + lastName`) and city, toggling ASC/DESC
- Sync all state to URL query params; reset page to 0 on search change
- "Records X-Y of Z" info line

**Non-Goals:**
- Server-side search is out of scope for this change (search stays as-is)
- Export / bulk operations
- Column reordering

## Decisions

### D1: Sort by full name in DB
Sort expression `CONCAT(first_name, ' ', last_name)` in JPQL / Spring Data `Sort`. Alternative: sort separately by lastName then firstName — rejected because the UI shows and the user reads "George Franklin", so alphabetical order must match display order.

### D2: Spring Data `Pageable` + `Page<T>` response
Use `Pageable` in repository and return `Page<OwnerSummary>`. Response body: `{ content: [...], totalElements, totalPages, number, size }`. Matches Spring Boot conventions and avoids a custom DTO.

### D3: Zero-based page index on backend, 1-based display on frontend
Spring Data uses 0-based pages. Frontend adds 1 for display. URL stores 0-based value to avoid conversion confusion.

### D4: URL query params via Angular Router
Use `ActivatedRoute.queryParams` / `Router.navigate({queryParams})` to persist and share state. On `queryParams` change, fire the API call (with `switchMap` to cancel stale requests — race condition fix). On search input change, reset `page` to `0`.

### D5: Pagination button set
Show: `[First] [Prev] [p-2] [p-1] [current] [p+1] [p+2] [Next] [Last]` — o fereastră glisantă de 5 numere centrată pe pagina curentă, clampată la margini. Disable First/Prev la pagina 0, Next/Last la ultima pagină.

## Risks / Trade-offs

- [CONCAT sort performance] → Mitigat prin index compus pe `(first_name, last_name)` și index pe `city`; adăugate prin migrare DB (task 2.1, 2.2)
- [URL length] → Params are short strings; no concern
- [Angular Router replaceUrl vs pushUrl] → Use `replaceUrl: true` for search/sort changes so Back button is not polluted; use default for page navigation
