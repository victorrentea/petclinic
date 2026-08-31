-- The owners grid is now paged server-side and the table grows to ~100.000 rows, but `owners`
-- carried no index at all besides owners_pkey: every listing was a seq scan plus a sort.
-- Each index below ends in the ordering's unique tie-breaker (id), so the index order IS the
-- query order and a page is an index scan with an offset — no separate sort node.

-- serves the default ordering: ORDER BY last_name, first_name, id
CREATE INDEX ON owners (last_name, first_name, id);

-- serves ORDER BY city, id
CREATE INDEX ON owners (city, id);

-- serves the last-name prefix filter: last_name LIKE 'Pot%'. A separate index because under the
-- database's en_US.UTF-8 collation a default btree cannot answer LIKE 'prefix%', and conversely a
-- text_pattern_ops btree sorts in C byte order so it cannot serve ORDER BY last_name.
-- Drop it if the search ever moves to ILIKE/pg_trgm, which this index does not help.
CREATE INDEX ON owners (last_name text_pattern_ops);
