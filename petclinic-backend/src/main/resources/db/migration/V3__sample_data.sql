INSERT INTO vets (first_name, last_name) VALUES
  ('James',  'Carter'),
  ('Helen',  'Leary'),
  ('Linda',  'Douglas'),
  ('Rafael', 'Ortega'),
  ('Henry',  'Stevens'),
  ('Sharon', 'Jenkins');

INSERT INTO specialties (name) VALUES ('radiology'), ('surgery'), ('dentistry');

-- Pairs preserved from upstream petclinic data; column order matches
-- the original ON CONFLICT (specialty_id, vet_id) hint.
INSERT INTO vet_specialties (specialty_id, vet_id) VALUES
  (1, 2), (2, 3), (3, 3), (2, 4), (1, 5);

INSERT INTO types (name) VALUES
  ('cat'), ('dog'), ('lizard'), ('snake'), ('bird'), ('hamster'), ('horse');

-- Owners and pets drawn from European literature, film, and science.
INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Erwin',     'Schroedinger', 'Boltzmanngasse 5',          'Vienna',           '0131914920'),
  ('Ronald',    'Weasley',      'The Burrow',                'Ottery St Catchpole','0119544321'),
  ('Roger',     'Radcliff',     '27 Outer Circle',           'London',           '0442074860707'),
  ('Newt',      'Scamander',    'Diagon Alley',              'London',           '0442079460001'),
  ('Tom',       'Riddle',       'Malfoy Manor',              'Wiltshire',        '0119844321'),
  ('Alice',     'Liddell',      'Christ Church',             'Oxford',           '0441865276150'),
  ('Harry',     'Potter',       '4 Privet Drive',            'Little Whinging',  '0119084455'),
  ('Henry',     'Baskerville',  'Baskerville Hall',          'Dartmoor',         '0441626832093'),
  ('John',      'Dolittle',     'Oxenthorpe Road',           'Puddleby',         '0441803712345'),
  ('George',    'Darling',      '14 Kensington Gardens',     'London',           '0442079372121'),
  ('James',     'Bond',         '30 Wellington Square',      'London',           '0442073527070'),
  ('Hercule',   'Poirot',       'Whitehaven Mansions',       'London',           '0442079241221');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Milton',          DATE '2020-09-07', 1, 1),  -- Schroedinger's cat
  ('Scabbers',        DATE '2019-08-06', 6, 2),  -- Ron Weasley's rat
  ('Pongo',           DATE '2018-04-17', 2, 3),  -- 101 Dalmatians
  ('Perdita',         DATE '2018-03-07', 2, 3),
  ('Pickett',         DATE '2020-11-30', 3, 4),  -- Scamander's bowtruckle
  ('Nagini',          DATE '2017-01-20', 4, 5),  -- Voldemort's snake
  ('Dinah',           DATE '2019-09-04', 1, 6),  -- Alice's cats
  ('Cheshire',        DATE '2019-09-04', 1, 6),
  ('Hedwig',          DATE '2018-08-06', 5, 7),  -- Harry's snowy owl
  ('Baskerville',     DATE '2017-02-24', 2, 8),  -- the Hound of the Baskervilles
  ('Polynesia',       DATE '2016-03-09', 5, 9),  -- Dolittle's parrot
  ('Nana',            DATE '2018-06-24', 2, 10), -- Peter Pan's St. Bernard
  ('Liza',            DATE '2019-06-08', 1, 10);

