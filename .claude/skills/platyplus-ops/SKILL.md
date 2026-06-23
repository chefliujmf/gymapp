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

## Deploy / promote — ZERO-CLICK (JM directive 2026-06-23: "don't want to click anything for PR whatever")
- To QA: just `git push origin dev` (auto-deploys).
- **To prod: nothing.** `promote.yml` (`workflow_run` on **Deploy Staging** success) fast-forwards `main` to the just-passed `dev` commit → `deploy.yml` (push:main, CI-gated) deploys prod. So a healthy QA deploy auto-promotes to prod, **no PR, no clicks**. **Kill switch:** repo Actions variable `AUTO_PROMOTE=off` pauses it; re-run manually via the promote workflow's `workflow_dispatch`.
- The old PR path is retired. `gh` is NOT authenticated on the Mac and the classifier **hard-blocks** repurposing the keychain git token for `gh` (don't re-attempt) — but you no longer need `gh` for promotion. `git` reads/pushes fine via keychain; a **direct `git push origin <sha>:refs/heads/main`** is the manual hotfix-promote (and was used once to bootstrap `promote.yml` onto `main`).
- Watch runs: `curl -s "https://api.github.com/repos/chefliujmf/gymapp/actions/runs?per_page=5"`.

## XPS (the box)
- `root@100.104.241.95` (Tailscale SSH, passwordless) for root; `jmf@` for non-root. There's a **host node** at `/home/jmf/.local/bin/node` (v24.17.0) — use it for host-side scripts (note: newer node rejects top-level `return` in `node -e`, use `process.exit()`). Container-internal node is `docker exec gymapp[-staging] node -e …`. Data fixes via the live API (`PUT /api/profile/athlete`, `DELETE /api/plan/<id>` with the user's `apiToken`) also remove stray intervals mirror events — prefer that over editing the root-owned `store.json` directly.
- Secrets: gitignored `auth.env` on the box — QA `/home/jmf/gymapp-staging/auth.env`, prod `/home/jmf/gymapp/auth.env` (RP_ID, ORIGIN, SEED_*, STRAVA_*). Never commit real/weak passwords.
- Containers: `gymapp` (prod, :8088), `gymapp-staging` (QA, :8089). NPM (HA Green, 10.0.0.127) fronts the duckdns domains; XPS LAN IP = 10.0.0.182.
- `claude` CLI lives at `/home/jmf/.local/bin/claude` (auth `~/.claude`) — owner's subscription.

