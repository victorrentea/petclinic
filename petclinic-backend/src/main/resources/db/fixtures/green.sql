-- Fixture "green": the seed, plus the Weasley household — a family with four pets and years
-- of visits, for a demo that needs an owner page with real history on it.
--
-- A fixture is a DELTA ON THE SEED, never a dataset of its own. The reset sidecar
-- (docker/reset/reset-server.py) empties every table, restores the seed, and only then runs
-- this file — all in one transaction. So it adds or changes rows and never truncates; and
-- when the schema or R__seed.sql moves, only the rows that differ have to move with it.
--
-- NOT a Flyway location: spring.flyway.locations names db/migration and db/seed only, so the
-- application never runs this. It ships next to the seed so the two read side by side; the
-- only thing that executes it is the reset sidecar, which does not exist in production.
--
-- The file name is the fixture's name: the review page draws one button per *.sql here.
--
-- Ids are looked up, not hardcoded: the seed owns ids 1..N and may grow, and a fixture that
-- assumed "the next owner is 27" would break the day the seed gains a row.

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Molly', 'Weasley', 'The Burrow', 'Ottery St Catchpole', '0441404812345');

INSERT INTO pets (name, birth_date, type_id, owner_id)
SELECT p.name, p.birth_date, t.id, o.id
FROM (VALUES
        ('Scabbers',   DATE '2014-07-31', 'hamster'),  -- the rat that was not a rat
        ('Errol',      DATE '2012-03-01', 'bird'),     -- the family owl, crashes into windows
        ('Pigwidgeon', DATE '2021-06-15', 'bird'),     -- Ron's tiny owl
        ('Arnold',     DATE '2023-02-14', 'hamster')   -- Ginny's Pygmy Puff
      ) AS p(name, birth_date, type_name)
JOIN types  t ON t.name = p.type_name
JOIN owners o ON o.first_name = 'Molly' AND o.last_name = 'Weasley';

INSERT INTO visits (pet_id, visit_date, visit_time, description)
SELECT pet.id, v.visit_date, v.visit_time, v.description
FROM (VALUES
        ('Scabbers',   DATE '2023-09-01', TIME '10:00', 'missing toe noted; owner insists it was always like that'),
        ('Scabbers',   DATE '2024-06-12', TIME '09:30', 'weight loss, restless at night'),
        ('Scabbers',   DATE '2025-05-02', TIME '16:15', 'annual checkup'),
        ('Errol',      DATE '2024-01-18', TIME '11:00', 'concussion after flying into a window'),
        ('Errol',      DATE '2025-01-20', TIME '11:00', 'second concussion, same window'),
        ('Errol',      DATE '2026-03-09', TIME '14:45', 'cataract check'),
        ('Pigwidgeon', DATE '2025-07-04', TIME '08:30', 'over-excitement, will not stop hooting'),
        ('Pigwidgeon', DATE '2026-04-11', TIME '10:30', 'wing feather trim'),
        ('Arnold',     DATE '2026-02-14', TIME '12:00', 'first visit: general checkup'),
        ('Arnold',     DATE '2026-05-20', TIME '15:00', 'fur colour check (it is purple)')
      ) AS v(pet_name, visit_date, visit_time, description)
JOIN pets   pet ON pet.name = v.pet_name
JOIN owners o   ON o.id = pet.owner_id AND o.last_name = 'Weasley';
