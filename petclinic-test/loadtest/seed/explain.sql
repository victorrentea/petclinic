-- EXPLAIN evidence for the owners grid.
--
-- Every statement below was copied out of the Postgres log while the backend served a real
-- request (log_statement=all), so these are Hibernate's own queries, not a reconstruction.
-- The bind parameters are inlined as literals so the plan is a custom plan for that value.

\echo '=== [1] the grid query, empty prefix — this is what GET /api/owners runs ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE '%' ESCAPE '\';

\echo '=== [2] broad prefix search (lastName=L) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE 'L%' ESCAPE '\';

\echo '=== [3] selective prefix search (lastName=Quarrierstein) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT o1_0.id, o1_0.address, o1_0.city, o1_0.first_name, o1_0.last_name, o1_0.telephone
FROM owners o1_0
WHERE o1_0.last_name LIKE 'Quarrierstein%' ESCAPE '\';

\echo '=== [4] ONE lazy pets load — the backend runs this once PER OWNER ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT p1_0.owner_id, p1_0.id, p1_0.birth_date, p1_0.name, t1_0.id, t1_0.name
FROM pets p1_0
LEFT JOIN types t1_0 ON t1_0.id = p1_0.type_id
WHERE p1_0.owner_id = 4242;

\echo '=== [5] ONE lazy visits load — the backend runs this once PER PET ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT v1_0.pet_id, v1_0.id, v1_0.visit_date, v1_0.description, v1_0.visit_time
FROM visits v1_0
WHERE v1_0.pet_id = 4242;

-- The queries below are NOT run by the application: /api/owners has no page/size/sort
-- parameter. They are what a paged, sorted grid would have to run, measured against the
-- schema as it actually stands (owners has one index: the primary key). They are the
-- evidence for the recommendation, and the baseline any fix has to beat. The deep-page
-- OFFSET is derived from the row count so the same file works at 10k and at 100k.

\echo '=== [6] WOULD-BE first page, sorted by name — not implemented; costed here ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, first_name, last_name, city FROM owners
ORDER BY last_name, first_name, id
LIMIT 5 OFFSET 0;

\echo '=== [7] WOULD-BE deep page (last page at size 5), sorted by name ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, first_name, last_name, city FROM owners
ORDER BY last_name, first_name, id
LIMIT 5 OFFSET (SELECT count(*) - 5 FROM owners);

\echo '=== [8] WOULD-BE deep page, sorted by city ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, first_name, last_name, city FROM owners
ORDER BY city, id
LIMIT 5 OFFSET (SELECT count(*) - 5 FROM owners);

\echo '=== [9] WOULD-BE deep page, sorted by name DESC ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, first_name, last_name, city FROM owners
ORDER BY last_name DESC, first_name DESC, id DESC
LIMIT 5 OFFSET (SELECT count(*) - 5 FROM owners);

\echo '=== [10] the total count a paged grid needs for its paginator ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM owners;

\echo '=== indexes that actually exist on owners ==='
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'owners';

\echo '=== collation (decides whether a plain btree can serve LIKE prefix) ==='
SELECT datcollate FROM pg_database WHERE datname = current_database();
