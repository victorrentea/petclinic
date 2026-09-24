CREATE INDEX owners_name_sort_idx   ON owners (last_name, first_name, id);
CREATE INDEX owners_city_sort_idx   ON owners (city, last_name, first_name, id);
CREATE INDEX owners_last_name_prefix_idx ON owners (last_name text_pattern_ops);
