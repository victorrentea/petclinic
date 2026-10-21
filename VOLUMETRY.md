# Volumetry

Data volumes the business expects. Design every list, query and endpoint for these numbers,
not for the few dozen rows in the dev database.

| Entity | Expected | By | Source |
| --- | --- | --- | --- |
| Owners | 50,000 | Oct 2027 | call with the business, 21 Oct 2026 (#25) |

What follows from it:
- No endpoint returns all owners: a grid over owners pages, sorts and filters on the server.
- A query that runs once per owner on a page (N+1) multiplies by the page size, never by 50k —
  and loading all owners to do anything in memory is a bug at this volume.
