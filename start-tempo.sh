#!/bin/bash
# Tempo on its own — no Docker, no Grafana: all the sequence diagrams need.
# OTLP in on :4318 (where start-backend.sh and the frontend's proxy already send), the
# search/trace API on :3200 (TEMPO_URL, read by petclinic-test/src/genseq/tempo-client.ts).
# One binary, downloaded once into petclinic-observability/.tools; traces are wiped on
# every start. ./start-grafana.sh is the full stack (dashboards, logs, metrics) instead —
# the two share :4318, so run one or the other.
set -euo pipefail
printf '\033]0;Tempo\007'  # set terminal/tab title
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OBS_DIR="$SCRIPT_DIR/petclinic-observability"

source "$SCRIPT_DIR/scripts/preflight.sh"
require_ports_free tempo 3200 4318

TEMPO_VERSION="3.1.1"
case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  MINGW*|MSYS*|CYGWIN*) os=windows ;;
  *) echo "❌ No Tempo build for $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch=arm64 ;;
  *) arch=amd64 ;;
esac
TOOL_DIR="$OBS_DIR/.tools/tempo-$TEMPO_VERSION-$os-$arch"
TEMPO_BIN="$TOOL_DIR/tempo"
[[ $os == windows ]] && TEMPO_BIN="$TEMPO_BIN.exe"

if [[ ! -x "$TEMPO_BIN" ]]; then
  echo "⬇️  Downloading Tempo v$TEMPO_VERSION ($os/$arch, ~65 MB)..."
  mkdir -p "$TOOL_DIR"
  curl -fSL --progress-bar \
    "https://github.com/grafana/tempo/releases/download/v$TEMPO_VERSION/tempo_${TEMPO_VERSION}_${os}_${arch}.tar.gz" \
    | tar xz -C "$TOOL_DIR"
fi

# tempo-local.yaml points every path at ./.tempo-data, relative to here.
cd "$OBS_DIR"
rm -rf .tempo-data

echo "🚀 Starting Tempo..."
# Without the grep, a single binary's background compaction worker logs "nil job received"
# errors forever: harmless, and the only thing anyone would read in this window.
"$TEMPO_BIN" -config.file tempo-local.yaml \
  > >(grep --line-buffered -vE 'caller=backend|unowned file entry') 2>&1 &
TEMPO_PID=$!
trap 'echo ""; echo "🛑 Stopping Tempo..."; kill $TEMPO_PID 2>/dev/null; wait $TEMPO_PID 2>/dev/null; echo "✅ Stopped"' EXIT

for _ in {1..30}; do
  curl -fsS http://127.0.0.1:3200/ready >/dev/null 2>&1 && break
  kill -0 $TEMPO_PID 2>/dev/null || { echo "❌ Tempo exited — see the log above" >&2; exit 1; }
  sleep 1
done
echo "✅ Tempo ready: OTLP on :4318, API on http://localhost:3200"
echo "   the tracing scripts pick it up by themselves; by hand: export TEMPO_URL=http://localhost:3200"

# Same trap as with Grafana: the agent is only attached if :4318 answered when the backend booted.
backend_pid="$(lsof -nP -iTCP:8080 -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [[ -z "$backend_pid" ]]; then
  echo "ℹ️  Backend not up yet — start it now (./start-backend.sh) so it picks up the OTel agent."
elif ps -o command= -p "$backend_pid" 2>/dev/null | grep -q 'opentelemetry-javaagent'; then
  echo "✅ Backend on :8080 already has the OTel agent attached — traces will be collected."
else
  echo "⚠️  Backend on :8080 is running WITHOUT the OpenTelemetry agent."
  echo "   Restart it (./start-backend.sh) or e2e runs will produce no sequence diagrams."
fi

echo "📜 Press Ctrl+C to stop."
wait $TEMPO_PID
