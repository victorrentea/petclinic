# Release: paginate-sort-owners

## One PR, one deploy

`GET /api/owners` changes from an owner array to `{ content, totalElements }`. Nothing in between works:
an old frontend against the new backend renders no owners, and a new frontend against the old backend
reads `content` from an array. So backend, frontend and the e2e/test consumers ship in **one PR**, and
backend and frontend go out in **one deploy**.

In the PR:
- backend: `OwnerPageDto`, paging/sort validation, page-then-graph queries, `V4__owner_list_indexes.sql`
- frontend: `OwnerService.listOwners`, the paged/sorted owners grid
- regenerated: `openapi.yaml`, `api-types.ts`, `docs/generated/DB.sql` (+ `DB.puml` via pre-commit),
  the owner-search / add-visit / `AddVisitApiTest` sequence diagrams

Order inside the deploy: backend first (Flyway applies V4 at startup), then frontend. The gap between
the two is the only window where the screen shows no owners; keep it to the deploy itself.

V4 only adds three b-tree indexes on `owners`. At today's size that is instant; at ~100k rows it should
take seconds (not measured), and the plain `CREATE INDEX` blocks writes to `owners` while it runs.
If the table is already large when this ships, schedule the deploy outside clinic hours.

## Rollback

Roll back **both** applications together, to the previous backend and frontend versions.

Leave the database alone:
- The three indexes stay. The old backend never asks for them and is not slowed by them.
- The old backend's Flyway accepts a database already at V4: V4 counts as a *future* migration, which
  Flyway's default `ignoreMigrationPatterns=*:future` skips. Checked against a V4 database with only
  V1–V3 + seed on the path: `validate` passes and `migrate` is a no-op.
- Never edit or delete `V4__owner_list_indexes.sql` once it ran anywhere persistent. If the indexes
  ever have to go, that is a new `V5` with `DROP INDEX`.

Rolling forward again after a rollback re-deploys both apps; V4 is already applied, so Flyway does nothing.

## Not verified by this change

Response times with ~100,000 owners and under concurrent load are **unverified**, deferred until budget
is available. What is verified, on small fixtures: the database cuts each page (`LIMIT/OFFSET`), and a
full page costs at most 3 SELECTs whatever the number of matches. `OwnerSearchThroughLatencyProxyTest`
was adapted and compiles, but was not run.
