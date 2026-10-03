-- Owners list: a LIKE 'prefix%' filter needs text_pattern_ops under a non-C collation;
-- the other two follow the Name and City sort chains, readable in both directions.
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
