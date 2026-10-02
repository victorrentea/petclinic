-- ICU so accented names sort alphabetically ('Łukasz' after 'Long'), not after 'Z' as under the C collation
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN last_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN city TYPE TEXT COLLATE "und-x-icu";

CREATE INDEX ON owners (first_name, last_name, id);
CREATE INDEX ON owners (city, id);
-- a non-C collation needs pattern_ops for LIKE 'prefix%' to use an index
CREATE INDEX ON owners (last_name text_pattern_ops);
