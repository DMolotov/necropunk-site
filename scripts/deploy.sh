#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".nvmrc" ]; then
  REQUIRED_NODE_MAJOR="${REQUIRED_NODE_MAJOR:-$(tr -d '[:space:]' < .nvmrc)}"
else
  REQUIRED_NODE_MAJOR="${REQUIRED_NODE_MAJOR:-20}"
fi

load_nvm() {
  if [ -n "${NVM_DIR:-}" ] && [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR}/nvm.sh"
    return 0
  fi

  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    return 0
  fi

  return 1
}

use_required_node() {
  if load_nvm; then
    nvm install "$REQUIRED_NODE_MAJOR" --latest-npm >/dev/null
    nvm use "$REQUIRED_NODE_MAJOR" >/dev/null
    nvm alias default "$REQUIRED_NODE_MAJOR" >/dev/null
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "node is not installed and nvm is unavailable" >&2
    exit 1
  fi

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$node_major" -lt 18 ]; then
    echo "node >= 18 is required (recommended 20). Current: $(node -v)" >&2
    exit 1
  fi
}

install_dependencies() {
  if [ -f package-lock.json ]; then
    if ! npm ci --omit=dev; then
      echo "npm ci failed, falling back to npm install --omit=dev"
      npm install --omit=dev
    fi
  else
    npm install --omit=dev
  fi
}

init_database() {
  node <<'NODE'
require('dotenv').config();
const mysql = require('./server/lib/mysql');
const { initKnowledgeCollection } = require('./server/lib/knowledge');

(async () => {
  await mysql.connect();
  await mysql.initSchema();
  const result = await initKnowledgeCollection();
  console.log('DB init complete:', result);
  await mysql.close();
})().catch((error) => {
  console.error('DB init failed:', error);
  process.exit(1);
});
NODE
}

start_server() {
  node scripts/manage.js restart
  node scripts/manage.js status
}

if [ ! -f ".env" ]; then
  echo ".env file is missing. Create it before deploy." >&2
  exit 1
fi

use_required_node
echo "Using $(node -v) / npm $(npm -v)"
install_dependencies
init_database
start_server

echo "Deploy finished."
echo "Run: bash scripts/smoke.sh"