INSERT INTO visits (pet_id, visit_date, description) VALUES
  (7, DATE '2024-03-04', 'rabies shot'),
  (8, DATE '2024-03-04', 'rabies shot'),
  (8, DATE '2023-06-04', 'neutered'),
  (7, DATE '2022-09-04', 'spayed');

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Sam',       'Carraclough',  'Greenall Bridge',           'Yorkshire',        '0441943876543'),
  ('Beatrix',   'Potter',       'Hill Top Farm',             'Near Sawrey',      '0441539436269'),
  ('Long',      'Silver',       'Admiral Benbow Inn',        'Bristol',          '0441179293000'),
  ('Argus',     'Filch',        'Hogwarts Castle',           'Inverness',        '0441463245678'),
  ('Wallace',   'Wensleydale',  '62 West Wallaby Street',    'Wigan',            '0441942244466'),
  ('Wendy',     'Darling',      '14 Kensington Gardens',     'London',           '0442079372122'),
  ('Rubeus',   'Hagrid',        'Gamekeepers Hut',           'Hogsmeade',        '0441463555111'),
  ('Hermione', 'Granger',       'Gryffindor Tower',          'Hogsmeade',        '0441463555112'),
  ('Salazar',  'Slytherin',     'Hogwarts Dungeons',         'Hogsmeade',        '0441463555113'),
  ('Tintin',   'Reporter',      '26 Rue du Labrador',        'Brussels',         '0032225112233'),
  ('Lady',     'Tremaine',      'Chateau Tremaine',          'Ile-de-France',    '0146203030'),
  ('Mister',   'Geppetto',      'Via dei Tessitori 7',       'Florence',         '0039055290383'),
  ('Alonso',   'Quixano',       'Campo de Montiel',          'La Mancha',        '0034926215566'),
  ('Charles',  'Dickens',       'Gad''s Hill Place',         'Higham',           '0441634406030'),
  ('Sherlock', 'Holmes',        '221B Baker Street',         'London',           '0442079351269');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Lassie',          DATE '2020-05-12', 2, 13),  -- Lassie Come-Home, Yorkshire
  ('Mittens',         DATE '2019-08-03', 1, 14),  -- Beatrix Potter's tales
  ('Pickles',         DATE '2021-02-18', 2, 14),
  ('Captain Flint',   DATE '2022-06-25', 5, 15),  -- Long John Silver's parrot
  ('Mrs Norris',      DATE '2018-11-10', 1, 16),  -- Filch's cat
  ('Gromit',          DATE '2017-04-07', 2, 17),  -- Wallace & Gromit
  ('Hutch',           DATE '2023-01-30', 6, 17),
  ('Toby',            DATE '2020-09-14', 2, 18),  -- Wendy's neighbourhood dog
  ('Norbert',         DATE '2021-07-22', 3, 19),  -- Hagrid's Norwegian Ridgeback
  ('Crookshanks',     DATE '2019-03-15', 1, 20),  -- Hermione's half-Kneazle
  ('Basilisk',        DATE '2022-10-05', 4, 21),  -- the basilisk of Slytherin
  ('Snowy',           DATE '2018-06-20', 2, 22),  -- Tintin's Milou
  ('Lucifer',         DATE '2021-12-01', 1, 23),  -- Lady Tremaine's cat
  ('Jaq',             DATE '2024-02-11', 6, 23),  -- Cinderella's mouse friend
  ('Figaro',          DATE '2019-09-09', 1, 24),  -- Geppetto's cat
  ('Rocinante',       DATE '2015-05-05', 7, 25),  -- Don Quixote's horse
  ('Grip',            DATE '2023-08-19', 5, 26),  -- Dickens's raven
  ('Toby of Lambeth', DATE '2020-11-27', 2, 27);  -- Sherlock Holmes's bloodhound

INSERT INTO visits (pet_id, visit_date, description) VALUES
  (14, DATE '2025-11-12', 'rabies vaccine'),
  (15, DATE '2025-12-03', 'annual checkup'),
  (16, DATE '2026-01-15', 'internal deworming'),
  (17, DATE '2026-02-20', 'beak and nail trim'),
  (18, DATE '2026-03-05', 'trivalent vaccine'),
  (19, DATE '2026-03-18', 'hind leg surgery'),
  (20, DATE '2026-04-02', 'general checkup'),
  (21, DATE '2026-04-10', 'spay/neuter'),
  (22, DATE '2025-10-22', 'skin and scale check'),
  (23, DATE '2025-11-30', 'trivalent vaccine'),
  (24, DATE '2026-02-14', 'habitat check'),
  (25, DATE '2026-03-22', 'allergy treatment'),
  (26, DATE '2026-04-15', 'checkup'),
  (27, DATE '2026-04-20', 'dental exam'),
  (28, DATE '2026-04-25', 'rabies vaccine'),
  (29, DATE '2026-04-28', 'horseshoeing'),
  (30, DATE '2026-05-01', 'plumage check'),
  (31, DATE '2026-05-02', 'wound on front paw'),
  (14, DATE '2026-05-02', 'post-vaccine follow-up'),
  (19, DATE '2026-05-03', 'surgical suture removal'),
  (1,  DATE '2026-05-03', 'annual general checkup');

INSERT INTO users (username, password, enabled) VALUES
  ('admin', '$2a$10$ymaklWBnpBKlgdMgkjWVF.GMGyvH8aDuTK.glFOaKw712LHtRRymS', TRUE);

INSERT INTO roles (username, role) VALUES
  ('admin', 'ROLE_OWNER_ADMIN'),
  ('admin', 'ROLE_VET_ADMIN'),
  ('admin', 'ROLE_ADMIN');
