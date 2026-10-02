#!/bin/bash
# The whole PetClinic in containers, one isolated instance per branch under review.
#
# Inside the network every service keeps its default port (5432 / 8080 / 4200). Only the
# frontend is published, and the host picks the port, so instances never collide — and
# neither does an instance with the plain ./start-*.sh stack on :4200 and :5432.
#
#   ./start-docker.sh up [--ref SHA] [--name N] [--ttl SECS] [--fresh] [--jacoco] [--otel]
#   ./start-docker.sh url   [name]        # the URL again
#   ./start-docker.sh ports [name]        # every published endpoint, as KEY=value lines
#   ./start-docker.sh reset [name]        # database back to the seed
#   ./start-docker.sh ls
#   ./start-docker.sh down  [name|--all]
#
# --ref builds a pinned commit from a git archive, so the working tree is never touched.
# --fresh rebuilds and drops the instance's volumes. --jacoco runs the backend under
# JaCoCo's agent in tcpserver mode, its port 6300 published to a host-picked loopback port
# (`docker port <name>-backend-1 6300`) — what per-test coverage dumps and resets between
# tests (petclinic-test/src/support/coverage.ts); on an instance already up without it,
# only the backend is re-created. --otel adds the instance's own Grafana LGTM (Tempo behind
# an OTLP collector) and starts both JVMs under the OpenTelemetry agent exporting to it, so a
# traced run never lands in another branch's Tempo; Grafana and OTLP get host-picked loopback
# ports too. `ports` prints them under the names the test tooling reads, for
# `env $(./start-docker.sh ports N) ./petclinic-test/run-tests-with-tracing.sh`.
# With more than one instance up, every command needs the name: none of them will guess
# which one you meant.
#
# Instances reap themselves after 2 idle hours (--ttl to change).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$REPO/docker/docker-compose.yml"
PROJECT_LABEL="com.docker.compose.project"
# Our own marker. Never match instances by their `petclinic-` name prefix: this repo also
# runs petclinic-chatbot and petclinic-observability, and `down --all` would eat them.
MINE="label=ro.victorrentea.petclinic.env=1"

die() { echo "❌ $*" >&2; exit 1; }

# Global, not a local in cmd_up: the EXIT trap expands it after the function's locals are
# already gone, and would otherwise leave the export tree behind on every pinned build.
EXPORT_DIR=""
trap '[ -n "$EXPORT_DIR" ] && rm -rf "$EXPORT_DIR"' EXIT

# Every project this tool made, running or not.
instances() {
    docker ps -a --filter "$MINE" --format "{{.Label \"$PROJECT_LABEL\"}}" | sort -u
}

# Networks and volumes outlive the containers when the reaper tears an instance down (it
# cannot remove the volume it is itself mounting). Sweep them when nothing is running.
gc() {
    local p young
    # Enumerated from networks *and* volumes. Networks alone used to be enough only by
    # accident: the reaper tried to remove the network while still attached to it, the
    # removal always failed, and the failure was what left the key gc reads.
    for p in $( { docker network ls --filter "$MINE" --format "{{.Label \"$PROJECT_LABEL\"}}"
                  docker volume  ls --filter "$MINE" --format "{{.Label \"$PROJECT_LABEL\"}}"
                } | sort -u ); do
        [ -n "$p" ] || continue
        # Still has containers, so it is a live instance, not wreckage.
        [ -n "$(docker ps -aq --filter "label=$PROJECT_LABEL=$p")" ] && continue
        # `up` creates the network and volumes before the containers, so a project that
        # is only seconds old is most likely another session mid-launch, not wreckage.
        young=$(_seconds_since_created "$p")
        [ -n "$young" ] && [ "$young" -lt 300 ] && continue
        docker network ls -q --filter "$MINE" --filter "label=$PROJECT_LABEL=$p" \
            | xargs -r docker network rm >/dev/null 2>&1 || true
        docker volume ls -q --filter "$MINE" --filter "label=$PROJECT_LABEL=$p" \
            | xargs -r docker volume rm >/dev/null 2>&1 || true
    done
}

