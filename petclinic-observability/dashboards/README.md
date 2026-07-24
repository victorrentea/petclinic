# PetClinic — Grafana Monitoring Dashboard

A ready-to-import Grafana dashboard for the PetClinic backend, built on the
OpenTelemetry metrics the app already emits (via the OTel Java agent) plus the
PostgreSQL and collector metrics scraped by the `otel-lgtm` stack.

- **Dashboard model:** [`petclinic-app-monitoring.json`](./petclinic-app-monitoring.json) (uid `petclinic-monitoring`)
- **One-command import:** [`import-dashboard.sh`](./import-dashboard.sh)

## What it monitors

| Row | Panels |
|-----|--------|
| 🟢 **Golden Signals** | Throughput (req/s) · 5xx error rate · p95 & p99 latency · DB connections in use · heap used |
| 🌐 **HTTP Traffic** | Request rate by route · latency percentiles (p50/p95/p99) · responses by status code · slowest-routes table |
| ☕ **JVM Runtime** | Heap vs non-heap memory · CPU utilization · live threads · GC pause time & frequency |
| 🔌 **DB Connection Pool (HikariCP)** | Connections by state (used/idle/max) · pending acquire requests · acquire-wait p95 |
| 🐘 **PostgreSQL Server** | Transactions/s (commits vs rollbacks) · row operations/s · active backends · database size · blocks read/s · index scans/s |

## Prerequisites

The dashboard queries a Prometheus datasource named **`prometheus`** (the default
inside the `grafana/otel-lgtm` image). For data to appear you need, in order:

1. **Database** — `./start-database.sh`
2. **Observability stack** — `./start-grafana.sh` (Grafana on http://localhost:3300, login `admin`/`admin`)
3. **Backend** — `./start-backend.sh` **started _after_ the stack is up.**

> ⚠️ **Order matters.** `start-backend.sh` only attaches the OpenTelemetry Java
> agent if the collector is already listening on `:4318`. If you start the
> backend before Grafana, it runs *uninstrumented* and the HTTP / JVM / pool
> panels stay empty — restart the backend once the stack is up.

Metric-freshness note: the OTel Java agent exports every **60 s**, so the
`rate()`-based panels use a fixed **2-minute** window (instead of
`$__rate_interval`) to stay gap-free. Give the app a minute of traffic before
expecting the latency/throughput panels to fill in.

## Import it

### Option A — script (easiest)

```sh
cd petclinic-observability/dashboards
./import-dashboard.sh
```

Override the target Grafana with env vars if needed:

```sh
GRAFANA_URL=http://my-host:3300 GRAFANA_USER=admin GRAFANA_PASS=secret ./import-dashboard.sh
```

Re-running is safe — the dashboard has a stable uid and is overwritten in place.

### Option B — Grafana UI (no shell)

1. Open Grafana → **Dashboards → New → Import**.
2. **Upload** `petclinic-app-monitoring.json` (or paste its contents).
3. Select the **`prometheus`** datasource if prompted, then **Import**.

## Regenerating / editing

The JSON is the source of truth. To tweak a panel, either edit it in the Grafana
UI and re-export (**Dashboard settings → JSON Model**, or
`GET /api/dashboards/uid/petclinic-monitoring`) back into
`petclinic-app-monitoring.json`, or edit the JSON directly and re-run
`import-dashboard.sh`.
