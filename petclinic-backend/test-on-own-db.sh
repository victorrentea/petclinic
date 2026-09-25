#!/bin/bash
# Run a command (normally `mvn test`) against a throwaway Postgres of its own, never
# against whatever listens on :5432.
#
#   ./test-on-own-db.sh mvn -o test
#
# Why: application.properties points every checkout of this repository at
# localhost:5432, and this machine keeps several of them on different branches. A test run
# there migrates that one database to THIS branch's Flyway history — after which a backend
# of another branch refuses to boot ("Detected applied migration not resolved locally") —
# and the Cucumber suite's DatabaseHooks truncate owners, pets, visits and vets, which is
# the data somebody's running app is showing. A container of the same Postgres the stack
# uses (docker/docker-compose.yml), on a host-picked loopback port, removed on exit.
#
# Spring's relaxed binding lets SPRING_DATASOURCE_URL win over application.properties, and
# surefire's forked JVM inherits the environment.
set -euo pipefail

[ $# -gt 0 ] || { echo "usage: $0 <command...>" >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo "❌ Docker is not running" >&2; exit 1; }

cid="$(docker run -d --rm -p 127.0.0.1::5432 \
    -e POSTGRES_USER=petclinic -e POSTGRES_PASSWORD=petclinic -e POSTGRES_DB=petclinic \
    postgres:16)"
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true' EXIT
port="$(docker port "$cid" 5432 | head -1 | sed 's/.*://')"

# Over TCP inside the container: the image's first-boot init runs a server on the unix
# socket only, then restarts it — a socket probe says "ready" to a server about to go away.
for _ in $(seq 60); do
    docker exec "$cid" pg_isready -h 127.0.0.1 -U petclinic -d petclinic -q 2>/dev/null && break
    sleep 1
done
docker exec "$cid" pg_isready -h 127.0.0.1 -U petclinic -d petclinic -q \
    || { echo "❌ the throwaway Postgres did not come up" >&2; exit 1; }

export SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:$port/petclinic"
echo "🐘 $* → own Postgres on 127.0.0.1:$port" >&2
cd "$(dirname "${BASH_SOURCE[0]}")"
"$@"
