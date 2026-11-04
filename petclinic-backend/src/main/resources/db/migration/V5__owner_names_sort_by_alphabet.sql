-- Owners come from everywhere (Śliwiński, Kraków, Île-de-France), but the database default collation
-- orders them by code point, after Z. It also comes from whatever locale initdb ran under, so it differs
-- between machines. The ICU root collation sorts by the alphabet, the same on every machine: an accent or
-- a case only breaks a tie. It is deterministic, so = and LIKE still compare exactly.
--
-- Postgres rebuilds the V4 indexes on these columns under the new collation. owners_last_name_prefix_idx
-- keeps serving LIKE 'x%': text_pattern_ops compares bytes, whatever the collation of the column.
ALTER TABLE owners
    ALTER COLUMN first_name TYPE text COLLATE "und-x-icu",
    ALTER COLUMN last_name TYPE text COLLATE "und-x-icu",
    ALTER COLUMN city TYPE text COLLATE "und-x-icu";
