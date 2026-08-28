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

## What it found

`GET /api/owners` **has no paging and no sorting**, and returns the entire `owners` table —
with every owner's pets and every pet's visits — on every call.

| | 10,000 owners | 100,000 owners |
|---|---|---|
| response body for one grid load | 6.5 MB | 66 MB |
| p50 latency (4 concurrent users) | 3.0 s | 27.8 s |
| SQL statements per request | 25,007 | ~250,000 |
| throughput | 1.3 req/s | 0.14 req/s |

`?page=1999&size=5` returns all 100,000 owners, byte-for-byte identical to the unparameterised
call. `?sort=…` likewise. See `results/summary-*.txt` and `results/explain-*.txt`.

## Layout

| file | what it is |
|---|---|
| `docker-compose.loadtest.yml` | db + backend + jmeter, on the `loadtest-net` network |
| `Dockerfile.backend` | the shipped backend image **plus `COPY lombok.config`** — see below |
| `Dockerfile.jmeter` | multi-arch JMeter; the published images are amd64-only and would measure QEMU |
| `seed/bulk-owners.sql` | the bulk fixture, applied with psql — deliberately *not* a Flyway migration |
| `seed/explain.sql` | `EXPLAIN (ANALYZE, BUFFERS)` for every query behind the grid |
| `jmx/owners-grid.jmx` | the 8 scenarios, serialized so each gets the server to itself |
| `analyze-jtl.py` | raw `.jtl` → p50 / p95 / p99 / max / throughput per scenario |
| `results/` | `summary-*.txt` and `explain-*.txt` are committed; raw `.jtl` is gitignored |

## Two things worth knowing before you re-run

**The shipped backend Dockerfile does not build.** `petclinic-backend/Dockerfile` copies
`pom.xml` and `src/` but not `lombok.config`, which sets `lombok.accessors.chain=true`.
Without it Lombok emits void setters and compilation fails on the chained calls in
`OwnerRestController` (`new Owner().setId(ownerId)`) and `PetRestController` — three errors.
`docker-compose.test.yml` inherits the same problem. `Dockerfile.backend` here is that file
with one line added; the real fix belongs in the shipped Dockerfile and is left to the owner.

**The bulk data never touches the demo database.** It is applied with `psql` inside this
stack after Flyway has built the real schema, so the schema under test is exactly the
shipped one (V1..V8) and only the row count differs. Nothing is added to
`petclinic-backend/src/main/resources/db/migration/`, and no applied migration is edited —
the house rule from `V5__clear_demo_owner_phone.sql` holds.

`PGDATA` is on a **tmpfs**: the Docker VM had no free disk, and it also takes storage
latency out of the measurement. A 10k grid load measured 2.5 s on tmpfs against 2.8 s on
disk — the database is not what makes this endpoint slow, so the choice does not move the
conclusion.
