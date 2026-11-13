-- 50,000 generated owners ON TOP of the Default seed, to see the owners grid page, sort and
-- search at the volume the business expects within a year (gh #25). Off by default; turned on
-- by the `large` profile (application-large.properties), which adds this location.
--
-- A repeatable named after db/seed's "seed", so Flyway runs it after that file's TRUNCATE.
-- Caveat: it re-runs only when ITS checksum changes. If the Default seed is re-applied later
-- (its checksum changed), the truncate takes these rows with it; ./start-database.sh resets.
--
-- Names, accents and cities repeat on purpose: equal sort keys are what paging must keep
-- stable, and diacritics are what the ICU collation (V4) must order like a reader would.
INSERT INTO owners (first_name, last_name, address, city, telephone)
SELECT (ARRAY['Ana', 'Ștefan', 'Łukasz', 'Zoë', 'Émile', 'Ivan', 'Mia', 'Jon', 'Ada', 'Björn'])[1 + n % 10],
        (ARRAY['Popescu', 'Śliwiński', 'Müller', 'Østergaard', 'García', 'Novák', 'Smith', 'Rossi',
              'Dupont', 'Kovács', 'Ionescu', 'Andersson', 'O''Brien', 'van Dijk'])[1 + (n / 10) % 14],
        n || ' Demo Street',
        (ARRAY['Kraków', 'Zürich', 'Århus', 'Bucureşti', 'Lyon', 'Málaga', 'Cluj', 'Łódź', 'Wien',
              'Ústí', 'Bergen', 'Évora', 'Gdańsk', 'Iași', 'Oslo'])[1 + n % 15],
        lpad(n::text, 10, '0')
FROM generate_series(1, 50000) AS n;
