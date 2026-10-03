-- The owners grid filters by a last-name prefix, then pages through the matches sorted by Name or City.

-- LIKE 'prefix%': under the en_US.UTF-8 collation a plain btree cannot serve a prefix match
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

-- One index per sort chain, ending with the id that makes the order total; the whole chain
-- flips direction together, so a backward scan serves the descending sort too.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
