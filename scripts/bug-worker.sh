#!/usr/bin/env bash
# Platyplus BUG WORKER — autonomous claude on the XPS.
# Picks the top reported bug (fail > review-bug), fixes it, adds a test, flips it to `totest`, and pushes to
# `dev` (→ QA auto-deploy). It STOPS at totest — JM tests on QA and promotes to prod himself. It NEVER promotes.
#
# Runs as user jmf (so claude uses jmf's Claude subscription creds) with GH_PROMOTE_TOKEN injected by systemd
# (the reused promote PAT — for `git push` only). One bug per run; the trigger re-fires until to-test hits the cap.
#
# Env: DRY=1 → assess-and-report only (no edits, no backlog change, no commit, no push).
set -uo pipefail

REPO=/home/jmf/gymapp-worker
CLAUDE=/home/jmf/.local/bin/claude
NODE=/home/jmf/.local/bin/node
SHARED=/home/jmf/backlog-shared
STATUS="$SHARED/claude-status.json"
LOCK=/tmp/gymapp-worker.lock
DRY="${DRY:-0}"
export BACKLOG_FILE="$SHARED/backlog.json"
export PATH="/home/jmf/.local/bin:$PATH"
export GIT_ASKPASS="$REPO/scripts/git-askpass.sh"
export GH_PROMOTE_TOKEN="${GH_PROMOTE_TOKEN:-}"

log(){ echo "[$(date -Is)] worker: $*"; }
setstatus(){ printf '%s' "$1" > "$STATUS.tmp" 2>/dev/null && mv "$STATUS.tmp" "$STATUS" 2>/dev/null || true; }

# single instance — a slow fix must not overlap the next trigger
exec 9>"$LOCK" || exit 0
flock -n 9 || { log "another run in progress, skipping"; exit 0; }

cd "$REPO" || { log "no repo at $REPO"; exit 1; }

# fresh dev
git fetch --quiet origin dev 2>/dev/null || { log "git fetch failed"; exit 1; }
git checkout --quiet dev 2>/dev/null || git checkout --quiet -b dev origin/dev
git reset --hard --quiet origin/dev
git clean -fdq -e node_modules

# the item list (src/data/generated/backlog.json) is a gitignored build artifact — regenerate it from
# FEEDBACK-LOG.md so backlog.mjs sees the current items (dep-free node script).
"$NODE" scripts/build-backlog.mjs >/dev/null 2>&1 || log "warn: build-backlog failed (item list may be stale)"

# pick the top bug (empty = nothing eligible, or the to-test bucket is full = JM's turn)
NEXT="$("$NODE" scripts/backlog.mjs next 2>/dev/null || true)"
if [ -z "$NEXT" ]; then
  log "idle — no eligible bug (or to-test bucket full)"
  setstatus "{\"where\":\"xps\",\"state\":\"idle\",\"at\":\"$(date -Is)\"}"
  exit 0
fi
N="$(printf '%s' "$NEXT" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).n))}catch{process.stdout.write("")}})')"
[ -z "$N" ] && { log "could not parse item number"; exit 1; }

log "working bug #$N (dry=$DRY)"
setstatus "{\"where\":\"xps\",\"state\":\"working\",\"item\":$N,\"dry\":$DRY,\"at\":\"$(date -Is)\"}"

if [ "$DRY" = "1" ]; then
  PROMPT="DRY RUN — do NOT edit files, do NOT change the backlog, do NOT commit, do NOT push. Just ASSESS Platyplus backlog bug #$N and report clearly: (1) is it a real, still-relevant bug? (2) where in the code does it live? (3) how would you fix it and what test would you add? Here is the item as JSON:
$NEXT"
  ALLOW="Read,Grep,Glob"
else
  PROMPT="You are working Platyplus backlog BUG #$N. Here is the item as JSON:
$NEXT

Follow your operating rules exactly: assess it's a real, still-relevant bug; fix it at the source; add and run a test (npm test + npm run build must pass); flip it to totest with a human-readable what-to-test via scripts/backlog.mjs; then commit (do NOT push). If it is not a real bug, discard or re-type it and stop. Work ONLY #$N."
  ALLOW="Bash,Edit,Read,Write,Grep,Glob"
fi

BEFORE="$(git rev-parse HEAD)"
timeout 1800 "$CLAUDE" -p "$PROMPT" \
  --output-format text \
  --permission-mode acceptEdits \
  --allowedTools "$ALLOW" \
  --append-system-prompt-file "$REPO/scripts/worker-system.md" 2>&1 | tail -60
AFTER="$(git rev-parse HEAD)"

if [ "$DRY" = "1" ]; then
  log "dry run done for #$N"
  setstatus "{\"where\":\"xps\",\"state\":\"idle\",\"at\":\"$(date -Is)\"}"
  exit 0
fi

# push ONLY if claude actually committed a code change
if [ "$BEFORE" != "$AFTER" ]; then
  if git push --quiet origin dev 2>/dev/null; then
    log "pushed #$N to dev (QA will redeploy)"
  else
    log "PUSH FAILED for #$N — flagging for JM"
    "$NODE" scripts/backlog.mjs flip "$N" review "Claude: fix is built + committed but the push to QA failed; needs a look" --force >/dev/null 2>&1 || true
  fi
else
  log "no code change for #$N (assessed/discarded/re-typed)"
fi
setstatus "{\"where\":\"xps\",\"state\":\"idle\",\"at\":\"$(date -Is)\"}"
log "run complete"
