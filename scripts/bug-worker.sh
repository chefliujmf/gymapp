#!/usr/bin/env bash
# Platyplus BUG WORKER — autonomous claude on the XPS.
# One invocation fills a BATCH: it works reported bugs (fail > review) one at a time until the to-test bucket
# reaches the cap (default 10) or no eligible bug remains, then idles. Each bug: assess → fix → test → flip to
# `totest` → commit → push to `dev` (→ QA auto-deploy). It STOPS at totest; JM tests on QA and promotes prod.
# It NEVER promotes. Runs as jmf (claude subscription auth) with GH_PROMOTE_TOKEN injected (git push only).
#
# Env: DRY=1 → assess ONE bug and report, no edits/backlog/commit/push. MAX_ITERS caps bugs per invocation.
set -uo pipefail

REPO=/home/jmf/gymapp-worker
CLAUDE=/home/jmf/.local/bin/claude
NODE=/home/jmf/.local/bin/node
NPM=/home/jmf/.local/bin/npm
SHARED=/home/jmf/backlog-shared
STATUS="$SHARED/claude-status.json"
TRIGGER="$SHARED/claude-trigger.json"
LOCK=/tmp/gymapp-worker.lock
DRY="${DRY:-0}"
MAX_ITERS="${MAX_ITERS:-12}"
export BACKLOG_FILE="$SHARED/backlog.json"
export PATH="/home/jmf/.local/bin:$PATH"
export GIT_ASKPASS="$REPO/scripts/git-askpass.sh"
export GH_PROMOTE_TOKEN="${GH_PROMOTE_TOKEN:-}"

log(){ echo "[$(date -Is)] worker: $*"; }
setstatus(){ printf '%s' "$1" > "$STATUS.tmp" 2>/dev/null && mv "$STATUS.tmp" "$STATUS" 2>/dev/null || true; }

# single instance — a slow batch must not overlap the next trigger tick
exec 9>"$LOCK" || exit 0
flock -n 9 || { log "another run in progress, skipping"; exit 0; }

cd "$REPO" || { log "no repo at $REPO"; exit 1; }

# BATCH GATE (cheap, before any git work): only fill a fresh batch when the to-test bucket is DRAINED to 0 and a
# bug awaits — OR when JM pressed "Start next batch" (the trigger flag). Otherwise idle out fast. DRY always runs.
if [ "$DRY" != "1" ] && [ ! -f "$TRIGGER" ]; then
  READY="$("$NODE" scripts/backlog.mjs ready 2>/dev/null || echo 0)"
  if [ "$READY" != "1" ]; then
    setstatus "{\"where\":\"xps\",\"state\":\"idle\",\"at\":\"$(date -Is)\"}"
    log "idle — to-test not drained to 0, or no eligible bug"; exit 0
  fi
fi

# fresh dev + regenerate the gitignored item list from FEEDBACK-LOG.md
git fetch --quiet origin dev 2>/dev/null || { log "git fetch failed"; exit 1; }
git checkout --quiet dev 2>/dev/null || git checkout --quiet -b dev origin/dev
git reset --hard --quiet origin/dev
git clean -fdq -e node_modules
"$NODE" scripts/build-backlog.mjs >/dev/null 2>&1 || log "warn: build-backlog failed (item list may be stale)"

# deps for the npm test/build gate (once; node_modules is gitignored so it survives clean/reset)
if [ ! -d node_modules ]; then log "installing deps (npm ci)…"; "$NPM" ci >/dev/null 2>&1 || log "warn: npm ci failed"; fi

# work exactly one bug. returns 9 = nothing eligible (bucket full / no bug); 0 = handled one; 1 = parse error.
work_one(){
  git reset --hard --quiet HEAD; git clean -fdq -e node_modules   # clean slate, keep pushed commits
  local NEXT N BEFORE AFTER ALLOW PROMPT
  NEXT="$("$NODE" scripts/backlog.mjs next 2>/dev/null || true)"
  [ -z "$NEXT" ] && return 9
  N="$(printf '%s' "$NEXT" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).n))}catch{process.stdout.write("")}})')"
  [ -z "$N" ] && { log "could not parse item number"; return 1; }
  log "working bug #$N (dry=$DRY)"
  setstatus "{\"where\":\"xps\",\"state\":\"working\",\"item\":$N,\"dry\":$DRY,\"at\":\"$(date -Is)\"}"
  if [ "$DRY" = "1" ]; then
    PROMPT="DRY RUN — do NOT edit files, change the backlog, commit, or push. Just ASSESS Platyplus backlog bug #$N and report clearly: (1) is it a real, still-relevant bug? (2) where in the code does it live? (3) how would you fix it and what test would you add? Here is the item as JSON:
$NEXT"
    ALLOW="Read,Grep,Glob"
  else
    PROMPT="You are working Platyplus backlog BUG #$N. Here is the item as JSON:
$NEXT

Follow your operating rules exactly: assess it's a real, still-relevant bug; fix it at the source; add and run a test (npm test + npm run build must pass); flip it to totest with a human-readable what-to-test via scripts/backlog.mjs; then commit (do NOT push). If it is not a real bug, discard or re-type it. If it's a real bug you should not auto-fix (large/redesign/needs a mock decision), flip it to todo with a note. Work ONLY #$N."
    ALLOW="Bash,Edit,Read,Write,Grep,Glob"
  fi
  BEFORE="$(git rev-parse HEAD)"
  timeout 1800 "$CLAUDE" -p "$PROMPT" \
    --output-format text \
    --permission-mode acceptEdits \
    --allowedTools "$ALLOW" \
    --append-system-prompt-file "$REPO/scripts/worker-system.md" 2>&1 | tail -40
  AFTER="$(git rev-parse HEAD)"
  [ "$DRY" = "1" ] && return 0
  if [ "$BEFORE" != "$AFTER" ]; then
    # The Mac (features) may have pushed to dev while we worked → re-sync before pushing so we don't fail on a
    # non-fast-forward. Our bug fix + a Mac commit touch different files, so the rebase is normally clean.
    if ! git pull --rebase --quiet origin dev 2>/dev/null; then
      git rebase --abort 2>/dev/null || true
      log "couldn't rebase #$N onto latest dev — parking for JM"
      "$NODE" scripts/backlog.mjs flip "$N" todo "Claude: fix built but couldn't cleanly rebase onto the latest dev; needs a look" --force >/dev/null 2>&1 || true
      return 0
    fi
    if git push --quiet origin dev 2>/dev/null; then
      log "pushed #$N to dev (QA will redeploy)"
    else
      log "PUSH FAILED for #$N — parking for JM"
      "$NODE" scripts/backlog.mjs flip "$N" todo "Claude: fix is built + committed but the push to QA failed; needs a look" --force >/dev/null 2>&1 || true
    fi
  else
    log "no code change for #$N (assessed → discarded/re-typed/parked)"
  fi
  return 0
}

# servicing any pending manual trigger now — clear the flag
rm -f "$TRIGGER" 2>/dev/null

worked=0
for _ in $(seq 1 "$MAX_ITERS"); do
  work_one; rc=$?
  [ $rc -eq 9 ] && { log "batch complete — to-test full or no eligible bug"; break; }
  [ $rc -eq 0 ] && worked=$((worked+1))
  [ "$DRY" = "1" ] && break
done

setstatus "{\"where\":\"xps\",\"state\":\"idle\",\"worked\":$worked,\"at\":\"$(date -Is)\"}"
log "run complete — worked $worked item(s)"
