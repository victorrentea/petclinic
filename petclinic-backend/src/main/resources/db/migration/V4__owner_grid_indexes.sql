-- Owners grid: each sort is served by its own index; the trailing id makes the order total.
CREATE INDEX owners_name_sort ON owners (last_name, first_name, id);
CREATE INDEX owners_city_sort ON owners (city, last_name, first_name, id);
-- Under a non-C collation a plain btree cannot serve LIKE 'Da%'; text_pattern_ops can, but not ORDER BY.
CREATE INDEX owners_last_name_prefix ON owners (last_name text_pattern_ops);
