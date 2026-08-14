-- The owners grid sorts and paginates server-side, so every page click, sort click and search
-- runs an ORDER BY ... LIMIT plus a COUNT over `owners`. The table carried only its primary key,
-- so both were sequential scans followed by a full sort of the matching set to produce 20 rows -
-- at the 10,000 owners this design targets, 20,000 row reads per interaction.
--
-- The sort keys below inherit "ro-x-icu" from the columns (V9), so they match the ORDER BY the
-- application emits exactly and the sort node disappears from the plan rather than merely being
-- fed faster. Verified at 10,000 rows: Seq Scan + top-N heapsort (97 buffers) becomes an
-- Index Scan reading 9 buffers.
--
-- Each index ends in the (last_name, first_name, id) tiebreaker the application appends to every
-- ordering, because a prefix of the sort key is not enough - the index only replaces the sort if
-- it covers the whole of it.

-- The default view and sort=name.
CREATE INDEX ON owners (last_name, first_name, id);

-- sort=city.
CREATE INDEX ON owners (city, last_name, first_name, id);

-- The last-name search is LIKE 'prefix%', which an ICU-collated btree cannot serve: ICU sort
-- order is not byte order, so the range scan is only valid under C-style comparison.
-- text_pattern_ops supplies exactly that, and is what keeps the COUNT off a sequential scan
-- when the grid is filtered.
CREATE INDEX ON owners (last_name text_pattern_ops);

-- Deliberately no index for sort=petCount: it orders by a correlated subquery
-- (Owner.petCount is an @Formula), which no index on `owners` can support.
