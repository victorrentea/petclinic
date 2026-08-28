-- The owners grid is now paged and sorted in the database (GitHub #25). Until now `owners` carried
-- exactly one index -- its primary key -- which is enough for 28 demo rows and nothing else; the
-- business expects 10,000-100,000 owners within a year.
--
-- Every sort ends in `id` because it is appended as an unconditional tiebreaker: six owners live in
-- London, and `ORDER BY city` alone is non-deterministic under LIMIT/OFFSET, so the same owner can
-- surface on two pages while another is never shown.
CREATE INDEX owners_last_name_first_name_id_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_id_idx ON owners (city, id);

-- `text_pattern_ops` is not optional. This database's collation is en_US.UTF-8, whose ordering is
-- dictionary-like rather than byte-wise, so a plain btree cannot serve a `LIKE 'prefix%'` predicate:
-- the rows sharing a prefix are not guaranteed to be adjacent in that ordering. This operator class
-- indexes the raw bytes, which makes the prefix a contiguous range again.
CREATE INDEX owners_last_name_pattern_idx ON owners (last_name text_pattern_ops);
