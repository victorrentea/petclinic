# Volume check: 100,000 owners (task 4.4)

The check ran on a temp table with the same columns, collation and indexes as `V4`, filled from
`generate_series(1, 100000)`, then `ANALYZE`d. Postgres 16.2 on the dev laptop, 2026-11-18.

| Query | Plan | Time |
|---|---|---|
| Name A→Z, first page (`LIMIT 10`) | Index Scan on `(last_name, first_name, id)` | 0.03 ms |
| Name Z→A, **last** page (`OFFSET 99990`) | Index Scan **Backward**, same index | 12.9 ms |
| City A→Z, middle page (`OFFSET 50000`, size 20) | Index Only Scan on `(city, last_name, first_name, id)` | 6.0 ms |
| City Z→A, first page (name ties still A→Z) | Index Only Scan Backward + Incremental Sort per city | 0.17 ms |
| `lastName=Pot`, first page | Index Scan on the name index | 5.4 ms |
| `lastName=Pot`, count | Bitmap Index Scan on `last_name text_pattern_ops` | 1.1 ms |

No query does a `Seq Scan` + full `Sort` on the owners table. The worst case is the deepest
offset, which grows linearly with the page number (design D1). At 100k owners it costs 13 ms.
