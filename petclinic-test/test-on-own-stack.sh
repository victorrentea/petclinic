#!/bin/bash
# Run a test command against this commit's own containers, never against whatever
# happens to listen on :4200 / :8080 / :5432.
#
#   ./test-on-own-stack.sh npm test
#   ./test-on-own-stack.sh npm run test:cucumber
#
# Why: `npm test` starts the stack through start-apps.ts, which waits for a PORT, not for
# its own process. This machine keeps several checkouts of the repository, and whichever
# started first owns those ports. When another one does, this checkout's database and
# backend fail to bind, the health checks pass against the other checkout's, and the suite
# runs this branch's frontend against a backend from a different branch. On 23 Sep 2026 the
# review of test-pr reported three failures that way (a visit's vet read "none", the owner
# search returned all 32 owners). All three passed on the branch's own backend.
#
# The instance is the one the review film uses (human-review.json, video.app): built from
# HEAD by `start-docker.sh up --ref`, named petclinic-<shortsha>, and shared, so one review
# run builds it once. It reaps itself after 30 idle minutes. Uncommitted edits to the APP
# are not in it; edits to the tests are, since the tests run from this folder.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
[ $# -gt 0 ] || { echo "usage: $0 <command...>" >&2; exit 2; }

sha="$(git -C "$REPO" rev-parse --short HEAD)"
name="petclinic-$sha"
# COVERAGE_DIR asks for per-test coverage (src/support/coverage.ts), which needs JaCoCo's
# agent inside the backend container: --jacoco adds it, and re-creates the backend of an
# instance that is already up without one.
jacoco=()
[ -n "${COVERAGE_DIR:-}" ] && jacoco=(--jacoco)
"$REPO/start-docker.sh" up --ref "$sha" --ttl 1800 "${jacoco[@]+"${jacoco[@]}"}" >&2

# 127.0.0.1 rather than the "localhost" start-docker.sh prints: Node resolves localhost to
# ::1 first, and the ports are bound to IPv4 loopback only (see playwright.config.ts).
front="$("$REPO/start-docker.sh" url "$name" | sed 's#//localhost:#//127.0.0.1:#')"
back="$(docker port "$name-backend-1" 8080 2>/dev/null | head -1 | sed 's/.*://')"
[ -n "$back" ] || { echo "❌ $name publishes no backend port — rebuild it: $REPO/start-docker.sh up --ref $sha --fresh" >&2; exit 1; }

if [ -n "${COVERAGE_DIR:-}" ]; then
    mkdir -p "$COVERAGE_DIR"
    COVERAGE_DIR="$(cd "$COVERAGE_DIR" && pwd)"      # the suites run from $HERE, below
    agent="$(docker port "$name-backend-1" 6300 2>/dev/null | head -1 | sed 's/.*://')"
    [ -n "$agent" ] || { echo "❌ $name has no JaCoCo agent port — $REPO/start-docker.sh up --ref $sha --jacoco" >&2; exit 1; }
    export COVERAGE_DIR JACOCO_ADDRESS="127.0.0.1:$agent"
    export COVERAGE_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
    # The classes the agent measured, exactly as the container runs them: JaCoCo matches
    # execution data to classes by a checksum of their bytes, and a local build of the same
    # commit is not guaranteed to be the same bytes.
    docker cp -q "$name-backend-1:/app/app.jar" "$COVERAGE_DIR/backend-app.jar"
    echo "📏 per-test coverage → $COVERAGE_DIR (JaCoCo agent on $JACOCO_ADDRESS)" >&2
fi

export SKIP_SERVER_START=1
export BASE_URL="$front"
export API_BASE_URL="$front/api"
export BACKEND_URL="http://127.0.0.1:$back"
echo "🧪 $* → app $BASE_URL, backend $BACKEND_URL ($name)" >&2
cd "$HERE"
exec "$@"
