-- The vet who attended the visit. Optional: a visit is often booked before anyone knows who
-- takes it, and the rows that existed before this column stay NULL for good.
-- Deleting a vet leaves their past visits standing, just with no vet.
ALTER TABLE visits ADD COLUMN vet_id INT REFERENCES vets (id) ON DELETE SET NULL;
CREATE INDEX ON visits (vet_id);
