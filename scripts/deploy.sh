#!/usr/bin/env bash
# One-command deploy of Platyplus to the XPS docker stack, with a health gate.
#
# Two modes:
#   - From the Mac (default): builds dist HERE (this is where the scraped catalog
#     lives) -> rsync dist+server to the XPS -> rebuild/restart -> health-check.
#   - On the XPS itself (self-hosted runner): set DEPLOY_LOCAL=1. Builds using the
#     synced content dir (DOWNLOADED_PAGES_DIR) -> sync into the compose dir ->
#     rebuild/restart -> health-check.
#
# Env:
#   XPS_HOST        ssh host alias for the server     (default: xps)
#   GYMAPP_DIR      compose dir on the server         (default: /home/jmf/gymapp)
#   DEPLOY_LOCAL=1  deploy on the server itself (no ssh/rsync over network)
#   SKIP_BUILD=1    reuse an existing ./dist (skip npm run build)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
XPS_HOST="${XPS_HOST:-xps}"
APP_DIR="${GYMAPP_DIR:-/home/jmf/gymapp}"

# BUILD_CMD lets the XPS runner use "npm run build:app" (compiles against a
# pre-synced generated catalog, skipping the scrape it doesn't have).
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo ">> building dist (${BUILD_CMD:-npm run build})..."
  ${BUILD_CMD:-npm run build}
fi

# Poll the container's own healthcheck for up to 60s. $1 = "local" | "remote".
wait_healthy() {
  local runner="$1" i status
  echo ">> waiting for gymapp to report healthy..."
  for i in $(seq 1 30); do
    if [ "$runner" = local ]; then
      status="$(docker inspect -f '{{.State.Health.Status}}' gymapp 2>/dev/null || echo none)"
    else
      status="$(ssh "$XPS_HOST" 'docker inspect -f "{{.State.Health.Status}}" gymapp 2>/dev/null || echo none')"
    fi
    if [ "$status" = healthy ]; then echo "OK: gymapp healthy"; return 0; fi
    sleep 2
  done
  echo "FAIL: gymapp did NOT become healthy -- recent logs:" >&2
  if [ "$runner" = local ]; then
    ( cd "$APP_DIR" && docker compose logs --tail 40 gymapp ) >&2
  else
    ssh "$XPS_HOST" "cd '$APP_DIR' && docker compose logs --tail 40 gymapp" >&2
  fi
  return 1
}

if [ "${DEPLOY_LOCAL:-0}" = "1" ]; then
  echo ">> deploying locally on the server ($APP_DIR)"
  rsync -a --delete dist/ "$APP_DIR/dist/"
  rsync -a server/ "$APP_DIR/server/"
  ( cd "$APP_DIR" && docker compose up -d --build )
  wait_healthy local
else
  echo ">> syncing dist + server to ${XPS_HOST}:${APP_DIR}"
  rsync -az --delete dist/ "${XPS_HOST}:${APP_DIR}/dist/"
  rsync -az server/ "${XPS_HOST}:${APP_DIR}/server/"
  echo ">> rebuild/restart on ${XPS_HOST}"
  ssh "$XPS_HOST" "cd '$APP_DIR' && docker compose up -d --build"
  wait_healthy remote
fi

echo "OK: deploy complete"
