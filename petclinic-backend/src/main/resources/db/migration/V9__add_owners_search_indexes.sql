-- Owners grid becomes server-paginated, sorted, and filtered (issue #25). With thousands of owners
-- planned in production, back these access paths with indexes.
--
-- The database collation is C (byte-wise), so a plain btree on last_name is usable both for the
-- prefix filter (WHERE last_name LIKE 'x%', from findByLastNameStartingWith) AND for ORDER BY
-- last_name, first_name — no text_pattern_ops needed. A single composite index covers both.
CREATE INDEX idx_owners_last_name_first_name ON owners (last_name, first_name);

-- Supports sorting the grid by the City column.
CREATE INDEX idx_owners_city ON owners (city);
