# Release: paginate-sort-owners

## One PR, one deploy

`GET /api/owners` changes from an array to `{content, totalElements}` — a **breaking** contract change.
Backend, frontend, the regenerated `openapi.yaml` / `api-types.ts`, the e2e glue and the regenerated
sequence diagrams ship in **one PR** and go out in **one deploy**. No in-repo consumer remains on the
array shape; an out-of-repo consumer of the list must move to `content` in the same window.

Deploy order inside the window: backend first (Flyway applies `V4__owner_list_indexes.sql` on boot),
then the frontend. Between the two, the old frontend hits the new backend and fails loudly on the owners
list only; keep that gap short. The new frontend against an old backend shows an explicit error
("did not answer with a page") rather than an empty grid.

## V4

Additive only: three `CREATE INDEX` on `owners`, no data change, V1–V3 and `R__seed.sql` untouched.
`CREATE INDEX` (not `CONCURRENTLY`) briefly blocks writes to `owners`; at today's size this is
milliseconds. Revisit before running it against a large table.

## Rollback

Roll back **backend and frontend together** to the previous release. Leave the database as it is:

- Do **not** delete or edit `V4__owner_list_indexes.sql` in any environment where it ran, and do not
  drop its row from `flyway_schema_history`.
- The previous application boots on the V4 schema: Flyway ignores a migration newer than its own
  (`*:future`), validates, and applies nothing — proven by
  `OwnerListIndexesMigrationTest.applicationFromBeforeV4_stillValidatesAndMigrates`.
- The indexes cost the old application nothing but slightly slower owner writes; re-deploying this
  change later finds V4 already applied.

## Not verified

Performance at 100,000 owners and under concurrent load is **unverified**: no large dataset was
generated and `OwnerSearchThroughLatencyProxyTest` was only compiled, not run. Deferred for budget.
