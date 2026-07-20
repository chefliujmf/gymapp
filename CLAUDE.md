# Platyplus (gymapp) — maintenance guide for Claude

Read this before changing anything here. It lists the invariants and the
"when you change X, also update Y" rules so nothing drifts.

## ▶ CURRENT WORK QUEUE — start here
**`FEEDBACK-LOG.md`** is the single, numbered, statused source of truth for what JM
has asked for and where we're at (✅ done · 🔨 building · ⬜ todo). **Any session: read it
first, work the OPEN queue top-down, to the T**, unless JM says otherwise. Append every new
feedback/idea there (numbered) on receipt. Design detail for big items → the **🎨 Design reference**
section of `FEEDBACK-LOG.md`. (FEEDBACK-LOG.md is now the SINGLE backlog + design + test guide —
UX-BACKLOG.md and REGRESSION.md were folded into it.)

**ALSO read JM's LIVE in-app TRIAGE (#438/#440).** JM (and any user, via the top-bar report button) triages
the backlog inside the app (Admin → Backlog): per item # a **status** (review/todo/build/totest/pass/fail/
done/discarded), **priority**, **type** (bug/feature/idea/chore), **comments**, plus **app-added items** and
**user bug/idea reports**. ⚠️ **The overlay lives in ONE SHARED FILE — `/srv/backlog/backlog.json` — bind-mounted
into BOTH the prod AND QA containers from the host `/home/jmf/backlog-shared`. It is ONE backlog for ALL environments
(JM directive: prod + QA are NEVER separate backlogs).** `{triage, added}`. NOT `app_meta` (that Postgres field is a
DEAD legacy store the app IGNORES — reading/writing it silently does NOTHING; JM lost a whole session to this). The item
LIST is generated from `FEEDBACK-LOG.md` (`scripts/build-catalog`… → `scripts/build-backlog.mjs` →
`src/data/generated/backlog.json`, rebuilt each deploy). **Each session, read the overlay via the API `GET
/auth/admin/backlog`** (which reads the shared file), or on the box `cat /srv/backlog/backlog.json`. **WRITE it only via
`PUT /auth/admin/backlog/:n`** (or edit `/srv/backlog/backlog.json` on the box), then **VERIFY the write landed by
reading it back** — NEVER `app_meta`. Let it STEER the queue: **his status OVERRIDES my .md status** (esp. Done = his ✅
sign-off; `review` = a fresh user report; `fail` = re-work top priority), **his priority OVERRIDES top-to-bottom order**,
skip discarded, and FOLD his comments + app-added items into the numbered entry here (so the .md stays authoritative).
See memory `platyplus-admin-backlog` + skill `verify-before-ready`.

## ▶ TESTING & VERIFICATION — HARD RULE (JM directive 2026-06-26)
JM lost trust because I shipped "built" code that didn't work. The fix is non-negotiable:
1. **LOG FIRST.** Every report → `FEEDBACK-LOG.md` (numbered) *before* touching code. Don't fix-then-forget.
2. **`🔨 built ≠ done`.** Compiling/deploying is NOT verified. Only **JM marks ✅** after testing on QA.
3. **Every fix ships with a test.** A unit test in `src/*.test.ts` (`npm test`, vitest) when the logic is
   pure; otherwise a `scripts/smoke-test.mjs` row and/or a **manual step in the 🧪 Test guide section of
   `FEEDBACK-LOG.md`**. The test is the permanent regression net — write it, run it green, commit it.
4. **The 🧪 Test guide section of `FEEDBACK-LOG.md`** is the live "test one-by-one" guide: per item =
   unit test file + JM's manual steps + expected result + status. Keep it current.
5. **Mock-first for anything JM sees** (skill `options-first`), and **trace the real flow / check the
   source of truth** (e.g. do these choices match intervals?) — not just "does it compile?".
