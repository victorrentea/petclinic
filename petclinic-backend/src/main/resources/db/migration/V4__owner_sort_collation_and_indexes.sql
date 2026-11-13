-- The owners grid sorts by name and by city (gh #25). The database's default collation,
-- C.UTF-8, orders by byte, so "Śliwiński" sorted after "Wensleydale". ICU orders the way a
-- reader does; it is deterministic, so equality (and the case-sensitive search) is unchanged.
ALTER TABLE owners ALTER COLUMN last_name  TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE TEXT COLLATE "und-x-icu";

-- One index per sort the grid offers, ending in id like the ORDER BY does, so a page of
-- ~50,000 owners is read straight off the index instead of sorting the whole table.
CREATE INDEX owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx ON owners (city, id);

-- A non-C collation can't serve LIKE 'prefix%' from the indexes above; this one can.
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
