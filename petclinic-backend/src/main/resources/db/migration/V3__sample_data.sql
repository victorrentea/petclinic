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

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('George',   'Franklin',  '110 W. Liberty St.',     'Madison',     '6085551023'),
  ('Betty',    'Davis',     '638 Cardinal Ave.',      'Sun Prairie', '6085551749'),
  ('Eduardo',  'Rodriquez', '2693 Commerce St.',      'McFarland',   '6085558763'),
  ('Harold',   'Davis',     '563 Friendly St.',       'Windsor',     '6085553198'),
  ('Peter',    'McTavish',  '2387 S. Fair Way',       'Madison',     '6085552765'),
  ('Jean',     'Coleman',   '105 N. Lake St.',        'Monona',      '6085552654'),
  ('Jeff',     'Black',     '1450 Oak Blvd.',         'Monona',      '6085555387'),
  ('Maria',    'Escobito',  '345 Maple St.',          'Madison',     '6085557683'),
  ('David',    'Schroeder', '2749 Blackhawk Trail',   'Madison',     '6085559435'),
  ('Carlos',   'Estaban',   '2335 Independence La.',  'Waunakee',    '6085555487'),
  ('Lydia',    'Quark',     '42 Kernel Way',          'Madison',     '6085559012'),
  ('Oscar',    'Byte',      '9 Cache Ct.',            'Monona',      '6085553344');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Leo',      DATE '2000-09-07', 1, 1),
  ('Basil',    DATE '2002-08-06', 6, 2),
  ('Rosy',     DATE '2001-04-17', 2, 3),
  ('Jewel',    DATE '2000-03-07', 2, 3),
  ('Iggy',     DATE '2000-11-30', 3, 4),
  ('George',   DATE '2000-01-20', 4, 5),
  ('Samantha', DATE '1995-09-04', 1, 6),
  ('Max',      DATE '1995-09-04', 1, 6),
  ('Lucky',    DATE '1999-08-06', 5, 7),
  ('Mulligan', DATE '1997-02-24', 2, 8),
  ('Freddy',   DATE '2000-03-09', 5, 9),
  ('Lucky',    DATE '2000-06-24', 2, 10),
  ('Sly',      DATE '2002-06-08', 1, 10);

INSERT INTO visits (pet_id, visit_date, description) VALUES
  (7, DATE '2010-03-04', 'rabies shot'),
  (8, DATE '2011-03-04', 'rabies shot'),
  (8, DATE '2009-06-04', 'neutered'),
  (7, DATE '2008-09-04', 'spayed');

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Andrei',   'Popescu',   'Str. Mihai Viteazu 12',     'Bucuresti',    '0721111001'),
  ('Maria',    'Ionescu',   'Str. Memorandumului 5',     'Cluj-Napoca',  '0721111002'),
  ('George',   'Pop',       'Bd. Revolutiei 22',         'Timisoara',    '0721111003'),
  ('Elena',    'Stan',      'Str. Lascar Catargi 8',     'Iasi',         '0721111004'),
  ('Mihai',    'Dumitru',   'Str. Republicii 41',        'Brasov',       '0721111005'),
  ('Ioana',    'Marin',     'Bd. Tomis 110',             'Constanta',    '0721111006'),
  ('Radu',     'Tudor',     'Str. Cetatii 17',           'Sibiu',        '0721111007'),
  ('Cristina', 'Vasile',    'Str. Republicii 3',         'Oradea',       '0721111008'),
  ('Alex',     'Munteanu',  'Str. Domneasca 50',         'Galati',       '0721111009'),
  ('Diana',    'Stoica',    'Bd. Republicii 88',         'Pitesti',      '0721111010'),
  ('Bogdan',   'Radu',      'Str. Unirii 14',            'Craiova',      '0721111011'),
  ('Ana',      'Florescu',  'Bd. Independentei 27',      'Ploiesti',     '0721111012'),
  ('Vlad',     'Nistor',    'Str. Eminescu 9',           'Arad',         '0721111013'),
  ('Laura',    'Mihai',     'Str. Marasesti 33',         'Bacau',        '0721111014'),
  ('Tudor',    'Cristea',   'Str. Stefan cel Mare 21',   'Suceava',      '0721111015');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Rex',     DATE '2020-05-12', 2, 13),
  ('Mia',     DATE '2019-08-03', 1, 14),
  ('Buddy',   DATE '2021-02-18', 2, 14),
  ('Coco',    DATE '2022-06-25', 5, 15),
  ('Luna',    DATE '2018-11-10', 1, 16),
  ('Bella',   DATE '2017-04-07', 2, 17),
  ('Charlie', DATE '2023-01-30', 6, 17),
  ('Toby',    DATE '2020-09-14', 2, 18),
  ('Ziggy',   DATE '2021-07-22', 3, 19),
  ('Misty',   DATE '2019-03-15', 1, 20),
  ('Oscar',   DATE '2022-10-05', 4, 21),
  ('Daisy',   DATE '2018-06-20', 2, 22),
  ('Milo',    DATE '2021-12-01', 1, 23),
  ('Pepper',  DATE '2024-02-11', 6, 23),
  ('Shadow',  DATE '2019-09-09', 1, 24),
  ('Spirit',  DATE '2015-05-05', 7, 25),
  ('Tweety',  DATE '2023-08-19', 5, 26),
  ('Rocky',   DATE '2020-11-27', 2, 27);

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
