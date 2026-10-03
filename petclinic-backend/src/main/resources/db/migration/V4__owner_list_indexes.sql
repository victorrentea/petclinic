-- The owners grid (#25) filters by a last-name prefix and pages in Name or City order.

-- LIKE 'prefix%' under a non-C collation (en_US.UTF-8) cannot use a plain btree: text_pattern_ops compares bytes.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

-- One per sortable column, carrying the whole tie-break chain; scanned backwards for the desc direction.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
