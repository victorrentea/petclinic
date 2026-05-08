# Owner Search — Gatling Performance Test

Verifies that `GET /api/owners?q=<term>` responds in **< 500ms at the 95th percentile**
under **30 requests/second**, with a dataset of **10,000 owners**.

## Prerequisites

1. Backend running on `http://localhost:8080` (security enabled, `admin`/`admin`)
2. Database seeded with ~10,000 owners (see below)

## Seeding 10,000 Owners

Connect to psql and run:

```sql
INSERT INTO owners (first_name, last_name, address, city, telephone)
SELECT
  'First' || i,
  'Last'  || i,
  i || ' Main St',
  'City'  || (i % 100),
  '555' || LPAD(CAST(i AS VARCHAR), 7, '0')
FROM generate_series(1, 10000) AS s(i);
```

## Running the Test

```sh
# From petclinic-backend/
./mvnw gatling:test
```

Reports are generated under `target/gatling/`.

## Assertion

The test fails the build if:
- 95th percentile response time ≥ 500ms
- Error rate ≥ 1%
