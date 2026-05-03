# Observability Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up local Grafana LGTM + OpenTelemetry zero-code instrumentation (backend agent + Angular browser SDK) + `mcp-grafana` so Claude can answer queries about latency, traces, and logs in the running PetClinic app.

**Architecture:** Single Docker container (`grafana/otel-lgtm`) with overridden bundled-collector config to enable a `postgresql` receiver. The Spring Boot backend is auto-attached to the OTel Java agent via `start-backend.sh`. The Angular frontend pushes OTLP traces through the dev-server proxy to LGTM. Claude Code talks to Grafana over `mcp-grafana` configured via committed `.mcp.json`.

**Tech Stack:** Docker Compose, `grafana/otel-lgtm:0.8.1`, OpenTelemetry Java agent v2.10.0, OpenTelemetry JS SDK (`@opentelemetry/sdk-trace-web` and friends), `mcp-grafana`, Bash.

**Spec:** `docs/superpowers/specs/2026-05-03-observability-stack-design.md`.

**Branch:** `main` (no worktree — infra-only changes, no parallel feature work).

---

## File Structure

**New files:**
- `docker-compose.yml` — root, single `lgtm` service
- `start-observability.sh` — root, opt-in launcher
- `stop-observability.sh` — root, teardown
- `observability/otelcol-config.yaml` — collector config override (extends LGTM stock)
- `.mcp.json` — registers `mcp-grafana` for Claude Code
- `petclinic-frontend/src/otel.ts` — browser OTel init
- `petclinic-frontend/proxy.conf.json` — dev-server proxy for `/v1/traces`

**Modified:**
- `start-backend.sh` — agent auto-download + JVM args
- `petclinic-backend/.gitignore` — ignore `.tools/`
- `petclinic-frontend/src/main.ts` — single import line
- `petclinic-frontend/angular.json` — add `proxyConfig` to `serve.options`
- `petclinic-frontend/package.json` (via `npm install`) — 6 OTel deps
- `README.md` — new "Observability" section

**Boundaries:** observability config lives under `observability/`. Frontend OTel init is a single self-contained file. Backend instrumentation is purely script-level — no Java code change.

---

### Task 1: Add Docker Compose with stock LGTM container

**Goal of task:** student can run `docker compose up -d lgtm`, hit Grafana at http://localhost:3000 (admin/admin), and the OTLP receiver listens on :4318.

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write the verification check (failing)**

Run:
```bash
curl -fsS http://localhost:3000/api/health
```
Expected: connection refused (Grafana not running yet) — **this is the failing baseline**.

- [ ] **Step 2: Create `docker-compose.yml` at repo root**

```yaml
services:
  lgtm:
    image: grafana/otel-lgtm:0.8.1
    container_name: petclinic-lgtm
    ports:
      - "3000:3000"   # Grafana UI
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    volumes:
      - lgtm-data:/data
    extra_hosts:
      - "host.docker.internal:host-gateway"
volumes:
  lgtm-data:
```

- [ ] **Step 3: Pull the image and start the container**

```bash
docker compose pull lgtm
docker compose up -d lgtm
```

- [ ] **Step 4: Wait for Grafana to be ready, then re-run the check**

```bash
for i in {1..30}; do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ Grafana up after ${i}s"; break
  fi
  sleep 1
done
curl -fsS http://localhost:3000/api/health
```
Expected: JSON body containing `"database": "ok"`.

- [ ] **Step 5: Verify OTLP HTTP receiver port is open**

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:4318/v1/traces -X POST -H "Content-Type: application/json" -d '{"resourceSpans":[]}'
```
Expected: `200`.

- [ ] **Step 6: Stop the container (clean state)**

```bash
docker compose down
```

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(observability): add docker-compose with grafana/otel-lgtm"
```

---

### Task 2: Add helper scripts `start-observability.sh` / `stop-observability.sh`

**Goal of task:** opt-in start/stop with friendly messages, without forcing students who lack Docker to run them.

**Files:**
- Create: `start-observability.sh`
- Create: `stop-observability.sh`

- [ ] **Step 1: Write `start-observability.sh`**

