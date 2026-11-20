# EXPLAIN on 100,000 owners (task 4.2)

Throwaway PostgreSQL 16.2 cluster (the Zonky binaries), `initdb --locale=C.UTF-8 -E UTF8`, schema from
`V1__core_owners_pets.sql` + `V4__owners_paging.sql`, then generated data and `ANALYZE`:

- 100,000 owners, 559 distinct last names, skewed: Smith 12,910, Popescu 4,067, Potter 3,172, Mureșan 2,118,
  Śliwiński 1,748, plus accented names (Öztürk, Ångström, Ștefănescu, Žukauskas, Ødegaard…).
  **7,238 owners match `Pot%`**, sitting after 54,064 owners in name order.
- 40 cities, skewed (London 29,394, Bucharest 7,560, Kraków, Łódź, Iași…).
- 200,000 pets (1–3 per owner), 6 types.
- ICU order checked: `Mureșan, Muresby, Scamander, Śliwiński, Smith, Wensleydale, Zając`.

Queries are the SQL Hibernate 6.6 issues for the derived `findByLastNameStartingWith(String, Pageable)`
(`LIKE ? ESCAPE '\'`, `FETCH FIRST ? ROWS ONLY`), run as `PREPARE`/`EXECUTE` with bind parameters
(custom plans, as PgJDBC gets for the first executions), on a warm cache. An empty search sends `LIKE '%'`.

## Summary

| query | index used | execution time |
|---|---|---|
| (a) name,asc, page 0, size 10 | `owners_name_idx` (Index Scan, stops after 10) | 0.09 ms |
| (b) city,desc, page 0, size 20 | `owners_city_idx` (Index Scan **Backward**) | 0.05 ms |
| (c) `Pot%` + name,asc, page 0, size 10 | ⚠️ `owners_name_idx` with `LIKE` as a **Filter**, not `owners_last_name_prefix_idx`; 54,064 rows removed | **17 ms** |
| (d) name,asc, OFFSET 99,980 LIMIT 20 | `owners_name_idx`, walks all 100,000 entries | 36 ms |
| (e) COUNT, no filter | none: Seq Scan (expected for counting every row) | 8 ms |
| (f) COUNT, `Pot%` | `owners_last_name_prefix_idx` (Bitmap, range `~>=~ 'Pot' AND ~<~ 'Pou'`) | 1.4 ms |
| (g) pets, `owner_id = ANY(20 ids)` | `pets_owner_id_idx` | 0.12 ms |
| (h) pets, `owner_id IN (20 ids)` | `pets_owner_id_idx` (rewritten to `= ANY`) | 0.06 ms |
| (extra) `Pot%` + city,desc, size 20 | `owners_city_idx` backward, `LIKE` as Filter, 604 rows removed | 0.4 ms |

All three planned indexes and the pets index are used, and every query is in milliseconds at 100k, but **(c), the
filtered page sorted by name, does not use `owners_last_name_prefix_idx`**.

## Finding: the filtered name page walks the name index from "A"

Why:
- `owners_name_idx` is in ICU order, and PostgreSQL turns `LIKE 'Pot%'` into an index range only on a
  C-ordered or `*_pattern_ops` index, so on `owners_name_idx` the `LIKE` is only a Filter.
- The planner then compares "walk `owners_name_idx` until 10 rows pass the filter" (it assumes the 7,323
  estimated matches are spread evenly, so ~140 rows: cost 12) with "bitmap on `owners_last_name_prefix_idx`,
  then top-N sort" (cost 1,406). It picks the walk.
- But the matches are not spread evenly: in name order they are all **together**, after every owner whose name
  sorts before "Pot". The walk reads 54,064 rows first.
- So the cost grows with how late the prefix sorts, and with the table: `Sm%` 12 ms, `Pot%` 17 ms, `Zaj%` 19 ms,
  `Wil%` 23 ms (94,807 rows skipped), raw plans below. Only a prefix the planner thinks is rare (`Xyz%`, 0
  matches) gets `owners_last_name_prefix_idx` + Sort (0.02 ms). With the walk disabled, `Pot%` via the prefix
  index + top-N sort takes 2.1 ms.

