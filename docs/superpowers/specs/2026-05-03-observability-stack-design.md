# Observability Stack — Grafana LGTM + OpenTelemetry + MCP

**Status:** approved (brainstorming)
**Date:** 2026-05-03
**Owner:** Victor

## Goal

Demo-grade local observability for the PetClinic workshop: metrics, traces, and
logs from the Spring Boot backend (zero-code) and the Angular frontend, pushed
into Grafana LGTM, queryable by Claude Code through an MCP server.

The success criterion is that during a workshop Claude can answer questions like
"how long did endpoint `/api/owners` take on average?", "show me logs from
traces that hit `OwnerController.findById`", or "RPS for the last 10 minutes".

## Non-goals

- Production-grade observability (HA, retention tuning, security hardening).
- Custom Grafana dashboards (Explore UI is enough; MCP queries data sources directly).
- Load generators (students drive traffic manually from UI/Postman).
- Auto-attaching the agent to the IntelliJ "Run main class" play button (documented limitation).
- Frontend instrumentation in production builds (`npm start` only).
- Python chart-generation MCP (deferred — only `mcp-grafana` for now).

## Topology

```
  Backend (JVM + javaagent) ─OTLP/HTTP─┐
                                       │
  Angular (browser SDK)  ── via dev ───┤──▶  grafana/otel-lgtm
                          server proxy │      (single container)
                                       │       │
  Embedded Postgres :5432 ◀──scrape────┘       ├─ Tempo  (traces)
                          (postgresql receiver)├─ Loki   (logs)
                                               ├─ Mimir  (metrics)
                                               └─ Grafana :3000
                                                       ▲
                                                       │ HTTP
                                                       │
                                               ┌───────────────┐
                                               │  mcp-grafana  │ ◀── Claude Code
                                               │ (local binary)│   via .mcp.json
                                               └───────────────┘
```

A single Docker container runs the full LGTM stack with its bundled OTel
Collector. We override its config to enable a `postgresql` receiver. The
backend agent and the Angular dev server both push OTLP to the bundled
collector. Claude Code talks to Grafana through `mcp-grafana`.

## Components

### 1. Docker Compose at repo root

File: `docker-compose.yml`

```yaml
services:
  lgtm:
    image: grafana/otel-lgtm:0.8.1   # pinned
    container_name: petclinic-lgtm
    ports:
      - "3000:3000"   # Grafana UI (admin/admin)
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    volumes:
      - ./observability/otelcol-config.yaml:/otel-lgtm/otelcol-config.yaml:ro
      - lgtm-data:/data
    extra_hosts:
      - "host.docker.internal:host-gateway"   # Linux host PG reachability
volumes:
  lgtm-data:
```

Helper scripts at repo root:
- `start-observability.sh` → `docker compose up -d lgtm`
- `stop-observability.sh` → `docker compose down`

The stack is **opt-in**: not wired into `start-all.sh`, because not every
workshop attendee has Docker Desktop. README documents the explicit start step.

### 2. OTel Collector config override

File: `observability/otelcol-config.yaml`

Extends the stock config baked into `grafana/otel-lgtm:0.8.1` (read from the
image at implementation time, copied into the file, then extended) with:

- A `postgresql` receiver targeting `host.docker.internal:5432`, user
  `postgres`, db `petclinic`. Connection comes from inside Docker, which
  appears to PG as a non-localhost client, so the embedded launcher's
  `pg_hba.conf` (or equivalent) needs a `host trust` line for the host bridge
  network. If the embedded launcher does not already permit it, implementation
  adds either: (a) a small change to `PostgresLauncher.java` to relax `pg_hba`
  for `host.docker.internal`, or (b) configure a password and pass it to the
  collector via env var. Pick at implementation time after probing the
  embedded PG defaults.
- The PG receiver is added to the `metrics` pipeline alongside the existing
  `otlp` receiver.

All other pieces of the stock config (Tempo / Loki / Mimir exporters and
pipelines) are preserved verbatim.

### 3. Backend zero-code instrumentation

The OpenTelemetry Java agent JAR is downloaded by `start-backend.sh` on first
run and cached at `petclinic-backend/.tools/opentelemetry-javaagent.jar`
(gitignored).

Modifications to `start-backend.sh`:

```bash
AGENT_DIR="$BACKEND_DIR/.tools"
AGENT_JAR="$AGENT_DIR/opentelemetry-javaagent.jar"
AGENT_VERSION="2.10.0"
AGENT_URL="https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${AGENT_VERSION}/opentelemetry-javaagent.jar"

if [[ ! -f "$AGENT_JAR" ]]; then
  mkdir -p "$AGENT_DIR"
  if curl -fsSL -o "$AGENT_JAR" "$AGENT_URL"; then
    echo "✅ Downloaded OTel agent v${AGENT_VERSION}"
  else
    echo "⚠️  Could not download OTel agent — booting without observability"
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

cd "$BACKEND_DIR"
MAVEN_OPTS="$OTEL_OPTS" ./mvnw spring-boot:run
```