```bash
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop or Colima first." >&2
  exit 1
fi

echo "🚀 Starting Grafana LGTM (metrics, logs, traces)..."
docker compose up -d lgtm

echo "⏳ Waiting for Grafana to be ready..."
for i in {1..60}; do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ Grafana ready at http://localhost:3000 (admin/admin)"
    exit 0
  fi
  sleep 1
done
echo "⚠️  Grafana did not become ready in 60s — check 'docker compose logs lgtm'" >&2
exit 1
```

- [ ] **Step 2: Write `stop-observability.sh`**

```bash
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "🛑 Stopping Grafana LGTM..."
docker compose down
echo "✅ Stopped (data persisted in volume 'lgtm-data')"
```

- [ ] **Step 3: Make scripts executable**

```bash
chmod +x start-observability.sh stop-observability.sh
```

- [ ] **Step 4: Verify the scripts run end-to-end**

```bash
./start-observability.sh
curl -fsS http://localhost:3000/api/health | grep -q '"database":"ok"' && echo "OK"
./stop-observability.sh
```
Expected: both scripts complete without errors; the curl prints `OK`.

- [ ] **Step 5: Commit**

```bash
git add start-observability.sh stop-observability.sh
git commit -m "feat(observability): add start/stop helper scripts"
```

---

### Task 3: Wire OTel Java agent into `start-backend.sh`

**Goal of task:** running `./start-backend.sh` downloads the agent on first run, attaches it to Spring Boot, and pushes OTLP to LGTM. With LGTM running, traces and metrics appear in Grafana within ~30 seconds of a backend request.

**Files:**
- Modify: `start-backend.sh`
- Modify: `petclinic-backend/.gitignore`

- [ ] **Step 1: Add `.tools/` to `petclinic-backend/.gitignore`**

Open `petclinic-backend/.gitignore` and append (preserve existing content):

```
# Local OpenTelemetry agent cache
.tools/
```

- [ ] **Step 2: Write the failing check**

Start the backend with current `start-backend.sh` (no OTel) and curl an endpoint:

```bash
./start-backend.sh &
BACKEND_PID=$!
sleep 30
curl -fsS http://localhost:8080/api/owners >/dev/null
kill $BACKEND_PID
```

Then query Tempo (LGTM must be running):

```bash
./start-observability.sh
curl -G "http://admin:admin@localhost:3000/api/datasources/proxy/uid/tempo/api/search" \
  --data-urlencode 'tags=service.name=petclinic-backend' | jq '.traces | length'
```
Expected: `0` (no agent attached → no traces) — **this is the failing baseline**.

- [ ] **Step 3: Replace `start-backend.sh` with the instrumented version**

Replace the full file contents:

```bash
#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/petclinic-backend"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

AGENT_VERSION="2.10.0"
AGENT_DIR="$BACKEND_DIR/.tools"
AGENT_JAR="$AGENT_DIR/opentelemetry-javaagent.jar"
AGENT_URL="https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${AGENT_VERSION}/opentelemetry-javaagent.jar"

if [[ ! -f "$AGENT_JAR" ]]; then
  mkdir -p "$AGENT_DIR"
  echo "⬇️  Downloading OpenTelemetry Java agent v${AGENT_VERSION}..."
  if curl -fsSL -o "$AGENT_JAR" "$AGENT_URL"; then
    echo "✅ Downloaded OTel agent"
  else
    echo "⚠️  Could not download OTel agent — booting WITHOUT observability"
    rm -f "$AGENT_JAR"
  fi
fi

OTEL_OPTS=""
if [[ -f "$AGENT_JAR" ]]; then
  OTEL_OPTS="-javaagent:$AGENT_JAR \
-Dotel.service.name=petclinic-backend \
-Dotel.exporter.otlp.endpoint=http://localhost:4318 \
-Dotel.exporter.otlp.protocol=http/protobuf \
-Dotel.logs.exporter=otlp \
-Dotel.metrics.exporter=otlp \
-Dotel.traces.exporter=otlp \
-Dotel.resource.attributes=deployment.environment=local"
fi

echo "🚀 Starting Petclinic Backend (Spring Boot)..."
echo "Backend will be available at: http://localhost:8080/"
if [[ -n "$OTEL_OPTS" ]]; then
  echo "📡 OpenTelemetry agent attached → http://localhost:4318"
fi
echo ""

cd "$BACKEND_DIR"
MAVEN_OPTS="$OTEL_OPTS" ./mvnw spring-boot:run
```

