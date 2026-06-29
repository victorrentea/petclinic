#!/usr/bin/env bash
#
# run-tests-with-tracing.sh — run the e2e tests against the FULL telemetry stack
# so each scenario's browser↔backend↔DB trace is captured in Tempo and turned
# into a PlantUML sequence diagram (petclinic-ui-test/diagrams/<test>.puml) by the
# Playwright globalTeardown.
#
# Why a dedicated script? Plain `npm test` lets Playwright's webServer start the
# apps via `npm run start:apps`, which boots the backend WITHOUT the OpenTelemetry
# Java agent — so no traces reach Tempo and no diagrams are produced. Here we:
#   1. start Grafana LGTM first (the backend only attaches the agent if the OTLP
#      collector on :4318 is already up),
#   2. start the embedded Postgres,
#   3. start the backend via ./start-backend.sh (agent attached),
#   4. start the frontend,
#   5. run the suite with SKIP_SERVER_START=1 so Playwright reuses our apps,
#   6. tear the whole stack down on exit.
#
# Usage:  ./run-tests-with-tracing.sh            (from petclinic-ui-test/)
#
set -uo pipefail

UI_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$UI_TEST_DIR/.." && pwd)"
LOG_DIR="$UI_TEST_DIR/test-results/tracing-run"
mkdir -p "$LOG_DIR"

DB_PORT=5432
OTLP_PORT=4318
GRAFANA_PORT=3300
BACKEND_PORT=8080
FRONTEND_PORT=4200

PIDS=()
GRAFANA_UP=0

log()  { printf '\033[1;36m[tracing]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[tracing]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[tracing] %s\033[0m\n' "$*" >&2; exit 1; }

port_open() {  # port_open <port>
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- 3<&-
}

free_port() {  # free_port <port> — kill whatever still listens (our forked apps)
  local pids
  pids="$(lsof -ti "tcp:$1" 2>/dev/null || true)"
  # shellcheck disable=SC2086  # word-splitting is intended: kill all listed PIDs
  [[ -n "$pids" ]] && kill $pids 2>/dev/null || true
}

kill_tree() {  # kill_tree <pid> — children first, then the process
  local pid="${1:-}"
  [[ -z "$pid" ]] && return 0
  pkill -P "$pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
}

cleanup() {
  local code=$?
  echo
  log "Tearing down the stack…"
  for pid in "${PIDS[@]:-}"; do kill_tree "$pid"; done
  # spring-boot:run / ng serve fork child processes — free the ports we started.
  for port in "$BACKEND_PORT" "$FRONTEND_PORT" "$DB_PORT"; do free_port "$port"; done
  if [[ "$GRAFANA_UP" == "1" ]]; then
    (cd "$ROOT/petclinic-observability" && docker compose down >/dev/null 2>&1 || true)
  fi
  log "Logs kept in $LOG_DIR"
  exit "$code"
}
trap cleanup EXIT INT TERM

wait_http() {  # wait_http <label> <url> <timeout-seconds>
  local label="$1" url="$2" timeout="${3:-120}" i
  log "Waiting for $label …"
  for ((i = 0; i < timeout; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then log "✅ $label ready"; return 0; fi
    sleep 1
  done
  die "$label not ready after ${timeout}s — see $LOG_DIR"
}

wait_port() {  # wait_port <label> <port> <timeout-seconds>
  local label="$1" port="$2" timeout="${3:-120}" i
  log "Waiting for $label …"
  for ((i = 0; i < timeout; i++)); do
    if port_open "$port"; then log "✅ $label ready"; return 0; fi
    sleep 1
  done
  die "$label not ready after ${timeout}s — see $LOG_DIR"
}

# --- preflight -------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker is required (Grafana/Tempo)"
command -v curl   >/dev/null 2>&1 || die "curl is required"
command -v lsof   >/dev/null 2>&1 || warn "lsof not found — port cleanup on teardown may be incomplete"

log "Repo root: $ROOT"
log "Stack logs: $LOG_DIR"

# 1) Grafana LGTM (collector :4318 must be up before the backend starts) and the
#    database can warm up in parallel.
log "Starting Grafana LGTM…"
( "$ROOT/start-grafana.sh" >"$LOG_DIR/grafana.log" 2>&1 ) & PIDS+=("$!"); GRAFANA_UP=1

log "Starting embedded Postgres…"
( "$ROOT/start-database.sh" >"$LOG_DIR/database.log" 2>&1 ) & PIDS+=("$!")

wait_http "Grafana"        "http://localhost:$GRAFANA_PORT/api/health" 120
wait_port "OTLP collector" "$OTLP_PORT"                                 30
wait_port "Postgres"       "$DB_PORT"                                   90

# 2) Backend WITH the OTel agent (start-backend.sh attaches it now that :4318 is up).
log "Starting backend (OTel agent attached)…"
( "$ROOT/start-backend.sh" >"$LOG_DIR/backend.log" 2>&1 ) & PIDS+=("$!")
wait_http "Backend" "http://127.0.0.1:$BACKEND_PORT/api/pettypes" 300

# 3) Frontend.
log "Starting frontend…"
( "$ROOT/start-frontend.sh" >"$LOG_DIR/frontend.log" 2>&1 ) & PIDS+=("$!")
wait_http "Frontend" "http://127.0.0.1:$FRONTEND_PORT/" 240

# 4) Run the suite. SKIP_SERVER_START=1 stops Playwright from launching its own
#    (agent-less) apps; globalTeardown then builds the diagrams from Tempo.
log "Running e2e tests with tracing…"
cd "$UI_TEST_DIR" || die "cannot cd into $UI_TEST_DIR"
SKIP_SERVER_START=1 npm test
test_status=$?

# 5) Report the diagrams produced.
shopt -s nullglob
diagrams=("$UI_TEST_DIR"/diagrams/*.puml)
if ((${#diagrams[@]})); then
  log "📊 Generated ${#diagrams[@]} sequence diagram(s):"
  for d in "${diagrams[@]}"; do echo "      - ${d#"$ROOT"/}"; done
  log "Render to PNG:  plantuml -tpng petclinic-ui-test/diagrams/*.puml"
else
  warn "No .puml generated. Check $LOG_DIR/backend.log (was the OTel agent attached?)"
  warn "and that the tests actually hit the backend so traces reached Tempo."
fi

if [[ $test_status -eq 0 ]]; then
  log "✅ Tests passed."
else
  warn "Tests exited with status $test_status."
fi
exit "$test_status"
