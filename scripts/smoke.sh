#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT:-3000}}"

echo "[1/3] GET ${BASE_URL}/api/status"
curl -fsS "${BASE_URL}/api/status"
echo

echo "[2/3] GET ${BASE_URL}/api/knowledge/items?limit=2"
curl -fsS "${BASE_URL}/api/knowledge/items?limit=2"
echo

echo "[3/3] POST ${BASE_URL}/api/knowledge/items"
curl -fsS -X POST "${BASE_URL}/api/knowledge/items" \
  -H "Content-Type: application/json" \
  -d "{\"section\":\"player\",\"title\":\"smoke-$(date +%s)\",\"available\":\"all\",\"description\":\"smoke test\",\"tags\":[\"smoke\"]}"
echo

echo "Smoke checks passed."
