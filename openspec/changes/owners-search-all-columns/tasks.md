## 1. De-risk (spikes before building)

- [ ] 1.1 Confirm the embedded test Postgres can `CREATE EXTENSION pg_trgm` (contrib module) — write a throwaway test that creates the extension; if it fails, resolve before proceeding
- [ ] 1.2 On a realistic-volume dataset, run `EXPLAIN` on the OR + `EXISTS` query and confirm the trigram GIN indexes are used; if not, plan the `UNION`-of-per-source-queries fallback

## 2. Database migration

- [ ] 2.1 Add Flyway `V6__owners_search_trgm.sql`: `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- [ ] 2.2 Add the five GIN trigram indexes (owners full-name `lower(first_name || ' ' || last_name)`, address, city, telephone, pets name) exactly matching the query expressions
- [ ] 2.3 Verify the migration applies cleanly on a fresh dev DB and in the test bootstrap

## 3. Backend — repository search (TDD)

- [ ] 3.1 Write failing repository tests: case-insensitive contains hit for each column (name spanning the space, address, city, telephone raw-digit, pet name)
- [ ] 3.2 Write failing tests for empty `q` → first page of all owners, and for the `zzz` no-match → empty page
- [ ] 3.3 Write failing tests for pagination boundaries (default size 20, `page=1`) and `ORDER BY last_name, first_name, id` stability
- [ ] 3.4 Implement `Page<Owner> search(String q, Pageable pageable)` as a native query with matching `countQuery` (use `||` and `lower(...)`, not JPQL `concat()`) to make the tests pass
- [ ] 3.5 If step 1.2 showed the OR/EXISTS plan does not use the indexes, implement the `UNION` fallback instead and re-run the same tests

## 4. Backend — controller & API contract (TDD)

- [ ] 4.1 Write failing controller tests: `q`/`page`/`size` return a paged DTO with `content` + `totalElements`; empty `q` returns page 0 of all
- [ ] 4.2 Write a failing test that legacy `lastName=` still returns starts-with results (deprecated back-compat path)
- [ ] 4.3 Update `OwnerController.listOwners` to accept `q`, `page`, `size`, return the paged DTO, keep `lastName` mapped to the old starts-with, and leave `@PreAuthorize(hasRole(OWNER_ADMIN))` unchanged
- [ ] 4.4 Add/keep a security test asserting a non-`OWNER_ADMIN` caller is forbidden when security is enabled

## 5. Frontend — owner-list search & pagination (TDD)

- [ ] 5.1 Write failing tests: debounce (~300 ms) collapses rapid keystrokes into one request; min-2-char gate suppresses single-char searches; clearing the box loads page 0 of all
- [ ] 5.2 Add `OwnerService.searchOwners(q, page, size)` returning the new paged response shape
- [ ] 5.3 Relabel the box to "Search"; wire `Subject` → `debounceTime(300)` → `distinctUntilChanged` → `filter(len === 0 || len >= 2)`
- [ ] 5.4 Add pagination controls (page/size/total); stop loading the full list on init — load page 0 instead
- [ ] 5.5 Remove the frontend `lastName` usage in favor of `q`

## 6. API spec & guardrails

- [ ] 6.1 Regenerate the OpenAPI spec (generated output) reflecting `q`/`page`/`size`, the paged response, and the deprecated `lastName`
- [ ] 6.2 Run the GUARDRAILS drift checks and the full backend + frontend test suites; fix any drift

## 7. Docs

- [ ] 7.1 Note in the change/docs the documented behaviors: telephone raw-digit matching, whole-`q`-as-one-substring, offset-paging trade-off
