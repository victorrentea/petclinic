#!/usr/bin/env bash
# Owners-grid load test, end to end. Postgres, the backend under test and the load
# generator all run in containers.
#
#   ./run-loadtest.sh              # 10_000 owners
#   ./run-loadtest.sh 100000       # 100_000 owners
#   ./run-loadtest.sh --down       # remove the loadtest-* containers, network, volumes
#
# Host ports used: 25432 (db) and 28080 (backend) — deliberately NOT 5432/8080/4200/15432,
# which the dev stack and the latency proxy already own. Everything created is named
# `loadtest-*`, so --down removes exactly that and nothing else.
#
# The backend jar and the JMeter distribution are built/downloaded ON THE HOST and
# bind-mounted into a stock eclipse-temurin:21-jre. That is a workaround for a Docker VM
# with no free disk, not a shortcut: no server is started on the host, only compiled.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.loadtest.yml"
JMETER_VERSION=5.6.3
JAR=../../petclinic-backend/target/petclinic-backend-1.0.jar

if [ "${1:-}" = "--down" ]; then
  $COMPOSE --profile tools down -v --remove-orphans
  exit 0
fi

N_OWNERS="${1:-10000}"
THREADS="${THREADS:-4}"
DURATION="${DURATION:-30}"
# The last page at size 5. Deep paging is only a deep page if it is the actual end.
DEEP_PAGE=$(( N_OWNERS / 5 - 1 ))

if [ ! -f "$JAR" ]; then
  echo "==> building the backend jar on the host (compile only, nothing is started here)"
  (cd ../../petclinic-backend && mvn -B -q clean package -DskipTests)
fi

if [ ! -d ".tools/apache-jmeter-${JMETER_VERSION}" ]; then
  echo "==> fetching JMeter ${JMETER_VERSION} to ./.tools (host side, gitignored)"
  mkdir -p .tools
  curl -fsSL -o .tools/jmeter.tgz \
    "https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz"
  tar -xzf .tools/jmeter.tgz -C .tools
  rm .tools/jmeter.tgz
fi

echo "==> starting loadtest-db + loadtest-backend"
$COMPOSE up -d db backend

echo "==> waiting for the backend to answer on :28080"
for _ in $(seq 1 90); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:28080/api/owners/count)" = "200" ]; then
    break
  fi
  sleep 2
done

echo "==> seeding ${N_OWNERS} owners (plus pets and visits)"
docker exec -i loadtest-db psql -U petclinic -d petclinic -v "n_owners=${N_OWNERS}" \
  -f - < seed/bulk-owners.sql | tail -4

# The JIT and the connection pool need a moment; the JMeter groups start against an
# already-warm process so the first samples are not measuring class loading.
echo "==> warm-up"
for _ in 1 2 3 4 5; do curl -s -o /dev/null "http://localhost:28080/api/owners?page=0&size=5" || true; done

echo "==> JMeter: ${THREADS} threads, ${DURATION}s per scenario, deep page=${DEEP_PAGE}"
rm -f "results/results-${N_OWNERS}.jtl"
$COMPOSE --profile tools run --rm -T jmeter \
  -n -t jmx/owners-grid.jmx \
  -l "results/results-${N_OWNERS}.jtl" -j "results/jmeter-${N_OWNERS}.log" \
  -Jhost=backend -Jport=8080 \
  -Jthreads="${THREADS}" -Jduration="${DURATION}" -Jdeep_page="${DEEP_PAGE}"

echo
echo "==> results (${N_OWNERS} owners, ${THREADS} concurrent users)"
python3 analyze-jtl.py "results/results-${N_OWNERS}.jtl" | tee "results/summary-${N_OWNERS}.txt"

echo
echo "==> EXPLAIN (ANALYZE, BUFFERS) for the queries behind the grid"
docker exec -i loadtest-db psql -U petclinic -d petclinic \
  -f - < seed/explain.sql | tee "results/explain-${N_OWNERS}.txt"
