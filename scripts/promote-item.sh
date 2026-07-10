#!/usr/bin/env bash
# Per-item PROD promote — JM's gate: an item at "Tested Success" promotes to prod ON ITS OWN. NEVER a wholesale
# dev→prod (that would ship untested items riding along). This cherry-picks just the commit(s) for backlog item
# #N from dev onto a fresh branch off main, opens a PR, and arms auto-merge. CI's build check gates the merge →
# deploy.yml ships prod. Run from the repo root on the Mac (gh authed).
#
# Usage: scripts/promote-item.sh <item-number>
#   - already on prod            → no-op
#   - no commit tagged #N on dev → no-op (item passed without a code change)
#   - cherry-pick conflicts      → STOP: it depends on an un-promoted item; promote that dependency first
set -euo pipefail

N="${1:?usage: scripts/promote-item.sh <item-number>}"
cd "$(dirname "$0")/.."
ORIG="$(git rev-parse --abbrev-ref HEAD)"
git fetch -q origin

# already on prod?
if git log origin/main --oneline --format='%s' --grep="#$N" | grep -qE "(^|[^0-9])#$N([^0-9]|$)"; then
  echo "#$N already appears on prod (main). Nothing to promote."; exit 0
fi

# its commit(s) on dev-not-main, oldest→newest (match #N as a whole token: '#N ', '#N:', '#N)')
SHAS=()
while read -r sha subj; do
  case " $subj " in *"#$N "*|*"#$N:"*|*"#$N)"*|*"#$N,"*) SHAS+=("$sha");; esac
done < <(git log origin/main..origin/dev --reverse --format='%H %s')

if [ "${#SHAS[@]}" -eq 0 ]; then
  echo "No commit tagged #$N on dev — nothing to ship (item passed without a code change?)."; exit 0
fi
echo "#$N → ${#SHAS[@]} commit(s) to promote."

BR="promote/$N"
git checkout -q -B "$BR" origin/main
for sha in "${SHAS[@]}"; do
  if ! git cherry-pick "$sha" >/dev/null 2>&1; then
    git cherry-pick --abort 2>/dev/null || true
    git checkout -q "$ORIG"; git branch -D "$BR" 2>/dev/null || true
    echo "CONFLICT cherry-picking ${sha:0:9} for #$N — it depends on an un-promoted item. Promote that dependency first."
    exit 1
  fi
done
git push -q -u origin "$BR" --force-with-lease

gh pr create --base main --head "$BR" \
  --title "Promote #$N → prod (Tested Success)" \
  --body "Per-item promote (JM's gate: Tested Success → prod, never wholesale dev→prod). Cherry-picks the #$N commit(s) onto main. CI build-gates the auto-merge → deploy.yml ships prod." >/dev/null 2>&1 \
  || echo "(a PR for $BR may already exist — updated the branch)"
gh pr merge "$BR" --auto --squash >/dev/null 2>&1 || true
git checkout -q "$ORIG"
echo "✓ #$N promote PR opened + auto-merge armed. It ships to prod once CI's build check passes."
