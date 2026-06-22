CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_owners_first_name_trgm ON owners USING gin (lower(first_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_owners_last_name_trgm  ON owners USING gin (lower(last_name)  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_owners_address_trgm    ON owners USING gin (lower(address)    gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_owners_city_trgm       ON owners USING gin (lower(city)       gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_owners_telephone_trgm  ON owners USING gin (lower(telephone)  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pets_name_trgm         ON pets   USING gin (lower(name)       gin_trgm_ops);