- [ ] **Step 4: Run end-to-end and verify traces appear**

```bash
./start-observability.sh
./start-backend.sh &
BACKEND_PID=$!
# Wait for the backend to be up
for i in {1..120}; do
  if curl -fsS http://localhost:8080/api/owners >/dev/null 2>&1; then break; fi
  sleep 1
done
# Generate a few requests
for i in {1..5}; do curl -fsS http://localhost:8080/api/owners >/dev/null; done
# Give agent time to flush
sleep 15
# Query Tempo for traces tagged with service.name=petclinic-backend
curl -fsS -G "http://admin:admin@localhost:3000/api/datasources/proxy/uid/tempo/api/search" \
  --data-urlencode 'tags=service.name=petclinic-backend' \
  --data-urlencode 'limit=5' | jq '.traces | length'
kill $BACKEND_PID
```
Expected: a number `>= 1` (at least one trace recorded).

- [ ] **Step 5: Commit**

```bash
git add start-backend.sh petclinic-backend/.gitignore
git commit -m "feat(observability): auto-attach OTel agent in start-backend.sh"
```

---

### Task 4: Override LGTM collector config to add PostgreSQL receiver

**Goal of task:** the bundled collector inside `grafana/otel-lgtm` scrapes the embedded PG instance for `pg_stat_*` metrics, exporting them via the existing Mimir pipeline. Verifiable by querying Prometheus for a metric like `postgresql_backends`.

**Files:**
- Create: `observability/otelcol-config.yaml`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Extract the stock collector config from the running image**

```bash
mkdir -p observability
docker compose up -d lgtm
docker compose exec lgtm cat /otel-lgtm/otelcol-config.yaml > observability/otelcol-config.yaml
docker compose down
ls -la observability/otelcol-config.yaml
```
Expected: file exists, non-empty, contains `receivers:`, `exporters:`, `service:` sections.

- [ ] **Step 2: Probe embedded Postgres connection from inside Docker**

