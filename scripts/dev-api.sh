#!/usr/bin/env bash
# Local dev backend: runs server/server.js against ISOLATED dev data (never prod).
# RP_ID=localhost so passkeys work on http://localhost:5173. Start with `npm run dev:api`
# (or both backend+frontend with `npm run dev:full`).
set -e
cd "$(dirname "$0")/.."
export DATA_FILE=./server/dev-data/store.json
export ORIGIN=http://localhost:5173
export RP_ID=localhost
export PORT=8088
export STATIC_DIR="$(pwd)/dist"
export SEED_USER=jmfiset
export SEED_EMAIL=dev@local
export SEED_PASSWORD=devpass
exec node server/server.js
