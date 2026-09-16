-- The attending vet. Nullable: legacy rows have none, and MCP-booked visits don't pick one.
-- Its own migration rather than a line appended to V3: V3 has already run on every database
-- out there, and editing an applied migration changes its checksum, so Flyway refuses to
-- start against any of them.
ALTER TABLE visits ADD COLUMN vet_id INT REFERENCES vets (id);
CREATE INDEX ON visits (vet_id);
