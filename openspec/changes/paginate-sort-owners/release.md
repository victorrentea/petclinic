# Release and rollback

## Release: one PR, one deploy

`GET /api/owners` now answers `{content, totalElements}` instead of an array. Backend and frontend ship
together; no in-repo consumer reads the array any more (frontend, Cucumber, Playwright glue, MockMvc tests).

1. Merge the single PR carrying backend, frontend, `openapi.yaml`, `api-types.ts` and the V4 migration.
2. Deploy backend and frontend in the same window. Flyway applies `V4__owner_list_indexes.sql` on backend
   start: three additive btree indexes on `owners`, no data change.
3. Smoke check: `GET /api/owners` returns 10 owners and a `totalElements`; `GET /api/owners?size=7` returns 400;
   the Owners screen shows the paginator and sorts by Name and City.

External clients of the list endpoint, if any exist outside this repository, break at step 2.

## Rollback: both applications together

Redeploy the previous backend and frontend versions together. Leave the database as it is:

- Do not drop the indexes and do not delete V4 from `flyway_schema_history`. The previous backend boots
  on a V4 database: Spring Boot's Flyway ignores an applied version newer than its own (`*:future`),
  and its queries are unaffected by extra indexes. Verified by migrating to V4, then running the
  previous version's migrations with Boot's settings: migrate succeeds, schema stays at 4, indexes stay.
- Never roll back only one side: the old frontend cannot read a page, the new frontend cannot read an array.

## Migration numbering

`V4__owner_list_indexes.sql` is byte-identical to the V4 already on `origin/db27oct`, so a database that
ever ran that branch validates against this one. Never edit V4 once deployed; add V5 instead.
