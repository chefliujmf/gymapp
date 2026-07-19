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

# Alarm if the COACH's Claude subscription (OAuth) token is expired/expiring. The coach + the autonomous bug-worker
# run as this user on that token; once it lapses EVERY coach chat silently 401s (claude exits 1 → the vague "couldn't
# finish that one"). There's no refresh token, so it needs a manual re-auth — catch it BEFORE it silently dies for a day.
check_coach_auth() {
  # the coach + bug-worker run as user 'jmf' on jmf's Claude subscription — check THAT credential file explicitly
  # (the monitor itself runs as root, so $HOME would be /root — the wrong token).
  local cred="/home/jmf/.claude/.credentials.json" ea now
  [ -f "$cred" ] || { echo "$(ts)  coach  WARN no Claude credentials at $cred" >> "$LOG"; return; }
  ea=$(python3 -c "import json; o=json.load(open('$cred')); o=o.get('claudeAiOauth',o); print(int(o.get('expiresAt',0)))" 2>/dev/null || echo 0)
  [ "${ea:-0}" -gt 0 ] || return
  now=$(( $(date +%s) * 1000 ))
  if [ "$ea" -lt "$now" ]; then
    echo "$(ts)  coach  WARN Claude coach token EXPIRED $(( (now-ea)/3600000 ))h ago — coach + bug-worker are 401ing. Re-auth: sudo -u jmf -H claude setup-token" >> "$LOG"
  elif [ "$ea" -lt "$(( now + 86400000 ))" ]; then
    echo "$(ts)  coach  WARN Claude coach token expires in <24h — re-auth soon (sudo -u jmf -H claude setup-token)" >> "$LOG"
  fi
}

check gymapp /home/jmf/gymapp
[ -d /home/jmf/gymapp-staging ] && check gymapp-staging /home/jmf/gymapp-staging
check_backup
check_coach_auth
tail -n 800 "$LOG" > "$LOG.tmp" 2>/dev/null && mv -f "$LOG.tmp" "$LOG"
