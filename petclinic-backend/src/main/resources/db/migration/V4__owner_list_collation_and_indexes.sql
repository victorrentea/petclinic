-- The Owners grid sorts by name or city, a page at a time, over ~50k owners (VOLUMETRICS.md).

-- Romanian alphabet rules (Ș after S, Ț after T), declared on the columns so every environment
-- orders alike, whatever locale its cluster was initialised with.
ALTER TABLE owners
    ALTER COLUMN first_name TYPE TEXT COLLATE "ro-RO-x-icu",
    ALTER COLUMN last_name  TYPE TEXT COLLATE "ro-RO-x-icu",
    ALTER COLUMN city       TYPE TEXT COLLATE "ro-RO-x-icu";

-- One per sort the grid offers; id last makes each order total, so paging is stable.
CREATE INDEX owners_by_name      ON owners (last_name, first_name, id);
CREATE INDEX owners_by_city      ON owners (city, last_name, first_name, id);
-- City Z→A keeps the names A→Z: a mixed direction no backward scan of owners_by_city can give.
CREATE INDEX owners_by_city_desc ON owners (city DESC, last_name, first_name, id);

-- The last-name prefix search (LIKE 'Pot%'): a plain btree under an ICU collation cannot serve it.
CREATE INDEX owners_last_name_prefix ON owners (last_name text_pattern_ops);
