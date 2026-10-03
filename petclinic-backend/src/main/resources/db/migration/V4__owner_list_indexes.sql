-- Owners list: a last-name prefix filter, then a page in Name or City order.
-- text_pattern_ops: under a non-C collation (en_US.UTF-8) a plain btree cannot serve LIKE 'prefix%'.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);
-- One direction for the whole chain, so a descending sort walks the same index backwards.
CREATE INDEX owners_name_order_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_order_idx ON owners (city, last_name, first_name, id);