It still meets "milliseconds" at 100k: the worst case is a full index walk, the same as the deep page (d).
It grows linearly with the table, though, and `owners_last_name_prefix_idx` only serves the COUNT.

**Fix I'd propose (not applied: it changes D2 and the repository, not the migration):** give the ICU index a range
it *can* use, keeping `LIKE` as an exact recheck:

```sql
WHERE last_name >= :prefix AND last_name < :prefix || U&'\FFFF' AND last_name LIKE :prefix || '%' ESCAPE '\'
```

- CLDR's root collation gives U+FFFF the highest primary weight, which makes it a safe upper bound for prefixes.
  Checked here: across all 240 distinct 1–4 letter prefixes in the data, **0 rows** matching `LIKE` fell outside the
  range. The range is a superset (`Mures…` also brings in `Mureș…`), and the `LIKE` removes the extras.
- The naive "increment the last letter" bound is wrong under ICU: `[Ž, ž)` finds 0 rows, while 1,170 match `Ž%`.
- Measured: `Pot%` page 0.045 ms (13 buffers instead of 53,697), `Wil%` 2.2 ms (worst case before: 23 ms).
  `Pot%` COUNT becomes an Index Only Scan on `owners_name_idx` (2.1 ms custom, 1.5 ms generic). `Pot%` + city,desc 0.12 ms.
- In Spring Data that is still a derived query, e.g.
  `findByLastNameGreaterThanEqualAndLastNameLessThanAndLastNameStartingWith(prefix, prefix + "\uFFFF", prefix, pageable)`,
  or a `@Query`. Use it **only when `lastName` is non-empty**, and `findAll(Pageable)` for an empty search. Measured
  as a generic plan, the empty range `['', U+FFFF)` makes city,desc fall back to a bitmap + sort over every row
  (37 ms). `findAll` keeps (b) at 0.03 ms and the count at 7.5 ms, with no WHERE.
- With that, `owners_last_name_prefix_idx` has no reader left and can be dropped from V4 (one index less to maintain).
- The alternative is to leave it: worst case ≈ a full index walk, ~20–35 ms at 100k.

## Side notes

- **Generic plans.** If PgJDBC's server-side prepared statement ever switches to a generic plan, `LIKE $1` can no
  longer be turned into a range at all. The `Pot%` COUNT then becomes a Seq Scan (5.7 ms instead of 1.4 ms), and the
  page queries keep the same index walks as above. In these measurements, the original queries' generic cost estimates
  are higher than their custom ones, so PostgreSQL should keep custom plans. The proposed range form uses
  `owners_name_idx` in both plan modes (except the empty-range case above).
