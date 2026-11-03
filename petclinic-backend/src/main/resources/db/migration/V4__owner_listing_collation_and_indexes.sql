-- ICU collation so that sorting puts 'Ștefan' next to 'S' and 'de Panne' next to 'Dublin'
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN last_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN city TYPE TEXT COLLATE "und-x-icu";

CREATE INDEX owners_name_idx ON owners (first_name, last_name, id);
CREATE INDEX owners_city_idx ON owners (city, first_name, last_name, id);
-- a b-tree on a non-C collation cannot serve LIKE 'x%'
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
