# Release: paginate-sort-owners

## One PR, one deploy

`GET /api/owners` changes from an array to `{content, totalElements}` — a breaking contract.
Backend and frontend ship in the same PR and the same deploy; never deploy one without the other.

Contents:
- backend: paged `listOwners`, `OwnerPageDto`, request validation (400s), `V4__owner_list_indexes.sql`
- frontend: paginator + Name/City sorting on the Owners screen, `OwnerService.getOwnerPage`
- regenerated: `openapi.yaml`, `api-types.ts`, `docs/generated/DB.sql`, three `*.genseq.puml/json`

Order on deploy: backend first (Flyway applies V4 on boot), then frontend — the window in between
shows the old screen an object instead of an array, so keep it to the length of one rollout.

## Rollback (paired)

Roll back **both** applications to the previous release together.

- Leave the database as is: V4 only adds three indexes, and the previous backend boots on it —
  Flyway ignores an applied migration newer than any it knows (`ignoreMigrationPatterns` default
  `*:future`). Checked by validating and migrating a V4 database with only V1–V3 on the path.
- Do not edit, delete, or `flyway repair` V4 away. Re-deploying this change later finds it applied.
- If the indexes themselves must go: a new forward migration `DROP INDEX` — never a rewrite of V4.

## Not verified by this change

Performance at 100,000 owners and under concurrent load is **unverified**: no large dataset was
generated and `OwnerSearchThroughLatencyProxyTest` was compiled but not run. Bounded retrieval is
verified only on small fixtures (≤ 3 SELECTs per full page, only the page's owners loaded).
