#!/bin/bash
# Sourced by the ./start-*.sh scripts, which run `set -euo pipefail`.
#
# Refuses to start when the port is already taken, *before* anything slow or
# destructive happens. Without this, a leftover process from a previous day is
# only noticed much later and much less clearly:
#   - start-database.sh wipes `data/` first, so the wipe corrupts the orphan
#     postmaster and Postgres dies with "could not open file global/pg_filenode.map";
#   - a probe like `nc -z localhost 5432` then reports a perfectly healthy DB,
#     because the port really is open — just not by us;
#   - start-backend.sh spends a full `mvn clean` (~12s) before Spring says
#     "Port 8080 was already in use".
#
# It deliberately kills nothing: the squatter may be a second stack, a colleague's
# run, or a terminal Victor still wants. It names the process and stops.

# require_ports_free <service> <port>[:<role>]...
# All ports are checked before it gives up, so two orphans cost one run, not two.
require_ports_free() {
  local service="$1"; shift
  local busy=() spec port role pids pid

  for spec in "$@"; do
    port="${spec%%:*}"
    role="${spec#*:}"
    [[ "$role" == "$spec" ]] && role=""
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
    [[ -z "$pids" ]] && continue

    local where="port $port"
    [[ -n "$role" ]] && where="port $port ($role)"
    echo "❌ cannot start $service: $where is already in use" >&2
    for pid in $pids; do
      echo "   PID $pid — started $(ps -o lstart= -p "$pid" 2>/dev/null | xargs || echo '?')" >&2
      echo "     $(ps -o command= -p "$pid" 2>/dev/null | cut -c1-110 | xargs || echo '?')" >&2
      busy+=("$pid")
    done
  done

  [[ ${#busy[@]} -eq 0 ]] && return 0
  echo "   Nothing was started, built or wiped. Free the port(s), then re-run this script:" >&2
  echo "     kill ${busy[*]}" >&2
  exit 1
}

# The mirror image of the "✅ started <service> on port <n>" line every app prints
# when it is ready: one last line saying it is NOT coming. Without it a watcher
# tailing the log has nothing to match on failure and can only wait out its own
# timeout. Ctrl+C (130) and SIGTERM (143) are normal shutdowns, not failures.
_preflight_service=""
_preflight_on_exit() {
  local code=$?
  case $code in 0 | 130 | 143) return 0 ;; esac
  echo "❌ $_preflight_service stopped (exit $code) — see the output above" >&2
}

# Call once, after the require_port_free checks, just before launching.
announce_exit_failures() {
  _preflight_service="$1"
  trap _preflight_on_exit EXIT
}
