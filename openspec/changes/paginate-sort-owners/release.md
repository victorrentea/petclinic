# Release: paginate-sort-owners

## One PR, one deploy

`GET /api/owners` now answers `{content, totalElements}` instead of an array: **breaking**.
Backend and frontend ship together, in one PR and one deploy. No other in-repo client reads the
list (the chatbot and MCP use `GET /api/owners/{id}` only); JMeter only creates/updates/deletes.

Order of the deploy:
1. Backend. Flyway applies `V4__owner_list_indexes.sql` (three `CREATE INDEX` on `owners`) at boot.
2. Frontend, immediately after. Between the two, the old frontend shows an empty Owners grid.

## Rollback

Roll back **both** applications together, to the previous release:
1. Frontend.
2. Backend.

Leave the database as it is. The indexes are additive and the previous backend boots against
it: Flyway ignores an applied migration newer than its own (`*:future`), which
`OwnerListIndexesMigrationTest.previousRelease_stillValidatesADatabaseAtV4` checks.
Never edit or delete `V4__owner_list_indexes.sql` once applied anywhere persistent; if the
indexes ever have to go, drop them in a new `V5`.

## Not verified by this release

Performance at 100,000 owners and under concurrent load is **unverified**: no large dataset was
generated and `OwnerSearchThroughLatencyProxyTest` was only compiled, not run. What is verified
is that paging happens in SQL before pets load, in at most 3 SELECTs per page.