- **Deep offset (d):** 36 ms for the last page at 100k, as accepted in the design (Q&A #10).
- **COUNT without a filter (e):** a Seq Scan, ~8 ms, on every grid load. Page 0 is always full, so
  `PageableExecutionUtils` never skips it. Fine at 100k. At millions, consider an estimate or caching it.
- **Pets batch (g/h):** both forms use `pets_owner_id_idx`, 40 pets for 20 owners in ~0.1 ms, with `types` hash-joined.

## Raw plans (custom plans, warm cache)

### (a) name,asc, page 0, size 10, no filter

```sql
SELECT o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone FROM owners o1_0 WHERE o1_0.last_name LIKE $1 ESCAPE '\'
ORDER BY o1_0.last_name,o1_0.first_name,o1_0.id
FETCH FIRST $2 ROWS ONLY          -- $1 = '%', $2 = 10
```

```
Limit  (cost=0.42..1.26 rows=10 width=52) (actual time=0.030..0.067 rows=10 loops=1)
  Buffers: shared hit=13
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..8465.75 rows=99998 width=52) (actual time=0.029..0.066 rows=10 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=13
Planning:
  Buffers: shared hit=187
Planning Time: 0.678 ms
Execution Time: 0.089 ms
```

### (b) city,desc, page 0, size 20, no filter

```sql
SELECT o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone FROM owners o1_0 WHERE o1_0.last_name LIKE $1 ESCAPE '\'
ORDER BY o1_0.city DESC,o1_0.last_name DESC,o1_0.first_name DESC,o1_0.id DESC
FETCH FIRST $2 ROWS ONLY          -- $1 = '%', $2 = 20
```

```
Limit  (cost=0.42..2.22 rows=20 width=52) (actual time=0.009..0.040 rows=20 loops=1)
  Buffers: shared hit=23
  ->  Index Scan Backward using owners_city_idx on owners o1_0  (cost=0.42..8990.95 rows=99998 width=52) (actual time=0.009..0.039 rows=20 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=23
Planning:
  Buffers: shared hit=9
Planning Time: 0.079 ms
Execution Time: 0.046 ms
```

### (c) lastName=Pot, name,asc, page 0, size 10

```sql
SELECT o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone FROM owners o1_0 WHERE o1_0.last_name LIKE $1 ESCAPE '\'
ORDER BY o1_0.last_name,o1_0.first_name,o1_0.id
FETCH FIRST $2 ROWS ONLY          -- $1 = 'Pot%', $2 = 10
```

```
Limit  (cost=0.42..11.98 rows=10 width=52) (actual time=16.957..16.960 rows=10 loops=1)
  Buffers: shared hit=53697
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..8465.75 rows=7323 width=52) (actual time=16.956..16.959 rows=10 loops=1)
        Filter: (last_name ~~ 'Pot%'::text)
        Rows Removed by Filter: 54064
        Buffers: shared hit=53697
Planning:
  Buffers: shared hit=19
Planning Time: 0.140 ms
Execution Time: 16.976 ms
```

### (d) name,asc, deep page: OFFSET 99980 LIMIT 20

```sql
SELECT o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone FROM owners o1_0 WHERE o1_0.last_name LIKE $1 ESCAPE '\'
ORDER BY o1_0.last_name,o1_0.first_name,o1_0.id
OFFSET $2 ROWS FETCH FIRST $3 ROWS ONLY   -- $1 = '%', $2 = 99980, $3 = 20
```

```
Limit  (cost=8464.23..8465.75 rows=18 width=52) (actual time=35.579..35.584 rows=20 loops=1)
  Buffers: shared hit=97405
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..8465.75 rows=99998 width=52) (actual time=0.006..33.783 rows=100000 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=97405
Planning Time: 0.074 ms
Execution Time: 35.594 ms
```

### (e) COUNT, no filter

```sql
SELECT count(o1_0.id) FROM owners o1_0 WHERE o1_0.last_name LIKE $1 ESCAPE '\'   -- $1 = '%'
```

```
Aggregate  (cost=2545.99..2546.01 rows=1 width=8) (actual time=8.002..8.002 rows=1 loops=1)
  Buffers: shared hit=1046
  ->  Seq Scan on owners o1_0  (cost=0.00..2296.00 rows=99998 width=4) (actual time=0.002..5.599 rows=100000 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=1046
Planning:
  Buffers: shared hit=6
Planning Time: 0.092 ms
Execution Time: 8.017 ms
```

### (f) COUNT, lastName=Pot

```sql
SELECT count(o1_0.id) FROM owners o1_0 WHERE o1_0.last_name LIKE $1 ESCAPE '\'   -- $1 = 'Pot%'
```

```
Aggregate  (cost=1266.43..1266.44 rows=1 width=8) (actual time=1.375..1.376 rows=1 loops=1)
  Buffers: shared hit=1056
  ->  Bitmap Heap Scan on owners o1_0  (cost=111.01..1248.13 rows=7323 width=4) (actual time=0.233..1.218 rows=7238 loops=1)
        Filter: (last_name ~~ 'Pot%'::text)
        Heap Blocks: exact=1046
        Buffers: shared hit=1056
        ->  Bitmap Index Scan on owners_last_name_prefix_idx  (cost=0.00..109.18 rows=7289 width=0) (actual time=0.165..0.165 rows=7238 loops=1)
              Index Cond: ((last_name ~>=~ 'Pot'::text) AND (last_name ~<~ 'Pou'::text))
              Buffers: shared hit=10
Planning:
  Buffers: shared hit=12
Planning Time: 0.129 ms
Execution Time: 1.387 ms
```

### (g) pets batch, `owner_id = ANY(?)` (what Hibernate 6.6 sends for @BatchSize on PostgreSQL)

```sql
SELECT p1_0.owner_id,p1_0.id,p1_0.birth_date,p1_0.name,t1_0.id,t1_0.name FROM pets p1_0 LEFT JOIN types t1_0 ON t1_0.id=p1_0.type_id WHERE p1_0.owner_id = ANY ($1)   -- $1 = 20 owner ids
```

```
Hash Left Join  (cost=1.55..211.95 rows=40 width=27) (actual time=0.026..0.110 rows=40 loops=1)
  Hash Cond: (p1_0.type_id = t1_0.id)
  Buffers: shared hit=104
  ->  Index Scan using pets_owner_id_idx on pets p1_0  (cost=0.42..210.63 rows=40 width=22) (actual time=0.018..0.099 rows=40 loops=1)
        Index Cond: (owner_id = ANY ('{4711,5708,6705,7702,8699,9696,10693,11690,12687,13684,14681,15678,16675,17672,18669,19666,20663,21660,22657,23654}'::integer[]))
        Buffers: shared hit=103
  ->  Hash  (cost=1.06..1.06 rows=6 width=9) (actual time=0.004..0.004 rows=6 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 9kB
        Buffers: shared hit=1
        ->  Seq Scan on types t1_0  (cost=0.00..1.06 rows=6 width=9) (actual time=0.001..0.001 rows=6 loops=1)
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=136
Planning Time: 0.368 ms
Execution Time: 0.123 ms
```

### (h) pets batch, `owner_id IN (20 ids)`

```sql
SELECT p1_0.owner_id,p1_0.id,p1_0.birth_date,p1_0.name,t1_0.id,t1_0.name FROM pets p1_0 LEFT JOIN types t1_0 ON t1_0.id=p1_0.type_id WHERE p1_0.owner_id IN ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
```

```
Hash Left Join  (cost=1.55..211.95 rows=40 width=27) (actual time=0.010..0.056 rows=40 loops=1)
  Hash Cond: (p1_0.type_id = t1_0.id)
  Buffers: shared hit=101
  ->  Index Scan using pets_owner_id_idx on pets p1_0  (cost=0.42..210.63 rows=40 width=22) (actual time=0.005..0.047 rows=40 loops=1)
        Index Cond: (owner_id = ANY ('{4711,5708,6705,7702,8699,9696,10693,11690,12687,13684,14681,15678,16675,17672,18669,19666,20663,21660,22657,23654}'::integer[]))
        Buffers: shared hit=100
  ->  Hash  (cost=1.06..1.06 rows=6 width=9) (actual time=0.003..0.003 rows=6 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 9kB
        Buffers: shared hit=1
        ->  Seq Scan on types t1_0  (cost=0.00..1.06 rows=6 width=9) (actual time=0.001..0.001 rows=6 loops=1)
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=4
Planning Time: 0.079 ms
Execution Time: 0.063 ms
```

### (extra) lastName=Pot, city,desc, page 0, size 20

```sql
SELECT o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone FROM owners o1_0 WHERE o1_0.last_name LIKE $1 ESCAPE '\'
ORDER BY o1_0.city DESC,o1_0.last_name DESC,o1_0.first_name DESC,o1_0.id DESC
FETCH FIRST $2 ROWS ONLY          -- $1 = 'Pot%', $2 = 20
```

```
Limit  (cost=0.42..24.97 rows=20 width=52) (actual time=0.352..0.366 rows=20 loops=1)
  Buffers: shared hit=639
  ->  Index Scan Backward using owners_city_idx on owners o1_0  (cost=0.42..8990.95 rows=7323 width=52) (actual time=0.352..0.365 rows=20 loops=1)
        Filter: (last_name ~~ 'Pot%'::text)
        Rows Removed by Filter: 604
        Buffers: shared hit=639
Planning Time: 0.114 ms
Execution Time: 0.375 ms
```

## Raw plans: other prefixes on the current query (name,asc, size 10)

### `Sm%`

```
Limit  (cost=0.42..6.78 rows=10 width=52) (actual time=12.294..12.297 rows=10 loops=1)
  Buffers: shared hit=70693
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..8465.75 rows=13310 width=52) (actual time=12.294..12.296 rows=10 loops=1)
        Filter: (last_name ~~ 'Sm%'::text)
        Rows Removed by Filter: 71234
        Buffers: shared hit=70693
Planning Time: 0.052 ms
Execution Time: 12.306 ms
```

### `Wil%`

```
Limit  (cost=0.42..92.83 rows=10 width=52) (actual time=23.326..23.329 rows=10 loops=1)
  Buffers: shared hit=92229
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..8465.75 rows=916 width=52) (actual time=23.325..23.328 rows=10 loops=1)
        Filter: (last_name ~~ 'Wil%'::text)
        Rows Removed by Filter: 94807
        Buffers: shared hit=92229
Planning:
  Buffers: shared hit=32
Planning Time: 0.141 ms
Execution Time: 23.335 ms
```

### `Zaj%`

```
Limit  (cost=0.42..76.48 rows=10 width=52) (actual time=18.658..18.661 rows=10 loops=1)
  Buffers: shared hit=95063
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..8465.75 rows=1113 width=52) (actual time=18.658..18.661 rows=10 loops=1)
        Filter: (last_name ~~ 'Zaj%'::text)
        Rows Removed by Filter: 97639
        Buffers: shared hit=95063
Planning Time: 0.077 ms
Execution Time: 18.670 ms
```

### `Xyz%`

```
Limit  (cost=8.32..8.33 rows=2 width=52) (actual time=0.017..0.017 rows=0 loops=1)
  Buffers: shared hit=8
  ->  Sort  (cost=8.32..8.33 rows=2 width=52) (actual time=0.017..0.017 rows=0 loops=1)
        Sort Key: last_name COLLATE "und-x-icu", first_name COLLATE "und-x-icu", id
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=8
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=2 width=52) (actual time=0.002..0.002 rows=0 loops=1)
              Index Cond: ((last_name ~>=~ 'Xyz'::text) AND (last_name ~<~ 'Xy{'::text))
              Filter: (last_name ~~ 'Xyz%'::text)
              Buffers: shared hit=2
Planning:
  Buffers: shared hit=12
Planning Time: 0.108 ms
Execution Time: 0.024 ms
```

### `Pot%` with `enable_indexscan = off`: prefix index + top-N sort

```
Limit  (cost=1406.37..1406.40 rows=10 width=52) (actual time=2.100..2.101 rows=10 loops=1)
  Buffers: shared hit=1056
  ->  Sort  (cost=1406.37..1424.68 rows=7323 width=52) (actual time=2.100..2.100 rows=10 loops=1)
        Sort Key: last_name COLLATE "und-x-icu", first_name COLLATE "und-x-icu", id
        Sort Method: top-N heapsort  Memory: 27kB
        Buffers: shared hit=1056
        ->  Bitmap Heap Scan on owners o1_0  (cost=111.01..1248.13 rows=7323 width=52) (actual time=0.220..1.369 rows=7238 loops=1)
              Filter: (last_name ~~ 'Pot%'::text)
              Heap Blocks: exact=1046
              Buffers: shared hit=1056
              ->  Bitmap Index Scan on owners_last_name_prefix_idx  (cost=0.00..109.18 rows=7289 width=0) (actual time=0.161..0.161 rows=7238 loops=1)
                    Index Cond: ((last_name ~>=~ 'Pot'::text) AND (last_name ~<~ 'Pou'::text))
                    Buffers: shared hit=10
Planning Time: 0.084 ms
Execution Time: 2.112 ms
```

## Raw plans: proposed range form

```sql
SELECT o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone FROM owners o1_0 WHERE o1_0.last_name >= $1 AND o1_0.last_name < $2 AND o1_0.last_name LIKE $3 ESCAPE '\'
ORDER BY o1_0.last_name,o1_0.first_name,o1_0.id FETCH FIRST $4 ROWS ONLY
-- $1 = 'Pot', $2 = 'Pot' || U&'\FFFF', $3 = 'Pot%'
```

### page, `Pot%`

```
Limit  (cost=0.42..87.40 rows=10 width=52) (actual time=0.018..0.037 rows=10 loops=1)
  Buffers: shared hit=13
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..4523.25 rows=520 width=52) (actual time=0.018..0.036 rows=10 loops=1)
        Index Cond: ((last_name >= 'Pot'::text) AND (last_name < 'Pot￿'::text))
        Filter: (last_name ~~ 'Pot%'::text)
        Buffers: shared hit=13
Planning:
  Buffers: shared hit=59
Planning Time: 0.219 ms
Execution Time: 0.045 ms
```

### page, `Wil%`

```
Limit  (cost=67.63..67.65 rows=6 width=52) (actual time=2.200..2.202 rows=10 loops=1)
  Buffers: shared hit=691
  ->  Sort  (cost=67.63..67.65 rows=6 width=52) (actual time=2.199..2.200 rows=10 loops=1)
        Sort Key: last_name COLLATE "und-x-icu", first_name COLLATE "und-x-icu", id
        Sort Method: top-N heapsort  Memory: 27kB
        Buffers: shared hit=691
        ->  Bitmap Heap Scan on owners o1_0  (cost=44.81..67.55 rows=6 width=52) (actual time=0.562..1.952 rows=1054 loops=1)
              Recheck Cond: ((last_name >= 'Wil'::text) AND (last_name < 'Wil￿'::text))
              Filter: (last_name ~~ 'Wil%'::text)
              Heap Blocks: exact=671
              Buffers: shared hit=685
              ->  BitmapAnd  (cost=44.81..44.81 rows=6 width=0) (actual time=0.513..0.514 rows=0 loops=1)
                    Buffers: shared hit=14
                    ->  Bitmap Index Scan on owners_last_name_prefix_idx  (cost=0.00..17.40 rows=911 width=0) (actual time=0.076..0.076 rows=1054 loops=1)
                          Index Cond: ((last_name ~>=~ 'Wil'::text) AND (last_name ~<~ 'Wim'::text))
                          Buffers: shared hit=4
                    ->  Bitmap Index Scan on owners_name_idx  (cost=0.00..27.16 rows=674 width=0) (actual time=0.424..0.424 rows=1054 loops=1)
                          Index Cond: ((last_name >= 'Wil'::text) AND (last_name < 'Wil￿'::text))
                          Buffers: shared hit=10
Planning Time: 0.153 ms
Execution Time: 2.237 ms
```

### COUNT, `Pot%`

```
Aggregate  (cost=341.42..341.43 rows=1 width=8) (actual time=2.086..2.087 rows=1 loops=1)
  Buffers: shared hit=47
  ->  Index Only Scan using owners_name_idx on owners o1_0  (cost=0.42..340.12 rows=520 width=4) (actual time=0.016..1.584 rows=7238 loops=1)
        Index Cond: ((last_name >= 'Pot'::text) AND (last_name < 'Pot￿'::text))
        Filter: (last_name ~~ 'Pot%'::text)
        Heap Fetches: 0
        Buffers: shared hit=47
Planning:
  Buffers: shared hit=3
Planning Time: 0.140 ms
Execution Time: 2.101 ms
```

### city,desc, `Pot%`

```
Limit  (cost=0.42..320.54 rows=20 width=52) (actual time=0.078..0.113 rows=20 loops=1)
  Buffers: shared hit=30
  ->  Index Scan Backward using owners_city_idx on owners o1_0  (cost=0.42..8323.65 rows=520 width=52) (actual time=0.077..0.112 rows=20 loops=1)
        Index Cond: ((last_name >= 'Pot'::text) AND (last_name < 'Pot￿'::text))
        Filter: (last_name ~~ 'Pot%'::text)
        Buffers: shared hit=30
Planning Time: 0.150 ms
Execution Time: 0.122 ms
```

### page, `Pot%`, generic plan

```
Limit  (cost=0.42..822.50 rows=1 width=52) (actual time=0.033..0.045 rows=10 loops=1)
  Buffers: shared hit=13
  ->  Index Scan using owners_name_idx on owners o1_0  (cost=0.42..1644.58 rows=2 width=52) (actual time=0.032..0.043 rows=10 loops=1)
        Index Cond: ((last_name >= $1) AND (last_name < $2))
        Filter: (last_name ~~ like_escape($3, '\'::text))
        Buffers: shared hit=13
Planning Time: 0.103 ms
Execution Time: 0.060 ms
```

### COUNT, `Pot%`, generic plan

```
Aggregate  (cost=28.92..28.93 rows=1 width=8) (actual time=1.478..1.478 rows=1 loops=1)
  Buffers: shared hit=47
  ->  Index Only Scan using owners_name_idx on owners o1_0  (cost=0.42..28.92 rows=2 width=4) (actual time=0.025..1.318 rows=7238 loops=1)
        Index Cond: ((last_name >= $1) AND (last_name < $2))
        Filter: (last_name ~~ like_escape($3, '\'::text))
        Heap Fetches: 0
        Buffers: shared hit=47
Planning Time: 0.078 ms
Execution Time: 1.495 ms
```

### city,desc, empty range, generic plan (why an empty search should use `findAll`)

```
Limit  (cost=894.20..894.20 rows=1 width=52) (actual time=37.532..37.534 rows=20 loops=1)
  Buffers: shared hit=1676
  ->  Sort  (cost=894.20..894.20 rows=2 width=52) (actual time=37.530..37.531 rows=20 loops=1)
        Sort Key: city COLLATE "und-x-icu" DESC, last_name COLLATE "und-x-icu" DESC, first_name COLLATE "und-x-icu" DESC, id DESC
        Sort Method: top-N heapsort  Memory: 29kB
        Buffers: shared hit=1676
        ->  Bitmap Heap Scan on owners o1_0  (cost=21.42..894.19 rows=2 width=52) (actual time=10.953..23.389 rows=100000 loops=1)
              Recheck Cond: ((last_name >= $1) AND (last_name < $2))
              Filter: (last_name ~~ like_escape($3, '\'::text))
              Heap Blocks: exact=1046
              Buffers: shared hit=1676
              ->  Bitmap Index Scan on owners_name_idx  (cost=0.00..21.42 rows=500 width=0) (actual time=10.867..10.867 rows=100000 loops=1)
                    Index Cond: ((last_name >= $1) AND (last_name < $2))
                    Buffers: shared hit=630
Planning Time: 0.279 ms
Execution Time: 37.563 ms
```

### Empty search via `findAll(Pageable)`: city,desc page and count

```
Limit  (cost=0.42..2.17 rows=20 width=52) (actual time=0.009..0.026 rows=20 loops=1)
  Buffers: shared hit=23
  ->  Index Scan Backward using owners_city_idx on owners o1_0  (cost=0.42..8740.95 rows=100000 width=52) (actual time=0.008..0.025 rows=20 loops=1)
        Buffers: shared hit=23
Planning:
  Buffers: shared hit=18
Planning Time: 0.067 ms
Execution Time: 0.034 ms
```

```
Aggregate  (cost=2296.00..2296.01 rows=1 width=8) (actual time=7.538..7.539 rows=1 loops=1)
  Buffers: shared hit=1046
  ->  Seq Scan on owners o1_0  (cost=0.00..2046.00 rows=100000 width=4) (actual time=0.003..3.723 rows=100000 loops=1)
        Buffers: shared hit=1046
Planning:
  Buffers: shared hit=3
Planning Time: 0.049 ms
Execution Time: 7.552 ms
```

### Current query as a generic plan: `Pot%` COUNT

```
Aggregate  (cost=2547.25..2547.26 rows=1 width=8) (actual time=5.740..5.741 rows=1 loops=1)
  Buffers: shared hit=1046
  ->  Seq Scan on owners o1_0  (cost=0.00..2546.00 rows=500 width=4) (actual time=0.006..5.584 rows=7238 loops=1)
        Filter: (last_name ~~ like_escape($1, '\'::text))
        Rows Removed by Filter: 92762
        Buffers: shared hit=1046
Planning Time: 0.006 ms
Execution Time: 5.751 ms
```
