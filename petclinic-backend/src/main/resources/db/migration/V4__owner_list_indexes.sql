-- The paged owner list (GET /api/owners): a last-name prefix filter, ordered by Name or City.

-- LIKE 'Pot%' can only use a b-tree under a non-C collation through the pattern operator class.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

-- The two sort chains; one direction applies to the whole chain, so each is also read backwards.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
