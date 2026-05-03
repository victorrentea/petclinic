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

INSERT INTO users (username, password, enabled) VALUES
  ('admin', '$2a$10$ymaklWBnpBKlgdMgkjWVF.GMGyvH8aDuTK.glFOaKw712LHtRRymS', TRUE);

INSERT INTO roles (username, role) VALUES
  ('admin', 'ROLE_OWNER_ADMIN'),
  ('admin', 'ROLE_VET_ADMIN'),
  ('admin', 'ROLE_ADMIN');
