---
name: platyplus-ops
description: Operate the Platyplus app (gymapp repo) — environments, deploy/promote, XPS access, integrations (Strava/intervals/chatbot), secrets. Use when deploying, promoting dev→prod, touching the XPS, or wiring an integration.
---

# Platyplus ops

Personal/family fitness PWA (you + wife). Repo `chefliujmf/gymapp`. **Design rule:** non-technical users — owner does one-time setup, users only tap "Connect".

## Environments (NO `qa` branch)
- **dev** = local. `npm run dev:full` (web :5173 + API :8088). API runs `node --watch` (dev-api.sh) so edits auto-reload — but a **data import** to the dev store (`server/dev-data/store.json`) still needs the API to restart to load it. Mock auto-login when backend is down → that mock has NO server session, so server-auth routes 401 (test real login for those).
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
- **Chatbot**: `POST /auth/chat` (SSE, streams; `X-Accel-Buffering:no` so NPM doesn't buffer). Locked-down `claude -p` (deny shell/fs, allow ONLY `mcp__platyplus`), scoped to the signed-in user's Coach API token. MCP = `mcp/server.js` (typed tools over the Coach API).
  - **dev** spawns `claude` locally. **QA/prod** can't (Alpine/musl vs glibc claude) → `/auth/chat` proxies to a **host chat-helper** when `CHAT_HELPER_URL` is set.
  - **Host helper** = `chat-helper/server.mjs` as systemd `platyplus-chat.service` (runs as `jmf`, port 8790, `CHAT_HELPER_SECRET`, `CLAUDE_BIN`, `PLATYPLUS_MCP_PATH`, `PLATYPLUS_URL`=container Coach API). Lives at `/home/jmf/platyplus-chat/` (helper + `mcp/` rsynced — **host infra, NOT in CI deploy**, like the catalog). Compose: `extra_hosts host.docker.internal:host-gateway` + `CHAT_HELPER_URL`. **Done on QA (→8089); prod needs its own helper pointed at 8088.**
- **Coach engine model** (see memory `platyplus-coach-engine`): **ONE polyvalent engine** = `chefliujmf/cyclingcoach` (NOT cycling-only). `bertfitnesscoach` RETIRED (no per-person forks). Users differ ONLY by **profile**. `server.js buildSystemPrompt(user)` = coach identity + **app config/usage help** + the user's **athlete profile** (engine-native markdown, per-user `coachProfile`, edited at Profile → Athlete via `/auth/profile/athlete`). JM's profile imports from `~/dev/cyclingcoach/codex_coach/athlete_profile.md`. TODO: sync cyclingcoach `coach_system`+`instructions` into the prompt; onboarding Q&A (text/audio STT) for new users; intervals-plan MCP tool.

## Testing (two promotion gates)
- `TESTING.md` is the **living regression list**, grown per feature. Two gates: **Dev→QA** (minimum pass, mostly automatable) and **QA→Prod** (full acceptance, classic-IT). See memory `platyplus-testing-workflow`.
- `npm run test:smoke` (`scripts/smoke-test.mjs`) runs the Gate-1 [A] rows against the dev API (auth, /auth/me fields, athlete GET/PUT roundtrip, coachName persist, chat first SSE frame). When a feature is ready for testing, ADD cases to TESTING.md + extend the smoke test.

## Coach engine sync
- `scripts/sync-coach-engine.mjs` pulls `~/dev/cyclingcoach/instructions.md` → `server/coach-engine.md` (vendored artifact, committed + COPYed into the image). `server.js buildSystemPrompt` injects it. Re-run after editing the engine in cyclingcoach. (Only the transferable method — not the 131M knowledge_base.)
- Import a profile into an env store: `node scripts/import-athlete-profile.mjs <store.json> <user> <profile.md>` then restart that server/container so it loads.

## "When you change X" (from CLAUDE.md)
Any `server/*` change rebuilds the image (CI smoke-tests the module graph). New `/api`|`/auth` route → update `server/openapi.json`. User-facing batch → add to `src/notifications.ts`/releases. Keep `UX-BACKLOG.md` + memory current (the user stresses this).
