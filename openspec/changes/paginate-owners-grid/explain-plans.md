# EXPLAIN plans: owners list at 100k rows (task 1.2)

**Verdict: no plan does a Seq Scan + Sort of the whole table.** Every page query goes through one of
the three V4 indexes, and the worst case (the last page of all 100k owners) runs in under 50 ms.

- **No filter:** `owners_name_sort_idx` / `owners_city_sort_idx`, read forwards for `asc` and backwards
  for `desc`. No Sort node. Page 0 takes about 0.05 ms. The last page (offset 99,980) takes 25–45 ms,
  which is the `OFFSET` cost design D7 accepted.
- **Selective prefix** (`Kal`, 262 matches): `owners_last_name_prefix_idx` finds the matches, then a
  top-N sort orders them. Under 1 ms. This is the "prefix index vs sort index" choice D7 foresaw.
- **Broad prefix** (`M`, 10k matches, 10%): the planner switches by page.
  - Page 0 sorted by city walks the city index. 0.1 ms.
  - Page 0 sorted by name walks the name index **from the start of the alphabet up to `M`**, filtering
    as it goes: 10–13 ms. Under the `en_US.UTF-8` collation that index cannot take `LIKE 'M%'` as a
    range condition, which is why D7 has the separate `text_pattern_ops` index.
  - Last page: bitmap scan on the prefix index plus an in-memory quicksort of the 10k matches: about 30 ms.
- **Count:** with no filter it is a Seq Scan (9 ms), because counting every row has to read every
  row. With a prefix it uses the prefix index (0.2 ms).
- **Pets of a page** (`@BatchSize`): `pets_owner_id_idx`, 0.1 ms.
- **JDBC prepared statements:** after the driver's `prepareThreshold`, `plan_cache_mode=auto` kept the
  custom plan on the 7th execution. A *forced* generic plan cannot see the prefix. It falls back to the
  name index plus a filter, at 10–26 ms: slower, but still an index scan.

Not changed, just noted for later: the broad-prefix name-sorted page 0 (10–13 ms) and deep offsets
(up to 45 ms) are the only double-digit timings. Neither needs action at 100k (design Non-Goals: keyset
pagination).

## Summary

| query | plan | time |
|---|---|---|
| name asc/desc, no filter, page 0 | Index Scan (Backward) `owners_name_sort_idx` | 0.03–0.04 ms |
| name asc/desc, no filter, offset 99,980 | Index Scan (Backward) `owners_name_sort_idx` | 37–44 ms |
| city asc/desc, no filter, page 0 | Index Scan (Backward) `owners_city_sort_idx` | 0.03–0.05 ms |
| city asc/desc, no filter, offset 99,980 | Index Scan (Backward) `owners_city_sort_idx` | 24–26 ms |
| name/city × asc/desc, `Kal`, page 0 and last page | Index Scan `owners_last_name_prefix_idx` + top-N/quick Sort (262 rows) | 0.16–0.64 ms |
| name asc/desc, `M`, page 0 | Index Scan (Backward) `owners_name_sort_idx` + Filter | 10–13 ms |
| city asc/desc, `M`, page 0 | Index Scan (Backward) `owners_city_sort_idx` + Filter | 0.1 ms |
| name/city × asc/desc, `M`, offset 10,000 | Bitmap Index Scan `owners_last_name_prefix_idx` + quicksort (10k rows) | 28–30 ms |
| count, no filter | Seq Scan | 9 ms |
| count, `Kal` | Index Scan `owners_last_name_prefix_idx` | 0.2 ms |
| pets of one page | Index Scan `pets_owner_id_idx` | 0.1 ms |
| prepared, 7th execution (auto) | same as the custom `Kal` plan | 0.13 ms |
| prepared, forced generic, `Kal` / `Zzz` | Index Scan `owners_name_sort_idx` + Filter | 10 / 26 ms |

## How this was produced

