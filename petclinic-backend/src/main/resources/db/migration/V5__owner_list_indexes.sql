-- The owners grid pages through one of two orders: by name, or by city then name.
-- Each index matches its ORDER BY key for key, id included as the tie-breaker, so a page is an
-- index range scan whatever the table size. Under the C.UTF-8 collation the name index also
-- serves the last-name prefix filter (LIKE 'prefix%').
-- IF NOT EXISTS: some dev databases already hold both from earlier paging work.
CREATE INDEX IF NOT EXISTS owners_name_idx ON owners (last_name, first_name, id);
CREATE INDEX IF NOT EXISTS owners_city_idx ON owners (city, last_name, first_name, id);
