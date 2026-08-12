#!/usr/bin/env bash
# The petclinic Postgres MCP server (@bytebase/dbhub), exposed as a plain CLI.
#
# The database has exactly one entry point — the dbhub MCP server declared in
# .mcp.json. This script reaches that same server through `mcptools`
# (https://github.com/f/mcptools), an MCP-to-CLI bridge: same tools, same
# params, same JSON, only the transport differs. For agent harnesses where MCP
# servers are disabled by org policy but the shell is available.
#
#   .claude/skills/petclinic-db-cli/db-cli.sh tools
#   .claude/skills/petclinic-db-cli/db-cli.sh call execute_sql --params '{"sql":"select count(*) from owners"}'
#
# Setup once:  go install github.com/f/mcptools/cmd/mcptools@latest
# Connection:  $DATABASE_URL, defaulting to the local petclinic database.
set -euo pipefail

DSN="${DATABASE_URL:-postgres://petclinic:petclinic@localhost:5432/petclinic}"
DBHUB_VERSION="${DBHUB_VERSION:-1.2.0}"   # pinned: a mid-workshop release must not break the demo

# Agent shells are usually non-interactive and never source ~/.zshrc, so tools
# installed by version managers (nvm, go) are missing from PATH. Both lookups
# below exist because both have already bitten: mcptools lives in ~/go/bin, and
# npx lives under nvm — and when mcptools cannot spawn npx, the MCP handshake
# never completes and the failure surfaces as "initialization timed out",
# which looks like a broken bridge rather than a broken PATH.

MCPTOOLS="${MCPTOOLS:-$(command -v mcptools || echo "$HOME/go/bin/mcptools")}"
if [ ! -x "$MCPTOOLS" ]; then
  echo "mcptools not found. Install: go install github.com/f/mcptools/cmd/mcptools@latest" >&2
  exit 127
fi

if ! command -v npx >/dev/null 2>&1; then
  # Newest nvm-managed node first, then the usual system locations.
  NVM_BINS="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V -r)"
  for dir in $NVM_BINS /opt/homebrew/bin /usr/local/bin; do
    if [ -x "$dir/npx" ]; then
      PATH="$dir:$PATH"
      break
    fi
  done
  export PATH
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found — mcptools cannot start the dbhub server without it." >&2
  echo "Install Node.js, or put npx on PATH (nvm users: 'nvm use' in this shell)." >&2
  exit 127
fi

# On a machine that has never run this version, `npx` downloads the package on
# first use — which takes longer than mcptools' ~10s initialization timeout and
# fails as "initialization timed out", indistinguishable from a broken server.
# Warm the npx cache once so the first call on a fresh laptop just works.
WARM_MARKER="${TMPDIR:-/tmp}/.dbhub-warm-$DBHUB_VERSION"
if [ ! -f "$WARM_MARKER" ]; then
  npx -y "@bytebase/dbhub@$DBHUB_VERSION" --version >/dev/null 2>&1 || true
  touch "$WARM_MARKER" 2>/dev/null || true
fi

exec "$MCPTOOLS" "$@" \
  npx -y "@bytebase/dbhub@$DBHUB_VERSION" \
  --transport stdio \
  --dsn "$DSN"
