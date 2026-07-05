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
# The coach's MCP tools run from here on the host (spawned per chat by the chat-helper).
# NOTHING else syncs this → it silently drifted (~1wk stale, #350). The PROD deploy keeps it in
# step, so promoting to prod also refreshes the coach's tools. (Not synced on the QA/staging deploy:
# the host MCP dir is shared by both coaches, so gating it on promote keeps prod-approved code only.)
CHAT_MCP_DIR="${CHAT_MCP_DIR:-/home/jmf/platyplus-chat/mcp}"
# The host chat-helper bridge (spawns the coach) — another host-only component nothing syncs (#352).
CHAT_DIR="${CHAT_DIR:-$(dirname "$CHAT_MCP_DIR")}"

# BUILD_CMD lets the XPS runner use "npm run build:app" (compiles against a
# pre-synced generated catalog, skipping the scrape it doesn't have).
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo ">> building dist (${BUILD_CMD:-npm run build})..."
  ${BUILD_CMD:-npm run build}
fi

# Secrets master = GitHub Secrets: when the deploy job injects $AUTH_ENV (the
# AUTH_ENV_PROD secret), regenerate auth.env from it before compose reads it.
# No-op when AUTH_ENV is unset (e.g. the Mac hotfix path), leaving the on-box file
# untouched. Atomic write + 600 perms.
write_auth_env() {
  local dir="$1"
  [ -n "${AUTH_ENV:-}" ] || { echo ">> AUTH_ENV not injected — keeping existing $dir/auth.env"; return 0; }
  printf '%s\n' "$AUTH_ENV" > "$dir/auth.env.tmp"
  chmod 600 "$dir/auth.env.tmp"
  mv "$dir/auth.env.tmp" "$dir/auth.env"
  # GH_PROMOTE_TOKEN (PAT w/ Actions:write) for the in-app Promote button (#47).
  [ -n "${GH_PROMOTE_TOKEN:-}" ] && printf 'GH_PROMOTE_TOKEN=%s\n' "$GH_PROMOTE_TOKEN" >> "$dir/auth.env"
  echo ">> wrote $dir/auth.env from injected GitHub Secret ($(grep -c '=' "$dir/auth.env") vars)"
}

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

# Keep the coach's host MCP tools in step with the repo (#350 — nothing else syncs it, so it drifts).
# Best-effort + runs AFTER the app is healthy: a coach-tool sync must NEVER fail the app deploy.
# Excludes node_modules (installed on the box) + old .bak files. No --delete (keeps host backups).
# $1 = "local" | "remote".
sync_coach_mcp() {
  local runner="$1"
  if [ "$runner" = local ]; then
    [ -d "$CHAT_MCP_DIR" ] || { echo ">> (skip MCP sync) $CHAT_MCP_DIR absent"; return 0; }
    echo ">> syncing coach MCP → $CHAT_MCP_DIR (#350)"
    if rsync -a --exclude node_modules --exclude 'server.js.bak.*' mcp/ "$CHAT_MCP_DIR/"; then
      # Runner is root; keep the coach's files jmf-owned (the chat-helper runs as jmf, needs read).
      chown -R jmf:jmf "$CHAT_MCP_DIR" 2>/dev/null || true
      command -v node >/dev/null 2>&1 && { node --check "$CHAT_MCP_DIR/server.js" && echo ">> coach MCP synced (server.js OK)" || echo "WARN: coach MCP server.js failed --check (#350)" >&2; } || echo ">> coach MCP synced (node not on PATH — skipped --check)"
    else
      echo "WARN: coach MCP rsync failed — coach tools may drift (#350)" >&2
    fi
    # The host chat-helper bridge (#352) — sync it too, and RESTART the coach services only when it
    # actually changed (a restart interrupts an in-flight coach chat). Best-effort, non-fatal.
    if [ -f "$CHAT_DIR/server.mjs" ] && [ -f chat-helper/server.mjs ] && ! cmp -s chat-helper/server.mjs "$CHAT_DIR/server.mjs"; then
      echo ">> chat-helper changed → syncing + restarting coach services (#352)"
      if rsync -a chat-helper/server.mjs "$CHAT_DIR/server.mjs"; then
        chown jmf:jmf "$CHAT_DIR/server.mjs" 2>/dev/null || true
        systemctl restart platyplus-chat platyplus-chat-prod 2>/dev/null && echo ">> coach services restarted" || echo "WARN: could not restart coach services (#352)" >&2
      else echo "WARN: chat-helper rsync failed (#352)" >&2; fi
    fi
  else
    ssh "$XPS_HOST" "[ -d '$CHAT_MCP_DIR' ]" || { echo ">> (skip MCP sync) $CHAT_MCP_DIR absent on $XPS_HOST"; return 0; }
    echo ">> syncing coach MCP → ${XPS_HOST}:${CHAT_MCP_DIR} (#350)"
    if rsync -az --exclude node_modules --exclude 'server.js.bak.*' mcp/ "${XPS_HOST}:${CHAT_MCP_DIR}/"; then
      ssh "$XPS_HOST" "cd '$CHAT_MCP_DIR' && (command -v node >/dev/null 2>&1 && node --check server.js || true)" && echo ">> coach MCP synced (remote)" || echo "WARN: coach MCP --check failed (#350)" >&2
    else
      echo "WARN: coach MCP rsync failed — coach tools may drift (#350)" >&2
    fi
  fi
  return 0
}

if [ "${DEPLOY_LOCAL:-0}" = "1" ]; then
  echo ">> deploying locally on the server ($APP_DIR)"
  rsync -a --delete dist/ "$APP_DIR/dist/"
  rsync -a server/ "$APP_DIR/server/"
  rsync -a docker-compose.yml "$APP_DIR/docker-compose.yml"   # infra changes (mounts/env)
  write_auth_env "$APP_DIR"
  # env_file is read at container CREATE, and compose won't recreate on an
  # auth.env-only change — so force-recreate when we injected secrets, else a
  # token rotation wouldn't take effect.
  RECREATE=""; [ -n "${AUTH_ENV:-}" ] && RECREATE="--force-recreate"
  ( cd "$APP_DIR" && docker compose up -d --build $RECREATE )
  wait_healthy local
  sync_coach_mcp local
else
  echo ">> syncing dist + server + compose to ${XPS_HOST}:${APP_DIR}"
  rsync -az --delete dist/ "${XPS_HOST}:${APP_DIR}/dist/"
  rsync -az server/ "${XPS_HOST}:${APP_DIR}/server/"
  rsync -az docker-compose.yml "${XPS_HOST}:${APP_DIR}/docker-compose.yml"
  echo ">> rebuild/restart on ${XPS_HOST}"
  ssh "$XPS_HOST" "cd '$APP_DIR' && docker compose up -d --build"
  wait_healthy remote
  sync_coach_mcp remote
fi

echo "OK: deploy complete"
