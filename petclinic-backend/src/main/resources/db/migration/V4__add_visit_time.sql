-- Visits gain an exact local time of day (MCP create_visit requires it; legacy rows stay NULL)
ALTER TABLE visits ADD COLUMN visit_time TIME;
