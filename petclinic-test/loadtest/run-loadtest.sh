#!/usr/bin/env bash
# Owners-grid load test, end to end, entirely in Docker.
#
#   ./run-loadtest.sh              # 10_000 owners
#   ./run-loadtest.sh 100000       # 100_000 owners
#
# Host ports used: 25432 (db) and 28080 (backend) — deliberately NOT 5432/8080/4200/15432,
# which the dev stack and the latency proxy already own. Everything created here is named
# `loadtest-*`; `./run-loadtest.sh --down` removes exactly that and nothing else.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.loadtest.yml"
N_OWNERS="${1:-10000}"
THREADS="${THREADS:-4}"
DURATION="${DURATION:-60}"
DURATION_LIGHT="${DURATION_LIGHT:-30}"

if [ "${1:-}" = "--down" ]; then
  $COMPOSE --profile tools down -v --remove-orphans
  exit 0
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

# Hibernate caches nothing across requests here, but the JIT and the connection pool do
# need a moment; the JMeter groups therefore start against an already-warm process.
echo "==> warm-up"
curl -s -o /dev/null http://localhost:28080/api/owners || true

echo "==> running JMeter (${THREADS} threads, ${DURATION}s per heavy scenario)"
rm -f results/results.jtl
$COMPOSE run --rm --profile tools jmeter \
  -n -t jmx/owners-grid.jmx -l results/results.jtl -j results/jmeter.log \
  -Jhost=backend -Jport=8080 \
  -Jthreads="${THREADS}" -Jduration="${DURATION}" -Jduration_light="${DURATION_LIGHT}"

echo
echo "==> results (${N_OWNERS} owners, ${THREADS} concurrent users)"
python3 analyze-jtl.py results/results.jtl | tee "results/summary-${N_OWNERS}.txt"

echo
echo "==> EXPLAIN (ANALYZE, BUFFERS) for the queries behind the grid"
docker exec -i loadtest-db psql -U petclinic -d petclinic \
  -f - < seed/explain.sql | tee "results/explain-${N_OWNERS}.txt"
