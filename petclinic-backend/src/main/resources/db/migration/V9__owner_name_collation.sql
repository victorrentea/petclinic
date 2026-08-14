-- Ordering of owner names and cities must follow Romanian locale rules, not byte values,
-- and must not depend on the locale the database cluster happened to be initialised with.
-- Pinning the collation on the columns makes ordering a property of the schema: every
-- ORDER BY inherits it, so dev, CI and production cannot disagree, and no Java code changes.
ALTER TABLE owners ALTER COLUMN last_name  TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE text COLLATE "ro-x-icu";
