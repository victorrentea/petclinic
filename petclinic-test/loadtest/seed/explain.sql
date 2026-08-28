-- EXPLAIN evidence for the PAGED owners grid (GitHub #25, migration V9).
--
-- Every statement below was copied out of the Postgres log while the backend served a real
-- request (log_statement=all), so these are Hibernate's own queries, not a reconstruction.
-- Requests were told apart by giving each a distinct page size, so no log-window overlap
-- can attribute a statement to the wrong request.
--
-- The four shapes Hibernate emits are: {sort by name, sort by city} x {page 0, deep page}.
-- Page 0 carries no OFFSET clause at all; a deep page adds `offset $n rows`.
-- Every request also runs the count query for Page.totalElements.
--
-- The deep OFFSET is derived from the row count, so this file works at 10k and at 100k.

\echo '=== [1] FIRST page, sort=name — order by last_name, first_name, id ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE '%' ESCAPE '\'
ORDER BY o1_0.last_name, o1_0.first_name, o1_0.id
FETCH FIRST 5 ROWS ONLY;

\echo '=== [2] DEEP page, sort=name — same query plus OFFSET (the paging question) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE '%' ESCAPE '\'
ORDER BY o1_0.last_name, o1_0.first_name, o1_0.id
OFFSET (SELECT count(*) - 5 FROM owners) ROWS FETCH FIRST 5 ROWS ONLY;

\echo '=== [3] FIRST page, sort=city,desc ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE '%' ESCAPE '\'
ORDER BY o1_0.city DESC, o1_0.id DESC
FETCH FIRST 5 ROWS ONLY;

\echo '=== [4] DEEP page, sort=city,desc ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE '%' ESCAPE '\'
ORDER BY o1_0.city DESC, o1_0.id DESC
OFFSET (SELECT count(*) - 5 FROM owners) ROWS FETCH FIRST 5 ROWS ONLY;

\echo '=== [5] the count query — runs on EVERY request, for Page.totalElements ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(o1_0.id) FROM owners o1_0 WHERE o1_0.last_name LIKE '%' ESCAPE '\';

\echo '=== [6] SELECTIVE prefix, first page — does owners_last_name_pattern_idx serve LIKE? ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE 'Quarrierstein%' ESCAPE '\'
ORDER BY o1_0.last_name, o1_0.first_name, o1_0.id
FETCH FIRST 5 ROWS ONLY;

\echo '=== [7] BROAD prefix, first page ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE 'L%' ESCAPE '\'
ORDER BY o1_0.last_name, o1_0.first_name, o1_0.id
FETCH FIRST 5 ROWS ONLY;

\echo '=== [8] count query under a selective prefix ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(o1_0.id) FROM owners o1_0 WHERE o1_0.last_name LIKE 'Quarrierstein%' ESCAPE '\';

-- Hibernate does NOT send literals: it sends `like $1` with a bind parameter. After five
-- executions Postgres may switch to a GENERIC plan, which cannot know the parameter starts
-- with a constant prefix and therefore cannot turn LIKE into an index range. If that
-- happens, the pattern index is unusable in production no matter how good [6] looks.
-- This reproduces exactly what the driver does.
\echo '=== [9] the SAME query as a PREPARED statement — generic vs custom plan ==='
PREPARE grid_prefix (text, int) AS
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE $1 ESCAPE '\'
ORDER BY o1_0.last_name, o1_0.first_name, o1_0.id
FETCH FIRST $2 ROWS ONLY;

\echo '--- executions 1-5 (custom plans) ---'
EXPLAIN (ANALYZE) EXECUTE grid_prefix('Quarrierstein%', 5);
EXPLAIN (ANALYZE) EXECUTE grid_prefix('Quarrierstein%', 5);
EXPLAIN (ANALYZE) EXECUTE grid_prefix('Quarrierstein%', 5);
EXPLAIN (ANALYZE) EXECUTE grid_prefix('Quarrierstein%', 5);
EXPLAIN (ANALYZE) EXECUTE grid_prefix('Quarrierstein%', 5);
\echo '--- execution 6+ (this is where a generic plan would appear) ---'
EXPLAIN (ANALYZE, BUFFERS) EXECUTE grid_prefix('Quarrierstein%', 5);
EXPLAIN (ANALYZE, BUFFERS) EXECUTE grid_prefix('Quarrierstein%', 5);
DEALLOCATE grid_prefix;

\echo '=== [10] ONE lazy pets load — still runs once PER OWNER ON THE PAGE ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT p1_0.owner_id, p1_0.id, p1_0.birth_date, p1_0.name, t1_0.id, t1_0.name
FROM pets p1_0
LEFT JOIN types t1_0 ON t1_0.id = p1_0.type_id
WHERE p1_0.owner_id = 4242;

\echo '=== [11] ONE lazy visits load — once PER PET on the page ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT v1_0.pet_id, v1_0.id, v1_0.visit_date, v1_0.description, v1_0.visit_time
FROM visits v1_0
WHERE v1_0.pet_id = 4242;

\echo '=== indexes on owners ==='
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'owners' ORDER BY indexname;

\echo '=== how often each owners index was ACTUALLY used by the load run ==='
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes WHERE relname = 'owners' ORDER BY indexrelname;

\echo '=== sequential scans of owners during the load run (0 would be ideal) ==='
SELECT seq_scan, seq_tup_read, idx_scan FROM pg_stat_user_tables WHERE relname = 'owners';

\echo '=== collation (decides whether a plain btree can serve LIKE prefix) ==='
SELECT datcollate FROM pg_database WHERE datname = current_database();
