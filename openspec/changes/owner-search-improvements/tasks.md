## Database

- [x] 1.1 Create `V4__owner_search_indexes.sql` Flyway migration: enable `pg_trgm` extension and add GIN indexes on `owners` (first_name, last_name, city, address, telephone) and `pets` (name) — GIN+pg_trgm natively supports `ILIKE`, no expression indexes needed

---

## Backend

- [x] 2.1 Write a failing test in `OwnerRepositoryTest` for a new `search(String q, Pageable pageable)` method — assert it returns a `Page<Owner>`, finds owners by firstName, lastName, city, address, telephone, and pet name (case-insensitive, contains), and returns correct `totalElements`
- [x] 2.2 Add `search(@Param("q") String q, Pageable pageable)` to `OwnerRepository` with a JPQL query using `ILIKE '%' || :q || '%'` for each owner field and `EXISTS (SELECT 1 FROM Pet p WHERE p.owner = o AND p.name ILIKE '%' || :q || '%')` for pet name; return `Page<Owner>`
- [x] 2.3 Handle blank `q` → return all owners (no WHERE clause); test this case
- [x] 2.4 Write a failing test in `OwnerControllerTest` for `GET /api/owners?q=smith&page=0&size=10&sort=name&dir=asc` — assert paginated response envelope (content + totalElements) and `400` for invalid `size`
- [x] 2.5 Update `openapi.yml`: replace `lastName` with `q` (optional string); add `page` (integer, default 0), `size` (integer, default 20), `sort` (string, enum: name/city), `dir` (string, enum: asc/desc); define paginated response schema (content array + totalElements)
- [x] 2.6 Regenerate OpenAPI DTOs (`mvn clean install`) and update `OwnerController`: accept `@RequestParam` for `q`, `page`, `size`, `sort`, `dir`; validate `size ∈ {5, 10, 20}` (return `400` otherwise); build `PageRequest` with sort; call `ownerRepository.search(q, pageable)`

---

## Frontend

- [x] 3.1 Replace the "Last name" input with a single "Search..." input bound to a `searchTerm` field; remove any existing search button
- [x] 3.2 Implement 300ms debounce on `searchTerm` using `debounceTime(300)` + `switchMap` to call `GET /api/owners?q=<term>&page=0&size=<size>&sort=<sort>&dir=<dir>`; `switchMap` cancels in-flight requests on each new emission
- [x] 3.3 Trigger search immediately on Enter key press (bypass debounce)
- [x] 3.4 Add state: `currentPage`, `pageSize` (default 20), `sortField: 'name' | 'city'`, `sortDir: 'asc' | 'desc'`; each change re-fetches page 0
- [x] 3.5 Make "Name" and "City" column headers clickable — toggle `sortDir` on same field, reset to `asc` on field change; clicking triggers server-side re-fetch (not client-side sort)
- [x] 3.6 Display up/down arrow indicator next to the active sort column header
- [x] 3.7 Add pagination controls below the grid: prev/next buttons, current page indicator, page size selector (5/10/20); changing page size resets to page 0
