#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[qa] Working directory: $SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "[qa] Node.js is not installed or not in PATH. Install Node.js 20+ and retry." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[qa] npm is not installed or not in PATH. Reinstall Node.js and retry." >&2
  exit 1
fi

echo "[qa] Node: $(node --version)"
echo "[qa] npm:  $(npm --version)"

if [ ! -d "node_modules" ]; then
  echo "[qa] node_modules missing, installing dependencies (npm install)..."
  if ! npm install; then
    if [ -f "package-lock.json" ]; then
      echo "[qa] npm install failed, trying npm ci fallback..."
      npm ci
    else
      echo "[qa] npm install failed and package-lock.json is missing." >&2
      exit 1
    fi
  fi
else
  echo "[qa] node_modules already present, skipping dependency reinstall."
fi

echo "[qa] Ensuring Playwright Chromium is installed..."
npm run install:browsers

echo "[qa] Running owners Playwright suite..."
npm run test:owners

