# Volumetry

Expected production data volumes. Size queries, endpoints and UI lists against these, not against the seed.

| Entity | Growth | Source |
|---|---|---|
| Owner | ~100,000 new / year | Bizu, 2026-11-03 |

Consequence: any list of owners is paged (and sorted, filtered) **server-side**; never return all owners.
