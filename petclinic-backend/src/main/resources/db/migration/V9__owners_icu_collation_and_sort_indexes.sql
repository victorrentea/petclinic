-- Issue #25 (openspec/changes/add-owners-pagination): the owners list is now sortable by
-- last_name/city. Plain byte-order LIKE/ORDER BY on the C collation the DB was created with
-- treats diacritics as coming after every ASCII letter; und-x-icu sorts Unicode-aware. Both
-- ICU collation and the matching indexes are added here so the new sort is both correct and
-- indexed, ready for the 100k-owner production volume (see AGENTS.md "Volumetry").
ALTER TABLE owners ALTER COLUMN last_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN city TYPE TEXT COLLATE "und-x-icu";

CREATE INDEX ON owners (last_name, first_name, id);
CREATE INDEX ON owners (city, last_name, first_name, id);
