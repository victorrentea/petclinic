-- Owners grid is sorted and paged on the server (issue #25).

-- ICU instead of the database default "C", so accented names (Śliwiński) sort next to their base
-- letter instead of after Z. Deterministic, so = and LIKE stay exact and case-sensitive.
-- address keeps "C": it is not a sort key.
ALTER TABLE owners
    ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN last_name  TYPE TEXT COLLATE "und-x-icu",
    ALTER COLUMN city       TYPE TEXT COLLATE "und-x-icu";

-- Default sort (Name = first name, last name, id as tie-breaker), served in either direction.
CREATE INDEX owners_name_sort_idx ON owners (first_name, last_name, id);

-- Prefix search lastName LIKE 'x%': an index in a non-C collation cannot serve it.
CREATE INDEX owners_last_name_like_idx ON owners (last_name text_pattern_ops);
