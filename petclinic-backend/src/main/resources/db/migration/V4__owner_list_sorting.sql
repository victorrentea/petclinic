-- The owners grid sorts by name and by city: linguistic order (ICU root collation),
-- not byte order, so "Łódź" sorts next to "L" and "de la Cruz" next to "D".
ALTER TABLE owners
    ALTER COLUMN last_name  TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN city       TYPE TEXT COLLATE "und-x-icu";

-- One index per sort chain, so the first page reads a page of index entries, not the table.
-- Created after the collation change, so they carry it.
CREATE INDEX owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx ON owners (city, last_name, first_name, id);
