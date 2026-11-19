-- The owners list pages and sorts on the server (#25), for ~100,000 owners.

-- Alphabetical as a reader expects: the database default (C.UTF-8) compares bytes, putting
-- 'Śliwiński' after 'Wensleydale'. ICU's root collation is deterministic, so equality and the
-- case-sensitive LIKE 'Pot%' keep their meaning.
ALTER TABLE owners
    ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN last_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN city TYPE TEXT COLLATE "und-x-icu";

-- One index per sort order, ending with id: the tie-breaker that keeps pages from overlapping.
CREATE INDEX owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx ON owners (city, last_name, first_name, id);

-- The last-name prefix search: under a non-C collation a plain btree can't serve LIKE 'x%'.
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
