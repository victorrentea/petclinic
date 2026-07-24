-- Owners grid (issue #25): human-alphabetical ordering + the indexes backing the two sortable columns.
--
-- The cluster is created with datcollate = "C" (byte order). Under it every lowercase-initial
-- surname ("de Vries", "van Gogh") sorts after ALL uppercase-initial ones, and every accented
-- surname ("Szabó", "Ștefănescu") after those. Invisible in the 28-row ASCII seed; glaring at the
-- planned 10k Dutch, Hungarian and Romanian names. Pinning the collation on the COLUMNS rather than
-- relying on the cluster's also makes ordering identical in dev, CI and production, whose cluster
-- collation we do not control.
--
-- und-x-icu (ICU root) is chosen over a locale-specific collation because it is byte-identical to
-- nl-x-icu on mixed nl/hu/ro name sets, and the Netherlands is the primary market -- see design
-- decision D6. Hungarian ("cs"/"sz"/"zs" as single letters) and Romanian (Ș after S, Ț after T)
-- diverge mildly; that is a product-owner-accepted limitation, pinned by OwnerCollationTest.
--
-- address and telephone are deliberately NOT recollated: neither is sortable (D4).
ALTER TABLE owners ALTER COLUMN last_name  TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE TEXT COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE TEXT COLLATE "und-x-icu";

-- owners carried only its primary key until now, so every page request meant a full sort.
-- Both indexes end in id because the sort key must be TOTAL: over a non-unique ORDER BY column
-- (city is London x7, Hogsmeade x3 in the seed alone) PostgreSQL may legally break ties differently
-- per request, which makes LIMIT/OFFSET paging return one owner on two pages and skip another.
CREATE INDEX owners_sort_idx ON owners (last_name, first_name, id);
CREATE INDEX owners_city_sort_idx ON owners (city, last_name, id);

-- The lastName search compiles to LIKE 'prefix%'. A btree in a non-"C" collation CANNOT serve that
-- predicate -- it would degrade to a seq scan, so recollating above would quietly trade a fixed sort
-- for a broken search. text_pattern_ops sorts by byte value regardless of the column collation,
-- which is exactly what a prefix match needs; it cannot serve the ICU-collated ORDER BY, hence two
-- separate indexes on last_name rather than one.
CREATE INDEX owners_search_idx ON owners (last_name text_pattern_ops);
