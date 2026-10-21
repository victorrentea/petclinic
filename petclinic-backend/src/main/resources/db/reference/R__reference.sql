-- Reference data: the lookup rows the app cannot be used without, in EVERY environment —
-- the app, a deployment with real data, and every test. Pet types (the pet form's dropdown
-- has nothing to offer without them) and vet specialties (the chatbot's RAG triages
-- symptoms against their descriptions). Nothing else: owners, pets, visits, vets and the
-- admin user are demo data and live in db/seed/R__seed.sql, which tests do not load.
--
-- Its own location (db/reference), not db/migration: the versioned chain carries no rows,
-- ever (AGENTS.md) — the specialty descriptions are exactly the text the old V6/V7 kept
-- re-seeding over each other. Repeatable, so edit it freely: it re-runs on checksum change,
-- and Flyway runs repeatables by description, so "reference" always lands before "seed".
--
-- An upsert, not a TRUNCATE: on a database that already holds these rows (every one the old
-- seed built) it rewrites them in place and keeps their ids, which pets and vet_specialties
-- point at. The ids are literal for the same reason — the seed's pets name type 1..7 and its
-- vets specialty 1..3 — and each sequence is moved past them afterwards, so a type or a
-- specialty created through the API never collides with one written here.
--
-- The reset sidecar (docker/reset) runs this same file when it empties the database, so an
-- "empty" stack and an "empty" test database hold exactly these rows.

INSERT INTO types (id, name) VALUES
  (1, 'cat'), (2, 'dog'), (3, 'lizard'), (4, 'snake'), (5, 'bird'), (6, 'hamster'), (7, 'horse')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- description = the symptoms that identify the specialty; vectorized into the chatbot's RAG.
INSERT INTO specialties (id, name, description) VALUES
  (1, 'radiology',
    'limping, limp, broken bone, fracture, suspected fracture, swollen leg, can''t bear weight, holding up a paw, joint pain after a fall, suspected internal injury, ingested a foreign object.'),
  (2, 'surgery',
    'skin rash, itching, lump, growth, mass, wound, open wound, cut, laceration, abscess, swelling under the skin, bite wound, non-healing sore.'),
  (3, 'dentistry',
    'bad breath, tooth pain, bleeding gums, difficulty eating, dropping food, drooling, broken tooth, loose tooth, pawing at the mouth, reluctance to chew.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

SELECT setval(pg_get_serial_sequence('types', 'id'), (SELECT max(id) FROM types));
SELECT setval(pg_get_serial_sequence('specialties', 'id'), (SELECT max(id) FROM specialties));
