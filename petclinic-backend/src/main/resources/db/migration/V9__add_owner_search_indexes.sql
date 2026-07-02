-- Indexes to keep the Owners grid fast at ~1M rows (server-side pagination + sorting).
--
-- (last_name, first_name): serves the default "browse all owners ORDER BY last_name,
--   first_name" listing as an ordered index scan (no sort), the Name sort, and the
--   leading column of the findByLastNameStartingWith (last_name LIKE 'x%') prefix filter.
-- (city): serves the City sort.
--
-- NOTE: under a non-C database collation a plain btree does not accelerate the LIKE 'x%'
--   range predicate itself; if last-name prefix search becomes hot on such a deployment,
--   add a text_pattern_ops index. Kept as a plain btree here to match the existing
--   vets(last_name)/pets(name) convention and to serve the Name sort.
CREATE INDEX ON owners (last_name, first_name);
CREATE INDEX ON owners (city);
