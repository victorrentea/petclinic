# Volumes & non-functional requirements

## Data volumes
- **Owners:** ~50,000 in production within a year, each with their pets (business target,
  confirmed 2026-10-23). The 26 seeded owners are not representative.

Consequence: any listing of owners (and by extension pets/visits) is paged and sorted
**server-side**; never fetch all rows to page or sort them in the browser.

## Owners grid at 50,000 owners — measured 2026-10-23 (issue #25)
50,000 generated owners (accented and duplicate names; `CREATE TABLE … (LIKE public.owners
INCLUDING ALL)`, so the same ICU collations and indexes as migration V4) on the dev Postgres 16.2,
`EXPLAIN ANALYZE` of the SQL Hibernate sends — which always filters `last_name LIKE ?`, `'%'`
when unfiltered. Warm cache; first (cold) run in brackets. Each page is the page query + a count.

| Query                                   | Plan                                             | Time            |
|-----------------------------------------|--------------------------------------------------|-----------------|
| Default page (Name ↑, `LIMIT 20`)       | Index Scan `owners_name_sort_idx`                | 0.1 ms          |
| Count, unfiltered                       | Seq Scan                                         | 6.5 ms (16 ms)  |
| Page filtered `lastName=Dav`            | Index Scan `owners_name_sort_idx` + filter       | 0.1 ms          |
| Count filtered `lastName=Dav`           | Bitmap Index Scan `owners_last_name_like_idx`    | 2.3 ms          |
| Last page (`OFFSET 49980`)              | Index Scan `owners_name_sort_idx`, 50k rows read | 22 ms (32 ms)   |
| City ↓ page                             | Seq Scan + top-N heapsort                        | 10.4 ms (28 ms) |

No index on `city` (Q13): a City-sorted page costs ~17 ms in the database, far under the
p95 ≤ 200 ms the latency-proxy perf test holds the endpoint to. Revisit when business sets
a latency target.
