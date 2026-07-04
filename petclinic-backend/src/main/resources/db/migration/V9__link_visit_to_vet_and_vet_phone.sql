-- A visit is now performed by a vet: add visits.vet_id (nullable FK -> vets), and give vets a phone.
-- The exact time-of-day added in V4 is dropped: visits are booked by date only.
ALTER TABLE vets ADD COLUMN phone TEXT;

ALTER TABLE visits ADD COLUMN vet_id INTEGER;
ALTER TABLE visits ADD CONSTRAINT visits_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES vets(id);
CREATE INDEX visits_vet_id_idx ON visits (vet_id);

ALTER TABLE visits DROP COLUMN visit_time;
