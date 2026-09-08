-- A visit records the vet that attended the consultation.
-- Nullable: legacy rows have no vet, and visits booked over MCP don't pick one.
ALTER TABLE visits ADD COLUMN vet_id INT REFERENCES vets (id);
CREATE INDEX ON visits (vet_id);

-- Backfill: every visit in the DB at this point comes from the V3 sample data,
-- spread round-robin over the 6 seeded vets so the UI has something to show.
UPDATE visits SET vet_id = 1 + (id % 6);