6. **PRIORITY + PIPELINE (JM 2026-07-10 — supersedes the old 10-at-a-time batch):** BUGS are worked by the
   **autonomous XPS worker** (`scripts/bug-worker.sh` + systemd timer on the box), **NOT this chat** — see memory
   `platyplus-bug-worker-architecture`. This chat = **features/ideas/ideation**. Worker pick order (JM 2026-07-11, exact): **PRIORITY first
   (HIGH>MED>LOW), then Tested-Failed before Bugs within each priority, then OLDEST # first** — so a high-priority
   bug outranks a low-priority fail (buckets: fail·hi → bug·hi → fail·med → bug·med → fail·lo → bug·lo); **bugs only** (never features/ideas). **The ORDER MINDSET stays even when we polish items HERE in the chat, not
   just the worker (JM 2026-07-11 "order mindset stays"): work highest-priority + oldest first, no ad-hoc cherry-picking.** It keeps a small
   **rolling `totest` buffer** (cap 5) on QA and goes **ONE-BY-ONE**, not a batch of 10. **PROMOTE = per item, gated
   on "Tested Success" (`pass`):** JM tests on QA → flips an item to `pass` → promote **that item alone** with
   **`scripts/promote-item.sh <N>`** (cherry-picks its commit onto a branch off `main` → prod PR → CI build-gates
   auto-merge → `deploy.yml` ships prod), then mark **`done`**. **NEVER promote wholesale dev→prod** — dev carries
   untested worker fixes + infra that must not ride along (JM directive: "don't promote dev→prod without testing +
   approval"). `fail` ⇒ the worker reworks it (top priority). Fix what's BROKEN first — **ALL bugs before ANY
   feature/idea**. Many "open" `todo` bugs are already fixed (verify the `#NNN` code ref + test, then flip to
   `totest`) — reconcile, don't re-fix. ⚠️ The Mac (this chat) and the worker BOTH push `dev` → always
   `git fetch && rebase` before pushing (the worker does this automatically since the #5003 push-race). **Assess RELEVANCE when reviewing ANY item
   (bug or feature, JM 2026-07-09): old items may reference removed/redesigned features → `discarded`, don't work
   them.** `todo` = JM's parking bucket (don't auto-work it). Batch status flips so my writes don't race JM's
   live triage on the shared backlog file.
See skill `platyplus-testing` + memory `platyplus-testing-workflow` + `platyplus-admin-backlog`.

## Architecture (how it runs)
- One Node container (`gymapp-auth`, `server/server.js`): serves the built SPA,
  handles **password + passkey auth** (own `store.json`), proxies intervals.icu,
  and serves **self-hosted media** at `/media/*` from a mounted volume.
- Runs on the always-on XPS via `docker compose` (`docker-compose.yml`).
- Public at `https://platyplus.duckdns.org` via NPM (HA Green). Passkeys bind to
  that exact domain (RP_ID) — the TLS cert MUST match it.
- Deploy = **3-env CI/CD** (see DEPLOY.md): CI on every push/PR; `dev` push → **QA/staging**
  auto-deploy. **Prod promotion = one click** (repo → Actions → "Promote to prod" → Run workflow,
  AFTER testing QA): `promote-prod.yml` opens/reuses a `dev`→`main` PR and enables **auto-merge**, so
  it ships once the protected-branch `build` check passes → `deploy.yml` (push:`main`, CI-gated)
  deploys **prod** via the XPS self-hosted runner (`build:app` + synced catalog). So: push `dev` →
  test on QA → Run workflow → prod. Auth = Actions secret `PROMOTE_TOKEN` (fine-grained PAT, Contents+PRs
  write, configured **no-expiration** → set-and-forget; a PAT's PR triggers the `build` check, `GITHUB_TOKEN`'s
  would not). Repo "Allow auto-merge" on. `npm run deploy` = Mac hotfix path.

## INVARIANT: 100% media independence (do not break)
- The catalog must contain **zero** third-party media URLs (Centr, MuscleWiki,
  jwplayer/jwplatform, JOIN/digitaloceanspaces, drive.google). Everything is a
  `/media/...` path served from our XPS, or dropped (UI shows an emoji).
- `scripts/build-catalog.mjs` enforces this with an **independence gate** that
  FAILS the build if any third-party media URL appears. Never weaken it.
- Scope: the gate is about **bundled CATALOG media** (videos/images/audio). A
  **runtime map service is NOT catalog media** — the route maps (`RouteMapLeaflet`/
  `FlybyMap`, #141/#51) load **OpenStreetMap tiles** live (free, no key); that's
  allowed and does NOT trip the gate. Don't "fix" it by ripping out the map.
- Media lives on the XPS at `/home/jmf/gymapp/media/{video,audio,images/...}`
  (served via the `./media:/srv/media:ro` mount). Catalog paths must match the
  on-disk layout.

## When you change X, also update Y
> **Propagate every improvement to ALL impacted layers (JM directive 2026-07-04).** When you improve a
> capability, don't stop at the UI — trace it through and update each layer it touches: the **API**
> (`server/server.js` + `server/openapi.json`), the coach's **MCP tools** (`mcp/server.js` → **sync to the
> host**, see below), the coach **instructions** (`server/coach-engine*.md`), and your own **skills / memory /
> agent prompts**. (Why: on 2026-07-04 the host MCP was found ~a week stale — #313/#341/#343/#332 tools
> never reached the coach because nothing syncs `mcp/`. Don't let a layer drift.)

| Change | Also update |
|--------|-------------|
| **Add/change ANY UI, color, component, badge, chart, or highlight** | **APPLY THE THEME PALETTE — always** (JM 2026-07-19). Use the CSS tokens in `src/styles.css` `:root` (`var(--accent)` green=primary/active/success, `--danger` red, `--amber`/`--warn`, `--cyan` info/device/rest), **never invent a hex** (an off-theme blue `#3d7bff` slipped into the gym grid). Pick the token by MEANING; match `rgba()` tint hue to its token. Skill **`platyplus-theme`** + memory `platyplus-theme-palette`. |
| Add/modify any `/api/*` or `/auth/*` endpoint in `server/server.js` | **`server/openapi.json`** (the Swagger spec at `/api/docs`) — keep it in sync. If a coach **MCP tool** calls it, update `mcp/server.js` too (next row). |
| **Add/modify a coach MCP tool** (`mcp/server.js`) or **the host chat-helper** (`chat-helper/server.mjs`) | **HOST-ONLY components — sync to `/home/jmf/platyplus-chat/` on the XPS.** `scripts/deploy.sh` now does this automatically on **prod deploy** (rsyncs `mcp/` + `chat-helper/server.mjs`, restarts the coach services when the helper changed) — but nothing else does, so for a hotfix outside a promote, sync by hand (`rsync … xps:/home/jmf/platyplus-chat/{mcp/,server.mjs}`, `node --check`). Was ~1 wk stale before this (#350/#352). MCP is spawned fresh per chat (no restart); the **chat-helper needs a `systemctl restart platyplus-chat platyplus-chat-prod`**. Both QA(:8089)+prod(:8088) share ONE mcp dir + one helper. ⚠️ The coach `systemPrompt` (~128 KB) is passed via `--append-system-prompt-file` (a temp file), NOT argv — never revert to `--append-system-prompt <string>` (Linux 128 KiB argv cap → E2BIG crash, #352). Keep tool behaviour in step with the `/api/*` it calls + `coach-engine*.md`. |
| **Add a file/module under `server/`** | nothing to hand-list — `server/Dockerfile` does `COPY *.js` so it's baked in; CI builds + **smoke-tests the server image** (module-graph check). Any `server/` change **rebuilds the image** (not just `dist/`) — make sure that CI step is green before merge. (A missing-COPY once crash-looped prod.) |
| Add a new media source/type | `scripts/build-catalog.mjs` self-host fn + gate; download via `scripts/fetch-missing-media.mjs`; upload to the XPS `media/` and redeploy |
| **Add/replace content** (exercises, recipes, audio) | **`CONTENT.md`** — the runbook: importer → build-catalog (free-first de-dup) → host images + `npm run sync:catalog` → `content-manifest` (license/commercial) → deploy |
| **Ship a user-facing batch to prod** | add a block to **`src/data/releases.ts`** (the in-app "What's new" bell) |
| Change how media is referenced | re-run the build; confirm the **gate is green** |
| Change deploy/infra/containers | **`RESTORE.md`** and this file |
| Change the build pipeline | `scripts/*` stay consistent (`build-catalog`, `fetch-missing-media`) |
| New UX feature using the calendar | use `calApi` (`src/calendar.ts`); document new endpoints in openapi.json |
| **Add a sport the coach should know** | add a row to `SPORT_ENGINES` in `server/server.js` + a `server/coach-engine-<sport>.md` (ONE engine per sport — cycling=FTP power, running=Daniels pace, **strength=1-RM/%1RM zones + GOAL-DEPENDENT volume + concurrent-training**, #534; gated by `user.sports`). Strength engine is **sport+goal-adaptive**: `inferGymFocus(mainSport+objective)` → gym focus (endurance main sport → *support*/maintenance, never "low"); `# GYM FOCUS` tail block feeds it the athlete's main sport + objective. `coach-engine-strength.md` is hand-maintained (NOT written by `sync-coach-engine.mjs`). See `docs/strength-coaching.md` + memory `platyplus-gym-engine`. |
| **Change run/ride pace mapping** (`PACE_ANCHORS`) | keep `server/icu-steps.js` **and** `src/running-paces.ts` IN SYNC; anchors are DERIVED from the Daniels curves in `running-paces.ts` (not hand-guessed) — re-verify + update `src/icu-steps.test.ts`. Easy/recovery is enforced by `clampEasyEfforts` (both files' guard) |
| **Change how a planned workout maps to intervals** (`planToIcuEvent`, `plannedTss` in `server/icu-steps.js`) | intervals does **NOT** compute planned load for externally-created (API) workouts — we compute Coggan **TSS** (`plannedTss`, FTP-independent: the % IS the IF) and set `ev.icu_training_load` so intervals does Form/CTL/ATL out-of-the-box. Keep it consistent with the client `plannedLoad` (`src/workout-summary.ts`); update `src/icu-steps.test.ts`. Backfill existing plans via `POST /api/plans/resync`. (#372) |
| **Coach must respect max sessions/day** | enforced 3 ways, keep in sync: dynamic prompt (`buildSystemPrompt` `# ONE SESSION PER DAY`), daily-adapt msg, and the **server 409 guard** in `upsertPlan` (rejects a NEW **or MOVED** coach session onto a full day — combine into that day's id or move it). The cap is the PURE `planCapViolation` (`server/plan-cap.js`, unit-tested `src/plan-cap.test.ts`) — it EXCLUDES the plan's own id so a MOVE is checked vs the OTHER sessions there (#5014: the old inline guard only fired on CREATE, so a coach MOVE onto a full day stacked two). MCP `create_ride/run/workout` descriptions say so too. `user.info.maxPerDay` (default 1). (#371/#5014) |
| **Coach must respect max training-days/WEEK (HARD cap)** | `user.info.trainingDays` is a HARD weekly ceiling (JM #454), enforced the SAME ways as maxPerDay — keep in sync: dynamic prompt (`buildSystemPrompt` `# WEEKLY TRAINING DAYS — HARD CAP`), daily-adapt msg, **server 409 guard** in `upsertPlan` (rejects a session on a NEW day once the Mon–Sun week already has `trainingDays` days — move/combine, never add past the cap), MCP `create_ride/run/workout` descriptions, and Profile copy (`Availability.tsx` — "a hard cap … never more"). NOT "base + optional bonus" anymore. |
| **Change how profile BASICS sync with intervals** (height/DOB/sex/weight/city) | it's **TWO-WAY** (#268/#1003/#459): READ = `syncAthleteProfile` fills `user.info` from the athlete record fill-if-empty (on connect + session load); WRITE = `PUT /auth/profile` maps the CHANGED fields via `athleteBasicsPatch` (`server/sport-settings.js`, cm→metres · sex male/female→M/F · dob passthrough) and `PUT /athlete/{id}` (partial merge, verified). ⚠️ **The write-back is PROD-ONLY — guard every intervals write with `!IS_STAGING`** (QA+prod share i28814; a QA write corrupts the real account). Keep both directions + the unit tests (`athleteBasicsPatch` in `src/sport-settings.test.ts`) in sync; the client Profile reads/writes `user.info.heightCm`/`user.info.dob`. |
| **Per-user intervals athlete (NEVER fall back to the seed i28814)** | the client reads its intervals athlete from a device-local `icu_athlete_id` that DEFAULTS to the seed athlete i28814 → a shared/unsynced browser leaks JM's data to another user (#453, Xenia saw JM's activities). Fixes: the **server `/icu` proxy FORCES `/athlete/<id>` to the authenticated `req.user.icuAthlete`** (authoritative) and **409s an athlete-scoped call when the user has no athlete**; the client `syncIcu` (AuthContext) ALWAYS writes the current user's athlete. **#456 (JM directive): NO per-user path may default to i28814** — the `\|\| 'i28814'` fallback was removed everywhere except the admin SEED (`server.js` ~67/80). A missing athlete must **BLOCK + report an error**, never read/write the seed calendar (that's how dupes/corruption happen): `pushPlanToIcu`/`reconcileFromIcu`/`deleteIcuEvent`/`findIcuEventsForPlan` bail, endpoint `icuKey` guards also require an athlete. Don't reintroduce a per-user i28814 default. |
| **Coach weekly LOAD** (`weeklyLoadBudget` in `readiness.js`, `buildSystemPrompt` `# WEEKLY LOAD BUDGET`, `coach-engine-cycling.md`) | it's a BAND, not a ceiling: flat ×7 / build ×9 / hard ×11 / cap ×12 of CTL. A productive build must dip Form into the **green zone (-10 to -20)** — too easy (grey >-8) AND too hard (past cap / Form <-25 without a named overload block) are both wrong. CTL stashed in `/auth/readiness`. Keep the multiples + the green target in sync across all 3. (#375) |
| **Change cycle / PREGNANCY repro-state** (`server/cycle.js` `phaseFromHistory`/`pregnancyStage`, `buildSystemPrompt` `# CYCLE PHASE`/`# PREGNANCY` blocks, `coach-engine-female.md §6`, Profile `CycleFields`) | female-only. Cycle phase is DERIVED from the last PERIOD marker in 60-day wellness (intervals only stamps the START day, #422). **PREGNANCY OVERRIDES the cycle** (#427): `info.pregnant` → `/auth/readiness` sets NO cyclePhase + the prompt emits `# PREGNANCY` (week/trimester from EDD/LMP) INSTEAD of `# CYCLE PHASE`. 🔒 **ABSOLUTE PRIVACY: never write pregnancy/trimester in any title/description/plan name** (syncs to Strava) — rule in the block + coach-engine privacy + female §6 + `set_activity_text`. Profile "Cycle & pregnancy" toggle sets `info.pregnant`. Keep all pure fns unit-tested (`src/cycle.test.ts`); evidence in `docs/pregnancy-coaching.md`. |
| **Change how the coach writes an activity's PUBLIC title/description** (`set_activity_text` MCP + `coach-engine.md` "TITLE stays human, DESCRIPTION goes scientific" + `sync-coach-engine.mjs`) | TITLE = human/creative (Strava style, KOM/Local Legend ok); DESCRIPTION = plain-with-personality, NOT a physiology lecture NOR a dry data line, do NOT repeat numbers already on the activity, NO em-dash, never mention pregnancy. Source repo `../coach-engine-src` regenerates `coach-engine*.md` (not in workspace) → re-apply there on a manual `sync-coach-engine`. Memory `platyplus-coach-public-text-voice`. (#425) |
| **Change intervals↔Platyplus sync** (`reconcileFromIcu`, `icuEventToPlan`, `planToIcuEvent`) | **Platyplus OWNS the plan — it wins for CONTENT *and* the DAY (#588, SUPERSEDES #380's "intervals-move-wins").** Users must not manipulate the plan in intervals: a MOVE of a Platyplus-origin event there is REVERTED (`userMovedPlatyplusPlan` → re-push to the owned date via `pushPlanToIcu`, prod-only); events carry a "📋 Planned in Platyplus — edit it there" label (stripped on import so it never accumulates). An intervals-ORIGIN plan still adopts its own moves. (intervals has no per-event read-only lock via the athlete key, so this revert-on-sync IS the enforcement; `.ics` subscription was rejected — it's read-only but loses structured head-unit workouts, and JM needs those on his Garmin.) GYM has no intervals model → never re-import our own gym events (they carry the "Open in Platyplus" link → skip, else empty shell, #377). Nothing DERIVED may persist in `plan.notes` — strip on every compose AND import: the auto deep-link (`stripPlatyplusLinks`, #378) AND the native workout text (`stripDerivedWorkout`, #388 — else a 1h ride doubled to ~2h in intervals). ⚠️ QA + prod share the real athlete i28814 → **`IS_STAGING` makes QA READ-ONLY toward intervals** (`pushPlanToIcu` skips + `dailyAdaptTick` returns on staging; only PROD writes). Never let prod compute `IS_STAGING=true` (it'd stop mirroring) — it's derived from the QA `RP_ID`/`ORIGIN`. #381. Push finds a MOVED event by `icuEventId` (any date) so it updates, not duplicates. |

## Readiness engine — our own WHOOP (since 2026-06-26)
Platyplus auto-derives the check-in's **Sleep · Freshness · Energy** as a personal **1–5** from intervals
wellness (CTL/ATL/Form, HRV, RHR, sleep) + the check-in; manual tap always overrides. Research + formulas +
build plan → **`docs/readiness-scores.md`**; operational summary → the **`platyplus-readiness-scores`** skill;
memory `platyplus-readiness-model`. Build the math as a pure, unit-tested `server/readiness.js`. (#158/#159)
- **Menstrual cycle + PREGNANCY (#329/#422/#427, female-only):** cycle phase is DERIVED from the last PERIOD
  marker in wellness (`phaseFromHistory` — intervals only stamps the start day). **PREGNANCY (`info.pregnant`)
  OVERRIDES it** — gates the cycle off and emits a `# PREGNANCY` block (evidence-based, ACOG/Canadian,
  `docs/pregnancy-coaching.md`) with an ABSOLUTE privacy rule (never in any public title/description). Profile
  "Cycle & pregnancy" toggle. `server/cycle.js` (`phaseFromHistory`/`pregnancyStage`), unit-tested.
- **Forecast = MORNING readiness** (`/auth/readiness-forecast`, #365): project planned load for the days
  BEFORE the target only (exclude the target's own session — else a hard day projects its own post-session
  fatigue → false "wrecked"). And **skip non-session events** — an intervals ATP **weekly TARGET** (category
  `TARGET`, e.g. "ATP W06" ~250 TSS/wk) or NOTE is NOT a single-day load (#366). Same filter on `/auth/readiness-projection`.
- **Daily auto-adapt (#367 · #469):** an in-process scheduler (`dailyAdaptTick`, QA/prod, ticks every 30 min) has
  the coach proactively re-plan the rolling **14-day** horizon per athlete's LOCAL tz. **#469 (JM 2026-07-10):
  ONE pass per day, AFTER the athlete has CHECKED IN today** (`user.dailyAdapt.done`) — the old everyday ~4am
  MORNING pass was REMOVED (adapting before the check-in has no readiness context, so it didn't make sense). No
  check-in ⇒ no adapt that day (the next check-in fills/adjusts the horizon). Runtime-message-driven, NOT in
  `coach-engine.md` (keeps the ~128 KB systemPrompt under the argv limit, #352). Manual: `POST /api/coach/daily-adapt`.
  **#439 — SEPARATE focused pass per topic (JM), NOT one giant prompt** (the coach gave each partial attention +
  ran out, leaving the back half of the horizon blank): `runDailyAdapt` runs (1) `dailyAdaptMsg` = adapt the WORKOUT
  plan + fill the horizon — **looped** with `horizonFillMsg` until `horizonCoverage().empty < 3`; (2) `reviewMsg` =
  reviews only; (3) `roundOutMsg` = fuel/mind/recovery only. Reviews + round-out gated ONCE/day (`dailyAdapt.extras`).
  Keep each message SINGLE-TOPIC — don't merge them back into one mega-prompt. (Coach planning is still prod-only via
  `IS_STAGING`; the #463 daily REMINDER runs before that gate, so it fires on QA+prod.)
- **Planned LOAD makes Form real (#372):** the forecast + intervals' own Form only drop when planned sessions carry
  load. intervals does NOT compute it for API workouts, so `planToIcuEvent` sets `icu_training_load` from `plannedTss`.
  Without it a hard week projected FLAT (~-3 Form). Backfill after a mapping change: `POST /api/plans/resync`.

## Tools / scripts (keep current)
- `scripts/build-catalog.mjs` — builds `src/data/generated/*` from `downloaded_pages/`. Self-hosts all media + runs the independence gate.
- `scripts/fetch-missing-media.mjs` — downloads still-images the catalog references but we don't have yet (idempotent).
- `deploy` flow per DEPLOY.md / RESTORE.md.

## Logs & health (for the monitoring routine)
- Containers log to Docker's json-file driver, **rotated** (`max-size 10m`,
  `max-file 5`) — see `docker-compose.yml`.
- Check: `ssh xps 'docker logs --since 1h gymapp'` and
  `ssh xps 'docker ps --format "{{.Names}} {{.Status}}"'` (Status shows healthy/unhealthy).
- Healthcheck hits `/auth/config`. A routine should alert on `unhealthy` or
  error spikes in logs. `monitor.sh` also alarms if the daily `backup-secrets`
  job goes stale (>36h) or fails.
- **PROD (and QA/staging) DOWN = top priority — drop everything, triage now.**
  Read logs, find root cause, fix via the CI/CD pipeline (manual `docker compose
  up --build` on prod is blocked), redeploy, and verify `healthy` + HTTP 200
  before calling it fixed.

## Secrets — GitHub Secrets are the master (since 2026-06-23)
- All app secrets live in **GitHub Actions secrets**, one blob per env: `AUTH_ENV_PROD`
  and `AUTH_ENV_STAGING` (the full `auth.env` contents). The deploy jobs inject them
  (`env: AUTH_ENV: ${{ secrets.AUTH_ENV_* }}`) and `scripts/deploy.sh` / `deploy-staging.sh`
  **regenerate `auth.env` on the box** from that before `docker compose up`. Rotate a token =
  edit the secret, redeploy. The on-box `auth.env` is now a derived runtime copy (the app
  can't read GitHub Secrets directly). The Mac hotfix path leaves it untouched (no `AUTH_ENV`).
- `PROMOTE_TOKEN` (Actions secret) is the prod-promotion PAT — used by `promote-prod.yml` only.
- `VAPID_ENV` (Actions secret, #457) — Web Push keys, its OWN secret (3 lines: `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`). Both deploy scripts append it to `auth.env` (like `GH_PROMOTE_TOKEN`);
  the workflows pass `VAPID_ENV: ${{ secrets.VAPID_ENV }}`. ABSENT → `PUSH_ENABLED=false`, phone push disabled
  (app degrades gracefully). Generate once with `web-push.generateVAPIDKeys()` — STABLE (changing it drops all
  subscriptions). One keypair serves QA + prod.
- When you change `auth.env` keys, update **both** the GitHub Secret blob and this list.

## Data store: Postgres (since 2026-06-23)
- The live store is **Postgres 16** (a `db` service in each compose file; container
  `gymapp-db` prod / `gymapp-staging-db` QA, isolated `./pgdata` volume, NOT
  port-published — reachable only on the compose network). App connects via
  `DATABASE_URL` (`postgres://platyplus:${PG_PASSWORD:-platyplus}@db:5432/platyplus`).
- `server/db.js` is a **drop-in** for the old `server/store.js`: relational tables
  (users + child plans/logs/calendar_items/notifications/coach_reviews/passkeys/
  checkins; FKs, indexes; irregular fields in a JSONB `doc` per row). `loadStore()`
  rebuilds the in-memory `store`; `save(store)` persists transactionally (serialized,
  dedup-guarded). Single instance → in-memory read cache + Postgres durable store.
- **First boot on an empty DB auto-migrates `/data/store.json`** into Postgres (logs
  `Migrated N users … → Postgres`), then keeps the file as a backup. Startup is
  guarded on `DATABASE_URL` so the CI module-graph smoke-test imports without a DB.
- ⚠️ Prod TODO before heavy use: set a real `PG_PASSWORD` + a **nightly `pg_dump`**
  backup (the old nightly `store.json` backup no longer captures live writes).

## Data that matters (backed up)
- **Postgres `pgdata`** — the live store (accounts/passkeys/plans/logs/…); back up via `pg_dump`.
- `data/store.json` — legacy seed, kept as the pre-migration backup (nightly **encrypted** backup to Drive).
- `auth.env` — derived from GitHub Secrets at deploy (still backed up). Media + dist sync separately (weekly/Drive).
