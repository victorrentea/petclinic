ALTER TABLE owners
  ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu",
  ALTER COLUMN last_name  TYPE TEXT COLLATE "und-x-icu",
  ALTER COLUMN city       TYPE TEXT COLLATE "und-x-icu";
CREATE INDEX owners_name_idx        ON owners (last_name, first_name, id);
CREATE INDEX owners_city_idx        ON owners (city, id);
CREATE INDEX owners_last_name_like_idx ON owners (last_name text_pattern_ops);
