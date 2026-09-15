-- Sorting the owners grid by Name needs alphabetic (not byte) ordering of diacritics, which
-- only an ICU collation gives. The collation is put on the column, not the index, so a plain
-- `ORDER BY last_name` picks it up with no COLLATE in the query and the derived Spring Data
-- finder stays a plain method. If ICU is unavailable the column keeps its default collation and
-- the index below still speeds up paging, just without alphabetic diacritic ordering.
DO $$ BEGIN
    CREATE COLLATION IF NOT EXISTS owner_name (provider = icu, locale = 'und');
    ALTER TABLE owners ALTER COLUMN last_name TYPE text COLLATE owner_name;
    ALTER TABLE owners ALTER COLUMN first_name TYPE text COLLATE owner_name;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ICU unavailable, falling back to default collation: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX IF NOT EXISTS owners_city_idx ON owners (city, id);
