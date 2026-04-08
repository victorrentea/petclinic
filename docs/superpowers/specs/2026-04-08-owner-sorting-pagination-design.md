# Owner List — Sorting & Pagination Design

**Date:** 2026-04-08
**Scope:** Add server-side sorting (Name, City) and pagination (10/20/50 per page) to the owner list.

---

## Context

Production target is 100,000+ owners. The current implementation calls `findAll()` and filters in-memory — this must be eliminated entirely. All filtering, sorting, and pagination must happen at the DB level.

---

## API Contract

```
GET /api/owners?q=smith&page=0&size=10&sort=lastName,asc&sort=firstName,asc
```

**Query params:**
- `q` — optional search term; replaces the old `lastName` param; searches across firstName, lastName, address, city, telephone, pet names
- `page` — 0-based page index (Spring default); default `0`
- `size` — items per page: 10, 20, or 50; default `10`
- `sort` — Spring standard format e.g. `lastName,asc`; two `sort` params for the Name column

**Response body** — Spring's standard `Page<OwnerDto>`:
```json
{
  "content": [ ...owners... ],
  "totalElements": 142,
  "totalPages": 15,
  "number": 0,
  "size": 10
}
```

**Sort mappings (frontend → API):**
- Name column → `sort=lastName,asc&sort=firstName,asc` (direction applied to both)
- City column → `sort=city,asc`

Default sort on first load: Name ascending.

---

## Backend

### Diacritics

Diacritic-insensitive search moves from Java (`Normalizer`) to the DB:

- **PostgreSQL (prod):** enable `unaccent` extension; use `unaccent(lower(field)) LIKE unaccent(lower(:q))`
- **H2 (dev/test):** register a `CREATE ALIAS UNACCENT` in the H2 init script pointing to the same Java `Normalizer` logic

Both DBs expose a function named `unaccent`. The JPQL query uses `FUNCTION('unaccent', ...)`.

### Repository

`OwnerRepository` extends `JpaRepository<Owner, Integer>` and adds:

```java
@Query(
  value = """
    SELECT DISTINCT o FROM Owner o LEFT JOIN o.pets p
    WHERE :q IS NULL OR :q = ''
      OR LOWER(FUNCTION('unaccent', o.firstName)) LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.lastName))  LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.city))       LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.address))    LIKE LOWER(FUNCTION('unaccent', :q))
      OR o.telephone                               LIKE :q
      OR LOWER(FUNCTION('unaccent', p.name))       LIKE LOWER(FUNCTION('unaccent', :q))
    """,
  countQuery = """
    SELECT COUNT(DISTINCT o) FROM Owner o LEFT JOIN o.pets p
    WHERE :q IS NULL OR :q = ''
      OR LOWER(FUNCTION('unaccent', o.firstName)) LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.lastName))  LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.city))       LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.address))    LIKE LOWER(FUNCTION('unaccent', :q))
      OR o.telephone                               LIKE :q
      OR LOWER(FUNCTION('unaccent', p.name))       LIKE LOWER(FUNCTION('unaccent', :q))
    """
)
Page<Owner> findByQuery(@Param("q") String q, Pageable pageable);
```

- `LEFT JOIN o.pets p` is for filtering only; pets are still loaded lazily via `@BatchSize(size=10)`
- `DISTINCT` prevents duplicates when an owner has multiple pets matching the query
- Separate `countQuery` required — Spring cannot auto-derive count from DISTINCT + JOIN
- Caller passes `q` pre-wrapped with `%` wildcards: `"%" + term + "%"`. Normalization happens in the DB.

### Controller

`listOwners` signature changes to:
```java
public Page<OwnerDto> listOwners(
    @RequestParam(required = false) String q,
    Pageable pageable)
```

Returns `Page<OwnerDto>` (Spring serializes this automatically).

### Indexes

Added to `Owner` entity via `@Table(indexes = {...})`:

```java
@Table(name = "owners", indexes = {
    @Index(name = "idx_owner_lastname_firstname", columnList = "last_name, first_name"),
    @Index(name = "idx_owner_city",               columnList = "city")
})
```

These cover ORDER BY on the two sortable columns. Hibernate generates DDL at startup.

**Known limitation:** diacritic-insensitive LIKE (`unaccent(lower(col)) LIKE :q`) requires a PostgreSQL functional index which JPA annotations cannot express. With `LIMIT 10/20/50` and contains-style `%q%` LIKE (which can't use B-tree indexes anyway), this is acceptable for now. A `schema-extras.sql` approach can add functional indexes as a follow-up.

---

## Frontend

### `OwnerService`

`getOwners()` and `searchOwners()` are merged into one:

```typescript
getOwners(params: {
  q?: string,
  page: number,
  size: number,
  sort: string,
  order: 'asc' | 'desc'
}): Observable<OwnerPage>
```

New interface:
```typescript
interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
```

### `owner-list.component`

- "Name" and "City" column headers are clickable; show asc/desc arrow indicator
- Default sort: Name ascending on first load
- Clicking a sorted column toggles asc ↔ desc
- Page size selector: 10 / 20 / 50 (dropdown or button group)
- Paginator: prev/next + page numbers
- Any change to `q`, sort column, sort direction, or page size resets to page 0
- Page navigation does not reset sort or search
- All state changes trigger one new API call via reactive stream (debounce on search input, immediate on sort/page changes)
