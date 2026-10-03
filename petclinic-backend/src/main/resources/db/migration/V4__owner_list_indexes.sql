-- The owners grid (GET /api/owners) pages through ~100k owners by Name or City, filtered by a
-- last-name prefix. Each sort chain ends in id, so offset pages never overlap; one direction applies
-- to the whole chain, so either can walk the same index forwards or backwards.

-- LIKE 'prefix%' cannot use a plain B-tree under a non-C collation; text_pattern_ops can.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);

CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