# Age of a project's oldest surviving volume, or "" when it cannot be told — in which case
# the caller must assume it is young and leave it alone.
_seconds_since_created() {
    local v created epoch now
    v=$(docker volume ls -q --filter "$MINE" --filter "label=$PROJECT_LABEL=$1" | head -1)
    [ -n "$v" ] || return 0
    created=$(docker volume inspect "$v" --format '{{.CreatedAt}}' 2>/dev/null) || return 0
    epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$created" +%s 2>/dev/null \
            || date -u -d "$created" +%s 2>/dev/null) || return 0
    now=$(date -u +%s)
    echo $(( now - epoch ))
}

# The instance a command acts on. Never guesses when it would be a guess: `down` used to
# fall back to the alphabetically first project, so a `down` typed right after `up`
# destroyed a different instance's database.
resolve() {
    local want="${1:-}" all
    all="$(instances)"
    [ -n "$all" ] || die "no instance is running — ./start-docker.sh up"
    if [ -n "$want" ]; then
        printf '%s\n' "$all" | grep -qxF -- "$want" \
            || die "no such instance: $want"$'\n'"running: $(echo $all)"
        echo "$want"; return
    fi
    [ "$(printf '%s\n' "$all" | wc -l)" -eq 1 ] || \
        die "several instances are up — name the one you mean:"$'\n'"  $(echo $all)"
    echo "$all"
}

# EXTRA_COMPOSE: the overlays on top of the base file, for `up --jacoco` / `--otel`. Every
# other command works on the project by name and needs none — `down` sweeps the overlays'
# extra services as orphans.
EXTRA_COMPOSE=()
compose() { COMPOSE_PROJECT_NAME="$1" PETCLINIC_SRC="${2:-$REPO}" IDLE_TTL="${IDLE_TTL:-7200}" \
            PETCLINIC_TAG="${PETCLINIC_TAG:-worktree}" \
            docker compose -f "$COMPOSE_FILE" "${EXTRA_COMPOSE[@]+"${EXTRA_COMPOSE[@]}"}" "${@:3}"; }

# The JaCoCo agent jar, off the local Maven repository — the same version the backend's pom
# measures unit tests with, fetched once if this machine never ran that build.
jacoco_agent() {
    local v jar
    v="$(grep -A1 '<artifactId>jacoco-maven-plugin</artifactId>' "$REPO/petclinic-backend/pom.xml" \
        | sed -n 's#.*<version>\(.*\)</version>.*#\1#p' | head -1)"
    v="${v:-0.8.13}"
    jar="$HOME/.m2/repository/org/jacoco/org.jacoco.agent/$v/org.jacoco.agent-$v-runtime.jar"
    [ -f "$jar" ] || mvn -q dependency:get -Dartifact="org.jacoco:org.jacoco.agent:$v:jar:runtime" >&2 \
        || die "cannot fetch the JaCoCo agent $v"
    echo "$jar"
}

# The OpenTelemetry Java agent, the very jar ./start-backend.sh and the pom's genseq profile
# attach: the version is read off that profile, and the file is shared with both.
otel_agent() {
    local v jar
    v="$(sed -n 's#.*<otel.agent.version>\(.*\)</otel.agent.version>.*#\1#p' \
        "$REPO/petclinic-backend/pom.xml" | head -1)"
    v="${v:-2.20.1}"
    jar="$REPO/petclinic-backend/.tools/opentelemetry-javaagent-$v.jar"
    if [ ! -f "$jar" ]; then
        local url="https://github.com/open-telemetry/opentelemetry-java-instrumentation"
        url="$url/releases/download/v$v/opentelemetry-javaagent.jar"
        mkdir -p "$(dirname "$jar")"
        curl -fsSL -o "$jar" "$url" >&2 || { rm -f "$jar"; die "cannot fetch the OpenTelemetry agent $v"; }
    fi
    echo "$jar"
}

port_of() { compose "$1" "" port frontend 4200 2>/dev/null | tail -1 | sed 's/.*://' || true; }
# A port published by one of the instance's containers, overlay services included (compose
# would only answer for the services of the files it is given).
published() { docker port "$1-$2-1" "$3" 2>/dev/null | head -1 | sed 's/.*://' || true; }

