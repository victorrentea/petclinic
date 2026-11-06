# Volumetry

Data volumes the business expects. Design every list, query and endpoint for these numbers, not
for the few dozen rows in the dev database.

| Entity | Expected | By | Source |
| --- | --- | --- | --- |
| Owners | 100,000 | Nov 2027 | the business, 6 Nov 2026 (#25): what they dream of, used as the design target |

What follows from it:

- No endpoint returns all owners: `GET /api/owners` always answers one page.
- Sorting and searching owners happen in the database, each served by an index.
