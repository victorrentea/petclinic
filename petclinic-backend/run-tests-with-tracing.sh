#!/usr/bin/env bash
#
# run-tests-with-tracing.sh — run the @GenerateSequence @SpringBootTests with the OpenTelemetry
# Java agent attached, so each one's trace is captured in Tempo and turned into a PlantUML
# sequence diagram per scenario in petclinic-test/generated (AddVisitApiTest.java.<scenario>.genseq.puml).
#
# The backend twin of petclinic-test/run-tests-with-tracing.sh, and deliberately the same
# pipeline: the JVM writes the very same "trace window" the browser suites write, and the very
# same generator turns windows into diagrams. What differs is only how much has to be running.
#
# Needed:   ./start-grafana.sh   — Tempo + the OTLP collector on :4318, or any other one named by
#           OTEL_EXPORTER_OTLP_ENDPOINT + GRAFANA_URL (`env $(../start-docker.sh ports N) …` for an
#           instance up with --otel)
# NOT needed: the database (the tests boot an embedded Postgres), the backend (they *are* the
#             backend) and the frontend.
#
# Usage:  ./run-tests-with-tracing.sh            (from petclinic-backend/)
#
set -uo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
TEST_DIR="$ROOT/petclinic-test"

OTLP="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
# Kept in step with the pom's genseq profile and with start-backend.sh — all three download and
# attach the same jar, and a mismatch here is a JVM that will not start.
AGENT_VERSION="2.20.1"
AGENT_JAR="$BACKEND_DIR/.tools/opentelemetry-javaagent-$AGENT_VERSION.jar"
AGENT_URL="https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${AGENT_VERSION}/opentelemetry-javaagent.jar"

log()  { printf '\033[1;36m[tracing]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[tracing]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[tracing] %s\033[0m\n' "$*" >&2; exit 1; }

# Any HTTP answer at all: a collector GETs back a 405, which is still a collector.
answers() { curl -s -o /dev/null --max-time 3 "$1"; }

answers "$OTLP/v1/traces" || die "Nothing is listening at $OTLP — start Tempo first: ./start-grafana.sh"
log "✅ OTLP collector reachable at $OTLP."

if [[ ! -f "$AGENT_JAR" ]]; then
  mkdir -p "$(dirname "$AGENT_JAR")"
  log "⬇️  Downloading OpenTelemetry Java agent v${AGENT_VERSION}…"
  curl -fsSL -o "$AGENT_JAR" "$AGENT_URL" || { rm -f "$AGENT_JAR"; die "could not download the agent."; }
fi
log "✅ Agent present: ${AGENT_JAR#"$ROOT"/}"

# -Dgroups=genseq: exactly the tests carrying @GenerateSequence, which is also a JUnit tag, so
# nothing here has to be kept in step with a list of class names.
log "Running the @GenerateSequence tests with the agent attached…"
(cd "$BACKEND_DIR" && mvn -Pgenseq test -Dgroups=genseq)
test_status=$?

# The JVM has exited by now, so its spans are flushed; the generator still waits for each window
# to close and retries the Tempo search, because ingestion is asynchronous on Tempo's side too.
log "Fetching the traces and drawing the diagrams…"
(cd "$TEST_DIR" && npm run --silent diagram:java)
diagram_status=$?

# Only this suite's own: the directory holds the browser suites' diagrams too, and a run
# that drew nothing must not report theirs as its own. find, not a glob: `**` needs
# globstar, off by default; and not mapfile, which macOS's system bash 3.2 does not have.
diagrams=()
while IFS= read -r d; do diagrams+=("$d"); done \
  < <(find "$TEST_DIR/generated" -name '*.java.*.genseq.puml' | sort)
if ((${#diagrams[@]})); then
  log "📊 Collected ${#diagrams[@]} sequence diagram(s):"
  for d in "${diagrams[@]}"; do echo "      - ${d#"$ROOT"/}"; done
else
  warn "No .puml collected — were the tests actually traced (is $OTLP Tempo, and did any"
  warn "test carry @GenerateSequence)?"
fi

if ((test_status == 0 && diagram_status == 0)); then
  log "✅ Done."
else
  warn "Tests exited $test_status, diagram generation exited $diagram_status."
fi
exit "$test_status"
