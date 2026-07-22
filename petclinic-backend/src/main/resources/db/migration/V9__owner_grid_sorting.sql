-- Owners grid: human-alphabetical ordering + indexes backing the two sortable columns (issue #25).
--
-- The database is created with datcollate = "C" (byte order), under which every lowercase-prefixed
-- surname ("van Gogh", "de Vries") and every accented one ("Ångström") sorts AFTER "Z" — users read
-- that as a broken A-Z page. Pinning the collation on the columns themselves (rather than relying on
-- the cluster's) also makes ordering identical in dev and in production, whose cluster collation we
-- do not control.
ALTER TABLE owners ALTER COLUMN last_name  TYPE TEXT COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "en-US-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE TEXT COLLATE "en-US-x-icu";

-- Both indexes end in id: the sort key must be TOTAL, otherwise LIMIT/OFFSET paging over a
-- non-unique column (city has "London" x6 today, hundreds in production) may legally return the
-- same owner on two pages while dropping another.
CREATE INDEX owners_last_first_id_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_id_idx ON owners (city, id);

-- TRAP, deliberately accepted: a non-"C" collation makes these plain btrees unusable for the
-- lastName prefix search (LIKE 'Dav%'), which degrades to a Filter over a seq scan instead of an
-- Index Cond. Under 1 ms at 10k rows, so we defer the fix; when search becomes hot, add:
--   CREATE INDEX owners_last_name_prefix_idx ON owners (last_name varchar_pattern_ops);
