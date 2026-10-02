-- The paged owners grid (#25): filter by last-name prefix, order by Name or City, ~100k owners.
-- Additive only, so the application version before paging runs unchanged against this schema.

-- last_name LIKE 'Pre%' can use a plain B-tree only under the C collation; this one works under any.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);

-- The two sort chains, each ending in id. One direction for the whole chain, so a backward scan
-- of the same index serves the descending order too.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
