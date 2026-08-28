-- Bulk owner fixture for the owners-grid load test.
--
-- Deliberately NOT a Flyway migration in petclinic-backend/src/main/resources/db/migration:
-- that path is the demo database everyone boots locally, and nobody wants 10k owners in it.
-- This script is applied with psql, inside the loadtest Docker stack only, AFTER Flyway has
-- built the real schema — so the schema under test is exactly the shipped one (V1..V8),
-- indexes included, and only the row count differs.
--
--   psql -v n_owners=10000 -f bulk-owners.sql
--
-- Names are drawn so that neither sorting nor prefix search is degenerate:
--   * 60% of owners take one of 25 "common" surnames -> a broad prefix matches thousands
--   * 40% take a base+suffix combination out of a ~1600-name long tail -> a selective
--     prefix matches a handful
--   * first letters, lengths and accents vary, so ORDER BY last_name is a real comparison
--     sort and LIKE 'x%' is a real range scan rather than everything or nothing.
-- setseed makes the whole fixture reproducible: the same prefixes match the same counts
-- on every run, so two runs are comparable.

\set ON_ERROR_STOP on

BEGIN;

SELECT setseed(0.42);

-- Start from a known row count. The V3 demo owners are left out on purpose: 10 rows are
-- noise at this scale, and a fixed population makes the 10k and 100k runs comparable.
TRUNCATE visits, pets, owners RESTART IDENTITY CASCADE;

INSERT INTO owners (first_name, last_name, address, city, telephone)
SELECT
  fn.a[1 + (random() * (array_length(fn.a, 1) - 1))::int],
  CASE
    WHEN random() < 0.60
      THEN cl.a[1 + (random() * (array_length(cl.a, 1) - 1))::int]
    ELSE tb.a[1 + (random() * (array_length(tb.a, 1) - 1))::int]
      || ts.a[1 + (random() * (array_length(ts.a, 1) - 1))::int]
  END,
  (100 + (random() * 8900)::int)::text || ' ' || st.a[1 + (random() * (array_length(st.a, 1) - 1))::int],
  ct.a[1 + (random() * (array_length(ct.a, 1) - 1))::int],
  lpad(((random() * 8999999999)::bigint + 1000000000)::text, 10, '0')
FROM generate_series(1, :n_owners) g
CROSS JOIN (SELECT ARRAY[
  'George', 'Betty', 'Eduardo', 'Harold', 'Peter', 'Jean', 'Maria', 'David', 'Carlos', 'Anneliese',
  'Hiroshi', 'Fatima', 'Oluwaseun', 'Sven', 'Priya', 'Nikolai', 'Chiara', 'Ahmed', 'Grace', 'Tomasz',
  'Ingrid', 'Rajesh', 'Yuki', 'Miguel', 'Aisha', 'Lars', 'Sofia', 'Dmitri', 'Chen', 'Amara',
  'Willem', 'Beatriz', 'Kwame', 'Elena', 'Mateusz', 'Noor', 'Sebastian', 'Ling', 'Hanna', 'Idris',
  'Clara', 'Kenji', 'Zara', 'Anton', 'Rosa', 'Bogdan', 'Naledi', 'Pierre', 'Isabela', 'Farid',
  'Marta', 'Jonas', 'Leila', 'Viktor', 'Adaeze', 'Ruben', 'Sanne', 'Emeka', 'Katarzyna', 'Tobias'
] AS a) fn
CROSS JOIN (SELECT ARRAY[
  'Nakamura', 'Okonkwo', 'Petrescu', 'Vasquez', 'Lindqvist',
  'Bianchi', 'Duarte', 'Fitzgerald', 'Haugen', 'Ibrahim',
  'Jankowski', 'Kaufmann', 'Laurent', 'Mbeki', 'Novotny',
  'Ostrowski', 'Quintero', 'Rasmussen', 'Sokolov', 'Thibault',
  'Ueda', 'Vandermeer', 'Wojcik', 'Yamamoto', 'Zieliński'
] AS a) cl
CROSS JOIN (SELECT ARRAY[
  'Abernath', 'Blackwood', 'Castellan', 'Drummond', 'Eastwick', 'Fairbairn', 'Grimald', 'Halloran',
  'Ingerson', 'Jarvinen', 'Kowalcz', 'Lindstrom', 'Marchetti', 'Nordstrom', 'Oakhurst', 'Pendleton',
  'Quarrier', 'Ravensc', 'Stroganov', 'Tremblay', 'Underhill', 'Villareal', 'Whitlock', 'Xanthop',
  'Yorkfield', 'Zubrowsk', 'Ashcombe', 'Braithwa', 'Cunningh', 'Dellacro', 'Ellingsw', 'Fontaineb',
  'Galbraith', 'Hawthorne', 'Iversonne', 'Jablonow', 'Kirkpatr', 'Lomonosov', 'Marchbank', 'Nightingal'
] AS a) tb
CROSS JOIN (SELECT ARRAY[
  'a', 'ov', 'ini', 'sen', 'ez', 'son', 'ley', 'man', 'berg', 'ström',
  'ovic', 'akis', 'idis', 'oglu', 'escu', 'ynski', 'ault', 'ière', 'inho', 'ova',
  'wicz', 'baum', 'thal', 'stein', 'holm', 'quist', 'gaard', 'dottir', 'ovski', 'enko',
  'ridge', 'worth', 'field', 'combe', 'shaw', 'stone', 'brook', 'hurst', 'wick', 'mere'
] AS a) ts
CROSS JOIN (SELECT ARRAY[
  'Madison', 'Sun Prairie', 'McFarland', 'Monona', 'Windsor', 'Waunakee', 'Verona', 'Middleton',
  'Cross Plains', 'Deerfield', 'Stoughton', 'Oregon', 'Fitchburg', 'Cottage Grove', 'Mount Horeb',
  'Belleville', 'Black Earth', 'Brooklyn', 'Cambridge', 'Dane', 'De Forest', 'Edgerton', 'Evansville',
  'Marshall', 'Mazomanie', 'Morrisonville', 'New Glarus', 'Oakdale', 'Poynette', 'Prairie du Sac',
  'Rio', 'Sauk City', 'Shorewood Hills', 'Stockholm', 'Token Creek', 'Utica', 'Vermont', 'Westport',
  'Wyocena', 'York Center'
] AS a) ct
CROSS JOIN (SELECT ARRAY[
  'W. Liberty St.', 'Center St.', 'Blackhawk Trail', 'Westview Blvd.', 'Broadway', 'S. Main St.',
  'Oak Ridge Rd.', 'Maple Grove Ln.', 'Sunset Dr.', 'Riverbend Ct.', 'Elm Street', 'Prairie View Rd.',
  'N. Washington Ave.', 'Lakeshore Dr.', 'Birch Hollow', 'Cedar Point Way', 'Harvest Ln.',
  'Meadowlark Cir.', 'Old Mill Rd.', 'Stonegate Blvd.'
] AS a) st;

