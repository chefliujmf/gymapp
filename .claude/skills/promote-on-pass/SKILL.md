---
name: promote-on-pass
description: The instant ≥1 backlog item is tested-success (pass) on QA and not yet on prod, PROMOTE dev→main — trunk-based, promote on the FIRST pass, never batch or hoard tested items. Then flip the promoted items pass→done. Use the moment JM says something tests successfully.
---

# Promote on tested-success (trunk-based)

**JM directive (2026-07-14):** "promote once you have 1 test success or more." Do NOT let tested-success
items pile up on `dev` — ship to prod as soon as ONE passes. Trunk-based: small, frequent promotes, `main`
always equals prod. This is a SEPARATE routine JM asked for — run it on every pass, don't fold it away.

## The trigger
The moment JM marks (or tells you) an item **tested success / `pass`** on QA and it's on `dev` but not yet on
prod → **PROMOTE NOW.** One pass is enough. Never wait to batch 5 or 10. Other green dev work (tests + build
pass) rides along — that's fine and expected on a trunk; the *trigger* is a genuine JM-verified pass.

## The routine (each time)
1. **Reconcile** dev vs main: `git fetch origin main dev`. If main is ahead only by the last promote's merge
   commit, `git merge origin/main -X ours` into dev (dev is authoritative) so the PR is clean. `npm run build`
   must be green; `git push origin dev`.
2. **Promote:** `gh workflow run promote-prod.yml --ref dev` → opens/reuses the dev→main PR with auto-merge
   (gated on the protected `build` check).
3. **Watch to done:** poll the PR to `MERGED` → `deploy.yml` ships prod. Confirm prod `/auth/config` = 200 and
   `docker ps` shows `gymapp` + `gymapp-db` healthy. If a prod-only path changed, verify it with real data.
4. **Flip pass → done** in the shared backlog `/srv/backlog/backlog.json` for every item that just shipped
   (`done` = on prod), and **read it back to confirm** (skill `verify-before-ready`). This is my job — JM can only
   set `pass`; I flip pass→done on promote (else tested items pile up).

## Don't
- Don't hoard tested items "to batch a release." One pass → promote.
- Don't use unverified work as the *reason* to promote (it may ride along, but the trigger is a real pass).
- Don't push `main` directly — always via `promote-prod.yml`.

Pairs with `trunk-based` (branch model), `verify-before-ready` (verify + log to the right store), `platyplus-ops`.
