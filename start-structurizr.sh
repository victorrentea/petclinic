#!/bin/bash
set -euo pipefail
printf '\033]0;Structurizr\007'  # set terminal/tab title
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$SCRIPT_DIR/petclinic-backend/docs"
DSL="$DOCS_DIR/c4model.dsl"  # hand-written C4 source (!includes c4model.c3.dsl)

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop or Colima first." >&2
  exit 1
fi
if [[ ! -f "$DSL" ]]; then
  echo "❌ Not found: $DSL" >&2
  exit 1
fi

PORT=8081  # backend already owns 8080

# `structurizr/structurizr local` (structurizr/lite is retired) serves ONLY a file
# named workspace.dsl from its data dir, and autosaves layout back into that dir.
# So stage a COPY of c4model.dsl in a throwaway temp dir — keeps docs/ clean and
# guarantees the real c4model.dsl can never be overwritten by the editor.
STAGE="$(mktemp -d -t structurizr.XXXXXX)"
cp "$DSL" "$STAGE/workspace.dsl"
cp "$DOCS_DIR"/c4model.*.dsl "$STAGE/" 2>/dev/null || true  # C3 fragment(s) so !include resolves

cleanup() {
  echo ""
  echo "🛑 Shutting down Structurizr..."
  docker rm -f petclinic-structurizr >/dev/null 2>&1 || true
  rm -rf "$STAGE"
  echo "✅ Stopped"
}
trap cleanup EXIT

echo "🏛️  Serving petclinic-backend/docs/c4model.dsl at http://localhost:$PORT"
echo "    (re-run this script to pick up edits to c4model.dsl)"
echo "📜 Press Ctrl+C to stop."

docker rm -f petclinic-structurizr >/dev/null 2>&1 || true  # clear any stale container
exec docker run --rm --name petclinic-structurizr \
  -p "$PORT:8080" \
  -v "$STAGE:/usr/local/structurizr" \
  structurizr/structurizr local
