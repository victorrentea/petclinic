-- Owner listing: make it pageable, sortable and searchable at 100k rows.
--
-- The `owners` table carried no index at all until now (V1 indexed types, pets and
-- visits, and skipped this one), while every page of the grid sorts by name or city
-- and filters by a last-name prefix.

-- 1. Ordering is a property of this schema, not of the server's locale.
--
-- This database was created with the C collation (byte order), which files
-- 'Śliwiński' after 'Wensleydale' instead of between 'Silver' and 'Tremaine'.
-- Rather than rebuild the cluster - or repeat COLLATE in every ORDER BY, where one
-- omission silently drops the index below - the collation is pinned on the columns
-- themselves, so every query sorting them is linguistic by default.
--
-- "unicode" is the built-in ICU root collation: present in any PostgreSQL >= 16
-- regardless of which OS locales the host happens to have installed, and
-- deterministic, so LIKE still works on these columns.
ALTER TABLE owners ALTER COLUMN last_name TYPE TEXT COLLATE "unicode";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "unicode";
ALTER TABLE owners ALTER COLUMN city TYPE TEXT COLLATE "unicode";

-- 2. The default sort: (last_name, first_name) with the id tiebreak that keeps
-- paging stable. The index order *is* the ORDER BY, so a page is an index walk
-- with no Sort node - and it inherits the columns' collation from above.
CREATE INDEX idx_owners_name ON owners (last_name, first_name, id);

-- 3. The other offered sort.
CREATE INDEX idx_owners_city ON owners (city, id);

-- 4. The last-name prefix search (LIKE 'Pot%'). A btree in a linguistic collation
-- cannot serve a prefix LIKE; text_pattern_ops compares byte-wise, which can.
CREATE INDEX idx_owners_last_name_prefix ON owners (last_name text_pattern_ops);
