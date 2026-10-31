#!/usr/bin/env bash
# Starts the Chat AI demo with simulated models (no API key needed):
#
#   Browser -> front :8080 -> back :8081 -> mock API :8090/v1
#
# Usage: ./mock/start-demo.sh      (stop with Ctrl+C)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/mock/config"

for dir in back front; do
  if [ ! -d "$ROOT/$dir/node_modules" ]; then
    echo "Installing dependencies in $dir/ ..."
    (cd "$ROOT/$dir" && npm ci --no-audit --no-fund)
  fi
done

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(cd "$ROOT/mock" && exec node server.mjs) & pids+=($!)
(cd "$ROOT/back" && CONFIG_LOCATION="$CONFIG/back.json" exec node service.mjs) & pids+=($!)
(cd "$ROOT/front" && CONFIG_LOCATION="$CONFIG/front.json" exec npm run dev) & pids+=($!)

sleep 3
echo
echo "  Chat AI demo is running:  http://localhost:8080"
echo "  Mock API:                 http://localhost:8090/v1/models"
echo "  Stop with Ctrl+C"
echo

# Exit (and stop the others) as soon as one service stops.
wait -n
