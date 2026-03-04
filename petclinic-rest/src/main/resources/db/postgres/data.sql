INSERT INTO vets (first_name, last_name) SELECT 'James', 'Carter' WHERE NOT EXISTS (SELECT * FROM vets WHERE id=1);
INSERT INTO vets (first_name, last_name) SELECT 'Helen', 'Leary' WHERE NOT EXISTS (SELECT * FROM vets WHERE id=2);
INSERT INTO vets (first_name, last_name) SELECT 'Linda', 'Douglas' WHERE NOT EXISTS (SELECT * FROM vets WHERE id=3);
INSERT INTO vets (first_name, last_name) SELECT 'Rafael', 'Ortega' WHERE NOT EXISTS (SELECT * FROM vets WHERE id=4);
INSERT INTO vets (first_name, last_name) SELECT 'Henry', 'Stevens' WHERE NOT EXISTS (SELECT * FROM vets WHERE id=5);
INSERT INTO vets (first_name, last_name) SELECT 'Sharon', 'Jenkins' WHERE NOT EXISTS (SELECT * FROM vets WHERE id=6);

INSERT INTO specialties (name) SELECT 'radiology' WHERE NOT EXISTS (SELECT * FROM specialties WHERE name='radiology');
INSERT INTO specialties (name) SELECT 'surgery' WHERE NOT EXISTS (SELECT * FROM specialties WHERE name='surgery');
INSERT INTO specialties (name) SELECT 'dentistry' WHERE NOT EXISTS (SELECT * FROM specialties WHERE name='dentistry');

INSERT INTO vet_specialties VALUES (1, 2) ON CONFLICT (specialty_id, vet_id) DO NOTHING;
INSERT INTO vet_specialties VALUES (2, 3) ON CONFLICT (specialty_id, vet_id) DO NOTHING;
INSERT INTO vet_specialties VALUES (3, 3) ON CONFLICT (specialty_id, vet_id) DO NOTHING;
INSERT INTO vet_specialties VALUES (2, 4) ON CONFLICT (specialty_id, vet_id) DO NOTHING;
INSERT INTO vet_specialties VALUES (1, 5) ON CONFLICT (specialty_id, vet_id) DO NOTHING;

INSERT INTO types (name) SELECT 'cat' WHERE NOT EXISTS (SELECT * FROM types WHERE name='cat');
INSERT INTO types (name) SELECT 'dog' WHERE NOT EXISTS (SELECT * FROM types WHERE name='dog');
INSERT INTO types (name) SELECT 'lizard' WHERE NOT EXISTS (SELECT * FROM types WHERE name='lizard');
INSERT INTO types (name) SELECT 'snake' WHERE NOT EXISTS (SELECT * FROM types WHERE name='snake');
INSERT INTO types (name) SELECT 'bird' WHERE NOT EXISTS (SELECT * FROM types WHERE name='bird');
INSERT INTO types (name) SELECT 'hamster' WHERE NOT EXISTS (SELECT * FROM types WHERE name='hamster');
INSERT INTO types (name) SELECT 'horse' WHERE NOT EXISTS (SELECT * FROM types WHERE name='horse');

INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'George', 'Franklin', '110 W. Liberty St.', 'Madison', '6085551023' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=1);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Betty', 'Davis', '638 Cardinal Ave.', 'Sun Prairie', '6085551749' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=2);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Eduardo', 'Rodriquez', '2693 Commerce St.', 'McFarland', '6085558763' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=3);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Harold', 'Davis', '563 Friendly St.', 'Windsor', '6085553198' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=4);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Peter', 'McTavish', '2387 S. Fair Way', 'Madison', '6085552765' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=5);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Jean', 'Coleman', '105 N. Lake St.', 'Monona', '6085552654' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=6);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Jeff', 'Black', '1450 Oak Blvd.', 'Monona', '6085555387' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=7);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Maria', 'Escobito', '345 Maple St.', 'Madison', '6085557683' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=8);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'David', 'Schroeder', '2749 Blackhawk Trail', 'Madison', '6085559435' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=9);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Carlos', 'Estaban', '2335 Independence La.', 'Waunakee', '6085555487' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=10);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Lydia', 'Quark', '42 Kernel Way', 'Madison', '6085559012' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=11);
INSERT INTO owners (first_name, last_name, address, city, telephone) SELECT 'Oscar', 'Byte', '9 Cache Ct.', 'Monona', '6085553344' WHERE NOT EXISTS (SELECT * FROM owners WHERE id=12);

INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Leo', '2000-09-07', 1, 1 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=1);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Basil', '2002-08-06', 6, 2 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=2);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Rosy', '2001-04-17', 2, 3 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=3);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Jewel', '2000-03-07', 2, 3 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=4);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Iggy', '2000-11-30', 3, 4 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=5);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'George', '2000-01-20', 4, 5 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=6);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Samantha', '1995-09-04', 1, 6 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=7);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Max', '1995-09-04', 1, 6 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=8);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Lucky', '1999-08-06', 5, 7 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=9);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Mulligan', '1997-02-24', 2, 8 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=10);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Freddy', '2000-03-09', 5, 9 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=11);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Lucky', '2000-06-24', 2, 10 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=12);
INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT 'Sly', '2002-06-08', 1, 10 WHERE NOT EXISTS (SELECT * FROM pets WHERE id=13);

INSERT INTO visits (pet_id, visit_date, description) SELECT 7, '2010-03-04', 'rabies shot' WHERE NOT EXISTS (SELECT * FROM visits WHERE id=1);
INSERT INTO visits (pet_id, visit_date, description) SELECT 8, '2011-03-04', 'rabies shot' WHERE NOT EXISTS (SELECT * FROM visits WHERE id=2);
INSERT INTO visits (pet_id, visit_date, description) SELECT 8, '2009-06-04', 'neutered' WHERE NOT EXISTS (SELECT * FROM visits WHERE id=3);
INSERT INTO visits (pet_id, visit_date, description) SELECT 7, '2008-09-04', 'spayed' WHERE NOT EXISTS (SELECT * FROM visits WHERE id=4);

-- Insert Reviews
INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 1, 5, 'Excellent care for my cat Leo! Dr. Carter was very thorough and gentle.', CURRENT_TIMESTAMP - INTERVAL '5 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=1 AND feedback LIKE 'Excellent care for my cat Leo%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 1, 4, 'Very professional and knowledgeable. My pet felt comfortable.', CURRENT_TIMESTAMP - INTERVAL '10 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=1 AND feedback LIKE 'Very professional and knowledgeable%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 1, 5, 'Best vet in town! Highly recommend Dr. Carter.', CURRENT_TIMESTAMP - INTERVAL '15 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=1 AND feedback LIKE 'Best vet in town%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 2, 5, 'Dr. Leary is amazing with radiology. She found the issue right away!', CURRENT_TIMESTAMP - INTERVAL '3 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=2 AND feedback LIKE 'Dr. Leary is amazing%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 2, 4, 'Great experience. Very caring and explained everything clearly.', CURRENT_TIMESTAMP - INTERVAL '8 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=2 AND feedback LIKE 'Great experience%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 3, 5, 'Dr. Douglas performed surgery on my dog and the recovery was perfect!', CURRENT_TIMESTAMP - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=3 AND feedback LIKE 'Dr. Douglas performed surgery%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 3, 5, 'Excellent dentistry work. My pet teeth look great now.', CURRENT_TIMESTAMP - INTERVAL '7 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=3 AND feedback LIKE 'Excellent dentistry work%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 3, 4, 'Very skilled surgeon. I trust her completely with my pets.', CURRENT_TIMESTAMP - INTERVAL '12 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=3 AND feedback LIKE 'Very skilled surgeon%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 3, 5, 'Outstanding care and follow-up after surgery.', CURRENT_TIMESTAMP - INTERVAL '20 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=3 AND feedback LIKE 'Outstanding care and follow-up%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 4, 4, 'Good surgeon, very professional and efficient.', CURRENT_TIMESTAMP - INTERVAL '4 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=4 AND feedback LIKE 'Good surgeon%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 4, 5, 'Dr. Ortega saved my dogs life with emergency surgery. Forever grateful!', CURRENT_TIMESTAMP - INTERVAL '9 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=4 AND feedback LIKE 'Dr. Ortega saved my dogs life%');

INSERT INTO reviews (vet_id, rating, feedback, created_at) 
SELECT 5, 5, 'Dr. Stevens radiology expertise is top-notch. Highly recommend!', CURRENT_TIMESTAMP - INTERVAL '6 days'
WHERE NOT EXISTS (SELECT * FROM reviews WHERE vet_id=5 AND feedback LIKE 'Dr. Stevens radiology expertise%');

INSERT INTO users(username, password, enabled) VALUES
('admin', '$2a$10$ymaklWBnpBKlgdMgkjWVF.GMGyvH8aDuTK.glFOaKw712LHtRRymS', TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO roles (username, role) SELECT 'admin', 'ROLE_OWNER_ADMIN' WHERE NOT EXISTS (SELECT * FROM roles WHERE username='admin' AND role='ROLE_OWNER_ADMIN');
INSERT INTO roles (username, role) SELECT 'admin', 'ROLE_VET_ADMIN' WHERE NOT EXISTS (SELECT * FROM roles WHERE username='admin' AND role='ROLE_VET_ADMIN');
INSERT INTO roles (username, role) SELECT 'admin', 'ROLE_ADMIN' WHERE NOT EXISTS (SELECT * FROM roles WHERE username='admin' AND role='ROLE_ADMIN');
