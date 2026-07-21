#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; [ -f "$root/.env" ] || { echo "Copy .env.example to .env." >&2; exit 1; }; [ -d "$root/backend/node_modules" ] && [ -d "$root/frontend/node_modules" ] || { echo "Run scripts/bootstrap.sh first." >&2; exit 1; }; set -a; . "$root/.env"; set +a
backend_pid=''; frontend_pid=''; cleanup(){ [ -z "$backend_pid" ]||kill "$backend_pid" 2>/dev/null||true; [ -z "$frontend_pid" ]||kill "$frontend_pid" 2>/dev/null||true; }; trap cleanup EXIT INT TERM
(cd "$root/backend" && npm start)& backend_pid=$!; (cd "$root/frontend" && BROWSER=none npm start)& frontend_pid=$!; wait "$backend_pid" "$frontend_pid"
