-- Owners sort/pagination (issue #25).
-- The owners list is now server-side sorted case-insensitively by name (last_name, first_name)
-- and by city. Under the database's C collation the pre-existing plain btree indexes only serve
-- case-SENSITIVE ordering, so a lower(...) ORDER BY cannot use them. Add functional (lower) indexes
-- that the case-insensitive search + sort actually use, and drop the now-redundant raw indexes to
-- avoid write-amplification on the ~1M-row owners table.
--
-- NOTE: these are plain (transactional) CREATE INDEX statements, NOT CREATE INDEX CONCURRENTLY.
-- Flyway runs each migration while holding a transactional lock on its schema-history table, and
-- CONCURRENTLY (which must run outside a transaction and waits for concurrent transactions to drain)
-- deadlocks against that lock. For a true zero-downtime build on the 1M-row production table, create
-- these two indexes CONCURRENTLY out-of-band (ops runbook) and let this migration no-op via IF NOT
-- EXISTS. IF EXISTS also lets the DROPs no-op where the raw indexes were never created by a migration
-- (e.g. the Zonky test database).

CREATE INDEX IF NOT EXISTS owners_lower_last_first_idx
    ON owners (lower(last_name), lower(first_name));

CREATE INDEX IF NOT EXISTS owners_lower_city_idx
    ON owners (lower(city));

DROP INDEX IF EXISTS owners_last_name_first_name_idx;

DROP INDEX IF EXISTS owners_city_idx;
