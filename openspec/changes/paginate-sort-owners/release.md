# Release and rollback: paginate-sort-owners

## One PR, one deploy

`GET /api/owners` changes from a bare `OwnerDto[]` to `{content, totalElements}`. The backend, the
frontend and every in-repo list consumer move in the same PR, so they ship as one deploy:

1. Merge the single PR (backend, frontend, `openapi.yaml`, `api-types.ts`, tests, diagrams together).
2. Deploy backend and frontend from that same commit. On boot, Flyway applies
   `V4__owner_list_indexes.sql` — three `CREATE INDEX` on `owners`, nothing else.
3. Smoke check: `GET /api/owners` answers an object with `content` (10 owners) and `totalElements`;
   `GET /api/owners?size=7` answers 400; the Owners screen shows the paginator.

Never deploy only one side: an old frontend reads the new object as an array and renders nothing;
a new frontend on an old backend reads `content` of an array and renders nothing.

## Rollback

Roll back **both** applications to the previous release, together. Leave the database alone:

- The indexes stay. The previous release ships only V1–V3; Flyway's default
  `ignoreMigrationPatterns=*:future` lets it validate and boot on a database already at V4
  (checked: the previous migration set validates, applies nothing, and its prefix query runs).
- Do not edit, delete or `repair` V4, and do not drop its indexes as part of the rollback.
  Rolling forward again needs no migration step.

## Not verified by this release

Performance at ~100,000 owners and under concurrent load is unmeasured: the change was verified
with small functional fixtures only (database-side `OFFSET`/`FETCH FIRST`, ≤ 3 SQL statements per
full page). `OwnerSearchThroughLatencyProxyTest` was adapted and compiled, not run.
