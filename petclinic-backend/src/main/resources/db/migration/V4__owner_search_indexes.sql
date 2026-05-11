DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE INDEX IF NOT EXISTS idx_owners_first_name_trgm ON owners USING GIN (first_name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_owners_last_name_trgm  ON owners USING GIN (last_name  gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_owners_address_trgm    ON owners USING GIN (address    gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_owners_city_trgm       ON owners USING GIN (city       gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_owners_telephone_trgm  ON owners USING GIN (telephone  gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_pets_name_trgm         ON pets   USING GIN (name       gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm not available in this environment — GIN indexes skipped';
END;
$$;
