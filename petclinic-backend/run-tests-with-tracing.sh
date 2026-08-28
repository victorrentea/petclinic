#!/usr/bin/env bash
#
# run-tests-with-tracing.sh — run the @GenerateSequence @SpringBootTests with the OpenTelemetry
# Java agent attached, so each one's trace is captured in Tempo and turned into a PlantUML
# sequence diagram beside the test itself (…/AddVisitSequenceTest.java.genseq.puml).
#
# The backend twin of petclinic-test/run-tests-with-tracing.sh, and deliberately the same
# pipeline: the JVM writes the very same "trace window" the browser suites write, and the very
# same generator turns windows into diagrams. What differs is only how much has to be running.
#
# Needed:   ./start-grafana.sh   — Tempo + the OTLP collector on :4318
# NOT needed: the database (the tests boot an embedded Postgres), the backend (they *are* the
#             backend) and the frontend.
#
# Usage:  ./run-tests-with-tracing.sh            (from petclinic-backend/)
#
set -uo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
TEST_DIR="$ROOT/petclinic-test"

OTLP_PORT=4318
# Kept in step with the pom's genseq profile and with start-backend.sh — all three download and
# attach the same jar, and a mismatch here is a JVM that will not start.
AGENT_VERSION="2.20.1"
AGENT_JAR="$BACKEND_DIR/.tools/opentelemetry-javaagent-$AGENT_VERSION.jar"
AGENT_URL="https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${AGENT_VERSION}/opentelemetry-javaagent.jar"

log()  { printf '\033[1;36m[tracing]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[tracing]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[tracing] %s\033[0m\n' "$*" >&2; exit 1; }

port_up() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- 3<&-; }

port_up "$OTLP_PORT" || die "Nothing is listening on :$OTLP_PORT — start Tempo first: ./start-grafana.sh"
log "✅ OTLP collector reachable on :$OTLP_PORT."

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

# find, not a glob: `**` needs globstar, off by default; and not mapfile, which macOS's
# system bash 3.2 does not have.
diagrams=()
while IFS= read -r d; do diagrams+=("$d"); done \
  < <(find "$BACKEND_DIR/src/test/java" -name '*.genseq.puml' | sort)
if ((${#diagrams[@]})); then
  log "📊 Collected ${#diagrams[@]} sequence diagram(s):"
  for d in "${diagrams[@]}"; do echo "      - ${d#"$ROOT"/}"; done
else
  warn "No .puml collected — were the tests actually traced (is :$OTLP_PORT Tempo, and did any"
  warn "test carry @GenerateSequence)?"
fi

if ((test_status == 0 && diagram_status == 0)); then
  log "✅ Done."
else
  warn "Tests exited $test_status, diagram generation exited $diagram_status."
fi
exit "$test_status"
