-- Composite index for the default sort (lastName, firstName)
CREATE INDEX idx_owners_last_name_first_name ON owners (last_name, first_name);

-- Pattern-ops index so LIKE 'prefix%' is index-backed on last_name
CREATE INDEX idx_owners_last_name_pattern ON owners (last_name text_pattern_ops);

-- Single-column indexes for the other sortable fields
CREATE INDEX idx_owners_city      ON owners (city);
CREATE INDEX idx_owners_address   ON owners (address);
CREATE INDEX idx_owners_telephone ON owners (telephone);