## Integrations
- **Strava** (done): one app (Client ID 102783), callback domain `duckdns.org` (covers QA+prod), per-user OAuth "Connect" button, scopes read_all+write, creds in `.secrets/strava.env` (dev) + box `auth.env`. Pull capped by `STRAVA_LOOKBACK_DAYS` (def 14). Push = opt-in per workout.
- **intervals.icu**: per-user API-key paste (OAuth needs a manual creds request to the intervals dev). Plan is the source of truth on intervals; `cleanEvents()` drops ATP/targets/notes + dedupes same-day rides.
- **Chatbot**: `POST /auth/chat` (SSE, streams; `X-Accel-Buffering:no` so NPM doesn't buffer). Locked-down `claude -p` (deny shell/fs, allow ONLY `mcp__platyplus`), scoped to the signed-in user's Coach API token. MCP = `mcp/server.js` (typed tools over the Coach API).
  - **dev** spawns `claude` locally. **QA/prod** can't (Alpine/musl vs glibc claude) → `/auth/chat` proxies to a **host chat-helper** when `CHAT_HELPER_URL` is set.
  - **Host helper** = `/home/jmf/platyplus-chat/server.mjs`, run by systemd. **TWO units now (both active):** `platyplus-chat.service` (QA, port 8790, `PLATYPLUS_URL`=8089) and `platyplus-chat-prod.service` (prod, port 8791, `PLATYPLUS_URL`=8088). Each sets `CHAT_HELPER_SECRET`, `CLAUDE_BIN`, `PLATYPLUS_MCP_PATH=/home/jmf/platyplus-chat/mcp/server.js`. The `mcp/` dir is **host infra, NOT in CI deploy** (like the catalog) — its `server.js` is edited by hand on the box; **after editing it, `systemctl restart platyplus-chat.service platyplus-chat-prod.service`** (the `claude` CLI also re-spawns the MCP per chat, but restart to be deterministic). The repo `mcp/server.js` is the source — keep the host copy in sync (e.g. `get_checkins` text is now "all 1–10"). Compose: `extra_hosts host.docker.internal:host-gateway` + `CHAT_HELPER_URL`.
- **Coach engine model** (see memory `platyplus-coach-engine`): **ONE polyvalent engine** = `chefliujmf/cyclingcoach` (NOT cycling-only). `bertfitnesscoach` RETIRED (no per-person forks). Users differ ONLY by **profile**. `server.js buildSystemPrompt(user)` = coach identity + **app config/usage help** + the user's **athlete profile** (engine-native markdown, per-user `coachProfile`, edited at Profile → Athlete via `/auth/profile/athlete`). JM's profile imports from `~/dev/cyclingcoach/codex_coach/athlete_profile.md`. TODO: sync cyclingcoach `coach_system`+`instructions` into the prompt; onboarding Q&A (text/audio STT) for new users; intervals-plan MCP tool.

## Testing (two promotion gates)
- `TESTING.md` is the **living regression list**, grown per feature. Two gates: **Dev→QA** (minimum pass, mostly automatable) and **QA→Prod** (full acceptance, classic-IT). See memory `platyplus-testing-workflow`.
- `npm run test:smoke` (`scripts/smoke-test.mjs`) runs the Gate-1 [A] rows against the dev API (auth, /auth/me fields, athlete GET/PUT roundtrip, coachName persist, chat first SSE frame). When a feature is ready for testing, ADD cases to TESTING.md + extend the smoke test.

## Coach engine sync
- `scripts/sync-coach-engine.mjs` pulls `~/dev/cyclingcoach/instructions.md` → `server/coach-engine.md` (vendored artifact, committed + COPYed into the image). `server.js buildSystemPrompt` injects it. Re-run after editing the engine in cyclingcoach. (Only the transferable method — not the 131M knowledge_base.)
- Import a profile into an env store: `node scripts/import-athlete-profile.mjs <store.json> <user> <profile.md>` then restart that server/container so it loads.

## UX/UI changes — ALWAYS research best practice first (JM directive)
Before any UX/UI change, **look up current best practice + how leading apps do it** (WebSearch:
NN/g, Android/iOS HIG, fitness apps like Strava/Whoop/intervals.icu) and apply it — don't guess.
Cite the sources in the reply. Established patterns so far:
- **Nav:** ≤5 fixed bottom tabs; overflow → hubs/"More"; adapt CONTENT not structure (multi-sport).
- **Charts:** one-takeaway-per-chart; round-number axes (1/2/5/10); interactive (scrub → value;
  mini-cards update the headline number, not a box); subtle draw-in motion; legible contrast.
- **Explanations:** a tappable **ⓘ** popover (`InfoDot`), tap-to-reveal, <150 chars, dismiss on blur.
- **Date range:** preset chips + a **Custom** option with start/end native date inputs; auto-swap if
  reversed; ≤6 taps.
- **Field save:** autosave + "Saved ✓" (no Save buttons); **Profile vs Settings vs Admin** split.
Charts live in `src/charts.tsx` (TrendChart/BarChart/PowerCurveChart/InfoDot/ChartModal, dependency-free SVG).

## "When you change X" (from CLAUDE.md)
Any `server/*` change rebuilds the image (CI smoke-tests the module graph). New `/api`|`/auth` route → update `server/openapi.json`. User-facing batch → add to `src/notifications.ts`/releases. Keep `UX-BACKLOG.md` + memory current (the user stresses this).