Start the embedded PG (assumes the Maven module's launcher is running on host :5432) and probe from a one-shot container:

```bash
# Start embedded PG (in a separate terminal)
./start-database.sh

# Probe from inside Docker
docker run --rm --add-host=host.docker.internal:host-gateway postgres:16 \
  psql "host=host.docker.internal port=5432 user=postgres dbname=petclinic sslmode=disable" \
  -c "SELECT 1;"
```

If this succeeds without prompting for a password, trust auth is OK and we proceed without password config. If it fails with auth error, stop and update `petclinic-database/src/main/java/ro/victorrentea/petclinic/db/PostgresLauncher.java` to allow `host trust` for the host bridge network in `pg_hba.conf` (or set a known password and pass it via env). Document whichever path is taken below in Step 3.

- [ ] **Step 3: Append the `postgresql` receiver to `observability/otelcol-config.yaml`**

In the `receivers:` map, add:

```yaml
  postgresql:
    endpoint: host.docker.internal:5432
    transport: tcp
    username: postgres
    databases:
      - petclinic
    collection_interval: 10s
    tls:
      insecure: true
```

If the Step 2 probe required a password, also add `password: ${env:OTEL_PG_PASSWORD}` here, and pass `-e OTEL_PG_PASSWORD=...` to the lgtm service via `docker-compose.yml`.

In `service.pipelines.metrics.receivers`, add `postgresql` so the section reads, e.g., `[otlp, postgresql]`.

- [ ] **Step 4: Mount the override into the container**

Modify `docker-compose.yml` — under `services.lgtm.volumes`, add the bind mount before `lgtm-data`:

```yaml
    volumes:
      - ./observability/otelcol-config.yaml:/otel-lgtm/otelcol-config.yaml:ro
      - lgtm-data:/data
```

- [ ] **Step 5: Restart and verify PG metrics flow into Mimir**

```bash
docker compose down
docker compose up -d lgtm
# Wait for collector
sleep 20
# Query Mimir (via Grafana datasource proxy) for a postgresql metric
curl -fsS -G "http://admin:admin@localhost:3000/api/datasources/proxy/uid/prometheus/api/v1/query" \
  --data-urlencode 'query=postgresql_backends' | jq '.data.result | length'
```
Expected: a number `>= 1`.

If `0`, check `docker compose logs lgtm | grep -i postgres` for receiver errors and revisit Step 3.

- [ ] **Step 6: Commit**

```bash
git add observability/otelcol-config.yaml docker-compose.yml
git commit -m "feat(observability): scrape embedded postgres via otel collector"
```

---

### Task 5: Add `.mcp.json` for `mcp-grafana`

**Goal of task:** Claude Code, started in this repo, automatically picks up `mcp-grafana` and exposes its tools.

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Verify `mcp-grafana` is installable (don't install yet — student will)**

```bash
which mcp-grafana || echo "(not installed — that's fine for this task)"
```

- [ ] **Step 2: Create `.mcp.json` at repo root**

```json
{
  "mcpServers": {
    "grafana": {
      "command": "mcp-grafana",
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_USERNAME": "admin",
        "GRAFANA_PASSWORD": "admin"
      }
    }
  }
}
```

- [ ] **Step 3: Verify JSON is valid**

```bash
jq . .mcp.json
```
Expected: pretty-printed JSON, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add .mcp.json
git commit -m "feat(observability): register mcp-grafana for Claude Code"
```

---

### Task 6: Install OTel browser SDK dependencies

**Goal of task:** the `petclinic-frontend` package has the OTel browser deps installed and locked.

**Files:**
- Modify: `petclinic-frontend/package.json` (via npm CLI)
- Modify: `petclinic-frontend/package-lock.json` (auto-generated)

- [ ] **Step 1: Install the dependencies**

```bash
cd petclinic-frontend
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-trace-web \
  @opentelemetry/resources \
  @opentelemetry/context-zone \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/instrumentation \
  @opentelemetry/auto-instrumentations-web
cd ..
```

- [ ] **Step 2: Verify dependencies are listed**

```bash
jq '.dependencies | keys[] | select(startswith("@opentelemetry"))' petclinic-frontend/package.json
```
Expected: 7 lines, one per package above.

- [ ] **Step 3: Confirm the project still builds**

```bash
cd petclinic-frontend
npm run build
cd ..
```
Expected: build succeeds (warnings OK; no errors).

- [ ] **Step 4: Commit**

```bash
git add petclinic-frontend/package.json petclinic-frontend/package-lock.json
git commit -m "feat(observability): add OpenTelemetry browser SDK deps"
```

---

### Task 7: Write Angular OTel init module

**Goal of task:** `src/otel.ts` initializes a `WebTracerProvider` and registers auto-instrumentations. Importing it from `main.ts` causes spans to be created on document load and on every fetch/XHR call to the backend.

**Files:**
- Create: `petclinic-frontend/src/otel.ts`
- Modify: `petclinic-frontend/src/main.ts`

- [ ] **Step 1: Write the failing check**

Open Chrome DevTools Network tab and reload the app (with backend + LGTM running). Filter by `/v1/traces`. Expected at this point: **no requests to /v1/traces** — failing baseline.

- [ ] **Step 2: Create `petclinic-frontend/src/otel.ts`**

```typescript
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { Resource } from '@opentelemetry/resources';

const provider = new WebTracerProvider({
  resource: new Resource({
    'service.name': 'petclinic-frontend',
    'deployment.environment': 'local',
  }),
});

provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({ url: '/v1/traces' }),
  ),
);

provider.register({ contextManager: new ZoneContextManager() });

