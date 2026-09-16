-- Demo / test dataset. NOT part of the incremental chain in db/migration.
--
-- Repeatable (R__), so Flyway re-applies it whenever its checksum changes and runs it after
-- every versioned migration — i.e. always against the final schema. That is what frees this
-- file from the "never edit an applied migration" rule the old V3__sample_data.sql lived under.
--
-- To offer a second dataset later, give it the SAME description in a sibling location
-- (db/seed/minimal/R__seed.sql) and switch spring.flyway.locations between them. Flyway refuses
-- to start with two resolved migrations of one description, so the two can never both apply.

-- Idempotent, and resets the identity sequences so the ids below stay deterministic
-- (owner 1 = Kevin McCallister, pet 3 = Milton) — several tests and e2e specs rely on them.
TRUNCATE roles, users, visits, pets, owners, vet_specialties, specialties, vets, types
    RESTART IDENTITY CASCADE;

INSERT INTO vets (first_name, last_name) VALUES
  ('James',  'Carter'),
  ('Helen',  'Leary'),
  ('Linda',  'Douglas'),
  ('Rafael', 'Ortega'),
  ('Henry',  'Stevens'),
  ('Sharon', 'Jenkins');

-- description = the symptoms that identify the specialty; vectorized into the chatbot's RAG.
INSERT INTO specialties (name, description) VALUES
  ('radiology',
    'limping, limp, broken bone, fracture, suspected fracture, swollen leg, can''t bear weight, holding up a paw, joint pain after a fall, suspected internal injury, ingested a foreign object.'),
  ('surgery',
    'skin rash, itching, lump, growth, mass, wound, open wound, cut, laceration, abscess, swelling under the skin, bite wound, non-healing sore.'),
  ('dentistry',
    'bad breath, tooth pain, bleeding gums, difficulty eating, dropping food, drooling, broken tooth, loose tooth, pawing at the mouth, reluctance to chew.');

-- Pairs preserved from upstream petclinic data; column order matches
-- the original ON CONFLICT (specialty_id, vet_id) hint.
INSERT INTO vet_specialties (specialty_id, vet_id) VALUES
  (1, 2), (2, 3), (3, 3), (2, 4), (1, 5);

INSERT INTO types (name) VALUES
  ('cat'), ('dog'), ('lizard'), ('snake'), ('bird'), ('hamster'), ('horse');