-- Pets and visits are seeded too, and that is not decoration: GET /api/owners serialises
-- every owner's pets and every pet's visits, so the size of these two tables is what the
-- endpoint's N+1 behaviour is multiplied by. An owners-only fixture would measure a
-- version of the endpoint that does not exist.
INSERT INTO pets (name, birth_date, type_id, owner_id)
SELECT
  pn.a[1 + (random() * (array_length(pn.a, 1) - 1))::int],
  DATE '2015-01-01' + (random() * 3800)::int,
  ty.ids[1 + (random() * (array_length(ty.ids, 1) - 1))::int],
  o.id
FROM owners o
CROSS JOIN (SELECT ARRAY[
  'Leo', 'Basil', 'Mochi', 'Pepper', 'Biscuit', 'Nala', 'Rocco', 'Willow', 'Juno', 'Tofu',
  'Freya', 'Barnaby', 'Clementine', 'Dexter', 'Hazel', 'Milo', 'Olive', 'Rufus', 'Sable', 'Tilly'
] AS a) pn
CROSS JOIN (SELECT array_agg(id ORDER BY id) AS ids FROM types) ty
-- The row count must be a function of o.id, not of random(): an uncorrelated LATERAL
-- argument is evaluated once for the whole query, which silently gives *every* owner the
-- same number of pets. o.id % 4 gives 0..3 pets per owner (avg 1.5) and is reproducible.
CROSS JOIN LATERAL generate_series(1, o.id % 4) s;

INSERT INTO visits (pet_id, visit_date, description)
SELECT
  p.id,
  DATE '2023-01-01' + (random() * 900)::int,
  d.a[1 + (random() * (array_length(d.a, 1) - 1))::int]
FROM pets p
CROSS JOIN (SELECT ARRAY[
  'annual check-up', 'rabies vaccination', 'dental cleaning', 'limping on left foreleg',
  'skin allergy follow-up', 'neutering', 'ear infection', 'weight management consult',
  'post-operative review', 'microchip implant'
] AS a) d
CROSS JOIN LATERAL generate_series(1, p.id % 4) s;

COMMIT;

-- Without fresh statistics the planner still believes the table holds the 10 demo rows and
-- picks a plan for that table, which would make every EXPLAIN below meaningless.
VACUUM ANALYZE owners;
VACUUM ANALYZE pets;
VACUUM ANALYZE visits;

SELECT
  (SELECT count(*) FROM owners) AS owners,
  (SELECT count(*) FROM pets) AS pets,
  (SELECT count(*) FROM visits) AS visits,
  (SELECT count(DISTINCT last_name) FROM owners) AS distinct_last_names;
