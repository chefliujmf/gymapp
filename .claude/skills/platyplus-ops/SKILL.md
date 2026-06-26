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

## Deploy / promote — ONE-CLICK WORKFLOW (JM directives 2026-06-23: "don't want to click for PR" + "I need to test too" + "secure the token")
- To QA: just `git push origin dev` (auto-deploys to https://platyplus-qa.duckdns.org, prod password).
- **To prod: test on QA, then repo → Actions → "Promote to prod" → Run workflow.** `promote-prod.yml` (`workflow_dispatch`) **opens/reuses a `dev`→`main` PR and enables auto-merge**, so GitHub merges it once the protected-branch `build` check passes → `deploy.yml` (push:`main`, CI-gated) ships prod. The human QA test is the gate; no PR busywork.
- **`main` is a PROTECTED branch** requiring the `build` check — a direct push (even a merge) is rejected (`protected branch hook declined`), so promotion MUST go through a PR. (Also: `main` carries PR **merge commits**, so it never fast-forwards from `dev`.)
- **Auth = `PROMOTE_TOKEN` Actions secret** (a fine-grained PAT, Contents+PRs write, repo-scoped). A PAT acts as a real user, so its PR triggers the `build` check (the built-in `GITHUB_TOKEN`'s would NOT — that's why a PAT, not GITHUB_TOKEN). Repo "Allow auto-merge" ON (`gh api -X PATCH repos/chefliujmf/gymapp -f allow_auto_merge=true`, done). Set/rotate: `gh secret set PROMOTE_TOKEN --repo chefliujmf/gymapp` (reads stdin). **The PAT is configured with NO expiration (JM confirmed 2026-06-23) → zero-maintenance, nothing to rotate.** (So don't push the GitHub-App alternative — it was built then reverted when JM supplied the PAT; only relevant if the no-expiry PAT is ever revoked.) **No local secret copies anymore** — JM had me delete `.secrets/` (github.env + dev strava.env) on 2026-06-23; GitHub Secrets is the sole home. Local dev Strava therefore needs a re-"Connect" if used (dev-api.sh sources `.secrets/strava.env` only `[ -f ]`, so it just skips).
- **`gh` is authenticated on the Mac** (as `chefliujmf`, scopes `repo`+`workflow`, since 2026-06-23) — use it directly for PRs/secrets/merges/`gh run`. The first promotion (to ship `promote-prod.yml` itself to prod) is bootstrapped with authed `gh`: `gh pr create -B main -H dev` → `gh pr merge dev --auto --merge`. (Earlier the classifier blocked repurposing the *keychain git* token for gh — irrelevant now that gh has its own login.)
- Watch runs: `gh run list -L 5` or `curl -s "https://api.github.com/repos/chefliujmf/gymapp/actions/runs?per_page=5"`.

## XPS (the box)
- `root@100.104.241.95` (Tailscale SSH, passwordless) for root; `jmf@` for non-root. There's a **host node** at `/home/jmf/.local/bin/node` (v24.17.0) — use it for host-side scripts (note: newer node rejects top-level `return` in `node -e`, use `process.exit()`). Container-internal node is `docker exec gymapp[-staging] node -e …`. Data fixes via the live API (`PUT /api/profile/athlete`, `DELETE /api/plan/<id>` with the user's `apiToken`) also remove stray intervals mirror events — prefer that over editing the root-owned `store.json` directly.
- Secrets: **GitHub Secrets are the master** (since 2026-06-23). Two blobs hold the full `auth.env` per env: `AUTH_ENV_PROD` + `AUTH_ENV_STAGING`. Deploy jobs inject them (`env: AUTH_ENV`) and `deploy.sh`/`deploy-staging.sh` `write_auth_env()` regenerates the on-box `auth.env` before `docker compose up`. So the box `auth.env` (QA `/home/jmf/gymapp-staging/auth.env`, prod `/home/jmf/gymapp/auth.env`; keys RP_ID, ORIGIN, SEED_*, STRAVA_*, CHAT_HELPER_SECRET) is now a **derived runtime copy**. **Rotate/add a secret:** edit the blob — `ssh root@box 'cat <path>/auth.env' | edit | gh secret set AUTH_ENV_PROD --repo chefliujmf/gymapp` (or set from a local file), then redeploy. `gh secret set NAME` reads stdin — never put secret values in argv. `PROMOTE_TOKEN` (Actions secret) is the promotion PAT, used by `promote-prod.yml` only. Never commit real/weak passwords.
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

## UX/UI changes — ALWAYS research best practice first (HARD RULE, JM directive, reaffirmed 2026-06-23)
**Non-negotiable, every time, no exceptions** (even "tiny" tweaks): BEFORE touching any UX/UI,
**WebSearch current best practice + how leading apps do it** (NN/g, Android/iOS HIG, fitness apps
like Strava/Whoop/Oura/intervals.icu), apply it, and **cite the sources in the reply**. Never guess
or ship from memory. **THEN present 2-3 options WITH ASCII mockups (`AskUserQuestion` `preview`) and
get JM's pick BEFORE implementing — never implement-then-iterate** (see the `options-first` skill +
`show-options-and-mockups-first` memory; JM was burned by the check-in being shipped 4× then rejected).
Established patterns so far:
- **Nav:** ≤5 fixed bottom tabs; overflow → hubs/"More"; adapt CONTENT not structure (multi-sport).
- **Charts:** one-takeaway-per-chart; round-number axes (1/2/5/10); interactive (scrub → value;
  mini-cards update the headline number, not a box); subtle draw-in motion; legible contrast.
