-- Visits record the attending vet
ALTER TABLE visits ADD COLUMN vet_id INTEGER;
ALTER TABLE visits ADD CONSTRAINT visits_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES vets (id);
