-- Owners are listed a page at a time, sorted by name or city, and searched by last name,
-- at a volume where each of those must be served by an index (VOLUMETRY.md).

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- Two arguments with a qualified dictionary: the one-argument form depends on search_path,
-- which would make IMMUTABLE a lie and the index on this function unsafe.
CREATE FUNCTION search_key(text) RETURNS text AS $$
    SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1))
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

-- ICU sorts letters with diacritics next to their base letter; C.UTF-8 puts them after Z.
ALTER TABLE owners
    ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN last_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN city TYPE TEXT COLLATE "und-x-icu";

CREATE INDEX owners_by_name ON owners (first_name, last_name, id);
CREATE INDEX owners_by_city ON owners (city, first_name, last_name, id);
CREATE INDEX owners_by_search_key ON owners (search_key(last_name) text_pattern_ops);
