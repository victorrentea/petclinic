#!/bin/bash

set -euo pipefail

printf '\033]0;chat\007'  # set terminal/tab title

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHATBOT_DIR="$SCRIPT_DIR/petclinic-chatbot"

if [[ ! -d "$CHATBOT_DIR" ]]; then
  echo "Chatbot directory not found: $CHATBOT_DIR" >&2
  exit 1
fi

# OpenAI key — used for both chat and embeddings. Take it from the env, else from
# secrets.env (gitignored). Never commit the key.
if [[ -z "${OPENAI_API_KEY:-}" && -f "$SCRIPT_DIR/secrets.env" ]]; then
  set -a; source "$SCRIPT_DIR/secrets.env"; set +a
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "❌ OPENAI_API_KEY is not set. Export it, or add it to secrets.env (gitignored)." >&2
  exit 1
fi

echo "🤖 Starting PetClinic Chatbot (Spring AI)..."
echo "Chatbot will be available at: http://localhost:8082/"
echo "Requires the backend MCP server (./start-backend.sh) running on :8080."
echo "RAG embeddings are cached on disk (rag-vector-store.json) — delete it to rebuild."
echo ""

cd "$CHATBOT_DIR"
mvn -ntp spring-boot:run
