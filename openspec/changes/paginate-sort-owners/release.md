# Release and rollback

## One PR, one deploy

`GET /api/owners` changes from an array to `{content, totalElements}`: **breaking**. The backend,
the frontend, and every in-repo list consumer (Cucumber/Playwright glue, `AddVisitApiTest`,
`OwnerSearchThroughLatencyProxyTest`) change in the same PR and ship in the same deploy.

1. Merge the PR (backend + frontend + `V4__owner_list_indexes.sql` + regenerated `openapi.yaml`,
   `api-types.ts`, `DB.sql`, sequence diagrams).
2. Deploy the backend. Flyway applies V4 on startup: three `CREATE INDEX` on `owners`, plain (not
   `CONCURRENTLY`, since Flyway runs it in a transaction), so writes to `owners` wait while they
   build. Seconds at 100k rows; not measured.
3. Deploy the frontend straight after. Until it lands, an old frontend reads the new envelope as no
   owners; the new frontend instead shows an explicit error if it meets an old array-answering backend.

## Rollback: the application pair, never the schema

Roll back **both** applications together to the previous release. Leave V4 applied:

- The previous backend boots on a V4 database. Flyway validates and ignores V4 as a future migration
  (default `ignoreMigrationPatterns=*:future`). Checked by booting `main`'s backend against a V4
  database: it started and answered the old array for `?lastName=Pot`.
- The indexes are additive; the previous code neither needs nor conflicts with them.
- Do not edit or delete V4 once it reached a persistent environment. If the indexes ever have to go,
  that is a new `V5` with `DROP INDEX`.

## Not verified by this change

Response times with ~100,000 owners and under concurrent load are **deferred until budget is
available**. `OwnerSearchThroughLatencyProxyTest` was adapted and compiles, but was not run.