-- Owners and pets drawn from European literature, film, and science.
-- Kevin McCallister (owner 1 = sub 1 in the demo JWT) deliberately has NO phone: the chatbot's
-- create_visit tool then ELICITS one on the first booking and only CONFIRMS it on later ones.
INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Kevin',     'McCallister',  '671 Lincoln Boulevard',     'Winnetka',         NULL),
  ('Harry',     'Potter',       '4 Privet Drive',            'Little Whinging',  '0119084455'),
  ('Erwin',     'Schroedinger', 'Boltzmanngasse 5',          'Vienna',           '0131914920'),
  ('Salazar',   'Śliwiński',    'Hogwarts Dungeons',         'Hogsmeade',        '0441463555113'),
  ('Ronald',    'Weasley',      'The Burrow',                'Ottery St Catchpole','0119544321'),
  ('Roger',     'Radcliff',     '27 Outer Circle',           'London',           '0442074860707'),
  ('Newt',      'Scamander',    'Diagon Alley',              'London',           '0442079460001'),
  ('Alice',     'Liddell',      'Christ Church',             'Oxford',           '0441865276150'),
  ('Henry',     'Baskerville',  'Baskerville Hall',          'Dartmoor',         '0441626832093'),
  ('John',      'Dolittle',     'Oxenthorpe Road',           'Puddleby',         '0441803712345'),
  ('George',    'Darling',      '14 Kensington Gardens',     'London',           '0442079372121'),
  ('James',     'Bond',         '30 Wellington Square',      'London',           '0442073527070'),
  ('Hercule',   'Poirot',       'Whitehaven Mansions',       'London',           '0442079241221');

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Sam',       'Carraclough',  'Greenall Bridge',           'Yorkshire',        '0441943876543'),
  ('Beatrix',   'Potter',       'Hill Top Farm',             'Near Sawrey',      '0441539436269'),
  ('Long',      'Silver',       'Admiral Benbow Inn',        'Bristol',          '0441179293000'),
  ('Argus',     'Filch',        'Hogwarts Castle',           'Inverness',        '0441463245678'),
  ('Wallace',   'Wensleydale',  '62 West Wallaby Street',    'Wigan',            '0441942244466'),
  ('Wendy',     'Darling',      '14 Kensington Gardens',     'London',           '0442079372122'),
  ('Rubeus',   'Hagrid',        'Gamekeepers Hut',           'Hogsmeade',        '0441463555111'),
  ('Hermione', 'Granger',       'Gryffindor Tower',          'Hogsmeade',        '0441463555112'),
  ('Tom',      'Riddle',        'Malfoy Manor',              'Wiltshire',        '0119844321'),
  ('Tintin',   'Reporter',      '26 Rue du Labrador',        'Brussels',         '0032225112233'),
  ('Lady',     'Tremaine',      'Chateau Tremaine',          'Ile-de-France',    '0146203030'),
  ('Mister',   'Geppetto',      'Via dei Tessitori 7',       'Florence',         '0039055290383'),
  ('Alonso',   'Quixano',       'Campo de Montiel',          'La Mancha',        '0034926215566'),
  ('Charles',  'Dickens',       'Gad''s Hill Place',         'Higham',           '0441634406030'),
  ('Sherlock', 'Holmes',        '221B Baker Street',         'London',           '0442079351269');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Axel',            DATE '2018-12-24', 6, 1),  -- Buzz McCallister's tarantula (hamster stand-in)
  ('Hedwig',          DATE '2018-08-06', 5, 2),  -- Harry's snowy owl
  ('Milton',          DATE '2020-09-07', 1, 3),  -- Schroedinger's cat
  ('Nagini',          DATE '2017-01-20', 4, 22), -- Voldemort's snake
  ('Scabbers',        DATE '2019-08-06', 6, 5),  -- Ron Weasley's rat
  ('Pongo',           DATE '2018-04-17', 2, 6),  -- 101 Dalmatians
  ('Perdita',         DATE '2018-03-07', 2, 6),
  ('Pickett',         DATE '2020-11-30', 3, 7),  -- Scamander's bowtruckle
  ('Dinah',           DATE '2019-09-04', 1, 8),  -- Alice's cats
  ('Cheshire',        DATE '2019-09-04', 1, 8),
  ('Baskerville',     DATE '2017-02-24', 2, 9),  -- the Hound of the Baskervilles
  ('Polynesia',       DATE '2016-03-09', 5, 10), -- Dolittle's parrot
  ('Nana',            DATE '2018-06-24', 2, 11), -- Peter Pan's St. Bernard
  ('Liza',            DATE '2019-06-08', 1, 11);

