# Release and rollback: paginate-sort-owners

## One PR, one deploy

`GET /api/owners` changes from an array to `{content, totalElements}` (**breaking**). Backend,
frontend and every in-repo consumer (backend tests, Cucumber/Playwright glue) change in the same
PR and ship in the same deploy. Do not deploy the backend alone: the old frontend would read the
envelope as an empty owner list.

1. Merge the single PR (backend + `V4__owner_list_indexes.sql` + frontend + tests + regenerated
   `openapi.yaml`, `api-types.ts`, `DB.sql`, sequence diagrams).
2. Deploy backend and frontend together. Flyway applies V4 on backend start: three additive
   B-tree indexes on `owners`, no data change. On a large table, `CREATE INDEX` locks writes to
   `owners` while it builds; at today's size this is negligible.
3. Smoke check: `GET /api/owners` returns `totalElements`; `GET /api/owners?size=7` returns 400;
   the Owners screen shows `1 – 10 of N`.

## Rollback

Roll back **both** applications to the previous version together. Leave the database as it is:

- Keep V4 and its indexes. The previous backend validates against a database at V4, because Flyway
  ignores applied migrations newer than its own by default (`*:future`). Checked on 2026-10-03 by
  validating HEAD's V1-V3 + seed against a V4 database: successful. The indexes are invisible to
  the old queries and to `ddl-auto=validate`.
- Never edit, rename or delete `V4__owner_list_indexes.sql` once a persistent environment has
  applied it; a fix goes in V5. A changed V4 fails Flyway validation with a checksum mismatch.
  This already happened locally: the shared dev database in this checkout had a different V4 from
  an earlier attempt and refused to boot. Reset such a dev database with `./start-database.sh`, or
  point the backend at a fresh one; never repair the checksum in a shared environment.

## Not verified by this change

Response times with ~100,000 owners and under concurrent load are **unmeasured** (deferred for
budget). Verified: the database pages before loading associations, and a full page costs at most 3
SELECTs. `OwnerSearchThroughLatencyProxyTest` compiles against the new envelope with its original
thresholds, but was not run.
