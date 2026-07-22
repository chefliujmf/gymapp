---
name: verify-prod-or-rollback
description: After EVERY prod promote, prove the push actually works on prod (not just "deploy green") — health + container + the real changed screens in Chrome + logs — and ROLL BACK immediately if it's broken. JM directive 2026-07-22 after a bad push reached prod.
---

# Verify prod after a push — or roll back

**A green deploy is NOT a working push.** JM lost trust because "built/deployed" ≠ "works". After EVERY prod promote (`promote-prod.yml` → PR merge → `deploy.yml`), run this gate. If any step fails, **ROLL BACK first, diagnose second** — never leave prod broken while investigating.

## The gate (run in order, all must pass)

1. **Deploy workflow succeeded** — `gh run list --branch main --workflow "Deploy" --limit 1` → `completed/success` for the promoted SHA. A failed/cancelled deploy = not shipped; re-run or fix, don't assume.
2. **Health 200** — `curl -s -o /dev/null -w "%{http_code}" https://platyplus.duckdns.org/auth/config` → `200`.
3. **Container healthy + FRESH** — `ssh xps 'docker ps --format "{{.Names}} {{.Status}}" | grep "^gymapp "'` → `Up <seconds> (healthy)`. "Up 3 days" means the deploy didn't restart it → it did NOT ship; investigate.
4. **Logs clean post-deploy** — `ssh xps 'docker logs --since 3m gymapp 2>&1 | grep -iE "error|unhandled|crash|throw" | head'` → no new error spikes.
5. **FUNCTIONAL check on PROD in Chrome (the real test)** — open `https://platyplus.duckdns.org` and WALK the screens the push changed (skill `platyplus-browser-testing`). Confirm the FEATURE actually works, not just that the page loads. One screenshot per changed surface. This is the step that catches "compiled but wrong" — do NOT skip it, and do NOT claim a push good on health-200 alone.
   - Prod is JM's REAL account (and his wife's) — read-only checks are safe; don't trigger destructive/irreversible writes just to test.

## If ANY step fails → ROLL BACK NOW

Prod stays broken for zero extra minutes. Roll back, THEN diagnose on dev.

- **Standard rollback — revert the merge on `main`** (CI-gated redeploy of the previous good state):
  ```
  gh pr list --base main --head dev --json number   # or find the merge commit
  git fetch origin && git checkout main && git pull
  git revert -m 1 <merge_commit_sha> --no-edit       # -m 1 = keep main's first parent
  git push origin main                                # push:main → deploy.yml redeploys the reverted (good) state
  ```
  Then re-run the gate on the reverted SHA to confirm prod is healthy again.
- **Faster stop-gap (infra only, if the app image itself is bad):** redeploy the previous known-good image/tag on the box, or `git reset` main to the last-good SHA and push (only if a revert is messy) — prefer the revert PR for auditability.
- After rollback: reproduce on **dev/QA**, fix, re-verify in Chrome on QA, and only re-promote once the gate would pass.

## Report honestly

- State each gate result (deploy SHA, health code, container uptime, functional screens checked).
- If you rolled back, say so plainly + why + what you'll fix. Never report a push as successful without the functional Chrome step.

Ties: `promote-on-pass`, `platyplus-testing`, `platyplus-browser-testing`, `verify-before-ready`, `platyplus-ops`; memory `platyplus-operate-prod-directly`.
