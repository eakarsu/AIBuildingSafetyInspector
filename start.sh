#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$root/.env" ] || { echo "Copy .env.example to .env." >&2; exit 1; }
[ -d "$root/backend/node_modules" ] && [ -d "$root/frontend/node_modules" ] || { echo "Run scripts/bootstrap.sh first." >&2; exit 1; }
set -a
. "$root/.env"
set +a

backend_port="${BACKEND_PORT:-3001}"
frontend_port="${FRONTEND_PORT:-3000}"
for port in "$backend_port" "$frontend_port"; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; refusing to stop another process." >&2
    exit 1
  fi
done

if [ "${MIGRATE_ON_START:-false}" = true ]; then
  case "${ALLOW_SCHEMA_MIGRATION:-}" in
    1|true) ;;
    *) echo "Explicit schema migration acknowledgement is required." >&2; exit 1 ;;
  esac
  bash "$root/scripts/migrate.sh"
  node "$root/backend/scripts/create-admin.js"
fi

backend_pid=''
frontend_pid=''
cleanup() {
  [ -z "$backend_pid" ] || kill "$backend_pid" 2>/dev/null || true
  [ -z "$frontend_pid" ] || kill "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
(cd "$root/backend" && npm start) & backend_pid=$!
(cd "$root/frontend" && BROWSER=none PORT="$frontend_port" REACT_APP_API_URL="http://127.0.0.1:$backend_port" ./node_modules/.bin/react-scripts start) & frontend_pid=$!
wait "$backend_pid" "$frontend_pid"
