---
name: trunk-based
description: Trunk-based version control for Platyplus (gymapp) — dev is the trunk (commit small + push often → QA), main is prod via promote only. Keep everything in git; no long-lived branches. Use whenever committing, branching, or starting any code change.
---

# Trunk-based development (Platyplus)

JM directive (2026-06-25): **everything under version control, trunk-based.** Integrate
continuously on one trunk; no long-lived divergent branches.

## The two branches (only these)
- **`dev` = the TRUNK.** All day-to-day work lands here. Every push to `dev` →
  CI (`ci.yml`) + auto-deploys **QA** (`deploy-staging.yml`). Keep `dev` always green
  and releasable.
- **`main` = prod release.** **Protected** (requires the `build` check) — never push
  or merge directly. Prod ships ONLY via **promote-prod** (`gh workflow run
  promote-prod.yml` → dev→main PR + auto-merge → `deploy.yml`). See `platyplus-ops`.

## Working rules
1. **Commit small & often, push to `dev` frequently.** One logical change per commit;
   a clear message (what + why). Don't batch a day's work into one giant commit.
2. **No long-lived feature branches.** If you must branch (isolation/experiment), keep
   it short and merge back into `dev` within the session. The default is: work on `dev`.
   When the harness starts you on `main`, branch to `dev` (or a short topic branch) first.
3. **Build before you commit.** `npx tsc -b` (typecheck) and/or `npm run build:app`;
   check the EXIT CODE (a workbox/PWA step can fail AFTER vite prints "built"). Never
   commit known-broken code to the trunk.
4. **Everything in git** — code, **mockups (`mockups/*.html`)**, docs, `FEEDBACK-LOG.md`,
   `.claude/skills/*`. The ONLY things gitignored are secrets + data + generated/scraped:
   `auth.env`, `server/dev-data/`, `pgdata/`, `data/store.json` backups, `*.fit/*.gpx/*.tcx`
   (personal activity files), `downloaded_pages/`, synced catalog. Never commit secrets
   or real/weak passwords.
5. **Promote intentionally.** Ship to prod only after testing QA. The human QA test is
   the release gate; `main` always equals what's in prod.

## Quick checks
- `git status -sb` — confirm you're on `dev`, in sync, nothing stray untracked.
- `git log origin/dev..dev --oneline` — unpushed commits (push them; don't let the trunk drift locally).
- `git branch -a` — should stay short (dev, main). A pile of stale branches ≠ trunk-based; prune them.

Pairs with `platyplus-ops` (deploy/promote mechanics) + memory `platyplus-envs-cicd`.
