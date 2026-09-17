-- The vet who attended the consultation. Nullable on purpose: a visit is often booked before
-- anyone knows who will take it, and every row that existed before this column stays NULL.
-- ON DELETE SET NULL because retiring a vet must not be blocked by their history, and a visit
-- whose vet is gone is exactly the "no vet" case the app already has to render.
ALTER TABLE visits ADD COLUMN vet_id INT REFERENCES vets (id) ON DELETE SET NULL;
-- Same reason pet_id is indexed: the FK check behind a vet delete would otherwise scan visits.
CREATE INDEX ON visits (vet_id);
