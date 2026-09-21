-- Schema only, no rows: the dataset lives in db/seed/R__seed.sql.
--
-- The owners grid pages with LIMIT/OFFSET over an ORDER BY, and the server closes every ordering
-- with the id so page boundaries are stable. These two indexes mirror those ORDER BY clauses
-- column for column, id included, so the planner can walk the index instead of sorting the table.
-- The lastName prefix filter (last_name LIKE 'x%') rides the first index as well.
CREATE INDEX idx_owners_last_name_first_name_id ON owners (last_name, first_name, id);
CREATE INDEX idx_owners_city_id ON owners (city, id);
