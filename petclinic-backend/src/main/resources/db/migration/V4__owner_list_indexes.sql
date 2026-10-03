-- The paged owner list (GET /api/owners) filters by a last-name prefix and orders by Name or City.

-- LIKE 'Pot%' can only use a b-tree under the non-C collation through text_pattern_ops.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

-- One column per sort chain entry, all ascending: a backward scan serves the descending sort.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
