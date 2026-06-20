#!/usr/bin/env bash
# Platyplus health monitor — runs on the XPS via cron (every ~10 min).
# Checks prod + staging container health + recent error log volume, appends a
# status line, and restarts a container that's been unhealthy/missing for TWO
# consecutive checks (avoids restart loops on a single blip).
#   Install (on the XPS):  crontab -l | { cat; echo "*/10 * * * * /home/jmf/monitor.sh"; } | crontab -
#   Watch:                 tail -f /home/jmf/monitor.log
set -uo pipefail
LOG=/home/jmf/monitor.log
STATE=/home/jmf/.monitor-state
ts() { date '+%Y-%m-%d %H:%M:%S'; }
touch "$STATE"

check() {
  local name="$1" dir="$2"
  local h errs
  h=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || echo missing)
  errs=$(docker logs --since 15m "$name" 2>&1 | grep -ciE 'error|exception|EADDRINUSE|ECONNREFUSED|unhandled' || true)
  echo "$(ts)  $name  health=$h  errors/15m=$errs" >> "$LOG"
  if [ "$h" = unhealthy ] || [ "$h" = missing ] || [ "$h" = exited ]; then
    if grep -q "^$name bad$" "$STATE" 2>/dev/null; then
      echo "$(ts)  $name STILL bad -> restarting" >> "$LOG"
      ( cd "$dir" && docker compose up -d ) >> "$LOG" 2>&1
      grep -v "^$name bad$" "$STATE" > "$STATE.tmp" 2>/dev/null || true; mv -f "$STATE.tmp" "$STATE" 2>/dev/null || true
    else
      echo "$name bad" >> "$STATE"
    fi
  else
    grep -v "^$name bad$" "$STATE" > "$STATE.tmp" 2>/dev/null || true; mv -f "$STATE.tmp" "$STATE" 2>/dev/null || true
  fi
}

check gymapp /home/jmf/gymapp
[ -d /home/jmf/gymapp-staging ] && check gymapp-staging /home/jmf/gymapp-staging
tail -n 800 "$LOG" > "$LOG.tmp" 2>/dev/null && mv -f "$LOG.tmp" "$LOG"
