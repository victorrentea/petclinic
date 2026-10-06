-- The Owners grid pages through ~100k owners sorted by name or by city. Each sort index ends in
-- id, like the ORDER BY the API sends, so a page is a short index walk instead of sorting the table.
CREATE INDEX owners_name_idx ON owners (first_name, last_name, id);
CREATE INDEX owners_city_idx ON owners (city, first_name, last_name, id);

-- The last-name search is a prefix LIKE 'x%'. Under a linguistic collation (en_US.UTF-8) a plain
-- btree cannot serve it; text_pattern_ops compares byte-wise, which a prefix match needs.
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
