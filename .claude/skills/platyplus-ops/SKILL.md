---
name: platyplus-ops
description: Operate the Platyplus app (gymapp repo) — environments, deploy/promote, XPS access, integrations (Strava/intervals/chatbot), secrets. Use when deploying, promoting dev→prod, touching the XPS, or wiring an integration.
---

# Platyplus ops

Personal/family fitness PWA (you + wife). Repo `chefliujmf/gymapp`. **Design rule:** non-technical users — owner does one-time setup, users only tap "Connect".

## Environments (NO `qa` branch)
- **dev** = local. `npm run dev:full` (web :5173 + API :8088). Mock auto-login when backend is down → that mock has NO server session, so server-auth routes 401 (test real login for those).
- **QA** = the `dev` branch DEPLOYED → `https://platyplus-qa.duckdns.org`. Every push to `dev` auto-deploys QA (`deploy-staging.yml`). QA login uses the **prod password** (hash copied). Public.
- **prod** = `main` → `https://platyplus.duckdns.org` (`deploy.yml`).
- EnvBadge labels DEV/QA/PROD by hostname. Deploys are **CI-gated** (reusable `ci.yml` via `workflow_call`; `deploy needs: ci`).

## Deploy / promote
- To QA: just `git push origin dev` (auto-deploys).
- To prod: PR `dev`→`main`, CI green, merge → prod auto-deploys. `gh` is installed; auth via osxkeychain:
  `GH_TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p')` then `gh pr create -B main -H dev …` and `gh pr merge <n> --merge`.
- Watch runs: `curl -s "https://api.github.com/repos/chefliujmf/gymapp/actions/runs?per_page=5"`.

## XPS (the box)
- `root@100.104.241.95` (Tailscale SSH, passwordless) for root; `jmf@` for non-root. `node` is only INSIDE containers → `docker exec gymapp[-staging] node -e …`.
- Secrets: gitignored `auth.env` on the box — QA `/home/jmf/gymapp-staging/auth.env`, prod `/home/jmf/gymapp/auth.env` (RP_ID, ORIGIN, SEED_*, STRAVA_*). Never commit real/weak passwords.
- Containers: `gymapp` (prod, :8088), `gymapp-staging` (QA, :8089). NPM (HA Green, 10.0.0.127) fronts the duckdns domains; XPS LAN IP = 10.0.0.182.
- `claude` CLI lives at `/home/jmf/.local/bin/claude` (auth `~/.claude`) — owner's subscription.

## Integrations
- **Strava** (done): one app (Client ID 102783), callback domain `duckdns.org` (covers QA+prod), per-user OAuth "Connect" button, scopes read_all+write, creds in `.secrets/strava.env` (dev) + box `auth.env`. Pull capped by `STRAVA_LOOKBACK_DAYS` (def 14). Push = opt-in per workout.
- **intervals.icu**: per-user API-key paste (OAuth needs a manual creds request to the intervals dev). Plan is the source of truth on intervals; `cleanEvents()` drops ATP/targets/notes + dedupes same-day rides.
- **Chatbot**: `POST /auth/chat` spawns locked-down `claude -p` (deny shell/fs, allow ONLY `mcp__platyplus`), scoped to the signed-in user's Coach API token. MCP = `mcp/server.js` (typed tools over the Coach API). Works on dev. **Prod TODO:** the node server runs IN the container, which has no `claude` → bridge it to the host's `claude` (mount `~/.local/bin/claude` + `~/.claude` + node, set `CLAUDE_BIN`), and bake `mcp/` into the server image.

## "When you change X" (from CLAUDE.md)
Any `server/*` change rebuilds the image (CI smoke-tests the module graph). New `/api`|`/auth` route → update `server/openapi.json`. User-facing batch → add to `src/notifications.ts`/releases. Keep `UX-BACKLOG.md` + memory current (the user stresses this).
