# Release: paginate-sort-owners

## One PR, one deploy

`GET /api/owners` changes from a bare `OwnerDto[]` to `{content, totalElements}`. Any array-reading
client breaks against the new backend, and the new frontend rejects an array response with an
explicit error. Ship them together:

1. Merge the single PR (backend, frontend, regenerated `openapi.yaml`/`api-types.ts`, migration, tests).
2. Deploy backend and frontend in the same deploy. Flyway applies `V4__owner_list_indexes.sql` at
   backend startup.
3. Smoke test: `GET /api/owners` returns 10 owners and `totalElements`; the Owners screen shows the
   paginator; `GET /api/owners?size=7` returns 400.

## Rollback

Roll back **both** applications to the previous release, together. Do **not** revert the migration:

- V4 only adds three B-tree indexes on `owners`. The old application never names them, and its
  unpaged `LIKE 'prefix%'` query runs correctly with or without them.
- Leave the `V4` row in `flyway_schema_history`. To the old jar it is a *future* migration, which
  Flyway's default `ignore-migration-patterns=*:future` accepts at startup. An environment that
  overrides that property (e.g. `*:missing` for real data) must keep `*:future` in the list.
- Never edit or delete `V4__owner_list_indexes.sql` once it has run on a persistent database. A fix
  goes in a new `V5`.

## Not verified by this change

- Response times with ~100,000 owners, and under concurrent users. No large dataset was generated,
  and `OwnerSearchThroughLatencyProxyTest` was only compiled, not run. Deferred until budget is
  available.
- Verified: pagination happens in SQL (`OFFSET … FETCH FIRST`), with at most 3 SELECTs for a full
  page of 5 or 20, on small fixtures.