- **Explanations:** a tappable **ⓘ** popover (`InfoDot`), tap-to-reveal, <150 chars, dismiss on blur.
- **Date range:** preset chips + a **Custom** option with start/end native date inputs; auto-swap if
  reversed; ≤6 taps.
- **Field save:** autosave + "Saved ✓" (no Save buttons); **Profile vs Settings vs Admin** split.
- **Rating / check-in scales:** touch targets **≥44px (iOS) / 48dp (Android)** — a 10-button row
  spanning a phone width busts this (~30px). For 1–10 granularity prefer a **slider** (Whoop-style)
  or a segmented control with adequate targets; 1–5 is the mobile default (lower cognitive load,
  data-quality diff vs 1–10 is trivial). Keep 1–10 only when mirroring an external score (e.g.
  intervals.icu sleep score) — and then fix the touch ergonomics.
Charts live in `src/charts.tsx` (TrendChart/BarChart/PowerCurveChart/InfoDot/ChartModal, dependency-free SVG).

## Build / deploy gotchas (learned 2026-06-23)
- **Check the build EXIT CODE, not just "✓ built in".** `npm run build` = `tsc -b` + `vite build` THEN a workbox/PWA precache step that can FAIL *after* vite prints success. Grepping only for "built in" hid an `exit 1`. Use `npm run build >/dev/null 2>&1; echo $?` or `npx tsc -b` for a pure typecheck.
- **Local build can fail while CI is green:** LOCAL has the full synced catalog → bundle ~6.3MB trips workbox `maximumFileSizeToCacheInBytes` (now 12MB in vite.config); CI builds a SMALLER catalog (scraped `downloaded_pages/` is gitignored/absent) so it stays under. **Never claim "the deploy didn't ship" without `gh run list --branch dev`** — I wrongly told JM fixes weren't deploying when CI was green.
- **Every `dev` push auto-redeploys QA → a ~10-20s Bad-Gateway window** (rapid pushes can auto-cancel an in-flight deploy). While JM tests, **BATCH commits**. Hard-reload (Cmd+Shift+R) clears the cached error / updates the autoUpdate SW.
- **In-app Promote-to-prod** needs `GH_PROMOTE_TOKEN` (a PAT with **Actions: write**) as a LINE INSIDE the `AUTH_ENV_STAGING`/`_PROD` blob (the server env) — distinct from the `PROMOTE_TOKEN` Actions secret used *inside* `promote-prod.yml`. Until added, the button shows "not set"; promotion still works via the Actions tab or `gh workflow run promote-prod.yml`.
- **Button 403 → FIXED IN CODE (2026-06-25, #144):** the old handler POSTed `workflow_dispatch` (needs `actions: write`), but `GH_PROMOTE_TOKEN` = `PROMOTE_TOKEN` has Contents+PRs only → 403. Now `/auth/promote-prod` does what `promote-prod.yml` does **directly** — open/reuse a dev→main PR + enable auto-merge via the GitHub REST/GraphQL API (Contents+Pull-requests write, which the PAT HAS). So the button no longer needs `actions: write` and no PAT change is required. (The standalone `promote-prod.yml` workflow + `gh workflow run` still exist as the other path.)

## Local dev server — keep it RUNNING (JM hit "can't connect / 500" ~4× in one session)
- A 500 / "Something went wrong on our end" / "Firefox can't connect 5173" in **dev** almost always = **the backend isn't running**, NOT a code bug. Vite (5173) proxies `/auth`→`localhost:8088`; with no API there it returns a text/plain 500 → the client shows its generic fallback. My changes are client-only unless `server/` changed, so suspect "not running" first.
- `npm run dev` now runs api+web with `concurrently -k --restart-tries 20` (self-heals an api hiccup); `dev:web` = frontend-only. It must stay in its own terminal — if JM closes it, 5173/8088 die.
- **When working WITH JM in a session, keep a persistent dev server up for him:** start `npm run dev` as a REAL background task (`run_in_background: true`), NOT `( npm run dev ) &` inside a one-shot Bash call — that child gets reaped when the call returns, leaving the ports dead and JM unable to connect (caused repeat reports). Verify with `curl -s -o /dev/null -w '%{http_code}' localhost:5173`.

## "When you change X" (from CLAUDE.md)
Any `server/*` change rebuilds the image (CI smoke-tests the module graph). New `/api`|`/auth` route → update `server/openapi.json`. User-facing batch → add to `src/notifications.ts`/releases. Keep `UX-BACKLOG.md` + memory current (the user stresses this).