registerInstrumentations({
  instrumentations: [
    getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-fetch': {
        propagateTraceHeaderCorsUrls: [/localhost:8080/],
      },
      '@opentelemetry/instrumentation-xml-http-request': {
        propagateTraceHeaderCorsUrls: [/localhost:8080/],
      },
    }),
  ],
});
```

- [ ] **Step 3: Add the import as the first line of `main.ts`**

Open `petclinic-frontend/src/main.ts` and insert at the very top (before any existing imports):

```typescript
import './otel';
```

- [ ] **Step 4: Verify the build still succeeds**

```bash
cd petclinic-frontend
npm run build
cd ..
```
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add petclinic-frontend/src/otel.ts petclinic-frontend/src/main.ts
git commit -m "feat(observability): init Angular OTel browser SDK"
```

---

### Task 8: Wire dev-server proxy for `/v1/traces`

**Goal of task:** browser POSTs to relative `/v1/traces` get proxied to `http://localhost:4318/v1/traces` by the Angular dev server, sidestepping CORS entirely.

**Files:**
- Create: `petclinic-frontend/proxy.conf.json`
- Modify: `petclinic-frontend/angular.json`

- [ ] **Step 1: Create `petclinic-frontend/proxy.conf.json`**

```json
{
  "/v1/traces": {
    "target": "http://localhost:4318",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

- [ ] **Step 2: Wire `proxyConfig` into `angular.json`**

In `petclinic-frontend/angular.json`, locate `projects.petclinic-angular.architect.serve.options` (currently contains only `browserTarget`). Add `proxyConfig`:

```json
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "browserTarget": "petclinic-angular:build",
            "proxyConfig": "proxy.conf.json"
          },
```

- [ ] **Step 3: End-to-end verification**

```bash
./start-observability.sh
./start-backend.sh &
BACKEND_PID=$!
( cd petclinic-frontend && npm start ) &
FRONTEND_PID=$!
sleep 60   # Angular dev server warmup
# Hit the app via curl through the dev server (forces a route change)
curl -fsS http://localhost:4200/ >/dev/null
sleep 15
# Look for the petclinic-frontend service in Tempo
curl -fsS -G "http://admin:admin@localhost:3000/api/datasources/proxy/uid/tempo/api/search" \
  --data-urlencode 'tags=service.name=petclinic-frontend' \
  --data-urlencode 'limit=5' | jq '.traces | length'
kill $FRONTEND_PID $BACKEND_PID
```
Expected: a number `>= 1`. (If `0`, open a real browser at http://localhost:4200, click around, then re-query — `curl /` may not trigger document-load instrumentation in time.)

- [ ] **Step 4: Commit**

```bash
git add petclinic-frontend/proxy.conf.json petclinic-frontend/angular.json
git commit -m "feat(observability): proxy /v1/traces from Angular dev server to LGTM"
```

---

### Task 9: README — Observability section

**Goal of task:** a reader who has just cloned the repo can stand up the full stack and ask Claude a query, in <5 minutes, by following the README.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the right insertion point**

Run:
```bash
grep -n "^##" README.md
```
Choose the position right after the project introduction and before any "Architecture" or "Development" section. If unsure, insert just before the last `##` header.

- [ ] **Step 2: Insert the Observability section**

Append this section at the chosen position (preserve surrounding content):

