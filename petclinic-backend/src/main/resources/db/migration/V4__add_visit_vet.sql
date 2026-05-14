ALTER TABLE visits
    ADD COLUMN vet_id INT REFERENCES vets (id);

CREATE INDEX ON visits (vet_id);
