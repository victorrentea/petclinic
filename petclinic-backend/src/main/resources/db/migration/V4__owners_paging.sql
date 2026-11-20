-- Accent-aware ordering for the Owners grid: Śliwiński sorts with the S names, not after Z.
ALTER TABLE owners ALTER COLUMN last_name  TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE TEXT COLLATE "und-x-icu";

CREATE INDEX owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx ON owners (city, last_name, first_name, id);
-- Under a non-C collation, LIKE 'Pot%' can only range-scan a byte-ordered (pattern_ops) index.
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
