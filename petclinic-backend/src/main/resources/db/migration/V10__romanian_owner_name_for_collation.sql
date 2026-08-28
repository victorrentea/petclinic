-- One owner with a Romanian surname, so the owners grid actually exercises the
-- database's collation instead of only ever sorting ASCII.
--
-- The sort runs in Postgres (ORDER BY last_name, first_name, id -- see V9), and this
-- database's collation is en_US.UTF-8: dictionary ordering, in which 'Ș' is treated as a
-- variant of 'S'. So 'Șerban' must land between 'Schroedinger' and 'Silver'. Under a
-- byte-wise ordering (C collation) the same row would sort after 'Zurcher' instead --
-- which is exactly the bug this row makes visible.
--
-- Done as a new migration rather than editing V3 (never edit an applied one).
UPDATE owners
SET first_name = 'Andrei',
    last_name  = 'Șerban'
WHERE first_name = 'Salazar'
  AND last_name = 'Slytherin';
