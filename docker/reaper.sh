#!/bin/sh
# Tears the whole instance down once nobody has touched it for IDLE_TTL seconds, so a
# forgotten review environment stops holding a port and a few hundred MB of RAM.
#
# "Touched" is read off nginx's access log mtime. /healthz and /v1/traces are excluded
# from that log precisely so the container's own healthcheck and the app's telemetry
# cannot look like a visitor.
set -eu

LOG=/activity/access.log
TTL="${IDLE_TTL:-7200}"
MINE="label=ro.victorrentea.petclinic.env=1"

[ -n "${PROJECT:-}" ] || { echo "reaper: PROJECT is empty, refusing to match anything"; exit 1; }

# Until the first request there is no log file, and a missing file must not read as
# "idle since the epoch" — that would reap the stack seconds after it came up.
[ -f "$LOG" ] || : > "$LOG"

while :; do
    sleep 30

    now=$(date +%s)
    # Failing to stat must fail *closed*. The old `|| echo 0` meant "last touched at the
    # epoch", so a log file that vanished under us reaped a busy instance within 30s.
    last=$(stat -c %Y "$LOG" 2>/dev/null || echo "$now")
    idle=$(( now - last ))
    # A clock that jumped backwards — routine after a laptop suspend — gives a negative
    # idle, which would otherwise compare as "not idle" forever.
    [ "$idle" -lt 0 ] && idle=0
    [ "$idle" -lt "$TTL" ] && continue

    echo "reaper: no request for ${idle}s (limit ${TTL}s) — tearing down $PROJECT"

    self=$(cat /etc/hostname)
    others=$(docker ps -aq --filter "$MINE" \
        --filter "label=com.docker.compose.project=$PROJECT" \
        | grep -v "^$self" || true)
    [ -n "$others" ] && docker rm -f $others >/dev/null || true

    # The network and the volumes are deliberately left to `start-docker.sh gc`: this
    # container is still attached to the network and still mounting the volumes, so it
    # cannot remove either, and pretending otherwise hid a dead `network rm` for a while.
    #
    # Last, and deliberately: the daemon completes the removal after this process dies.
    docker rm -f "$self" >/dev/null 2>&1 || true
    exit 0
done
