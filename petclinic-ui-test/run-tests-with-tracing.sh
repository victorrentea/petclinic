#!/usr/bin/env bash
#
# run-tests-with-tracing.sh — run the e2e tests against an ALREADY-RUNNING stack
# so each scenario's browser↔backend↔DB trace is captured in Tempo and turned
# into a PlantUML sequence diagram (petclinic-ui-test/diagrams/<test>.puml) by the
# Playwright globalTeardown.
#
# This script assumes the full telemetry stack is already up, started the
# canonical way (so the backend has the OpenTelemetry Java agent attached):
#
#     ./start-database.sh     # embedded Postgres        :5432
#     ./start-grafana.sh      # Grafana LGTM + Tempo      :3300, OTLP :4318
#     ./start-backend.sh      # Spring Boot + OTel agent  :8080
#     ./start-frontend.sh     # Angular dev server        :4200
#
# It does NOT start or stop anything — it only verifies the stack is reachable,
# runs the suite with SKIP_SERVER_START=1 (so Playwright reuses the running apps
# instead of booting its own agent-less ones), and reports the diagrams produced.
#
# Usage:  ./run-tests-with-tracing.sh            (from petclinic-ui-test/)
#
set -uo pipefail

UI_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$UI_TEST_DIR/.." && pwd)"

GRAFANA_PORT=3300
OTLP_PORT=4318
DB_PORT=5432
BACKEND_PORT=8080
FRONTEND_PORT=4200

log()  { printf '\033[1;36m[tracing]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[tracing]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[tracing] %s\033[0m\n' "$*" >&2; exit 1; }

http_up() { curl -fsS "$1" >/dev/null 2>&1; }
port_up() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- 3<&-; }

# --- preflight: the stack must already be running --------------------------
down=()
http_up "http://localhost:$GRAFANA_PORT/api/health"   || down+=("Grafana (:$GRAFANA_PORT)        → ./start-grafana.sh")
port_up "$OTLP_PORT"                                   || down+=("OTLP collector (:$OTLP_PORT)    → ./start-grafana.sh")
port_up "$DB_PORT"                                     || down+=("Postgres (:$DB_PORT)            → ./start-database.sh")
http_up "http://127.0.0.1:$BACKEND_PORT/api/pettypes"  || down+=("Backend (:$BACKEND_PORT)           → ./start-backend.sh")
http_up "http://127.0.0.1:$FRONTEND_PORT/"             || down+=("Frontend (:$FRONTEND_PORT)          → ./start-frontend.sh")

if ((${#down[@]})); then
  warn "The stack is not fully up. Start the missing pieces, then re-run:"
  for d in "${down[@]}"; do printf '   • %s\n' "$d" >&2; done
  die "aborting — nothing was started or stopped."
fi
log "✅ Stack reachable (Grafana, Tempo/OTLP, Postgres, backend+agent, frontend)."

# Heads-up if the backend is running WITHOUT the OTel agent — tests would pass
# but no traces would be recorded, so no diagrams would be produced.
if ! http_up "http://localhost:$GRAFANA_PORT/api/datasources/proxy/uid/tempo/api/echo"; then
  warn "Could not reach the Tempo proxy echo endpoint — diagram generation may find no traces."
fi

# --- run the suite ---------------------------------------------------------
log "Running e2e tests with tracing…"
cd "$UI_TEST_DIR" || die "cannot cd into $UI_TEST_DIR"
SKIP_SERVER_START=1 npm test
test_status=$?

# --- report the diagrams produced ------------------------------------------
shopt -s nullglob
diagrams=("$UI_TEST_DIR"/diagrams/*.puml)
if ((${#diagrams[@]})); then
  log "📊 Collected ${#diagrams[@]} sequence diagram(s):"
  for d in "${diagrams[@]}"; do echo "      - ${d#"$ROOT"/}"; done
  log "Render to PNG:  plantuml -tpng petclinic-ui-test/diagrams/*.puml"
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
