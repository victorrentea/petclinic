-- Indexes for the paginated owners grid (issue #25).
--
-- Until now `owners` carried no index except its primary key: fine for 28 rows,
-- but the business is aiming at 100.000 owners, and every page of the grid is an
-- ORDER BY + LIMIT/OFFSET over the whole table.
--
-- Each ordering ends in `id` because `last_name` is not unique (Darling x2,
-- Potter x2). Without a unique tie-breaker LIMIT/OFFSET may return a row on two
-- consecutive pages and skip another one entirely. The index has to carry `id`
-- as its last column too, or it stops covering the ordering.
CREATE INDEX owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx ON owners (city, id);

-- Not redundant with owners_name_idx. This database collates en_US.UTF-8, and
-- under a non-C collation a plain btree cannot serve `LIKE 'Pot%'` -- only a
-- text_pattern_ops index can. Conversely this index cannot serve
-- `ORDER BY last_name`, because its ordering is byte-wise. Different jobs.
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
