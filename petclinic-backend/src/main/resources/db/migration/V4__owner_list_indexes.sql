-- The paged owner list (GET /api/owners) filters on a last-name prefix and orders by Name or City.
-- LIKE 'prefix%' cannot use a plain btree under a non-C collation such as en_US.UTF-8: it needs
-- text_pattern_ops. The two ordering indexes match the sort chains column for column; one
-- direction applies to the whole chain, so each serves both asc (forward) and desc (backward).
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