INSERT INTO visits (pet_id, visit_date, description) VALUES
  (9,  DATE '2024-03-04', 'rabies shot'),   -- Dinah
  (10, DATE '2024-03-04', 'rabies shot'),   -- Cheshire
  (10, DATE '2023-06-04', 'neutered'),
  (9,  DATE '2022-09-04', 'spayed');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Lassie',          DATE '2020-05-12', 2, 14),  -- Lassie Come-Home, Yorkshire
  ('Mittens',         DATE '2019-08-03', 1, 15),  -- Beatrix Potter's tales
  ('Pickles',         DATE '2021-02-18', 2, 15),
  ('Captain Flint',   DATE '2022-06-25', 5, 16),  -- Long John Silver's parrot
  ('Mrs Norris',      DATE '2018-11-10', 1, 17),  -- Filch's cat
  ('Gromit',          DATE '2017-04-07', 2, 18),  -- Wallace & Gromit
  ('Hutch',           DATE '2023-01-30', 6, 18),
  ('Toby',            DATE '2020-09-14', 2, 19),  -- Wendy's neighbourhood dog
  ('Norbert',         DATE '2021-07-22', 3, 20),  -- Hagrid's Norwegian Ridgeback
  ('Crookshanks',     DATE '2019-03-15', 1, 21),  -- Hermione's half-Kneazle
  ('Basilisk',        DATE '2022-10-05', 4, 4),   -- Salazar's basilisk
  ('Snowy',           DATE '2018-06-20', 2, 23),  -- Tintin's Milou
  ('Lucifer',         DATE '2021-12-01', 1, 24),  -- Lady Tremaine's cat
  ('Jaq',             DATE '2024-02-11', 6, 24),  -- Cinderella's mouse friend
  ('Figaro',          DATE '2019-09-09', 1, 25),  -- Geppetto's cat
  ('Rocinante',       DATE '2015-05-05', 7, 26),  -- Don Quixote's horse
  ('Grip',            DATE '2023-08-19', 5, 27),  -- Dickens's raven
  ('Toby of Lambeth', DATE '2020-11-27', 2, 28);  -- Sherlock Holmes's bloodhound

INSERT INTO visits (pet_id, visit_date, description) VALUES
  (15, DATE '2025-11-12', 'rabies vaccine'),
  (16, DATE '2025-12-03', 'annual checkup'),
  (17, DATE '2026-01-15', 'internal deworming'),
  (18, DATE '2026-02-20', 'beak and nail trim'),
  (19, DATE '2026-03-05', 'trivalent vaccine'),
  (20, DATE '2026-03-18', 'hind leg surgery'),
  (21, DATE '2026-04-02', 'general checkup'),
  (22, DATE '2026-04-10', 'spay/neuter'),
  (23, DATE '2025-10-22', 'skin and scale check'),
  (24, DATE '2025-11-30', 'trivalent vaccine'),
  (25, DATE '2026-02-14', 'habitat check'),
  (26, DATE '2026-03-22', 'allergy treatment'),
  (27, DATE '2026-04-15', 'checkup'),
  (28, DATE '2026-04-20', 'dental exam'),
  (29, DATE '2026-04-25', 'rabies vaccine'),
  (30, DATE '2026-04-28', 'horseshoeing'),
  (31, DATE '2026-05-01', 'plumage check'),
  (32, DATE '2026-05-02', 'wound on front paw'),
  (15, DATE '2026-05-02', 'post-vaccine follow-up'),
  (20, DATE '2026-05-03', 'surgical suture removal'),
  (3,  DATE '2026-05-03', 'annual general checkup'),  -- Milton (Schroedinger's cat)
  (3,  DATE '2025-06-12', 'patient arrived in sealed box; simultaneously alive and dead — diagnosis deferred until observation'),
  (3,  DATE '2025-08-21', 'wave function collapsed during auscultation; patient definitively purring');

-- Spread the seeded visits round-robin over the vets so the UI has an attending vet to show.
-- The vet count is derived, not hard-coded: adding or removing a vet above must not leave
-- visits unassigned, nor point them at an id that no longer exists.
UPDATE visits SET vet_id = (SELECT MIN(id) FROM vets) + (id % (SELECT COUNT(*) FROM vets));

INSERT INTO users (username, password, enabled) VALUES
  ('admin', '$2a$10$ymaklWBnpBKlgdMgkjWVF.GMGyvH8aDuTK.glFOaKw712LHtRRymS', TRUE);

INSERT INTO roles (username, role) VALUES
  ('admin', 'ROLE_OWNER_ADMIN'),
  ('admin', 'ROLE_VET_ADMIN'),
  ('admin', 'ROLE_ADMIN');
