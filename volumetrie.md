# Volumetrie

Target data volumes agreed with the business. Design decisions (pagination, indexing,
caching, export) must hold at these numbers, not at the seeded sample size.

| Entity | Today (seed) | Target | Agreed on | Source |
|---|---|---|---|---|
| Owners | ~24 rows | **100.000 within one year** | 2026-09-02 | call with the business |

Consequences already taken:
- **Owners grid is paginated and sorted server-side** (issue #25). Fetching the whole
  owners table into the browser is off the table at 100k rows.