cmd_up() {
    local ref="" name="" fresh="" jacoco="" otel=""
    while [ $# -gt 0 ]; do
        case "$1" in
            --ref)   ref="${2:?--ref needs a commit}";   shift 2 ;;
            --name)  name="${2:?--name needs a name}";    shift 2 ;;
            --ttl)   IDLE_TTL="${2:?--ttl needs seconds}"; shift 2 ;;
            --fresh) fresh=1;    shift ;;
            --jacoco) jacoco=1;  shift ;;
            --otel)  otel=1;     shift ;;
            *) die "unknown option: $1" ;;
        esac
    done
    export IDLE_TTL="${IDLE_TTL:-7200}"

    docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and retry."
    gc

    local src="$REPO" sha=""
    if [ -n "$ref" ]; then
        sha="$(git -C "$REPO" rev-parse --short "$ref" 2>/dev/null)" \
            || die "no such commit in $REPO: $ref"
        # A tarball of the ref, never a checkout: the working tree keeps whatever branch
        # and uncommitted edits it had.
        EXPORT_DIR="$(mktemp -d)"; src="$EXPORT_DIR"
        git -C "$REPO" archive "$sha" | tar -x -C "$src"
        [ -f "$src/petclinic-frontend/nginx.conf" ] \
            || die "commit $sha predates the container setup — it has no petclinic-frontend/nginx.conf"
        # That commit's compose file, not today's: the services it declares are the ones its
        # source tree has. Today's file wanted a notification-service that a commit from
        # before it did not ship, and every pinned build died on a missing build context.
        # `url` and `down` keep using today's: they only ever name services both have.
        if [ -f "$src/docker/docker-compose.yml" ]; then
            COMPOSE_FILE="$src/docker/docker-compose.yml"
        fi
    fi
    : "${name:=petclinic-${sha:-worktree}}"
    # What the images are tagged with, so instances of the same commit share them.
    export PETCLINIC_TAG="${sha:-worktree}"
    # The marker label protects `ls`/`gc`, but `down` runs plain `docker compose -p`, which
    # is not label-filtered. Refusing to reuse an existing unrelated project name is what
    # keeps `--name petclinic-chatbot` from arming exactly the disaster the label prevents.
    case "$name" in
        petclinic-*) ;;
        *) die "--name must start with petclinic- (got: $name)" ;;
    esac
    if [ -z "$(docker ps -aq --filter "$MINE" --filter "label=$PROJECT_LABEL=$name")" ] \
        && [ -n "$(docker ps -aq --filter "label=$PROJECT_LABEL=$name")" ]; then
        die "$name is an existing compose project this tool did not create — pick another --name"
    fi

    if [ -n "$jacoco" ]; then
        export JACOCO_AGENT_JAR; JACOCO_AGENT_JAR="$(jacoco_agent)"
        EXTRA_COMPOSE+=(-f "$REPO/docker/docker-compose.jacoco.yml")
    fi
    if [ -n "$otel" ]; then
        export OTEL_AGENT_JAR; OTEL_AGENT_JAR="$(otel_agent)"
        EXTRA_COMPOSE+=(-f "$REPO/docker/docker-compose.otel.yml")
    fi

    if [ -n "$fresh" ]; then
        # Volumes too, or --fresh would keep the old database and the old activity log,
        # and the seed snapshot taken on the first boot would never be retaken.
        compose "$name" "$src" down -v >/dev/null 2>&1 || true
    elif [ -n "$(docker ps -q --filter "$MINE" --filter "label=$PROJECT_LABEL=$name")" ] \
        && { [ -z "$jacoco" ] || [ -n "$(published "$name" backend 6300)" ]; } \
        && { [ -z "$otel" ] || [ -n "$(published "$name" lgtm 3000)" ]; }; then
        # Already up: hand back the same instance instead of building a second one. With
        # --jacoco / --otel, only if it already carries what they add; otherwise the `up`
        # below adds it, re-creating only the services the overlay changes.
        echo "↻ $name is already up"
        cmd_url "$name"; return
    fi

    echo "🐳 building $name${sha:+ from $sha}  (this takes a few minutes the first time)"
    compose "$name" "$src" up -d --build --wait

    local p; p="$(port_of "$name")"
    [ -n "$p" ] || die "the stack came up but no host port was published"
    echo ""
    echo "✅ $name ready — reaps itself after $((IDLE_TTL/60)) idle minutes"
    # Before the app's own URL, never after: a caller scrapes the LAST URL printed as the
    # app (human-review's app blocks do).
    [ -n "$otel" ] && printf '   Grafana  http://localhost:%s  (admin/admin)\n' \
        "$(published "$name" lgtm 3000)"
    printf '   http://localhost:%s\n' "$p"
    command -v pbcopy >/dev/null && printf 'http://localhost:%s' "$p" | pbcopy \
        && echo "   (copied to the clipboard)"
}

