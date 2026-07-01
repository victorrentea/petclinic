# Conclusion — Issue #24: Owners search over all visible columns

Design decisions reached by grilling the issue. This is a spec/plan, not yet implemented.

## Problem

**Today:** one "Last name" box → `GET /api/owners?lastName=X` → `OwnerRepository.findByLastNameStartingWith` — which is **case-sensitive**, **starts-with**, **lastName only**, **no pagination**, and the frontend **loads the entire owner list into memory** on init.

**Issue #24 wants:** case-insensitive **contains** across **all visible columns** of the Owners table.

**Visible columns** (from `owner-list.component.html`): **Name** (`firstName` + `lastName`), **Address**, **City**, **Telephone**, **Pets** (pet names).

## Hard constraint that shaped everything

**~1 million owners** (now recorded in `CLAUDE.md` → "Data Volume / Scale"). Consequences:
- No client-side filtering, no full-list loads (browser or backend).
- Search **must** be filtered in SQL and **paginated**.
- `contains` = `LIKE '%term%'` (leading wildcard) → a plain B-tree can't serve it → naive query is a full scan of 1M rows per search.

## Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Where does filtering run? | **Backend SQL** | Can't ship 1M rows to the browser. (Client-side ruled out by scale.) |
| 2 | How to make `contains` fast at 1M rows? | **pg_trgm GIN indexes** | Only option that keeps true substring/`ILIKE '%term%'` semantics *and* is fast. FTS ruled out (word/prefix-based — "ondo" wouldn't match "London"). |
| 3 | Search the Pets column too? | **Yes** | Issue says "any visible column"; Pets is visible. `EXISTS` sub-select on `pets.name` + trigram index on it. |
| 4 | UI trigger? | **Debounced as-you-type, min 2 chars** | Modern filter-box feel; debounce (~300 ms) + min-length bounds how many 1M-row queries fire. Empty box → first page of all owners. |
| 5 | Pagination model | **Server-side `Pageable`, size 20, offset paging** (`?page=&size=`), response carries `totalElements` | Mandatory at 1M rows. Deep-offset is rare (users refine the query) — accepted trade-off. |
| 6 | API param | **New `q` param**; `lastName` retired from frontend, kept accepted-but-deprecated | Cleaner cross-column contract; preserves back-compat for any external API client. |
| 7 | Columns searched | `first+' '+last`, `address`, `city`, `telephone`, `pets.name` | 1:1 with the visible columns; concatenated name lets "john lond" span the space. |
| 8 | Telephone matching | **Raw-digit substring** | Stored as bare 10 digits; typed formatting (`(555)`) won't match — documented, not normalized. |
| 9 | Multi-term | **Whole string as one substring** (no token-AND) | Matches "contains" literally. Token-AND across columns = future work. |
| 10 | Ordering | `ORDER BY lastName, firstName, id` | Stable, deterministic pagination. |

## Implementation plan

### DB — Flyway migration (`V6__owners_search_trgm.sql`)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_owners_fullname_trgm ON owners USING gin (lower(first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX idx_owners_address_trgm  ON owners USING gin (lower(address) gin_trgm_ops);
CREATE INDEX idx_owners_city_trgm     ON owners USING gin (lower(city) gin_trgm_ops);
CREATE INDEX idx_owners_telephone_trgm ON owners USING gin (telephone gin_trgm_ops);
CREATE INDEX idx_pets_name_trgm       ON pets   USING gin (lower(name) gin_trgm_ops);
```

### Backend
- **Native query** (chosen deliberately) so the SQL expressions match the index expressions **exactly** — Hibernate's JPQL `concat()` compiles to `concat(...)`, which is **not** the same expression as `||`, so a JPQL query would silently **not** use the trigram index:
  ```sql
  SELECT * FROM owners o
  WHERE lower(o.first_name || ' ' || o.last_name) LIKE lower('%' || :q || '%')
     OR lower(o.address)   LIKE lower('%' || :q || '%')
     OR lower(o.city)      LIKE lower('%' || :q || '%')
     OR o.telephone        LIKE '%' || :q || '%'
     OR EXISTS (SELECT 1 FROM pets p WHERE p.owner_id = o.id
                AND lower(p.name) LIKE lower('%' || :q || '%'))
  ORDER BY o.last_name, o.first_name, o.id
  ```
  Exposed as `Page<Owner> search(String q, Pageable pageable)` (native + `countQuery`).
- **Fallback if the OR + EXISTS won't use the indexes:** rewrite as a `UNION` of per-source queries (each source uses its own trigram index), then paginate.
- Controller `listOwners`: accept `q`, `page`, `size`; return a paged DTO (content + `totalElements`). Keep `lastName` (deprecated) mapped to the old starts-with for back-compat. `@PreAuthorize(hasRole(OWNER_ADMIN))` unchanged.

### Frontend (`owner-list`)
- Relabel the box **"Search"**; wire an RxJS `Subject` → `debounceTime(300)` → `distinctUntilChanged` → `filter(len === 0 || len >= 2)`.
- Add pagination controls (page/size/total); stop loading the full list on init — load page 0.
- `OwnerService.searchOwners(q, page, size)` → new paged response shape.

### Tests (TDD)
- **Backend:** case-insensitive `contains` hits for each column incl. pet name; empty `q` → first page of all; pagination boundaries; ordering. Verify the embedded Postgres in tests supports `pg_trgm` (contrib module — **confirm before relying on it**).
- **Frontend:** debounce fires once, min-length gate, pagination, empty-query path.
- Regenerate the OpenAPI spec (it's generated output) and check GUARDRAILS drift tests.

## Risks / open items
1. **`pg_trgm` in the test Postgres** — confirm the embedded instance can `CREATE EXTENSION pg_trgm`; if not, tests need an alternative.
2. **OR + cross-table EXISTS index usage** — validate with `EXPLAIN` on realistic data; UNION fallback ready.
3. **Deep offset pagination** — `OFFSET 999000` is slow; acceptable because search narrows results. Revisit with keyset paging only if deep pages prove real.
4. **Denormalization not chosen** — no precomputed search_blob column, so pet-name changes need no sync; the cost is the runtime `EXISTS` join.
5. **Frontend list currently unpaginated everywhere** — this issue forces pagination into the base list flow, not just search.
