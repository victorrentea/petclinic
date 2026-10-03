-- Owners grid (GET /api/owners): case-sensitive last-name prefix filter + Name/City orderings.
-- text_pattern_ops: under a non-C collation a plain B-tree cannot serve LIKE 'prefix%'.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);
-- One direction per chain (asc or desc on every key), so each index is scanned either way.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
