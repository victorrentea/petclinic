# Query plans on 50,000 owners

Measured on PostgreSQL 16.2 against a throwaway database (`owners_explain_tmp`, dropped afterwards):
the `owners` table of V1 plus `V4__owner_list_collation_and_indexes.sql`, 50,000 generated owners
(400 surnames incl. Romanian/Polish ones, 600 cities with 20% of owners in 5 big ones), `ANALYZE`d.
Reproduce with `python3 explain_owners.py <path to V4>` (needs psycopg 3 and the dev Postgres on :5432).
Each query is run once with a custom plan and once forced generic — what a server-side prepared
statement can switch to after pgjdbc's 5th execution.

## Verdict

| query | plan | time |
|---|---|---|
| page 1, any sort, no filter | index scan on that sort's index, stops after 10 rows | ~0.03 ms |
| last page (offset 49,990), any sort | same index, walks to the offset | 16–22 ms |
| count, no filter | seq scan | 6–10 ms |
| count, `lastName='Pot'` | bitmap scan on `owners_last_name_prefix` (custom plan); seq scan if generic | 0.2 ms / 5 ms |
| page, `lastName='Pot'`, name asc | walks `owners_by_name` from the start, filtering | 0.5 ms |
| page, `lastName='Pot'`, name desc | walks `owners_by_name` backwards to the P's | 17 ms |
| page, `lastName='Pot'`, city asc/desc | walks the city index, filtering | ~4 ms |

- Every index is used by at least one plan; none is dropped. No plan sorts the table.
- `owners_by_city_desc` earns its place: the mixed order (city DESC, names ASC) is served by it
  directly, at 0.03–0.5 ms for page 1.
- **Weak spot, accepted at 50k:** a filtered page walks the *sort* index and filters, because the
  planner assumes matches are spread evenly through it; for a name sort they are clustered, so a
  name-desc search for an early-alphabet prefix walks almost the whole index (17 ms). Follow-up if
  the table grows: bound the walk by adding `last_name >= :prefix AND last_name < :prefix || U&'\FFFF'`
  (U+FFFF has the highest primary weight in ICU) next to the `LIKE`, which turns it into a range scan.

## Raw plans

Generated 50000 owners.

### count, no filter (lastName=''), custom plan: 5.848 ms
```
Aggregate (actual rows=1 loops=1)
->  Seq Scan on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort name asc, offset 0, custom plan: 0.037 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort name asc, offset 49990, custom plan: 17.805 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_name on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort name desc, offset 0, custom plan: 0.020 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan Backward using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort name desc, offset 49990, custom plan: 15.791 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan Backward using owners_by_name on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort city asc, offset 0, custom plan: 0.029 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city on owners (actual rows=10 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort city asc, offset 49990, custom plan: 16.434 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort city desc, offset 0, custom plan: 0.468 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city_desc on owners (actual rows=10 loops=1)
Filter: (last_name ~~ '%'::text)
```

### page, no filter (lastName=''), sort city desc, offset 49990, custom plan: 15.979 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city_desc on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ '%'::text)
```

### count, no filter (lastName=''), generic plan (what a server-prepared statement may switch to): 9.767 ms
```
Aggregate (actual rows=1 loops=1)
->  Seq Scan on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort name asc, offset 0, generic plan (what a server-prepared statement may switch to): 0.028 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort name asc, offset 49990, generic plan (what a server-prepared statement may switch to): 21.839 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_name on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort name desc, offset 0, generic plan (what a server-prepared statement may switch to): 0.022 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan Backward using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort name desc, offset 49990, generic plan (what a server-prepared statement may switch to): 18.675 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan Backward using owners_by_name on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort city asc, offset 0, generic plan (what a server-prepared statement may switch to): 0.022 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort city asc, offset 49990, generic plan (what a server-prepared statement may switch to): 19.713 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort city desc, offset 0, generic plan (what a server-prepared statement may switch to): 0.026 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city_desc on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### page, no filter (lastName=''), sort city desc, offset 49990, generic plan (what a server-prepared statement may switch to): 17.487 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city_desc on owners (actual rows=50000 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
```

### count, lastName='Pot', custom plan: 0.186 ms
```
Aggregate (actual rows=1 loops=1)
->  Bitmap Heap Scan on owners (actual rows=125 loops=1)
Filter: (last_name ~~ 'Pot%'::text)
->  Bitmap Index Scan on owners_last_name_prefix (actual rows=125 loops=1)
Index Cond: ((last_name ~>=~ 'Pot'::text) AND (last_name ~<~ 'Pou'::text))
```

### page, lastName='Pot', sort name asc, offset 0, custom plan: 0.567 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ 'Pot%'::text)
Rows Removed by Filter: 1000
```

### page, lastName='Pot', sort name desc, offset 0, custom plan: 16.935 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan Backward using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ 'Pot%'::text)
Rows Removed by Filter: 48875
```

### page, lastName='Pot', sort city asc, offset 0, custom plan: 3.821 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city on owners (actual rows=10 loops=1)
Filter: (last_name ~~ 'Pot%'::text)
Rows Removed by Filter: 12584
```

### page, lastName='Pot', sort city desc, offset 0, custom plan: 4.485 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city_desc on owners (actual rows=10 loops=1)
Filter: (last_name ~~ 'Pot%'::text)
Rows Removed by Filter: 12416
```

### count, lastName='Pot', generic plan (what a server-prepared statement may switch to): 5.179 ms
```
Aggregate (actual rows=1 loops=1)
->  Seq Scan on owners (actual rows=125 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
Rows Removed by Filter: 49875
```

### page, lastName='Pot', sort name asc, offset 0, generic plan (what a server-prepared statement may switch to): 0.538 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
Rows Removed by Filter: 1000
```

### page, lastName='Pot', sort name desc, offset 0, generic plan (what a server-prepared statement may switch to): 17.326 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan Backward using owners_by_name on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
Rows Removed by Filter: 48875
```

### page, lastName='Pot', sort city asc, offset 0, generic plan (what a server-prepared statement may switch to): 4.410 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
Rows Removed by Filter: 12584
```

### page, lastName='Pot', sort city desc, offset 0, generic plan (what a server-prepared statement may switch to): 4.745 ms
```
Limit (actual rows=10 loops=1)
->  Index Scan using owners_by_city_desc on owners (actual rows=10 loops=1)
Filter: (last_name ~~ like_escape($1, '\'::text))
Rows Removed by Filter: 12416
```