```markdown
## Observability (optional)

Local Grafana LGTM (metrics + logs + traces) plus zero-code OpenTelemetry
instrumentation for both backend and frontend, queryable from Claude Code via
`mcp-grafana`.

### 1. Start the stack

```sh
./start-observability.sh         # Grafana at http://localhost:3000 (admin/admin)
./start-database.sh              # if not already running
./start-backend.sh               # auto-downloads the OTel Java agent on first run
( cd petclinic-frontend && npm start )
```

### 2. Use the app, then explore

Open http://localhost:4200, browse around. Then in Grafana:
- **Explore → Tempo** — distributed traces (browser → backend → JDBC)
- **Explore → Loki** — backend logs (with `trace_id` for correlation)
- **Explore → Prometheus (Mimir)** — JVM, HTTP, and `postgresql_*` metrics

### 3. Install `mcp-grafana` and query from Claude Code

```sh
brew install mcp-grafana
# or
go install github.com/grafana/mcp-grafana/cmd/mcp-grafana@latest
```

The repo's `.mcp.json` registers it automatically when you open Claude Code
in this directory. Then ask things like:

- "What's the average latency of `GET /api/owners` in the last 10 minutes?"
- "Show me logs from traces that hit `OwnerController.findById`."
- "What's the requests-per-second on the backend right now?"

### Limitations

- **IntelliJ play button** on `@SpringBootApplication` does NOT attach the OTel
  agent — it bypasses `start-backend.sh`. To use observability from IntelliJ,
  either run via `./mvnw spring-boot:run` from the terminal, or set this in
  your Run Configuration's "VM options":
  ```
  -javaagent:./.tools/opentelemetry-javaagent.jar
  -Dotel.service.name=petclinic-backend
  -Dotel.exporter.otlp.endpoint=http://localhost:4318
  -Dotel.exporter.otlp.protocol=http/protobuf
  ```
- Frontend instrumentation works only with `npm start` (dev). Production
  builds skip the dev-server proxy.
- Default credentials (`admin/admin`) are local-demo only. Never published.
- Stack is **opt-in** — it's not part of `start-all.sh`. Students without
  Docker can ignore everything in this section.

### Stop

```sh
./stop-observability.sh
```
```

- [ ] **Step 3: Verify markdown is well-formed**

```bash
grep -c "^##" README.md
```
Expected: at least one more `##` than before.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(observability): add README section for LGTM + OTel + MCP"
```

---

### Task 10: Final smoke test (no code changes)

**Goal of task:** verify the entire stack works from a clean state in one go.

- [ ] **Step 1: Clean state**

```bash
./stop-observability.sh 2>/dev/null || true
docker volume rm petclinic_lgtm-data 2>/dev/null || true
rm -rf petclinic-backend/.tools
```

- [ ] **Step 2: Bring everything up**

```bash
./start-observability.sh
./start-database.sh &
DB_PID=$!
sleep 5
./start-backend.sh &
BACKEND_PID=$!
( cd petclinic-frontend && npm start ) &
FRONTEND_PID=$!
```

- [ ] **Step 3: Generate traffic and verify three signals**

```bash
# Wait for backend
for i in {1..120}; do
  if curl -fsS http://localhost:8080/api/owners >/dev/null 2>&1; then break; fi
  sleep 1
done
for i in {1..10}; do curl -fsS http://localhost:8080/api/owners >/dev/null; done
sleep 20

# Backend traces
echo "Backend traces:"
curl -fsS -G "http://admin:admin@localhost:3000/api/datasources/proxy/uid/tempo/api/search" \
  --data-urlencode 'tags=service.name=petclinic-backend' --data-urlencode 'limit=5' \
  | jq '.traces | length'

# Backend logs
echo "Backend logs:"
curl -fsS -G "http://admin:admin@localhost:3000/api/datasources/proxy/uid/loki/loki/api/v1/query_range" \
  --data-urlencode 'query={service_name="petclinic-backend"}' --data-urlencode 'limit=5' \
  | jq '.data.result | length'

# Postgres metric
echo "Postgres metric:"
curl -fsS -G "http://admin:admin@localhost:3000/api/datasources/proxy/uid/prometheus/api/v1/query" \
  --data-urlencode 'query=postgresql_backends' \
  | jq '.data.result | length'
```
Expected: each of the three echoes a number `>= 1`.

- [ ] **Step 4: Tear down**

```bash
kill $FRONTEND_PID $BACKEND_PID $DB_PID 2>/dev/null || true
./stop-observability.sh
```

- [ ] **Step 5: No commit (smoke test only).**

If any of the three checks returned `0`, do NOT mark the implementation complete — open the corresponding task (3 for traces, 3/agent-logback for logs, 4 for postgres) and debug.

---

## Summary

10 tasks, each commits independently, each leaves the repo in a working state.

After Task 10 passes the smoke test, run:

```bash
git log --oneline | head -12
```
Expected: 9 commits from this plan (Task 10 has no commit), all on `main`.