cmd_url() {
    local name; name="$(resolve "${1:-}")"
    local p; p="$(port_of "$name")"
    [ -n "$p" ] || die "$name is not running"
    printf 'http://localhost:%s\n' "$p"
}

# Machine-readable: one KEY=value per published endpoint, named after the variables the test
# tooling already reads, so `env $(./start-docker.sh ports N) <cmd>` points any of it at this
# instance. 127.0.0.1, not localhost: Node resolves localhost to ::1 first, and every port is
# bound to IPv4 loopback only. Lines for --jacoco / --otel appear only on an instance up with
# them, so a caller can tell which it got.
cmd_ports() {
    local name; name="$(resolve "${1:-}")"
    local p; p="$(port_of "$name")"
    [ -n "$p" ] || die "$name is not running"
    local back jacoco grafana otlp
    back="$(published "$name" backend 8080)"
    jacoco="$(published "$name" backend 6300)"
    grafana="$(published "$name" lgtm 3000)"
    otlp="$(published "$name" lgtm 4318)"
    echo "PETCLINIC_INSTANCE=$name"
    echo "BASE_URL=http://127.0.0.1:$p"
    echo "API_BASE_URL=http://127.0.0.1:$p/api"
    [ -n "$back" ]    && echo "BACKEND_URL=http://127.0.0.1:$back"
    [ -n "$jacoco" ]  && echo "JACOCO_ADDRESS=127.0.0.1:$jacoco"
    [ -n "$grafana" ] && echo "GRAFANA_URL=http://127.0.0.1:$grafana"
    [ -n "$otlp" ]    && echo "OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:$otlp"
    return 0
}

# Same starting point every time, so repeated deep links cannot pile up duplicate rows or
# trip a unique constraint.
# One implementation, reachable two ways. The button on the review page and this command
# both POST the same endpoint, so the terminal and the browser can never drift apart.
cmd_reset() {
    local name; name="$(resolve "${1:-}")"
    local p; p="$(port_of "$name")"
    [ -n "$p" ] || die "$name is not running"
    curl -fsS -X POST "http://localhost:$p/__reset" >/dev/null \
        || die "reset failed — docker compose logs reset (project $name)"
    echo "🌱 $name reset to the seed"
}

cmd_ls() {
    local p port state
    printf '%-26s %-9s %s\n' INSTANCE STATE URL
    for p in $(instances); do
        port="$(port_of "$p")"
        state=$([ -n "$(docker ps -q --filter "label=$PROJECT_LABEL=$p")" ] && echo running || echo stopped)
        printf '%-26s %-9s %s\n' "$p" "$state" "${port:+http://localhost:$port}"
    done
}

cmd_down() {
    local p
    if [ "${1:-}" = "--all" ]; then
        for p in $(instances); do
            compose "$p" "" down -v --remove-orphans >/dev/null 2>&1 || true; echo "🛑 $p"
        done
    else
        p="$(resolve "${1:-}")"
        compose "$p" "" down -v --remove-orphans; echo "🛑 $p"
    fi
    gc
}

case "${1:-up}" in
    up)    shift || true; cmd_up "$@" ;;
    url)   shift || true; cmd_url "$@" ;;
    ports) shift || true; cmd_ports "$@" ;;
    reset) shift || true; cmd_reset "$@" ;;
    ls)    cmd_ls ;;
    down)  shift || true; cmd_down "$@" ;;
    -h|--help|help) sed -n '2,28p' "${BASH_SOURCE[0]}" | sed -e 's/^#//' -e 's/^ //' ;;
    *) die "unknown command: $1  (up | url | ports | reset | ls | down)" ;;
esac
