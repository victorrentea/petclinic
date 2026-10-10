-- Fixture "green": exactly ONE of everything — one owner (Molly Weasley), one pet, one visit,
-- one vet with one specialty, one pet type, one user with one role. The smallest dataset on
-- which every screen still has something to show, for a demo that must read row by row.
--
-- A fixture is a DATASET OF ITS OWN, built on an empty database — never a delta on the seed.
-- The reset sidecar (docker/reset/reset-server.py) empties every table, restarting the
-- identity sequences, and runs this file on that, in one transaction. So every row green
-- has is written here, and what R__seed.sql holds never leaks into it.
--
-- NOT a Flyway location: spring.flyway.locations names db/migration and db/seed only, so the
-- application never runs this. It ships next to the seed so the two read side by side; the
-- only thing that executes it is the reset sidecar, which does not exist in production.
--
-- The file name is the fixture's name: the review page draws one button per *.sql here.
--
-- The ids are literal because the database starts empty with every sequence at 1: the first
-- row of each table is id 1.

-- Parents before children, so no foreign key ever points at a row not yet written.
INSERT INTO types (name) VALUES ('bird');                                  -- type 1

-- The one vet, Helen Leary, the seed's radiologist: one vet, one specialty, one link.
INSERT INTO vets (first_name, last_name) VALUES ('Helen', 'Leary');        -- vet 1

INSERT INTO specialties (name, description) VALUES
  ('radiology',
    'limping, limp, broken bone, fracture, suspected fracture, swollen leg, can''t bear weight, holding up a paw, joint pain after a fall, suspected internal injury, ingested a foreign object.');

INSERT INTO vet_specialties (specialty_id, vet_id) VALUES (1, 1);

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Molly', 'Weasley', 'The Burrow', 'Ottery St Catchpole', '0441404812345');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Errol', DATE '2012-03-01', 1, 1);      -- the family owl, crashes into windows

INSERT INTO visits (pet_id, visit_date, visit_time, description) VALUES
  (1, DATE '2024-01-18', TIME '11:00', 'concussion after flying into a window');

-- One user, admin, with the seed's password hash and one role. Security is off in the
-- demo stack (petclinic.security.enable=false); with it on, OWNER_ADMIN is the role that
-- opens the owner, pet and visit screens this dataset is about.
INSERT INTO users (username, password, enabled) VALUES
  ('admin', '$2a$10$ymaklWBnpBKlgdMgkjWVF.GMGyvH8aDuTK.glFOaKw712LHtRRymS', TRUE);

INSERT INTO roles (username, role) VALUES ('admin', 'ROLE_OWNER_ADMIN');
