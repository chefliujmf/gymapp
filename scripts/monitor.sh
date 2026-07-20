#!/usr/bin/env bash
# Platyplus health monitor — runs on the XPS via cron (every ~10 min).
# Checks prod + staging container health + recent error log volume, appends a
# status line, and restarts a container that has been unhealthy/missing for TWO
# consecutive checks (avoids restart loops on a single blip). Also alarms if the
# daily encrypted backup (backup-secrets.service) goes stale/failed.
#   Install (on the XPS):  crontab -l | { cat; echo "*/10 * * * * /home/jmf/monitor.sh"; } | crontab -
#   Watch:                 tail -f /home/jmf/monitor.log
set -uo pipefail
LOG=/home/jmf/monitor.log
STATE=/home/jmf/.monitor-state
ts() { date "+%Y-%m-%d %H:%M:%S"; }
touch "$STATE"

check() {
  local name="$1" dir="$2"
  local h errs
  h=$(docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" "$name" 2>/dev/null || echo missing)
  errs=$(docker logs --since 15m "$name" 2>&1 | grep -ciE "error|exception|EADDRINUSE|ECONNREFUSED|unhandled" || true)
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

# Alarm (problem-only) if the daily encrypted backup is stale or last run failed.
check_backup() {
  local unit=backup-secrets.service status last epoch age_h
  status=$(systemctl show "$unit" -p ExecMainStatus --value 2>/dev/null)
  last=$(systemctl show "$unit" -p ExecMainExitTimestamp --value 2>/dev/null)
  epoch=$(date -d "$last" +%s 2>/dev/null || echo 0)
  if [ "$epoch" = 0 ]; then
    echo "$(ts)  backup  WARN backup-secrets: no successful run on record" >> "$LOG"; return
  fi
  age_h=$(( ( $(date +%s) - epoch ) / 3600 ))
  if [ "${status:-1}" != 0 ] || [ "$age_h" -gt 36 ]; then
    echo "$(ts)  backup  WARN backup-secrets STALE/FAILED: last=\"$last\" age=${age_h}h status=${status:-?}" >> "$LOG"
  fi
}

# Alarm if the COACH's Claude auth is FAILING. The coach + bug-worker run as user 'jmf' on a LONG-LIVED
# CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`, ~1yr, stored in /home/jmf/.claude-coach-token + read by the
# platyplus-chat* services). It's an opaque token with no readable expiry, so we DETECT a real failure by watching the
# coach service logs for the OAuth-expired / 401 signature (logged on the first failed call) — cheap, and it catches
# expiry the moment it bites instead of silently 401ing for a day. When it fires: regenerate the token (below) + restart.
check_coach_auth() {
  local hits
  hits=$(journalctl -u platyplus-chat -u platyplus-chat-prod --since "2 hours ago" --no-pager 2>/dev/null | grep -ciE "OAuth access token has expired|authentication_failed|401 .*o?auth" || true)
  if [ "${hits:-0}" -gt 0 ]; then
    echo "$(ts)  coach  WARN Claude coach token FAILING (${hits} auth error(s)/2h) — regenerate: on the Mac run 'claude setup-token', then: put it in /home/jmf/.claude-coach-token (CLAUDE_CODE_OAUTH_TOKEN=…) + 'systemctl restart platyplus-chat platyplus-chat-prod'" >> "$LOG"
  fi
}

check gymapp /home/jmf/gymapp
[ -d /home/jmf/gymapp-staging ] && check gymapp-staging /home/jmf/gymapp-staging
check_backup
check_coach_auth
tail -n 800 "$LOG" > "$LOG.tmp" 2>/dev/null && mv -f "$LOG.tmp" "$LOG"
