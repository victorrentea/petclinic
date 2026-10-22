-- The Owners grid sorts by name and by city (#25), for 50,000 owners (VOLUMETRY.md).

-- Romanian alphabetical order (Ș after S, Ț after T), pinned on the columns so dev, tests and
-- production agree whatever collation each database was created with.
-- Rewrites the table: instant today, a lock worth planning for on a large copy.
ALTER TABLE owners
    ALTER COLUMN last_name TYPE TEXT COLLATE "ro-RO-x-icu",
    ALTER COLUMN first_name TYPE TEXT COLLATE "ro-RO-x-icu",
    ALTER COLUMN city TYPE TEXT COLLATE "ro-RO-x-icu";

-- One index per sort, ending on id like the ORDER BY does, so a page reads only its own rows.
CREATE INDEX owners_by_name ON owners (last_name, first_name, id);
CREATE INDEX owners_by_city ON owners (city, last_name, first_name, id);

-- The last-name prefix search (LIKE 'Mur%'), which an index in a linguistic collation cannot serve.
CREATE INDEX owners_last_name_prefix ON owners (last_name text_pattern_ops);
