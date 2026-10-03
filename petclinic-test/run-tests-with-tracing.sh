#!/usr/bin/env bash
#
# run-tests-with-tracing.sh — run the e2e tests against an ALREADY-RUNNING stack
# so each @generate_sequence scenario's browser↔backend↔DB trace is captured in
# Tempo and turned into a PlantUML sequence diagram — and each scenario named in
# GENSEQ_SELECT (one `<file>::<title>` per line), tagged or not
# (petclinic-test/generated/<test file>.<scenario>.genseq.puml).
#
# This script assumes the full telemetry stack is already up, started the
# canonical way (so the backend has the OpenTelemetry Java agent attached):
#
#     ./start-database.sh     # embedded Postgres        :5432
#     ./start-grafana.sh      # Grafana LGTM + Tempo      :3300, OTLP :4318
#     ./start-backend.sh      # Spring Boot + OTel agent  :8080
#     ./start-frontend.sh     # Angular dev server        :4200
#
# Or against an isolated instance of its own, which has every one of those inside
# (Tempo included) on host-picked ports — the way /human-review runs it:
#
#     ../start-docker.sh up --name petclinic-traced --otel --fresh
#     env $(../start-docker.sh ports petclinic-traced) ./run-tests-with-tracing.sh
#
# Every endpoint comes from the environment when set — BASE_URL, BACKEND_URL,
# GRAFANA_URL, OTEL_EXPORTER_OTLP_ENDPOINT, the names `start-docker.sh ports`
# prints — and defaults to the dev stack's fixed ports above.
#
# It does NOT start or stop anything — it only verifies the stack is reachable,
# runs both suites (which reuse the running apps), and reports the diagrams
# produced.
#
# Usage:  ./run-tests-with-tracing.sh            (from petclinic-test/)
#
set -uo pipefail

UI_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$UI_TEST_DIR/.." && pwd)"

GRAFANA="${GRAFANA_URL:-http://localhost:3300}"
OTLP="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
BACKEND="${BACKEND_URL:-http://127.0.0.1:8080}"
FRONTEND="${BASE_URL:-http://127.0.0.1:4200}"
DB_PORT=5432
# A container stack has its database behind the backend and the agent attached by
# construction (start-docker.sh up --otel); only the dev stack is checked for both.
DEV_STACK=1
[[ -n "${BACKEND_URL:-}" ]] && DEV_STACK=0

log()  { printf '\033[1;36m[tracing]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[tracing]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[tracing] %s\033[0m\n' "$*" >&2; exit 1; }

http_up() { curl -fsS "$1" >/dev/null 2>&1; }
# Any HTTP answer at all: a collector GETs back a 405, which is still a collector.
answers() { curl -s -o /dev/null --max-time 3 "$1"; }
port_up() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- 3<&-; }

# --- preflight: the stack must already be running --------------------------
down=()
http_up "$GRAFANA/api/health"   || down+=("Grafana ($GRAFANA)        → ./start-grafana.sh")
answers "$OTLP/v1/traces"       || down+=("OTLP collector ($OTLP)    → ./start-grafana.sh")
((DEV_STACK)) && { port_up "$DB_PORT" || down+=("Postgres (:$DB_PORT)            → ./start-database.sh"); }
http_up "$BACKEND/api/pettypes" || down+=("Backend ($BACKEND)        → ./start-backend.sh")
http_up "$FRONTEND/"            || down+=("Frontend ($FRONTEND)      → ./start-frontend.sh")

if ((${#down[@]})); then
  warn "The stack is not fully up. Start the missing pieces, then re-run:"
  for d in "${down[@]}"; do printf '   • %s\n' "$d" >&2; done
  die "aborting — nothing was started or stopped."
fi
log "✅ Stack reachable (Grafana, Tempo/OTLP, Postgres, backend+agent, frontend)."

# The backend only attaches the OTel agent when :4318 was already up at boot, so
# a backend started before Grafana passes every check above yet emits no traces.
if ((DEV_STACK)); then
  backend_port="${BACKEND##*:}"
  backend_pid="$(lsof -nP -iTCP:"$backend_port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  if [[ -n "$backend_pid" ]] && ! ps -o command= -p "$backend_pid" 2>/dev/null | grep -q 'opentelemetry-javaagent'; then
    die "Backend on :$backend_port is running WITHOUT the OpenTelemetry agent — restart it (./start-backend.sh) first."
  fi
  log "✅ Backend has the OpenTelemetry agent attached."
fi

# --- run both suites -------------------------------------------------------
# One diagram per style, so both runners are needed: add-visit.spec.ts carries
# @generate_sequence as a Playwright tag, owner-search.feature as a Cucumber
# scenario tag.
cd "$UI_TEST_DIR" || die "cannot cd into $UI_TEST_DIR"

# Clean slate once, for both suites: each regenerates only the diagrams of its
# own source files, so neither may do this sweep itself.
rm -f "$UI_TEST_DIR"/generated/*.genseq.puml "$UI_TEST_DIR"/generated/*.genseq.json

# GENSEQ_SELECT names tests to trace that carry no tag — what /human-review passes for the
# tests a branch wrote (src/genseq/sequence-tag.ts). Cucumber already runs every scenario
# and reads the list itself; Playwright only runs what its --grep lets through, so the
# selected spec titles join the tag there.
if [[ -n "${GENSEQ_SELECT:-}" ]]; then
  log "Also tracing $(grep -c . <<<"$GENSEQ_SELECT") test(s) named in GENSEQ_SELECT."
  log "Running the tagged and the selected Playwright specs…"
  SKIP_SERVER_START=1 npx playwright test --grep "$(npx ts-node src/genseq/sequence-tag.ts grep)"
else
  log "Running the tagged Playwright spec…"
  npm run test:sequence
fi
test_status=$?

log "Running the .feature scenarios (Cucumber)…"
npm run test:cucumber
cucumber_status=$?
((test_status == 0)) && test_status=$cucumber_status

# --- report the diagrams produced ------------------------------------------
shopt -s nullglob
diagrams=("$UI_TEST_DIR"/generated/*.genseq.puml)
if ((${#diagrams[@]})); then
  log "📊 Collected ${#diagrams[@]} sequence diagram(s):"
  for d in "${diagrams[@]}"; do echo "      - ${d#"$ROOT"/}"; done
else
  warn "No .puml collected — is the backend running WITH the OTel agent"
  warn "(./start-backend.sh while Grafana is up), so traces reached Tempo?"
fi

if [[ $test_status -eq 0 ]]; then
  log "✅ Tests passed."
else
  warn "Tests exited with status $test_status."
fi
exit "$test_status"
