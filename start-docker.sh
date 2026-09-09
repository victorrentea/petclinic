#!/bin/bash
# The whole PetClinic in containers, one isolated instance per branch under review.
#
# Inside the network every service keeps its default port (5432 / 8080 / 4200). Only the
# frontend is published, and the host picks the port, so instances never collide — and
# neither does an instance with the plain ./start-*.sh stack on :4200 and :5432.
#
#   ./start-docker.sh up [--ref SHA] [--name N] [--ttl SECS] [--fresh]
#   ./start-docker.sh url   [name]        # the URL again
#   ./start-docker.sh reset [name]        # database back to the seed
#   ./start-docker.sh ls
#   ./start-docker.sh down  [name|--all]
#
# --ref builds a pinned commit from a git archive, so the working tree is never touched.
# --fresh rebuilds and drops the instance's volumes. With more than one instance up, every
# command needs the name: none of them will guess which one you meant.
#
# Instances reap themselves after 30 idle minutes (--ttl to change).
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

compose() { COMPOSE_PROJECT_NAME="$1" PETCLINIC_SRC="${2:-$REPO}" IDLE_TTL="${IDLE_TTL:-1800}" \
            PETCLINIC_TAG="${PETCLINIC_TAG:-worktree}" \
            docker compose -f "$COMPOSE_FILE" "${@:3}"; }

port_of() { compose "$1" "" port frontend 4200 2>/dev/null | tail -1 | sed 's/.*://' || true; }

cmd_up() {
    local ref="" name="" fresh=""
    while [ $# -gt 0 ]; do
        case "$1" in
            --ref)   ref="${2:?--ref needs a commit}";   shift 2 ;;
            --name)  name="${2:?--name needs a name}";    shift 2 ;;
            --ttl)   IDLE_TTL="${2:?--ttl needs seconds}"; shift 2 ;;
            --fresh) fresh=1;    shift ;;
            *) die "unknown option: $1" ;;
        esac
    done
    export IDLE_TTL="${IDLE_TTL:-1800}"

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

    if [ -n "$fresh" ]; then
        # Volumes too, or --fresh would keep the old database and the old activity log,
        # and the seed snapshot taken on the first boot would never be retaken.
        compose "$name" "$src" down -v >/dev/null 2>&1 || true
    elif [ -n "$(docker ps -q --filter "$MINE" --filter "label=$PROJECT_LABEL=$name")" ]; then
        # Already up: hand back the same instance instead of building a second one.
        echo "↻ $name is already up"
        cmd_url "$name"; return
    fi

    echo "🐳 building $name${sha:+ from $sha}  (this takes a few minutes the first time)"
    compose "$name" "$src" up -d --build --wait

    local p; p="$(port_of "$name")"
    [ -n "$p" ] || die "the stack came up but no host port was published"
    echo ""
    echo "✅ $name ready — reaps itself after $((IDLE_TTL/60)) idle minutes"
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
        for p in $(instances); do compose "$p" "" down -v >/dev/null 2>&1 || true; echo "🛑 $p"; done
    else
        p="$(resolve "${1:-}")"
        compose "$p" "" down -v; echo "🛑 $p"
    fi
    gc
}

case "${1:-up}" in
    up)    shift || true; cmd_up "$@" ;;
    url)   shift || true; cmd_url "$@" ;;
    reset) shift || true; cmd_reset "$@" ;;
    ls)    cmd_ls ;;
    down)  shift || true; cmd_down "$@" ;;
    -h|--help|help) sed -n '2,18p' "${BASH_SOURCE[0]}" | sed -e 's/^#//' -e 's/^ //' ;;
    *) die "unknown command: $1  (up | url | reset | ls | down)" ;;
esac
