-- A second Romanian owner, this one placed at the *front* of the alphabet on purpose, so the
-- owners grid's first page exercises the collation instead of only ASCII.
--
-- The sort runs in Postgres (ORDER BY last_name, first_name, id -- see V9) and this database
-- collates en_US.UTF-8, i.e. dictionary order, where 'ă' is a variant of 'a'. So:
--
--   'Bărbulescu' < 'Baskerville'  (Bar... < Bas...)  -> it must be the FIRST owner listed
--
-- Under a byte-wise ordering (C collation) the multi-byte 'ă' (0xC4 0x83) sorts above every
-- ASCII letter, so the same row would drop to third, after 'Bond'. That one-row difference on
-- the first page is what owners-pagination.feature asserts.
--
-- Together with V10's 'Șerban' -- which must stay inside the S block rather than jumping past
-- 'Zurcher' -- both ends of the alphabet are covered.
--
-- Done as a new migration rather than editing V3 (never edit an applied one).
INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('Ștefan', 'Bărbulescu', 'Strada Lipscani 12', 'București', '0040213145566');
