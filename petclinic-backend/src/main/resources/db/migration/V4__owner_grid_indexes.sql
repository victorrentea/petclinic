-- Supports the paginated owners grid: two sort orders (name, city) with total tie-breakers
-- so LIMIT/OFFSET pages never repeat or skip a row, plus the last-name prefix search.
CREATE INDEX owners_name_sort_idx ON owners (first_name, last_name, id);
CREATE INDEX owners_city_sort_idx ON owners (city, first_name, last_name, id);
-- text_pattern_ops: under en_US.UTF-8 collation a plain btree index cannot serve LIKE 'prefix%'.
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