Auto-instrumentation provided by the Java agent v2.x out-of-the-box covers:
Spring MVC controller spans, JDBC spans (with SQL text), HikariCP metrics,
Logback log bridge to OTLP. No code changes in the backend.

**Failure modes (intentional):**
- LGTM not running → agent retries with backoff, drops data after retries; app
  is unaffected.
- Agent download fails (offline first run) → script logs a warning and starts
  the app without `-javaagent`.

### 4. Frontend instrumentation

New npm dependencies:
```
@opentelemetry/api
@opentelemetry/sdk-trace-web
@opentelemetry/context-zone
@opentelemetry/exporter-trace-otlp-http
@opentelemetry/instrumentation
@opentelemetry/auto-instrumentations-web
```

New file: `petclinic-frontend/src/otel.ts` with:
- `WebTracerProvider` configured with `service.name = petclinic-frontend`
- `OTLPTraceExporter` pointed at `/v1/traces` (relative URL — handled by the
  dev server proxy)
- `registerInstrumentations(getWebAutoInstrumentations(...))` covering
  document load, fetch, XHR
- `propagateTraceHeaderCorsUrls: [/localhost:8080/]` so the `traceparent`
  header is sent to the backend, enabling end-to-end distributed traces
  (browser → controller → JDBC).

`main.ts` adds `import './otel';` as the first import.

Dev server proxy: `petclinic-frontend/proxy.conf.json` (created or extended)
forwards `/v1/traces` → `http://localhost:4318`. Wired via
`angular.json` → `serve.options.proxyConfig`.

**Limitation:** works only with `npm start` (dev). Production builds are out of
scope for the workshop.

### 5. Claude MCP integration

File: `.mcp.json` at repo root.

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

Default credentials match the stock `grafana/otel-lgtm` image. README
explicitly notes these are local-demo credentials, never published.

`mcp-grafana` is installed manually by the student via `brew install
mcp-grafana` or `go install github.com/grafana/mcp-grafana/cmd/mcp-grafana@latest`.
README documents both paths.

Capabilities exposed to Claude through `mcp-grafana`: `query_prometheus`
(PromQL), `query_loki_logs` / `query_loki_stats` (LogQL),
`query_tempo_traces` / `find_traces` (TraceQL), `list_datasources`,
`search_dashboards`, `get_dashboard_by_uid`. These cover the success-criterion
queries (latency per endpoint, logs from traces in method X, RPS).

### 6. Repository hygiene

- `petclinic-backend/.gitignore` — add `.tools/`
- `README.md` — new "Observability" section with:
  1. How to start LGTM (`./start-observability.sh`)
  2. How the backend agent attaches automatically
  3. How the frontend dev proxy works
  4. How to install `mcp-grafana` and verify in Claude
  5. Known limitation: IntelliJ play button bypasses `start-backend.sh` —
     workaround is `JAVA_TOOL_OPTIONS=-javaagent:.../opentelemetry-javaagent.jar`
     in the run config

## Files touched (summary)

**New:**
- `docker-compose.yml`
- `start-observability.sh`, `stop-observability.sh`
- `observability/otelcol-config.yaml`
- `.mcp.json`
- `petclinic-frontend/src/otel.ts`
- `petclinic-frontend/proxy.conf.json` (if not already present — verify at impl)
- `docs/superpowers/specs/2026-05-03-observability-stack-design.md` (this file)

**Modified:**
- `start-backend.sh` — agent download + JVM args
- `petclinic-frontend/src/main.ts` — single import line
- `petclinic-frontend/angular.json` — proxyConfig wiring
- `petclinic-frontend/package.json` — 6 new deps
- `petclinic-backend/.gitignore` — `.tools/` entry
- `README.md` — new Observability section

## Open questions resolved during brainstorming

| # | Question | Decision |
|---|----------|----------|
| 1 | Docker vs cloud vs both? | Docker Compose only |
| 2 | How to ship the OTel agent? | Auto-download in `start-backend.sh` |
| 3 | Which MCPs? | Only `mcp-grafana` (no Python charts MCP for now) |
| 4 | Load generator? | None — manual traffic |
| 5 | Custom dashboard? | None — Explore UI |
| 6 | MCP config location? | `.mcp.json` committed at repo root |
| 7 | PostgreSQL deep metrics? | Yes — `postgresql` receiver in LGTM's bundled collector |
| 8 | Angular instrumentation? | Yes — via dev server proxy (no CORS hacks) |