The database was a throwaway embedded PostgreSQL 16.2 (zonky, the one the tests use), initialised
with `--locale=en_US.UTF-8` to match the dev DB's collation. It was started and discarded by a scratch
program, never the dev DB on :5432. The program ran V1 and generated the rows, then applied V4 and ran
`ANALYZE`:

- 100,000 owners, last names made of 3 of 20 syllables (8,000 distinct), 300 first names, 500 cities
- 150,000 pets

The SQL is exactly what Hibernate logs for `GET /api/owners` (captured from `OwnerListQueryCountTest`),
with the bind values inlined.

## Environment

```
PostgreSQL 16.2 on x86_64-apple-darwin20.6.0, compiled by Apple clang version 12.0.5 (clang-1205.0.22.9), 64-bit
datcollate = en_US.UTF-8
owners = 100000
pets = 150000
last_name like 'M%' matches 10014
last_name like 'Kal%' matches 262
last_name like 'Kalomi%' matches 12
last_name like 'Zzz%' matches 0
```

### sort=name asc, lastName='', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.last_name,o1_0.first_name,o1_0.id  fetch first 20 rows only
```
```
Limit  (cost=0.42..2.07 rows=20 width=57) (actual time=0.021..0.037 rows=20 loops=1)
  Buffers: shared hit=20 read=3
  ->  Index Scan using owners_name_sort_idx on owners o1_0  (cost=0.42..8286.42 rows=99990 width=57) (actual time=0.021..0.035 rows=20 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=20 read=3
Planning:
  Buffers: shared hit=20
Planning Time: 0.099 ms
Execution Time: 0.044 ms
```

### sort=name asc, lastName='', last page (offset 99980, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.last_name,o1_0.first_name,o1_0.id  offset 99980 rows fetch first 20 rows only
```
```
Limit  (cost=8285.59..8286.42 rows=10 width=57) (actual time=43.884..43.900 rows=20 loops=1)
  Buffers: shared hit=99917 read=492
  ->  Index Scan using owners_name_sort_idx on owners o1_0  (cost=0.42..8286.42 rows=99990 width=57) (actual time=0.007..41.392 rows=100000 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=99917 read=492
Planning Time: 0.053 ms
Execution Time: 43.911 ms
```

### sort=name desc, lastName='', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  fetch first 20 rows only
```
```
Limit  (cost=0.42..2.07 rows=20 width=57) (actual time=0.010..0.021 rows=20 loops=1)
  Buffers: shared hit=22 read=1
  ->  Index Scan Backward using owners_name_sort_idx on owners o1_0  (cost=0.42..8286.42 rows=99990 width=57) (actual time=0.010..0.019 rows=20 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=22 read=1
Planning:
  Buffers: shared hit=9
Planning Time: 0.103 ms
Execution Time: 0.028 ms
```

### sort=name desc, lastName='', last page (offset 99980, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  offset 99980 rows fetch first 20 rows only
```
```
Limit  (cost=8285.59..8286.42 rows=10 width=57) (actual time=37.368..37.376 rows=20 loops=1)
  Buffers: shared hit=100901
  ->  Index Scan Backward using owners_name_sort_idx on owners o1_0  (cost=0.42..8286.42 rows=99990 width=57) (actual time=0.003..35.146 rows=100000 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=100901
Planning Time: 0.029 ms
Execution Time: 37.384 ms
```

### sort=city asc, lastName='', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.city,o1_0.last_name,o1_0.first_name,o1_0.id  fetch first 20 rows only
```
```
Limit  (cost=0.42..2.16 rows=20 width=57) (actual time=0.025..0.042 rows=20 loops=1)
  Buffers: shared hit=20 read=3
  ->  Index Scan using owners_city_sort_idx on owners o1_0  (cost=0.42..8711.22 rows=99990 width=57) (actual time=0.024..0.034 rows=20 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=20 read=3
Planning Time: 0.066 ms
Execution Time: 0.049 ms
```

### sort=city asc, lastName='', last page (offset 99980, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.city,o1_0.last_name,o1_0.first_name,o1_0.id  offset 99980 rows fetch first 20 rows only
```
```
Limit  (cost=8710.35..8711.22 rows=10 width=57) (actual time=26.156..26.161 rows=20 loops=1)
  Buffers: shared hit=96902 read=602
  ->  Index Scan using owners_city_sort_idx on owners o1_0  (cost=0.42..8711.22 rows=99990 width=57) (actual time=0.009..23.973 rows=100000 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=96902 read=602
Planning Time: 0.056 ms
Execution Time: 26.173 ms
```

### sort=city desc, lastName='', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.city desc,o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  fetch first 20 rows only
```
```
Limit  (cost=0.42..2.16 rows=20 width=57) (actual time=0.012..0.022 rows=20 loops=1)
  Buffers: shared hit=22 read=1
  ->  Index Scan Backward using owners_city_sort_idx on owners o1_0  (cost=0.42..8711.22 rows=99990 width=57) (actual time=0.011..0.021 rows=20 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=22 read=1
Planning Time: 0.067 ms
Execution Time: 0.031 ms
```

### sort=city desc, lastName='', last page (offset 99980, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like '%' escape '\' order by o1_0.city desc,o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  offset 99980 rows fetch first 20 rows only
```
```
Limit  (cost=8710.35..8711.22 rows=10 width=57) (actual time=24.228..24.233 rows=20 loops=1)
  Buffers: shared hit=98106
  ->  Index Scan Backward using owners_city_sort_idx on owners o1_0  (cost=0.42..8711.22 rows=99990 width=57) (actual time=0.004..21.588 rows=100000 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=98106
Planning Time: 0.031 ms
Execution Time: 24.241 ms
```

### sort=name asc, lastName='Kal', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.last_name,o1_0.first_name,o1_0.id  fetch first 20 rows only
```
```
Limit  (cost=8.48..8.51 rows=10 width=57) (actual time=0.154..0.156 rows=20 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.154..0.155 rows=20 loops=1)
        Sort Key: last_name, first_name, id
        Sort Method: top-N heapsort  Memory: 28kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.006..0.082 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.049 ms
Execution Time: 0.162 ms
```

### sort=name asc, lastName='Kal', last page (offset 260, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.last_name,o1_0.first_name,o1_0.id  offset 260 rows fetch first 20 rows only
```
```
Limit  (cost=8.51..8.51 rows=1 width=57) (actual time=0.406..0.406 rows=2 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.394..0.400 rows=262 loops=1)
        Sort Key: last_name, first_name, id
        Sort Method: quicksort  Memory: 59kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.010..0.082 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.046 ms
Execution Time: 0.416 ms
```

### sort=name desc, lastName='Kal', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  fetch first 20 rows only
```
```
Limit  (cost=8.48..8.51 rows=10 width=57) (actual time=0.447..0.449 rows=20 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.447..0.448 rows=20 loops=1)
        Sort Key: last_name DESC, first_name DESC, id DESC
        Sort Method: top-N heapsort  Memory: 30kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.006..0.105 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.045 ms
Execution Time: 0.455 ms
```

### sort=name desc, lastName='Kal', last page (offset 260, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  offset 260 rows fetch first 20 rows only
```
```
Limit  (cost=8.51..8.51 rows=1 width=57) (actual time=0.417..0.418 rows=2 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.406..0.412 rows=262 loops=1)
        Sort Key: last_name DESC, first_name DESC, id DESC
        Sort Method: quicksort  Memory: 59kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.005..0.087 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.040 ms
Execution Time: 0.423 ms
```

### sort=city asc, lastName='Kal', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.city,o1_0.last_name,o1_0.first_name,o1_0.id  fetch first 20 rows only
```
```
Limit  (cost=8.48..8.51 rows=10 width=57) (actual time=0.269..0.270 rows=20 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.269..0.269 rows=20 loops=1)
        Sort Key: city, last_name, first_name, id
        Sort Method: top-N heapsort  Memory: 29kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.014..0.121 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.074 ms
Execution Time: 0.279 ms
```

### sort=city asc, lastName='Kal', last page (offset 260, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.city,o1_0.last_name,o1_0.first_name,o1_0.id  offset 260 rows fetch first 20 rows only
```
```
Limit  (cost=8.51..8.51 rows=1 width=57) (actual time=0.634..0.635 rows=2 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.622..0.628 rows=262 loops=1)
        Sort Key: city, last_name, first_name, id
        Sort Method: quicksort  Memory: 59kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.007..0.157 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.061 ms
Execution Time: 0.644 ms
```

### sort=city desc, lastName='Kal', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.city desc,o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  fetch first 20 rows only
```
```
Limit  (cost=8.48..8.51 rows=10 width=57) (actual time=0.282..0.284 rows=20 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.282..0.283 rows=20 loops=1)
        Sort Key: city DESC, last_name DESC, first_name DESC, id DESC
        Sort Method: top-N heapsort  Memory: 29kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.006..0.120 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.053 ms
Execution Time: 0.291 ms
```

### sort=city desc, lastName='Kal', last page (offset 260, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'Kal%' escape '\' order by o1_0.city desc,o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  offset 260 rows fetch first 20 rows only
```
```
Limit  (cost=8.51..8.51 rows=1 width=57) (actual time=0.515..0.515 rows=2 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.503..0.509 rows=262 loops=1)
        Sort Key: city DESC, last_name DESC, first_name DESC, id DESC
        Sort Method: quicksort  Memory: 59kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.005..0.067 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.040 ms
Execution Time: 0.520 ms
```

### sort=name asc, lastName='M', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.last_name,o1_0.first_name,o1_0.id  fetch first 20 rows only
```
```
Limit  (cost=0.42..16.91 rows=20 width=57) (actual time=9.791..9.798 rows=20 loops=1)
  Buffers: shared hit=39885
  ->  Index Scan using owners_name_sort_idx on owners o1_0  (cost=0.42..8286.42 rows=10050 width=57) (actual time=9.791..9.796 rows=20 loops=1)
        Filter: (last_name ~~ 'M%'::text)
        Rows Removed by Filter: 39696
        Buffers: shared hit=39885
Planning Time: 0.065 ms
Execution Time: 9.809 ms
```

### sort=name asc, lastName='M', last page (offset 10000, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.last_name,o1_0.first_name,o1_0.id  offset 10000 rows fetch first 20 rows only
```
```
Limit  (cost=2097.57..2097.62 rows=20 width=57) (actual time=27.956..27.958 rows=14 loops=1)
  Buffers: shared hit=1149
  ->  Sort  (cost=2072.57..2097.69 rows=10050 width=57) (actual time=27.511..27.744 rows=10014 loops=1)
        Sort Key: last_name, first_name, id
        Sort Method: quicksort  Memory: 1714kB
        Buffers: shared hit=1149
        ->  Bitmap Heap Scan on owners o1_0  (cost=145.33..1404.50 rows=10050 width=57) (actual time=0.428..2.142 rows=10014 loops=1)
              Filter: (last_name ~~ 'M%'::text)
              Heap Blocks: exact=1136
              Buffers: shared hit=1149
              ->  Bitmap Index Scan on owners_last_name_prefix_idx  (cost=0.00..142.82 rows=9853 width=0) (actual time=0.335..0.335 rows=10014 loops=1)
                    Index Cond: ((last_name ~>=~ 'M'::text) AND (last_name ~<~ 'N'::text))
                    Buffers: shared hit=13
Planning Time: 0.083 ms
Execution Time: 28.005 ms
```

### sort=name desc, lastName='M', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  fetch first 20 rows only
```
```
Limit  (cost=0.42..16.91 rows=20 width=57) (actual time=12.522..12.530 rows=20 loops=1)
  Buffers: shared hit=50767
  ->  Index Scan Backward using owners_name_sort_idx on owners o1_0  (cost=0.42..8286.42 rows=10050 width=57) (actual time=12.521..12.527 rows=20 loops=1)
        Filter: (last_name ~~ 'M%'::text)
        Rows Removed by Filter: 50290
        Buffers: shared hit=50767
Planning Time: 0.078 ms
Execution Time: 12.542 ms
```

### sort=name desc, lastName='M', last page (offset 10000, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  offset 10000 rows fetch first 20 rows only
```
```
Limit  (cost=2097.57..2097.62 rows=20 width=57) (actual time=27.504..27.506 rows=14 loops=1)
  Buffers: shared hit=1149
  ->  Sort  (cost=2072.57..2097.69 rows=10050 width=57) (actual time=26.906..27.285 rows=10014 loops=1)
        Sort Key: last_name DESC, first_name DESC, id DESC
        Sort Method: quicksort  Memory: 1714kB
        Buffers: shared hit=1149
        ->  Bitmap Heap Scan on owners o1_0  (cost=145.33..1404.50 rows=10050 width=57) (actual time=0.415..1.969 rows=10014 loops=1)
              Filter: (last_name ~~ 'M%'::text)
              Heap Blocks: exact=1136
              Buffers: shared hit=1149
              ->  Bitmap Index Scan on owners_last_name_prefix_idx  (cost=0.00..142.82 rows=9853 width=0) (actual time=0.327..0.327 rows=10014 loops=1)
                    Index Cond: ((last_name ~>=~ 'M'::text) AND (last_name ~<~ 'N'::text))
                    Buffers: shared hit=13
Planning Time: 0.080 ms
Execution Time: 27.526 ms
```

### sort=city asc, lastName='M', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.city,o1_0.last_name,o1_0.first_name,o1_0.id  fetch first 20 rows only
```
```
Limit  (cost=0.42..17.75 rows=20 width=57) (actual time=0.040..0.097 rows=20 loops=1)
  Buffers: shared hit=290
  ->  Index Scan using owners_city_sort_idx on owners o1_0  (cost=0.42..8711.22 rows=10050 width=57) (actual time=0.040..0.096 rows=20 loops=1)
        Filter: (last_name ~~ 'M%'::text)
        Rows Removed by Filter: 268
        Buffers: shared hit=290
Planning Time: 0.075 ms
Execution Time: 0.104 ms
```

### sort=city asc, lastName='M', last page (offset 10000, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.city,o1_0.last_name,o1_0.first_name,o1_0.id  offset 10000 rows fetch first 20 rows only
```
```
Limit  (cost=2097.57..2097.62 rows=20 width=57) (actual time=29.380..29.382 rows=14 loops=1)
  Buffers: shared hit=1149
  ->  Sort  (cost=2072.57..2097.69 rows=10050 width=57) (actual time=28.713..29.169 rows=10014 loops=1)
        Sort Key: city, last_name, first_name, id
        Sort Method: quicksort  Memory: 1714kB
        Buffers: shared hit=1149
        ->  Bitmap Heap Scan on owners o1_0  (cost=145.33..1404.50 rows=10050 width=57) (actual time=0.390..2.042 rows=10014 loops=1)
              Filter: (last_name ~~ 'M%'::text)
              Heap Blocks: exact=1136
              Buffers: shared hit=1149
              ->  Bitmap Index Scan on owners_last_name_prefix_idx  (cost=0.00..142.82 rows=9853 width=0) (actual time=0.303..0.303 rows=10014 loops=1)
                    Index Cond: ((last_name ~>=~ 'M'::text) AND (last_name ~<~ 'N'::text))
                    Buffers: shared hit=13
Planning Time: 0.081 ms
Execution Time: 29.407 ms
```

### sort=city desc, lastName='M', page 0 (size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.city desc,o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  fetch first 20 rows only
```
```
Limit  (cost=0.42..17.75 rows=20 width=57) (actual time=0.050..0.095 rows=20 loops=1)
  Buffers: shared hit=304
  ->  Index Scan Backward using owners_city_sort_idx on owners o1_0  (cost=0.42..8711.22 rows=10050 width=57) (actual time=0.050..0.093 rows=20 loops=1)
        Filter: (last_name ~~ 'M%'::text)
        Rows Removed by Filter: 285
        Buffers: shared hit=304
Planning Time: 0.083 ms
Execution Time: 0.102 ms
```

### sort=city desc, lastName='M', last page (offset 10000, size 20)

```sql
select o1_0.id,o1_0.address,o1_0.city,o1_0.first_name,o1_0.last_name,o1_0.telephone from owners o1_0 where o1_0.last_name like 'M%' escape '\' order by o1_0.city desc,o1_0.last_name desc,o1_0.first_name desc,o1_0.id desc  offset 10000 rows fetch first 20 rows only
```
```
Limit  (cost=2097.57..2097.62 rows=20 width=57) (actual time=29.531..29.533 rows=14 loops=1)
  Buffers: shared hit=1149
  ->  Sort  (cost=2072.57..2097.69 rows=10050 width=57) (actual time=29.071..29.305 rows=10014 loops=1)
        Sort Key: city DESC, last_name DESC, first_name DESC, id DESC
        Sort Method: quicksort  Memory: 1714kB
        Buffers: shared hit=1149
        ->  Bitmap Heap Scan on owners o1_0  (cost=145.33..1404.50 rows=10050 width=57) (actual time=0.397..2.299 rows=10014 loops=1)
              Filter: (last_name ~~ 'M%'::text)
              Heap Blocks: exact=1136
              Buffers: shared hit=1149
              ->  Bitmap Index Scan on owners_last_name_prefix_idx  (cost=0.00..142.82 rows=9853 width=0) (actual time=0.311..0.311 rows=10014 loops=1)
                    Index Cond: ((last_name ~>=~ 'M'::text) AND (last_name ~<~ 'N'::text))
                    Buffers: shared hit=13
Planning Time: 0.049 ms
Execution Time: 29.619 ms
```

### count, lastName=''

```sql
select count(o1_0.id) from owners o1_0 where o1_0.last_name like '%' escape '\'
```
```
Aggregate  (cost=2635.97..2635.99 rows=1 width=8) (actual time=8.891..8.892 rows=1 loops=1)
  Buffers: shared hit=1136
  ->  Seq Scan on owners o1_0  (cost=0.00..2386.00 rows=99990 width=4) (actual time=0.004..6.273 rows=100000 loops=1)
        Filter: (last_name ~~ '%'::text)
        Buffers: shared hit=1136
Planning:
  Buffers: shared hit=3
Planning Time: 0.067 ms
Execution Time: 8.903 ms
```

### count, lastName='Kal'

```sql
select count(o1_0.id) from owners o1_0 where o1_0.last_name like 'Kal%' escape '\'
```
```
Aggregate  (cost=8.34..8.35 rows=1 width=8) (actual time=0.190..0.190 rows=1 loops=1)
  Buffers: shared hit=262
  ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=4) (actual time=0.013..0.182 rows=262 loops=1)
        Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
        Filter: (last_name ~~ 'Kal%'::text)
        Buffers: shared hit=262
Planning Time: 0.082 ms
Execution Time: 0.201 ms
```

### pets of one page (@BatchSize)

```sql
select p1_0.owner_id,p1_0.id,p1_0.birth_date,p1_0.name,t1_0.id,t1_0.name from pets p1_0 left join types t1_0 on t1_0.id=p1_0.type_id where p1_0.owner_id = any ('{14970,58178,75365,41100,75087,6967,90208,97192,75859,22779,93647,27714,91502,4495,56868,75898,42774,56949,18597,38990}')
```
```
Nested Loop Left Join  (cost=0.42..183.19 rows=33 width=30) (actual time=0.019..0.083 rows=31 loops=1)
  Join Filter: (t1_0.id = p1_0.type_id)
  Rows Removed by Join Filter: 34
  Buffers: shared hit=91
  ->  Index Scan using pets_owner_id_idx on pets p1_0  (cost=0.42..180.92 rows=33 width=26) (actual time=0.008..0.066 rows=31 loops=1)
        Index Cond: (owner_id = ANY ('{14970,58178,75365,41100,75087,6967,90208,97192,75859,22779,93647,27714,91502,4495,56868,75898,42774,56949,18597,38990}'::integer[]))
        Buffers: shared hit=90
  ->  Materialize  (cost=0.00..1.04 rows=3 width=8) (actual time=0.000..0.000 rows=2 loops=31)
        Buffers: shared hit=1
        ->  Seq Scan on types t1_0  (cost=0.00..1.03 rows=3 width=8) (actual time=0.002..0.002 rows=3 loops=1)
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=65
Planning Time: 0.287 ms
Execution Time: 0.091 ms
```

### prepared statement, 7th execution (plan_cache_mode=auto), sort=name asc, lastName='Kal'

```sql
EXECUTE page('Kal%', 0, 20)
```
```
Limit  (cost=8.48..8.51 rows=10 width=57) (actual time=0.121..0.123 rows=20 loops=1)
  Buffers: shared hit=262
  ->  Sort  (cost=8.48..8.51 rows=10 width=57) (actual time=0.121..0.122 rows=20 loops=1)
        Sort Key: last_name, first_name, id
        Sort Method: top-N heapsort  Memory: 28kB
        Buffers: shared hit=262
        ->  Index Scan using owners_last_name_prefix_idx on owners o1_0  (cost=0.29..8.31 rows=10 width=57) (actual time=0.003..0.059 rows=262 loops=1)
              Index Cond: ((last_name ~>=~ 'Kal'::text) AND (last_name ~<~ 'Kam'::text))
              Filter: (last_name ~~ 'Kal%'::text)
              Buffers: shared hit=262
Planning Time: 0.034 ms
Execution Time: 0.127 ms
```

### prepared statement, forced GENERIC plan, sort=name asc, lastName='Kal'

```sql
EXECUTE page('Kal%', 0, 20)
```
```
Limit  (cost=854.02..1707.62 rows=50 width=57) (actual time=10.320..10.328 rows=20 loops=1)
  Buffers: shared hit=31577
  ->  Index Scan using owners_name_sort_idx on owners o1_0  (cost=0.42..8536.42 rows=500 width=57) (actual time=10.320..10.326 rows=20 loops=1)
        Filter: (last_name ~~ like_escape($1, '\'::text))
        Rows Removed by Filter: 31422
        Buffers: shared hit=31577
Planning Time: 0.003 ms
Execution Time: 10.336 ms
```

### prepared statement, forced GENERIC plan, sort=name asc, lastName='Zzz' (no match)

```sql
EXECUTE page('Zzz%', 0, 20)
```
```
Limit  (cost=854.02..1707.62 rows=50 width=57) (actual time=26.023..26.023 rows=0 loops=1)
  Buffers: shared hit=100409
  ->  Index Scan using owners_name_sort_idx on owners o1_0  (cost=0.42..8536.42 rows=500 width=57) (actual time=26.021..26.021 rows=0 loops=1)
        Filter: (last_name ~~ like_escape($1, '\'::text))
        Rows Removed by Filter: 100000
        Buffers: shared hit=100409
Planning Time: 0.009 ms
Execution Time: 26.038 ms
```

