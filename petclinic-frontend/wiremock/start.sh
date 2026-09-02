#!/usr/bin/env bash
# Optional dev tool: run a standalone WireMock on :8080 that serves the canned response examples
# baked into the Swagger (openapi.yaml, hard-coded in Java via ApiExamples).
#
# WireMock and the real Spring backend both want port 8080, so this is an *alternative* to the
# backend: stop the backend, run this, and the Angular app at http://localhost:4200 shows the
# canned example data — proving the documented examples without a database or backend.
#
#   ./start.sh                 # regenerate stubs from ../../openapi.yaml and serve on :8080
#   PORT=9090 ./start.sh       # serve on a different port
#   USE_DOCKER=1 ./start.sh    # run via the wiremock/wiremock Docker image instead of a jar
#
# Requires Node (for stub generation) and either a JDK or Docker (to run WireMock).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8080}"
WIREMOCK_VERSION="${WIREMOCK_VERSION:-3.9.1}"

echo "==> Generating WireMock stubs from the Swagger examples"
node "$SCRIPT_DIR/generate-mappings.mjs"

run_docker() {
  echo "==> Starting WireMock (Docker) on http://localhost:$PORT"
  exec docker run --rm -p "$PORT:8080" \
    -v "$SCRIPT_DIR:/home/wiremock" \
    "wiremock/wiremock:$WIREMOCK_VERSION" --enable-stub-cors --verbose
}

if [[ "${USE_DOCKER:-0}" == "1" ]]; then
  run_docker
fi

# Locate a wiremock-standalone jar: explicit override, local Maven repo, cache, or download once.
JAR="${WIREMOCK_JAR:-}"
M2_JAR="$HOME/.m2/repository/org/wiremock/wiremock-standalone/$WIREMOCK_VERSION/wiremock-standalone-$WIREMOCK_VERSION.jar"
CACHE_JAR="$SCRIPT_DIR/.cache/wiremock-standalone-$WIREMOCK_VERSION.jar"
[[ -z "$JAR" && -f "$M2_JAR" ]] && JAR="$M2_JAR"
[[ -z "$JAR" && -f "$CACHE_JAR" ]] && JAR="$CACHE_JAR"

if [[ -z "$JAR" ]]; then
  echo "==> wiremock-standalone $WIREMOCK_VERSION not found locally; downloading"
  mkdir -p "$SCRIPT_DIR/.cache"
  URL="https://repo1.maven.org/maven2/org/wiremock/wiremock-standalone/$WIREMOCK_VERSION/wiremock-standalone-$WIREMOCK_VERSION.jar"
  if curl -fsSL "$URL" -o "$CACHE_JAR"; then
    JAR="$CACHE_JAR"
  elif command -v docker >/dev/null 2>&1; then
    echo "==> Download failed; falling back to Docker"
    run_docker
  else
    echo "ERROR: no wiremock-standalone jar and no Docker." >&2
    echo "       Set WIREMOCK_JAR=/path/to/wiremock-standalone.jar, or install Docker." >&2
    exit 1
  fi
fi

echo "==> Starting WireMock on http://localhost:$PORT  (jar: $JAR)"
echo "    Stubs:  $SCRIPT_DIR/mappings"
echo "    Admin:  http://localhost:$PORT/__admin   |   Try: curl http://localhost:$PORT/api/vets"
exec java -jar "$JAR" --port "$PORT" --root-dir "$SCRIPT_DIR" --enable-stub-cors --verbose
