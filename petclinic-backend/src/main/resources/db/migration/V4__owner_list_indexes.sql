-- Owners grid (#25): filter by last-name prefix, then page through a Name or City ordering.

-- LIKE 'prefix%' can only use a b-tree under a non-C collation through the pattern operator class.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

-- One index per sort chain; every member shares the direction, so each serves both asc and desc.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
