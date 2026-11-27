-- GH #25: the Owners grid sorts by name or city and pages through ~100k owners.
-- ICU collation: the database default (C) would put Śliwiński after Wensleydale.
ALTER TABLE owners
    ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN last_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN city TYPE TEXT COLLATE "und-x-icu";

-- One index per sort order, ending in id so ties come back in a fixed order.
CREATE INDEX owners_by_name ON owners (last_name, first_name, id);
CREATE INDEX owners_by_city ON owners (city, last_name, first_name, id);
-- An ICU btree cannot serve LIKE 'Po%'; this one can.
CREATE INDEX owners_last_name_prefix ON owners (last_name text_pattern_ops);
