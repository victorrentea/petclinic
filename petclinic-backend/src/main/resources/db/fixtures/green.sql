-- Fixture "green": exactly ONE of everything — one owner (Molly Weasley), one pet, one visit,
-- one vet with one specialty, one pet type, one user with one role. The smallest dataset on
-- which every screen still has something to show, for a demo that must read row by row.
--
-- A fixture is a DELTA ON THE SEED, never a dataset of its own. The reset sidecar
-- (docker/reset/reset-server.py) empties every table, restores the seed, and only then runs
-- this file — all in one transaction. So this one trims the seed down with DELETEs and adds
-- its own rows; when the schema or R__seed.sql moves, only the rows named here move with it.
--
-- NOT a Flyway location: spring.flyway.locations names db/migration and db/seed only, so the
-- application never runs this. It ships next to the seed so the two read side by side; the
-- only thing that executes it is the reset sidecar, which does not exist in production.
--
-- The file name is the fixture's name: the review page draws one button per *.sql here.
--
-- Ids are looked up, not hardcoded: the seed owns ids 1..N and may grow, and a fixture that
-- assumed "the next owner is 27" would break the day the seed gains a row.

-- Children before parents, so no foreign key is ever left dangling mid-file.
DELETE FROM visits;
DELETE FROM pets;
DELETE FROM owners;

-- The one vet kept, Helen Leary, is the seed's radiologist: one vet, one specialty, one link.
DELETE FROM vet_specialties
WHERE vet_id NOT IN (SELECT id FROM vets WHERE first_name = 'Helen' AND last_name = 'Leary')
  OR specialty_id NOT IN (SELECT id FROM specialties WHERE name = 'radiology');
DELETE FROM vets WHERE NOT (first_name = 'Helen' AND last_name = 'Leary');
DELETE FROM specialties WHERE name <> 'radiology';

DELETE FROM types WHERE name <> 'bird';

-- The seed's only user, admin, keeps one role. Security is off in the demo stack
-- (petclinic.security.enable=false); with it on, OWNER_ADMIN is the role that opens the
-- owner, pet and visit screens this dataset is about.
DELETE FROM roles WHERE role <> 'ROLE_OWNER_ADMIN';

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Molly', 'Weasley', 'The Burrow', 'Ottery St Catchpole', '0441404812345');

INSERT INTO pets (name, birth_date, type_id, owner_id)
SELECT 'Errol', DATE '2012-03-01', t.id, o.id      -- the family owl, crashes into windows
FROM types t
JOIN owners o ON o.first_name = 'Molly' AND o.last_name = 'Weasley'
WHERE t.name = 'bird';

INSERT INTO visits (pet_id, visit_date, visit_time, description)
SELECT pet.id, DATE '2024-01-18', TIME '11:00', 'concussion after flying into a window'
FROM pets pet
WHERE pet.name = 'Errol';
