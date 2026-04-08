# Owner List — Sorting & Pagination Design

**Date:** 2026-04-08
**Scope:** Add server-side sorting (Name, City) and pagination (10/20/50 per page) to the owner list.

---

## Context

Production target is 100,000+ owners. The current implementation calls `findAll()` and filters in-memory — this must be eliminated entirely. All filtering, sorting, and pagination must happen at the DB level.

---

## API Contract

```
GET /api/owners?q=smith&page=0&size=10&sort=name,asc
```

**Query params:**
- `q` — optional search term; replaces the old `lastName` param; searches across firstName, lastName, address, city, telephone, pet names
- `page` — 0-based page index (Spring default); default `0`
- `size` — items per page: 10, 20, or 50; default `10`
- `sort` — `name,asc|desc` or `city,asc|desc`. `name` is a logical alias mapped in the controller to `ORDER BY firstName, lastName`.

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
- Name column → `sort=name,asc` or `sort=name,desc`
- City column → `sort=city,asc` or `sort=city,desc`

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
@Query("""
    SELECT o FROM Owner o
    WHERE :q IS NULL OR :q = ''
      OR LOWER(FUNCTION('unaccent', o.firstName)) LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.lastName))  LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.city))       LIKE LOWER(FUNCTION('unaccent', :q))
      OR LOWER(FUNCTION('unaccent', o.address))    LIKE LOWER(FUNCTION('unaccent', :q))
      OR o.telephone                               LIKE :q
      OR EXISTS (
            SELECT 1 FROM Pet p
            WHERE p.owner = o
            AND LOWER(FUNCTION('unaccent', p.name)) LIKE LOWER(FUNCTION('unaccent', :q))
         )
    """)
Page<Owner> findByQuery(@Param("q") String q, Pageable pageable);
```

- Correlated `EXISTS` subquery for pet name search — preserves row cardinality, no JOIN, no DISTINCT
- No explicit `countQuery` needed — Spring Data auto-derives it correctly because there's no DISTINCT
- Pets are still loaded lazily via `@BatchSize(size=10)` after the page is fetched
- Caller passes `q` pre-wrapped with `%` wildcards: `"%" + term + "%"`. Normalization happens in the DB.

### Page size cap (DoS protection)

A `PageableHandlerMethodArgumentResolverCustomizer` bean caps `size` at 50 framework-wide:

```java
@Bean
public PageableHandlerMethodArgumentResolverCustomizer pageableCustomizer() {
    return resolver -> resolver.setMaxPageSize(50);
}
```

Any request with `size` above 50 is silently clamped by Spring before reaching the controller. Prevents a malicious `size=3000000` request from loading millions of rows into memory.

### Controller

`listOwners` signature changes to:
```java
public Page<OwnerDto> listOwners(
    @RequestParam(required = false) String q,
    Pageable pageable)
```

The controller maps the logical `sort=name` to entity fields before calling the repository:
```java
// sort=name,asc → Sort.by("firstName").ascending().and(Sort.by("lastName").ascending())
```

`sort=city` passes through unchanged. Returns `Page<OwnerDto>` (Spring serializes this automatically).

### Indexes

Added to `Owner` entity via `@Table(indexes = {...})`:

```java
@Table(name = "owners", indexes = {
    @Index(name = "idx_owner_name", columnList = "first_name, last_name"),
    @Index(name = "idx_owner_city", columnList = "city")
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

---

## Testing

All features are covered by tests written before implementation (TDD).

### Backend — `OwnerRestControllerTest` (`@SpringBootTest` or `@WebMvcTest`)

- **Pagination:** page 0 vs page 1 return different owners; `totalElements` and `totalPages` are correct
- **Page size:** requesting `size=10` returns at most 10 owners
- **Page size cap:** requesting `size=3000000` is clamped to 50 — response contains at most 50 owners
- **Sort by name asc/desc:** first owner on page 0 changes correctly when direction is flipped
- **Sort by city asc/desc:** same as above for city
- **Search `q` — plain match:** filtering by a known last name returns only matching owners
- **Search `q` — diacritics:** searching `"Müller"` matches an owner stored as `"Muller"` and vice versa
- **Search `q` — pet name:** searching a pet's name returns the owner of that pet
- **Search `q` — no match:** returns empty `content` with `totalElements=0`
- **Search + pagination combined:** correct `totalElements` reflects filtered set, not full table

### Backend — `OwnerRepositoryTest` (`@DataJpaTest`)

- EXISTS subquery does not duplicate owners that have multiple pets matching the query
- `findByQuery` with null/blank `q` returns all owners (paginated)

### Frontend — `OwnerListComponent` (Jest/Karma unit tests)

- Clicking "Name" header sends `sort=name,asc`; clicking again sends `sort=name,desc`
- Changing page size resets to page 0
- Changing search term resets to page 0
- Paginator prev/next buttons emit correct page numbers
