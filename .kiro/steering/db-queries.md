---
inclusion: auto
name: db-queries
description: Database query patterns and best practices. Use when writing or reviewing JPQL, SQL, or Spring Data repository queries, or when designing any data access logic.
---

# DB Query Patterns

## Searching Child Collections — Use EXISTS, Not JOIN

When filtering a parent entity based on a condition on its children (one-to-many), always use an `EXISTS` subquery. Never use a `JOIN` for this purpose.

**Why:** A JOIN multiplies the result set rows by the number of matching children. An owner with 100 pets matching the search term produces 100 rows before any deduplication. EXISTS short-circuits on the first match and keeps the result set cardinality equal to the number of matching parents.

**Wrong — JOIN inflates cardinality:**
```java
// BAD: produces duplicate Owner rows when multiple pets match
SELECT DISTINCT owner FROM Owner owner
LEFT JOIN owner.pets pet
WHERE UPPER(pet.name) LIKE UPPER(CONCAT('%', :q, '%'))
```

**Correct — EXISTS preserves cardinality:**
```java
// GOOD: each Owner appears exactly once
SELECT owner FROM Owner owner
WHERE EXISTS (
    SELECT 1 FROM Pet pet
    WHERE pet.owner = owner
      AND UPPER(pet.name) LIKE UPPER(CONCAT('%', :q, '%'))
)
```

This applies to any parent-child relationship: Owner→Pets, Vet→Specialties, Pet→Visits, etc.
