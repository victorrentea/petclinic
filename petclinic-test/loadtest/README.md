# Owners-grid load test

Measures the latency of the owners grid against a database holding 10,000 (and 100,000)
owners. Everything runs in Docker — Postgres, the backend under test, and the JMeter load
generator — on host ports **25432** and **28080**, chosen to stay clear of the dev stack
(5432 / 8080 / 4200) and the latency proxy (15432).

```sh
./run-loadtest.sh            # 10_000 owners
./run-loadtest.sh 100000     # 100_000 owners
./run-loadtest.sh --down     # remove the loadtest-* containers, network and volumes
```

Everything created is named `loadtest-*`, so nothing else on the machine is touched.

## Results

`GET /api/owners` takes `lastName`, `page`, `size` and `sort` (`name` or `city`, optionally
`,asc` / `,desc`; defaults `page=0 size=10 sort=name`). Paging and sorting happen in the
database, and migration V9 backs both sorts with a covering index.

4 concurrent users, each scenario serialized. p50 / p95 / p99 in ms:

| scenario | 10k p50/p95/p99 | 100k p50/p95/p99 |
|---|---|---|
| first page, size=5 | 4 / 10 / 21 | 12 / 18 / 33 |
| deep page (last page, size=5) | 7 / 15 / 24 | 53 / 65 / 94 |
| deep page sort=city,asc | 6 / 17 / 41 | 40 / 51 / 67 |
| prefix search, broad (`L`) | 4 / 10 / 23 | 25 / 53 / 90 |
| prefix search, selective | 1 / 4 / 11 | 9 / 18 / 38 |

Full tables in `results/summary-*.txt`; plans in `results/explain-*.txt`.

**Two costs still grow with the table**, and both are visible in the plans:

1. **`SELECT count(*)` runs on every request** for `Page.totalElements`, and with no
   `lastName` filter it can only Seq Scan: 1.2 ms at 10k, **12.3 ms at 100k**. At 100k that
   *is* essentially the whole cost of a first-page request (measured p50 12 ms).
2. **`OFFSET` walks the index.** The last page reads every index entry before it —
   100,000 tuples for one 5-row page — 45 ms by name, 31 ms by city.

`pg_stat_user_indexes` after the 100k run shows all three V9 indexes in heavy use and
`owners_pkey` never touched, alongside 42,902 sequential scans reading 4.29 billion
tuples — the count query, once per request.

### The pre-paging baseline

`results/*-prepaging.txt` and `jmx/owners-grid-prepaging.jmx` are the same measurement taken
against the commit *before* server-side paging existed, kept for comparison. Then, one grid
load returned the whole table — 6.5 MB / 25,007 SQL statements at 10k, 66 MB / ~250,000 at
100k, p50 3.0 s and 27.8 s — and `?page=1999&size=5` returned all 100,000 owners because the
endpoint had no such parameter. That is the "before" picture, not a description of `accesa26`.

## Layout

| file | what it is |
|---|---|
| `docker-compose.loadtest.yml` | db + backend + jmeter on the `loadtest-net` network |
| `seed/bulk-owners.sql` | the bulk fixture, applied with psql — deliberately *not* a Flyway migration |
| `seed/explain.sql` | `EXPLAIN (ANALYZE, BUFFERS)` for every query behind the grid, plus real index-usage counters |
| `jmx/owners-grid.jmx` | the 9 scenarios, serialized so each gets the server to itself |
| `analyze-jtl.py` | raw `.jtl` → p50 / p95 / p99 / max / throughput per scenario |
| `results/` | `summary-*`, `explain-*`, `size-bounding-*` are committed; raw `.jtl` is gitignored |

## Three things worth knowing before you re-run

**No images are built.** The Docker VM on this machine has ~0 bytes free and pruning the
user's images or volumes was off limits, so `run-loadtest.sh` builds the backend jar and
fetches JMeter **on the host** and bind-mounts both into a stock `eclipse-temurin:21-jre`.
Compiling on the host is not running a service on the host: no port is bound there, and the
backend under test and the load generator are both containers, as required.

**The shipped backend Dockerfile does not build** — unrelated to the base commit, still true.
`petclinic-backend/Dockerfile` copies `pom.xml` and `src/` but not `lombok.config`, which
sets `lombok.accessors.chain=true`. Without it Lombok emits void setters and compilation
fails on the chained calls in `OwnerRestController` (`new Owner().setId(ownerId)`) and
`PetRestController` — three errors. `docker-compose.test.yml` inherits the same problem.

**The bulk data never touches the demo database.** It is applied with `psql` inside this
stack after Flyway has built the real schema, so the schema under test is exactly the
shipped one (V1..V11) and only the row count differs. Nothing is added to
`petclinic-backend/src/main/resources/db/migration/`, and no applied migration is edited.
The fixture does `TRUNCATE owners`, so the V3 demo owners and the V10/V11 collation rows are
absent during a run — deliberate, to keep the 10k and 100k populations comparable.

`PGDATA` is on a **tmpfs**: the Docker VM had no free disk, and it also takes storage
latency out of the measurement. A 10k grid load measured 2.5 s on tmpfs against 2.8 s on
disk under the pre-paging code — the database's storage was never what made this endpoint
slow, so the choice does not move the conclusion.
