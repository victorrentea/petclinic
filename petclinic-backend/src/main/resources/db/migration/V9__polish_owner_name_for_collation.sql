-- One owner with a Polish surname, so the owners grid actually exercises the
-- database's collation instead of only ever sorting ASCII.
--
-- The sort runs in Postgres, and this database collates en_US.UTF-8: dictionary
-- ordering, in which 'Ś' is treated as a variant of 'S'. So 'Śliwiński' must land
-- inside the S block -- after 'Silver' (Si < Śl) and before 'Tremaine'. Under a
-- byte-wise ordering (C collation) the multi-byte 'Ś' (0xC5 0x9A) sorts above every
-- ASCII letter, so the same row would drop to the very end of the list, after
-- 'Wensleydale'. That difference is exactly what this row makes visible.
--
-- Done as a new migration rather than editing V3 (never edit an applied one).
UPDATE owners
SET last_name = 'Śliwiński'
WHERE first_name = 'Salazar'
  AND last_name = 'Slytherin';
