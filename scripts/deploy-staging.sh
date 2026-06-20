#!/usr/bin/env bash
# Deploy the current DEV build to the staging/QA stack on the XPS. Served HTTPS on
# the tailnet ONLY (tailscale serve -> 127.0.0.1:8089), isolated data, own RP_ID.
# Run from the Mac on the dev branch:  npm run deploy:staging
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$REPO"
XPS_HOST="${XPS_HOST:-xps}"
STAGE_DIR="${STAGE_DIR:-/home/jmf/gymapp-staging}"

# BUILD_CMD lets the XPS runner use "npm run build:app" (synced catalog, no scrape).
if [ "${SKIP_BUILD:-0}" != "1" ]; then echo ">> building (${BUILD_CMD:-npm run build})"; ${BUILD_CMD:-npm run build}; fi

wait_staging() {
  local run="$1" i s
  for i in $(seq 1 30); do
    if [ "$run" = local ]; then s=$(docker inspect -f '{{.State.Health.Status}}' gymapp-staging 2>/dev/null || echo none)
    else s=$(ssh "$XPS_HOST" 'docker inspect -f "{{.State.Health.Status}}" gymapp-staging 2>/dev/null || echo none'); fi
    [ "$s" = healthy ] && { echo "OK: gymapp-staging healthy"; return 0; }
    sleep 2
  done
  echo "FAIL: staging unhealthy" >&2; return 1
}

if [ "${DEPLOY_LOCAL:-0}" = "1" ]; then
  echo ">> staging deploy locally on the XPS ($STAGE_DIR)"
  mkdir -p "$STAGE_DIR"
  rsync -a --delete dist/ "$STAGE_DIR/dist/"
  rsync -a server/ "$STAGE_DIR/server/"
  rsync -a docker-compose.staging.yml "$STAGE_DIR/docker-compose.yml"
  ( cd "$STAGE_DIR" && docker compose up -d --build )
  wait_staging local
else
  echo ">> syncing dist + server + compose to ${XPS_HOST}:${STAGE_DIR}"
  ssh "$XPS_HOST" "mkdir -p '$STAGE_DIR'"
  rsync -az --delete dist/ "${XPS_HOST}:${STAGE_DIR}/dist/"
  rsync -az server/ "${XPS_HOST}:${STAGE_DIR}/server/"
  rsync -az docker-compose.staging.yml "${XPS_HOST}:${STAGE_DIR}/docker-compose.yml"
  ssh "$XPS_HOST" "cd '$STAGE_DIR' && docker compose up -d --build"
  wait_staging remote
fi
echo "OK: QA -> https://jmf-xps-13-9343.tail8ece92.ts.net  (tailnet only)"
