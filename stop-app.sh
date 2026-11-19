#!/bin/bash
# Stops what the ./start-*.sh scripts of THIS checkout started, waiting until every port is free.
#   ./stop-app.sh                      # everything
#   ./stop-app.sh database backend     # only those (database | backend | frontend)
# A process on one of these ports that belongs to another checkout is named and left alone.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The database launcher goes first, through its proxy port: its shutdown hook stops Postgres
# cleanly and releases data/epg-lock. Killing only the postgres on 5432 leaves the launcher
# holding that lock, and the next start dies with "could not lock .../epg-lock".
ports_of() {
  case "$1" in
    database) echo "15432 5432" ;;
    backend)  echo "8080 8090" ;;
    frontend) echo "4200" ;;
    *) echo "unknown service: $1 (database | backend | frontend)" >&2; exit 2 ;;
  esac
}

ours() {
  local pid="$1" cwd cmd
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
  [[ "$cwd" == "$SCRIPT_DIR"* || "$cmd" == *"$SCRIPT_DIR"* ]]
}

listeners() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | sort -u || true; }

wait_free() {
  local port="$1" i
  for i in {1..40}; do
    [[ -z "$(listeners "$port")" ]] && return 0
    sleep 0.5
  done
  return 1
}

services=("$@")
[[ ${#services[@]} -eq 0 ]] && services=(database backend frontend)

status=0
for service in "${services[@]}"; do
  for port in $(ports_of "$service"); do
    for pid in $(listeners "$port"); do
      if ours "$pid"; then
        echo "🛑 $service: stopping PID $pid on port $port"
        kill "$pid" 2>/dev/null || true
      else
        echo "⚠️  port $port is held by PID $pid from outside this checkout, left running:" >&2
        echo "     $(ps -o command= -p "$pid" | cut -c1-110)" >&2
        status=1
      fi
    done
    if ! wait_free "$port"; then
      for pid in $(listeners "$port"); do
        if ours "$pid"; then
          echo "💀 $service: PID $pid ignored SIGTERM for 20s, sending SIGKILL"
          kill -9 "$pid" 2>/dev/null || true
        fi
      done
      wait_free "$port" || { echo "❌ port $port is still in use" >&2; status=1; }
    fi
  done
done

[[ $status -eq 0 ]] && echo "✅ stopped ${services[*]}"
exit $status
