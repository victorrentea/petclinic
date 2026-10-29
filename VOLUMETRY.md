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

## Measured: the Owners grid at 50,000 owners

21 Oct 2026, embedded Postgres 16.2 on a MacBook, schema from `db/migration` (V4 = Romanian
collation + the grid's indexes), 50,000 owners (5,000 last names, 1,000 cities), 75,000 pets,
150,000 visits. Median of 5 `EXPLAIN ANALYZE` runs of the SQL Hibernate sends, 20 rows a page.

| Query | Time | Plan |
| --- | --- | --- |
| First page by name, asc or desc | 0.03 ms | index `owners_by_name` (backward for desc) |
| First page by city, asc | 0.03 ms | index `owners_by_city` |
| First page by city, desc (name still asc) | 0.08 ms | `owners_by_city` backward + incremental sort |
| Last page by name (offset 49,980) | 14.5 ms | `owners_by_name`, walks the offset |
| Count, no search | 5.0 ms | seq scan — counting every row reads every row |
| Search page / count, prefix of 20 owners | 0.03 ms | index `owners_last_name_prefix` |
| Same, with the generic plan JDBC switches to after 5 runs | 5.9 / 4.4 ms | `owners_by_name` filtered / seq scan |
| The page's pets, then their visits | 0.06 / 0.08 ms | `pets_owner_id_idx`, `visits_pet_id_idx` |

Worst case is the last page: offset paging costs grow with the page number, linearly. At ten
times this volume, switch to keyset paging ("after this name") before adding hardware.
