## Context

Today the Owners screen has one "Last name" box → `GET /api/owners?lastName=X` →
`OwnerRepository.findByLastNameStartingWith`, which is case-sensitive, starts-with, lastName-only, and
unpaginated; the frontend loads the **entire** owner list into memory on init. Issue #24 wants
case-insensitive **contains** across every **visible** column of the Owners table: Name
(`firstName + lastName`), Address, City, Telephone, and Pets (pet names).
















The dominating constraint is scale: the owners table holds **~1 million rows** (`CLAUDE.md` → Data
Volume / Scale). That rules out client-side filtering and full-list loads, forces SQL filtering with
pagination, and makes `contains` (`LIKE '%term%'`, leading wildcard) expensive — a plain B-tree cannot
serve a leading wildcard, so a naive query scans all 1M rows per keystroke.

## Goals / Non-Goals

**Goals:**
- Case-insensitive substring search across all five visible columns via a single `q` parameter.
- Stay fast at 1M rows using `pg_trgm` GIN indexes with expressions that exactly match the query.
- Server-side pagination (`page`/`size`, default size 20) with `totalElements` in the response.
- Debounced, min-2-char, as-you-type UX; empty box → first page of all owners.
- Preserve API back-compat: `lastName` accepted-but-deprecated.

**Non-Goals:**
- Multi-term / token-AND search (whole `q` is one substring). Future work.
- Telephone normalization (formatted input like `(608)` is not massaged to digits).
- Keyset/seek pagination — offset paging is accepted; deep offsets are rare because search narrows.
- A denormalized `search_blob` column — the runtime `EXISTS` join on pets is preferred to avoid sync.
- Fuzzy/similarity ranking — trigram is used only as an index for exact substring, not for scoring.

## Decisions

| # | Question | Decision | Rationale / Alternatives |
|---|----------|----------|--------------------------|
| 1 | Where does filtering run? | **Backend SQL** | Cannot ship 1M rows to the browser; client-side filtering ruled out by scale. |
| 2 | Fast `contains` at 1M rows? | **pg_trgm GIN indexes** | Only option keeping true `ILIKE '%term%'` semantics *and* speed. FTS rejected — word/prefix-based, so "ondo" would not match "London". |
| 3 | Search the Pets column? | **Yes**, `EXISTS` sub-select on `pets.name` + trigram index | Issue says "any visible column"; Pets is visible. |
| 4 | UI trigger | **Debounced as-you-type, min 2 chars, ~300 ms** | Modern filter feel; debounce + min-length bound how many 1M-row queries fire. Empty box → page 0 of all. |
| 5 | Pagination model | **Server-side `Pageable`, size 20, offset paging**, response carries `totalElements` | Mandatory at 1M rows. Deep-offset slowness accepted (users refine query). |
| 6 | API param | **New `q`**; `lastName` retired from frontend, kept accepted-but-deprecated | Cleaner cross-column contract; preserves back-compat for external clients. |
| 7 | Columns searched | `first + ' ' + last`, `address`, `city`, `telephone`, `pets.name` | 1:1 with visible columns; concatenated name lets "john lond" span the space. |
| 8 | Telephone matching | **Raw-digit substring** | Stored as bare digits; typed formatting won't match — documented, not normalized. |
| 9 | Multi-term | **Whole string as one substring** | Matches "contains" literally; token-AND is future work. |
| 10 | Ordering | `ORDER BY last_name, first_name, id` | Stable, deterministic pagination. |
| 11 | Query flavor | **Native SQL, not JPQL** | JPQL `concat()` compiles to `concat(...)`, a different expression than the indexed `||` → JPQL would silently skip the trigram index. |

### DB — Flyway migration `V6__owners_search_trgm.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_owners_fullname_trgm  ON owners USING gin (lower(first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX idx_owners_address_trgm   ON owners USING gin (lower(address) gin_trgm_ops);
CREATE INDEX idx_owners_city_trgm      ON owners USING gin (lower(city) gin_trgm_ops);
CREATE INDEX idx_owners_telephone_trgm ON owners USING gin (telephone gin_trgm_ops);
CREATE INDEX idx_pets_name_trgm        ON pets   USING gin (lower(name) gin_trgm_ops);
```

### Backend — native paged search

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

Exposed as `Page<Owner> search(String q, Pageable pageable)` — native query with a matching
`countQuery`. `OwnerController.listOwners` accepts `q`, `page`, `size` and returns a paged DTO
(content + `totalElements`); `lastName` (deprecated) stays mapped to the old starts-with.
`@PreAuthorize(hasRole(OWNER_ADMIN))` unchanged.

### Frontend — `owner-list`

- Relabel box to **"Search"**; wire an RxJS `Subject` → `debounceTime(300)` → `distinctUntilChanged`
  → `filter(len === 0 || len >= 2)`.
- Add pagination controls (page/size/total); stop loading the full list on init — load page 0.
- `OwnerService.searchOwners(q, page, size)` → new paged response shape.

## Risks / Trade-offs

- **`pg_trgm` in the test Postgres** → Confirm the embedded instance can `CREATE EXTENSION pg_trgm`
  (it is a contrib module) before relying on it; if unavailable, tests need an alternative path.
- **OR + cross-table `EXISTS` may not use every index** → Validate with `EXPLAIN` on realistic data.
  **Fallback:** rewrite as a `UNION` of per-source queries (each source uses its own trigram index),
  then paginate.
- **Deep offset pagination** (`OFFSET 999000`) is slow → Accepted because search narrows results;
  revisit with keyset paging only if deep pages prove real.
- **No denormalized search column** → Pet-name changes need no sync; the cost is the runtime `EXISTS`
  join at query time.
- **Pagination forced into the base list flow** → This issue makes the whole owners list paginated,
  not just search; the unpaginated full-list load is removed everywhere.
- **Telephone formatting mismatch** → Typed `(608)` won't match stored `608...`; documented behavior,
  not a bug.

## Migration Plan

1. Ship Flyway `V6__owners_search_trgm.sql` (extension + 5 GIN indexes). Idempotent via
   `CREATE EXTENSION IF NOT EXISTS`; index builds run on the existing table.
2. Deploy backend with `q`/`page`/`size` and the deprecated `lastName` mapping — old clients keep
   working through the compatibility path (no forced client migration).
3. Deploy frontend switched to `q` + pagination.
4. Regenerate the OpenAPI spec (generated output) and re-run GUARDRAILS drift checks.
5. **Rollback:** revert backend/frontend; the indexes are harmless to leave in place, or drop them in a
   follow-up migration if reverting the DB.

## Open Questions

- Does the embedded test Postgres actually permit `CREATE EXTENSION pg_trgm`? (Blocking for TDD;
  confirm first.)
- Does `EXPLAIN` confirm the OR + `EXISTS` plan uses the trigram indexes, or is the `UNION` fallback
  required?
- Is offset paging acceptable long-term, or should keyset paging be scheduled once real usage of deep
  pages is observed?
