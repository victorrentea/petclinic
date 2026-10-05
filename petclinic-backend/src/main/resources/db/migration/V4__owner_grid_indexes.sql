-- The grid's order must not depend on how the server was initialised: under the C locale a
-- CI runner sorts 'Śliwiński' after 'Zyx'. ICU's English collation is bundled with Postgres.
ALTER TABLE owners
    ALTER COLUMN last_name  TYPE TEXT COLLATE "en-x-icu",
    ALTER COLUMN first_name TYPE TEXT COLLATE "en-x-icu",
    ALTER COLUMN city       TYPE TEXT COLLATE "en-x-icu";

-- Owners grid: each sort is served by its own index; the trailing id makes the order total.
CREATE INDEX owners_name_sort ON owners (last_name, first_name, id);
CREATE INDEX owners_city_sort ON owners (city, last_name, first_name, id);
-- A collated btree cannot serve LIKE 'Da%'; text_pattern_ops can, but not ORDER BY.
CREATE INDEX owners_last_name_prefix ON owners (last_name text_pattern_ops);
