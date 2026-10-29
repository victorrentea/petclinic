# Release and rollback

## Ship together

`GET /api/owners` changes shape (array → `{content, totalElements}`), so the backend and the
frontend go out in **one PR and one deploy**. A new backend behind an old frontend shows an
empty grid; an old backend behind a new frontend does the same. There is no other in-repo
consumer of the list: the chatbot calls only `GET /api/owners/{id}`, the JMeter plan only
POSTs owners and reads them by id.

1. Merge the PR (backend, frontend, `openapi.yaml`, `api-types.ts`, diagrams in one commit range).
2. Deploy backend and frontend together. On first start Flyway applies
   `V4__owner_list_indexes.sql` — three `CREATE INDEX` on `owners`, nothing else.
3. Smoke: `GET /api/owners` → 10 rows and `totalElements`; `GET /api/owners?size=7` → 400;
   the Owners screen shows `1 – 10 of N` and sorts by Name and City.

## Roll back together

Redeploy the previous backend **and** frontend versions; never one without the other.

- **Leave V4 applied.** The old backend never names those indexes (`ddl-auto=none`) and
  Flyway treats an applied migration newer than any it ships as *future*, which its default
  `ignoreMigrationPatterns=*:future` accepts — the old version boots on the new schema.
- **Never edit or delete `V4__owner_list_indexes.sql`** once a persistent environment has
  applied it; a later index change is a new `V5__…` migration.
- To drop the indexes anyway (not needed): a new migration, run by the newer version.

## Not verified by this change

Response times at ~100,000 owners and under concurrent load were **not** measured: the
latency-proxy test was adapted and compiled but not run, and no large dataset was generated.
What is verified is that paging happens in the database and a full page costs at most three
SELECTs (`OwnerListQueryBudgetTest`, and 3 statements per list request in the traced
diagrams).
