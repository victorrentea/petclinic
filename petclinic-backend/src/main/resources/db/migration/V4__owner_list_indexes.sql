-- Owners grid: last-name prefix filter, ordered by Name or City, a page at a time.
-- Additive only: the application version before paging runs unchanged on this schema.

-- A plain B-tree serves LIKE 'Pre%' only under the C collation; pattern ops serve it under any.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

-- One direction for the whole chain, so a backward scan serves the descending order too.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
