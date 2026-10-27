# Volumetry

Expected production data volumes. Design queries, endpoints and UI lists for these numbers,
not for the seed dataset (which has ~26 owners).

| Entity | Expected volume | Horizon | Source |
|--------|-----------------|---------|--------|
| Owners | 100,000 | in one year (by 2027-10) | Bizu, 2026-10-26 |

Consequences:
- Never return all owners in a single response. List endpoints must page on the server.
- Filtering and sorting run in the database, so they need indexes on the filtered and sorted columns.
