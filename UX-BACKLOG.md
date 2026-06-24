# Platyplus — backlog (UX + ops)

Everything captured from product direction. ✅ done · ⬜ todo.
Tackle UX roughly top-down; the calendar is the centerpiece most items hang off.

## 📌 Latest decisions & feedback (capture — keep current)

**Design rule (overriding):** built for **non-technical end users**. Owner does one-time
setup (OAuth app, callback domain, creds); **users only ever tap "Connect"** — never
register apps, paste keys, or set domains.

- ⬜ **Strava activities view** — surface the user's recent rides/runs in the app
  (read; only for users who've connected). Pull is capped to `STRAVA_LOOKBACK_DAYS`
  (default 14 = testing; final window TBD). **APPROVED — build.**
- ⬜ **Strava workout push (OPT-IN)** — a "Share to Strava" button on the finish
  screen, **only shown if the user connected Strava, only fires when they tap it**.
  Never automatic. **APPROVED — build.**
- ✅ **Strava Connect** — per-user OAuth, one app (QA+prod), read_all+write, logo, done.
- ⬜ **Chatbot / AI** — Owner: **Claude CLI on the XPS** (app proxies to `claude`, no API
  key in app). Other users: **BYO-AI** — punch in their own **Claude / OpenAI-Codex /
  Gemini** creds, per-user on their account. (NOT the build-a-shared-API-bot approach.)
- ⬜ **Anti-scrape / anti-download of MY content** (re-stressed, important) — users must
  not be able to scrape or download the self-hosted media. Deter download + screenshots
  (signed/expiring URLs, range-only, obfuscation, no-download attrs already added). True
  DRM is hard; raise the bar meaningfully.
- ⬜ **intervals.icu "Connect" button** — needs OAuth creds **requested from the intervals
  dev** (not self-serve). Until then, key-paste (friendlier UX shipped). For public launch.
- ⬜ **Profile vs Settings split** + section nav (see below).
- ✅ **Coach chatbot** built + working on DEV (locked-down `claude -p` + per-user MCP + chat UI).
  ⬜ **Stream the reply** (token-by-token, requested) · ⬜ take live on QA/prod (bridge container→host `claude`, bake in `mcp/`) · ⬜ per-user coach name (Tadej/Bert).

**✅ Shipped THIS session (dev→QA→prod where noted):** QA on its own public domain
(`platyplus-qa.duckdns.org`) + EnvBadge DEV/QA/PROD · **CI-gated deploys** (reusable
workflow) · dev API fix (SEED_EMAIL) · **History shows real exercise names + edit + Today
access** (was "Exercise 1,2") · **Strava per-user Connect** (read_all+write, one app QA+prod,
logo, 2-wk configurable cap) · friendlier intervals key UX · **usernameless passkey login**
+ password fallback · **typed notification center** (Release/Reminder/Coach/System labels) ·
**intervals ATP-filter + ride-dedupe** (`cleanEvents`, ⬜ verify on QA) · **QA secured to the
prod password** + staging secrets moved to gitignored `auth.env` (no weak pw in public repo).

## 🔎 AUDIT (full-chat review) — gaps now captured + status corrections

**Were MISSING from the backlog — now added/done:**
- ✅ **Tab favicon = old yellow dumbbell** (recurs without hard-refresh). Cause: Firefox's
  sticky SVG-favicon cache. Fix on dev: added a **PNG** `rel=icon` + bumped `?v=3` (PNG busts
  reliably). Deploy to prod to fix it there too.
- ✅ **Back arrow too tiny** → proper **44px** tap target (`.back`/`.back-btn`) — UX best practice.
- ✅ **Today "Suggested fuel/reset"**: had **no Add** + arbitrary picks → added **Add-to-day**
  button + **training-aware logic** (higher-protein on workout days). FUTURE ⬜: coach-driven
  suggestions (by the day's load/goals).
- ✅ **Loud env badge** (DEV orange frame / QA purple / PROD clean) so envs aren't confused.
- ⬜ **QA access method is PIVOTING**: tailscale-serve (tailnet) doesn't work for you because
  **AirVPN + Tailscale MagicDNS conflict** (MagicDNS breaks your internet). Moving QA to a
  **public DuckDNS subdomain + NPM** (like prod) so phone+Mac work, AirVPN-safe. Container
  already rebound to `8089`; **blocked on DuckDNS mgmt site being down** (prod domain still resolves).
  Desktop stopgap: `/etc/hosts` line → the `.ts.net` name on the Mac.

**Status CORRECTIONS (were ⬜, actually DONE this session):** Admin page · Today editable
items · one-format mobile-first · calendar default-view = Profile pref (Week) · day-detail
distinct panel · substitute/delete discoverable on all entries · remove "(indoor)" tag ·
generic device labels · Dev API (`dev:full`) · Calendar centerpiece (built) · Gym
workouts-first (built). (Inline ⬜ markers below may lag — these are DONE.)

**Confirmed STILL OPEN (correctly ⬜):** Strava/activity push · dev avatar photo · chatbot ·
BYO-AI/BYO-Strava · profile schema + onboarding (audio STT, fr-CA/fr-FR/en-CA/en-US) ·
monitoring routine · unified media manifest · release-notes bell · gym refinements
(time-estimate, reorder, add/skip-set, swipe, anti-download) · coach gen quality
(warm-up/cool-down, group-by-equipment, Pallof both sides) · Today "done" state ·
intervals/Strava source linking · profile-gating in cyclingcoach · Centris/checkcheck.

## 🧭 Profile vs Settings (UX)

- ⬜ **Split Profile and Settings.** Profile = the person (avatar, name, account, passkeys,
  connections like Strava/intervals). A separate **Settings** page for small config (API
  tokens, units, diet, video stills, etc.). Add a little **table-of-contents / section nav**
  to the right of Profile so it's not one long scroll. Decide the split (what lives in
  Profile vs Settings) — judgement call.

## 🔗 intervals.icu sync — clean up what shows as a "workout"

- ⬜ **Filter the ATP / Annual Training Plan entries** out of the day/today view. The coach
  writes these to intervals as a *representation/target*, not an executable session — they
  should never appear as something to "do" in Platyplus. Detect by category/type (ATP is not
  a `WORKOUT`) and exclude from the gym/ride execution list.
- ⬜ **De-dupe multiple bike rides on one day** — the sync is surfacing several rides where
  there should be one. Pick the canonical event (e.g. the coach's `[gymapp]`/structured one,
  or latest by `external_id`) and hide the rest. Reference: `fetchGymPlans` / `parseGymWorkout`
  in `src/plan.ts` + `src/intervals.ts`.

## ⭐ Session-4: FIRST REAL GYM USE (live feedback — highest priority)

### Gym player (the live workout screen) — fixes SHIPPED to dev/QA
- ✅ **Set tracking**: per-set tracker row (✓ done / ▸ current / tap to edit). (Add-set / skip /
  reorder + a full JetFit-style table = ⬜ refinement below.)
- ✅ **Weight field bug** fixed: carry-forward is now a PLACEHOLDER, not a value fallback that
  refilled on clear; Done-set falls back to it if left blank.
- ✅ **Switching exercise** now resumes at the first un-done set (was always set 1).
- ✅ **kg ↔ lbs toggle** in the log bar (live, units preference).
- ✅ **Rest timer between sets** — always a countdown (default 75s when coach didn't set one).
- ✅ **Whole-workout timer** now uses REAL elapsed time (done screen + log); live ⏱ in header.
- ✅ **Bigger/brighter ‹‹ ›› controls**. (Video follows the exercise — StageVideo keys on src.)
- ✅ **Video pause** (tap) + **'Stills only' Profile preference**.
- ⬜ **Pre-workout time estimate** — total + per-exercise (reps × time-under-tension).
- ⬜ **Reorder exercises before starting**; **add-set / skip-set** in player; full set TABLE.
- ⬜ **History back-nav**: open history → back → dumped to exercise 1 (should return to position).
- ⬜ **Pallof press both sides** during the workout (coach/data — fix via coach/MCP).
- ⬜ **Dedicated swipe gesture** to change exercise (currently arrows + dots).

### Video / media
- ⬜ **Centr video resolution is poor** — source quality; consider re-encode / better source.
- ⬜ **Anti-scraping / anti-download**: videos are currently downloadable. Deter download +
  screenshots of self-hosted content (signed/expiring URLs, range-only, obfuscation — note:
  true DRM is hard; aim to raise the bar).

### Coach (cyclingcoach / via the new MCP) — generation quality
- ⬜ **No warm-up / cool-down** in generated workouts.
- ⬜ **Group similar exercises** by equipment so you don't move around (e.g. all dumbbell+bench
  together — stay at the bench), when it doesn't compromise the workout goal.
- ⬜ **Pallof press both sides** should be represented.

### Today / status
- ⬜ **Once a workout is done, Today's plan should show it as DONE** (completed state).

### Intervals / Strava linking
- ⬜ **No visible link** between what Platyplus pushes and the intervals/Strava activity. Unsure
  Platyplus pushed anything. Normally one workout shows multiple **sources** at the bottom
  (Wahoo, Strava…). Verify the push + the planned↔completed↔source linkage (ties to the
  unbuilt activity-push / TCX item).

### Infra: QA/staging env + release notes (explicit ask)
- ✅ **QA/staging environment** — `gymapp-staging` container on the XPS, served HTTPS on the
  **tailnet only** via `tailscale serve` → `https://jmf-xps-13-9343.tail8ece92.ts.net` (no public
  exposure, passkeys work, isolated data/accounts, seed `jmfiset`/`stagingpass`).
  `npm run deploy:staging` (Mac) + **auto-deploy on every `dev` push** (`deploy-staging.yml` on
  the runner). **3-env CI/CD: CI on all pushes/PRs · dev push → STAGING · main merge → PROD.**
  Loud **env badge** (DEV/QA frame; PROD clean) so you never confuse them. Flow: dev → QA
  (validate on phone) → PR → prod.
- ⬜ Future: a public staging subdomain (DuckDNS+NPM) only if non-tailnet testers ever need it.
- ⬜ **Release notes in-app**: a **bell icon top-right** (notification center) listing new
  features per release — NOT a popup. User manages/reads notifications there.

## Calendar (the centerpiece) ⬜
- Big, modern, **close to Google Calendar**: Day / Week / Month / Year / Schedule
  views; clean event blocks; today highlighted.
- Everything (workouts, rides, runs, meals, mind) is an **event on a day**. The
  calendar replaces the "Day 1/2/3" framing.
- Current calendar feels empty/sparse — needs density + polish.

## Gym ⬜
- **Flip the model: workouts first, exercises second.** Land on workouts: either
  **select an existing workout** or **build one**.
- **Workout builder**: build a workout WITHOUT assigning a day; **save & reuse**
  it any number of times (library of reusable workouts). NOTE: `WorkoutBuilder.tsx`
  exists — review/extend it for the reusable-template flow.

## Ride & Run ✅ (built)
- ✅ **Builder for rides + runs** (`RideBuilder`, shared): segment editor (minutes +
  %FTP/threshold, ramps, reorder), preset blocks, live profile preview + total.
- ✅ Reusable like gym workouts: saved to `rideTemplates` (Dexie v5); "My rides/runs"
  library on the Ride/Run tabs (play/edit/delete); listed in the calendar Add sheet.
- ✅ "Save & add to a day" → `calApi.savePlan` (lands on calendar/Today, playable).
- ⬜ FUTURE: true intervals.icu push as a structured `workout_doc` (currently saves as a
  local coach plan via `/auth/plans`; the player runs it. Intervals mirroring = same work
  as the Strava-push item — encode segments → provider).

## Eat (meals) ✅ (built)
- Show a **list of meals** (drop Day 1/2/3 — the calendar handles days).
- **Create / add new meals.**
- **Meal packs**: pre-packaged breakfast / lunch / snack "packs" (like a day's
  set) that roll up **kcal + protein** for the pack. (User specifically likes this.)
- **Assign meals + snacks to days** (via calendar / add-to-calendar).
- **Shopping-list generator**: for selected days (or a full week), consolidate a
  shopping list from assigned meals **+ snacks**.

## Recipes / Mind (quick wins) — DONE
- ✅ Recipes **list back-arrow**.
- ✅ Recipe detail **add-to-calendar / assign a day** (`AddToCalendar`).
- ✅ Mind detail **assign to a day**.

## Today — DONE
- ✅ "Coming up" now renders **after** all of the day's items (training, fuel, mind).

## Cross-cutting UX ⬜
- Consistent "add to calendar → pick day" affordance across recipes, mind,
  workouts, rides, runs.
- Reusable-template concept shared by gym/ride/run workouts and meal packs.

## Infra / ops (the dev + maintenance asks)
- ✅ Self-hosted media (100% CDN-independent, gate-enforced) + B2 scrape.
- ✅ Dockerized behind auth-gateway; compose; logging (rotated) + healthchecks.
- ✅ Nightly encrypted backup + weekly data sync to Drive; RESTORE.md; CLAUDE.md.
- ✅ Swagger (`server/openapi.json`) documents session `/auth/*` too — keep in sync.
- ✅ Local dev (`npm run dev`, media proxied from prod) — see DEV.md.
- ⬜ **Dev API**: run `server.js` locally (`npm install` in `server/`) with isolated
  dev data + `localhost` origin, so dev has its own API/Swagger/passkeys, no prod writes.
- ⬜ **XPS staging stack**: parallel `*-dev` containers + dev subdomains
  (`platyplus-qa.duckdns.org`, NPM + cert) for full prod parity incl. passkeys.
- ✅ **CI**: `.github/workflows/ci.yml` — `npm ci && npm run build` on push dev/main + PR→main.
- ✅ **One-command deploy**: `npm run deploy` (`scripts/deploy.sh`) — build → rsync → compose
  up --build → **healthcheck gate**. Mac mode + on-box `DEPLOY_LOCAL=1` mode.
- ✅ **GitHub-triggered CD (self-hosted runner) — BUILT & validated.** Merge to `main` →
  `deploy.yml` on the XPS `xps-runner` (systemd) restores the synced 3.6 MB catalog →
  `build:app` → local deploy → healthcheck. (Earlier "unfit" note was wrong: the build needs
  only the 3.6 MB catalog, not the 24 GB raw scrape — and the media's already on the XPS.)
  Re-scrape → `npm run sync:catalog` to refresh the XPS catalog.
- ✅ **Branch protection on `main`**: requires `build` CI check + PR, enforced for admins.
  Promotion is now PR-based (`gh pr create -B main -H dev` → CI green → merge → `npm run deploy`).
- ⬜ **Monitoring routine**: scheduled check of `docker ps` health + `docker logs`
  to maintain the PWAs and act on issues (logs already set up for this).
- ⬜ **Unified media manifest**: single inventory of every self-hosted asset
  (images+audio+video) for integrity (currently only the video manifest exists).

## Productizing the coach (engine vs profile) — for non-technical new users ⬜
The cyclingcoach repo conflates two things; splitting them is what makes the coach sellable:
- **ENGINE (shared IP, you maintain in git):** coaching logic, skills, knowledge base, books,
  periodization/nutrition rules, exercise library. SAME for everyone (or per-sport). A new user
  NEVER touches this. It's the product's moat.
- **PROFILE (per-user DATA, app-managed):** sport, goals, experience, FTP/maxes, days/week,
  equipment, constraints, injuries, preferences. Today this is `codex_coach/athlete_profile.md`
  (a file). For a new user it must become **structured app data**, not a repo file.

**Don't fork the engine for the wife.** One polyvalent engine, made safe two ways:
(1) **profile-gating** — new capabilities (female-physiology, strength focus) only ACTIVATE for
matching profiles, so JM's profile (cyclist/male/FTP) never triggers them → his plans can't
change by adding her modules (additive + gated = no regression by construction);
(2) **golden-plan regression tests** — snapshot JM's current plan outputs; on every engine
change, regenerate + diff against the snapshot, fail on unexpected change. (cyclingcoach already
has `tests/`.) Two engines = double maintenance + divergence; the `bertfitnesscoach` full-clone
should slim toward shared-engine + her PROFILE/books, not a second engine.

A new user adapts the coach through **two in-app surfaces, zero GitHub/Claude:**
1. **Guided onboarding / profile** (structured form/wizard, no AI): answers → profile record
   in the app DB. This replaces editing `athlete_profile.md`. (Profile SCHEMA = later.)
   - Surfaced **both** at **first sign-in** (onboarding) AND under **Profile** (editable anytime).
   - **Audio answers** option (not just typing): speech-to-text, **quality matters**. Must
     support **fr-CA, fr-FR, en-CA, en-US**. (Whisper-class STT for quality; Web Speech API is
     the cheap fallback. STT engine TBD — fits the BYO-AI/subscription decision.)
2. **Conversational coaching** (the chatbot, via the MCP): "focus on my deadlift", "I travel
   next week", "knee hurts" → coach updates profile + adjusts plans via MCP tools. Replaces
   editing instruction files.

At plan-time: **engine (fixed) + this user's profile (injected) → plan.** Knowledge "books"
stay the product's shared brain; optional power-user uploads later (your wife's case), never required.
Build path: (a) profile schema + onboarding wizard in-app; (b) MCP **read** tools
(`get_profile`, `get_history`) to pair with the existing write tools; (c) coach engine reads
profile from the app instead of a repo file. This is the bridge from "dev-authored coach" → SaaS.

## User assistant chatbot (subscription-powered, NOT API) ⬜
Goal: in-app assistant that helps the user — receive feedback, **create workouts/meals,
adjust the plan** — by natural language. Audience = **me + wife only**. If ever sold,
swap the engine to the paid Anthropic API per-user (assets change anyway).

**Engine = headless Claude Code on the XPS, using the Claude *subscription*** (the
existing `claude login` OAuth — no API billing). The chatbot must **never modify the app**.
- The guardrail is the **toolset**, not the prompt. Run `claude -p` with a **deny-list**
  (`--disallowedTools "Bash,Edit,Write,Read,Glob,Grep,WebFetch"`) and an **allow-list of
  ONLY a custom MCP server** (`--allowedTools "mcp__gymdata__*"`). It is then structurally
  incapable of touching `server.js`, the filesystem, shell, or other users.
- **`gymdata` MCP server** (small Node MCP, ~100 lines) exposes typed, user-scoped tools,
  each validated server-side against the authenticated user's `store.json`:
  `create_workout`, `add_meal`, `adjust_plan` (add/remove that user's calendar items),
  `build_shopping_list`, `log_feedback` (append to a feedback log I review later).
- **Backend**: `POST /auth/chat` in `server.js` → spawns the locked-down `claude -p`
  (stream-json), passes the logged-in user's id into the MCP env so tools are scoped to them.
  Per-user session continuity via `--resume <sessionId>` keyed by account.
- **Frontend**: simple chat panel (own route or a sheet); streams replies; shows when the
  bot took an action ("Added Strength Day to Thu").
- **System prompt** (polish only, not the boundary): "You help THIS user manage THEIR own
  training & nutrition data via the provided tools. You cannot modify the app, access other
  users, or run code. Decline anything outside that."
- **Per-user assistant profile (like the `cyclingcoach` project)**: tie a profile to each
  user so the assistant adapts to *them*. Holds: **objectives**, **primary sport** (cyclist
  vs runner vs other — not everyone is a cyclist), and **personal adaptation docs/"books"**
  the user provides (e.g. my wife uploads references so it accounts for her being a woman).
  These get injected as the assistant's per-user context/system material, mirroring how
  `cyclingcoach` structures a coached athlete. Store per-account, server-side; the `gymdata`
  tools + this profile together define that user's assistant.
  - **Coach persona name** is per-user, editable from the **Profile page**. Defaults:
    JM → **Tadej**, wife → **Bert**. Store as an account setting (`coachName`); the chatbot
    addresses itself by it. (Profile field is inert until the chatbot exists, so deferred.)
  - **MCP is also the COACH↔app channel (not just the user chatbot).** Today the coaches
    (cyclingcoach, bertfitnesscoach) push workouts by writing free-text into an intervals.icu
    event description (`[gymapp] 1 rounds • Name [id] — 4x8 • …`). Parsing free text is fragile
    — it already broke once (inline vs newline → empty workout; fixed defensively in
    `parseGymWorkout`). The real fix: the same `gymdata`/`platyplus` MCP exposes typed tools
    (`create_workout({date,rounds,exercises:[{exId,sets,reps,weight}]})`, `create_ride`, …);
    coaches CALL them instead of emitting text. App stores canonically + mirrors a pretty
    description to intervals for display only. One MCP serves chatbot + coaches + BYO. The
    `encodeGymWorkout`/`parseGymWorkout` text format stays as the intervals *mirror*, not the
    source of truth. (Don't over-invest in hardening the text format — MCP replaces it.)
  - ✅ **BUILT (on dev, not yet prod): Platyplus MCP** (`mcp/server.js`) — 10 typed tools
    (search_exercises, create_workout/ride/run, schedule_meal/mind, add_note, list_schedule,
    remove_*) over the Coach API. Coach API extended: token-authed `/api/items` (meal/mind/note)
    + `/api/exercises` search (catalog mounted at `/catalog`). openapi → v1.2.0. End-to-end
    tested (MCP → create_workout → stored plan w/ canonical intervals mirror). Wire into a coach
    repo via `.mcp.json` with its Coach API token (see `mcp/README.md`). Defensive text parser
    fix also shipped (inline `[gymapp]` + PlanDetail fallback).
  - **Brain repos already exist**: JM → `chefliujmf/cyclingcoach`; Bert →
    `chefliujmf/bertfitnesscoach` (scaffolded 2026-06-19 from cyclingcoach, see its
    `ADAPT.md` — still needs profile/sport/woman-specific adaptation). The chatbot's
    per-user context should source from the matching brain repo.
- Caveat to honor: subscription = personal use + one shared rate-limit pool (5h windows).
  Fine at 2 users; do NOT open to real users on the subscription — that's the API trigger.
- **If sold → BYO-AI (multi-tenant)**: let each new user connect **their own** AI in
  account settings — Anthropic **Claude**, OpenAI **Codex**, or Google **Gemini**
  (subscription OAuth or pasted API key, stored per-account, server-side). Abstract the
  engine behind a `provider` interface (`claude` | `codex` | `gemini`) so the same
  `gymdata` tool layer drives whichever model the user linked; the owner's personal
  subscription stays the default only for me + wife. Each user runs on their own quota/billing.

## Content & licensing (for the SELL path) ⬜
- ⬜ **Sellable exercise content** (from msg 44 "free to use and sell"). The current library is
  **scraped Centr / MuscleWiki** — great for personal use, **NOT licensed to resell**. For the
  SaaS path the library must be **public-domain / licensed**.
  - ✅ source chosen by user: **`github.com/yuhonas/free-exercise-db`** (public-domain, ~800+
    exercises with images + instructions). **Integrate it**: map its schema → our catalog,
    **add exercises not already present**, self-host its images through the media pipeline
    (build-catalog gate). Prefer free-db entries as the resell-safe set; keep scraped ones only
    for personal/me+wife builds.
  - ⬜ **ExerciseDB** (`github.com/exercisedb/exercisedb-api`) — 11k+ exercises with
    **videos/GIFs**. ⚠️ AGPL is the API *code*; the GIF/video MEDIA is the paid ExerciseDB
    dataset → **commercial: NO/CHECK** (resale unclear). Data not in the repo (need to
    self-host the API / source the dataset). Good for PERSONAL use only — but we already
    have MuscleWiki+Centr videos. Resell-safe demo set stays free-exercise-db (stills).

  - ❌ **NOT resell-safe (assessed):** Centr, MuscleWiki, ExerciseDB *media*,
    **muscleandstrength.com** (proprietary commercial content, no open license).
    Personal use only — never in the sold product. Resell-safe = free-exercise-db (exercises),
    TheMealDB (recipes, attribution+verify), CC audio sources.
  - ⬜ **Recipes** → **TheMealDB** (free recipe API + images; verify commercial terms /
    attribution). Replace scraped Centr recipes for the resell set.
  - ⬜ **Meditation / audio** → **Freesound.org** (CC0 / CC-BY, filter by license),
    **Free Music Archive**, **Pixabay Music**, **Incompetech** (Kevin MacLeod, CC-BY), **mindfulnessexercises.com/audio-library** (free guided meditations).
    Verify EACH track's license; store attribution. Replace scraped Centr meditation audio.
  - ⬜ **Rides / runs** (LOW priority — no images/video, and the coach generates its own):
    **GoldenCheetah** (open-source, shared workout libraries) + free GitHub `.zwo`/workout repos
    for a starter indoor-ride set. Same for running. The ride/run BUILDER (already built) covers
    the rest.
  - ⬜ **BYO streaming for meditation/workout audio**: let a user link **Spotify** / **Tidal**
    (OAuth) in settings and play from their own account (no licensing burden on us). The **MCP /
    coach** picks suitable tracks/playlists (calm/ambient for meditation, tempo for workouts).
    Same BYO pattern as BYO-AI/BYO-Strava.
  - ⬜ Build an **attribution/credits** surface for CC-BY assets (required by those licenses).
- ⬜ **Anti-scraping / anti-download** of our own served media (already noted under Video/media).

## Deferred (non-Platyplus, from earlier in the session)
- ⬜ Daily **Centris scrape** on the XPS for new houses + **push to Pixel** if found.
- ⬜ `exp1-checkcheck-review` (Croissant climate review) on the XPS (needs HA on LAN).

## Session-2 feedback (captured live)
- ✅ Calendar: Day/Week/Month/Schedule (no Year), single-column mobile-first, side-by-side reverted.
- ✅ Calendar entries: Remove + Substitute (swap) + quick-add-multiple (sheet stays open, Done).
- ✅ Gym add = catalog workouts + saved templates (not exercises); images optimized (~5MB→~100KB).
- ⬜ **Admin page**: split "Admin · Users" out of Profile into its own admin-only page.
  Keep it SIMPLE + admin-focused (no workout features); admins just get access to it.
  Mobile-first: user cards, role badges, "+Add user" sheet, per-user actions sheet
  (reset / change role / remove) with confirmations. Coach API token stays in Profile.
- ⬜ Today page: events should be modifiable (show ASSIGNED items, allow delete/substitute),
  not just auto-suggestions. Reuse the calendar entry pattern.
- ⬜ One format for all: mobile-first single column everywhere (no desktop-only layouts).

## Session-3 feedback (captured live)
- ✅ Train: removed sample-workout feature; search bar moved to **top**; **Workouts on the
  LEFT**, Exercises on the right (seg toggle, both pages).
- ✅ Week strip: current day no longer cut off on phone (`flex:1; min-width:0`).
- ⬜ **Substitute/Delete not discoverable "in any pages"**: today the swap/remove buttons
  only exist on calendar entries that are coach-plans or items — **intervals `event`
  entries (the cycling ATP rides) have none**, so the user sees no way to edit them.
  → (a) make the buttons **visibly obvious** on entries that support them; (b) add
  edit/remove to the **Today** page entries; (c) decide intervals events: either allow
  "substitute" (add a replacement alongside) or a real delete via `/icu` DELETE — and say
  *why* coach-pushed rides can't be removed locally when they can't.
- ⬜ **Calendar default view = a Profile preference** (user wants **Week**, not Month).
  Currently persisted to `localStorage 'calView'`; move the default into profile settings.
- ⬜ Day-detail above the grid should read as a **distinct section** (heading/separator) —
  "not obvious it's a different section."
- ✅ **Dev identity "DE" fixed**: the vite-dev AuthContext was short-circuiting real auth with
  a mock `{dev, dev@local}`. Dev now authenticates against the real backend → shows real
  **jmfiset** (login `jmfiset` / `devpass`). Mock only on a true no-backend network error.
- ⬜ **Dev avatar photo**: still empty in dev (shows "JM" initials). The photo lives only in
  prod; to mirror it either re-upload in dev Profile, or copy the prod store's avatar when we
  have XPS/prod access. Not fakeable from the Mac.
- ✅ Substitute/Remove on **every** calendar entry incl intervals events (writes back via
  `/icu` DELETE) **and** on the **Today** page; calendar deep-links via `?d=&v=`.
- ⬜ Calendar **default view = Profile preference** (user wants **Week**); set in Profile.
- ✅ Month day-detail reads as a **distinct panel** (bordered card + spacing).

## Ride / Strava / devices (session-3 cont.)
- ⬜ **Remove the "(indoor)" tag** shown on rides.
- ⬜ **Push rides properly to Strava** — **NOT built yet.** Today `RidePlayer.finish()` only
  calls `logWorkout()` (local Dexie progress log); nothing leaves the device. Proper path:
  1. **Record the live stream** during the ride (power/cadence/HR + time) — currently shown
     live but not stored.
  2. **Build a `.TCX` or `.FIT`** from that stream (sport, start time, name, samples).
  3. **Upload**: either to **intervals.icu** (`POST .../activities` or file upload, which can
     forward to Strava) **or** directly to **Strava** via OAuth upload API. Pick based on which
     provider the user linked (ties into BYO-Strava below).
  4. Verify it lands with correct **sport/type/name** and the structured-workout association.
- ⬜ **BYO Strava (multi-provider activity source)**: a user may not use intervals.icu at all
  — let them **link their own Strava** (OAuth) in account settings as an alternative source/
  sink for activities. Same provider-abstraction idea as BYO-AI: `intervals | strava | …`.
- ⬜ **"Can't see / use Bluetooth HR during a bike workout"** (session-5). Code is correct:
  `pairDevice` filters the `heart_rate` service, the provider tracks HR + bpm, and the
  RidePlayer **setup** phase renders the device panel. Likely causes to confirm + fix:
  1. **Web Bluetooth is Chrome/Edge-only** (NOT Firefox or Safari) + needs HTTPS. If the
     user opens a ride in **Firefox**, the panel shows "use Chrome or Edge" and there's no
     pairing. → confirm the browser; make the unsupported message LOUD; recommend the
     installed Android PWA / Chrome.
  2. **Pairing only exists in the ride SETUP phase** — no way to add/see devices **during**
     the ride. → add a device affordance in the ride phase too.
  3. **No HR in the GYM player at all** — strength workouts can't show HR. → decide whether
     to add BLE HR to GymPlayer.
- ⬜ **Ride device pairing labels are too specific**: we added "HR" + "Trainer".
  - HR can be a **chest strap OR a watch** (Garmin, Coros, Apple Watch, …) — don't assume a strap.
  - Trainer **brand is unknown** (Wahoo/Tacx/Saris/…) — keep it generic.
  → Use neutral labels ("Heart rate", "Trainer / power") + a generic device icon; show the
  actual advertised device name from the Web Bluetooth/ANT pairing rather than a hardcoded brand.

## Recipe data cleanup (build-time) ⬜
- ✅ render-time: RecipeDetail strips HTML/entities (<p>, &deg;, &nbsp;) + drops junk tags
  (HCO, "AU/UK/US COMPLETE!"). ⬜ also clean at SOURCE in build-catalog so stored data is clean
  (and the calendar/Today meal titles too). Likely moot once recipes move to TheMealDB.

## Substitute should be type-locked ⬜
- ⬜ **Substitute must keep the same type/slot**: workout↔workout, meal↔meal, meditation↔meditation
  (and ideally same time). Today the swap opens the full Add sheet (any type). Fix: in replacing
  mode, lock the AddSheet to the replaced entry's type (hide the type picker).

## New categories: Yoga + Pilates ⬜
- ⬜ Add **Yoga** and **Pilates** as categories (exercise buckets + Train filters + build-catalog
  category mapping; today stretching→Mobility).
- ⬜ **Free yoga/pilates content** (videos/images) — RESEARCH commercial-safe sources: Wikimedia
  Commons (CC), free-exercise-db stretching subset, open yoga-pose datasets, Pexels/Pixabay video
  (free license). Verify each + record in content-manifest with commercial flag. (free-exercise-db
  has no yoga/pilates set, so this needs a new source.)

- ❌ **Yoga with Adriene / DoYogaWithMe**: free to WATCH but **copyrighted by the creators** —
  NOT resell-safe (commercial redistribution = infringement). Personal-use only (and YouTube embeds
  conflict with our self-hosted independence). Resell-safe yoga = CC/public-domain only (still TBD).

## More content sources triaged (session-5)
- ⬜ **Wger** (`wger.de`, CC-BY-SA 4.0) — 855 exercises + 357 images. **Resell-safe WITH
  attribution + share-alike.** Incremental (overlaps free-exercise-db/MuscleWiki; few demos).
  Integrate via API like free-exercise-db IF we want more breadth; record license_author for SA.
- ❌ **Pilates.com / video.pilates.com free workouts** — Balanced Body copyrighted video → NOT
  resell-safe (personal only).
- ❌ **exerciselibrary.com** — commercial/copyrighted → NOT resell-safe.
- ⚠️ **Resell-safe PILATES + YOGA content is still UNSOLVED** — none of the above fill it.
  Need true CC0/CC-BY: Wikimedia Commons, Pexels/Pixabay video (free license), open pose datasets.

- [ ] Real per-workout/ride imagery as card background (currently sport-themed gradient + logo overlay stopgap)

- [ ] Free CC meditation audio: Tibetan singing-bowl / chant / "world peace" tracks (Freesound CC0, Free Music Archive, Pixabay Music). Self-host + manifest. (user request)

## 🗓️ 2026-06-23 session — captured (do later)

**Planning source-of-truth — cyclingcoach must author INTO Platyplus, not intervals.**
- Today cyclingcoach publishes plans DIRECTLY to intervals.icu (`tools/intervals_icu_workouts.py`)
  because the Platyplus→intervals push currently omits `time_target` (Wahoo needs it). So Platyplus
  is NOT yet the single master for *planning* — dual-writing to intervals causes conflicts/dupes.
- ⬜ **Migrate cyclingcoach → publish to Platyplus** (`tools/publish_platyplus_plan.py`) as the ONLY
  authoring surface; Platyplus fans out to intervals→Wahoo. **Blocker:** add `time_target` to the
  Platyplus→intervals event push so Wahoo rides are complete. Until then, do NOT push planned
  workouts from Platyplus (cyclingcoach owns intervals directly). [Root cause of the 2026-06-23
  "delete them" — Platyplus re-push conflicted with cyclingcoach's direct intervals events.]

**Train — filters & sorting (workouts + exercises).**
- ⬜ Filter + sort **Workouts AND Exercises** by **equipment**, **time/duration**, **intensity**.
- ⬜ **Settings → equipment list** (what the user owns) to power the equipment filter.

**Check-in.**
- ⬜ History: once all 3 logged, collapse the Today card to a one-line summary; full history in Logs.

**Nav.**
- ⬜ Train back-arrow — root tab (no back by design); revisit only if reached via a hub.

**intervals.icu — indoor completion.**
- ⬜ Confirm an indoor-completed Platyplus workout reaches intervals labeled clearly (FIT→Strava→intervals).

## 🗓️ 2026-06-23 — Coach plan-authoring → Platyplus (DESIGN LOCKED, building Phase 1)

**Architecture:** Platyplus = single MASTER for planning. cyclingcoach (and every BYO-AI)
authors INTO Platyplus via the MCP/Coach-API; Platyplus **mirrors to intervals.icu**
(workout steps + a rendered rich description, WITH the meal/mind references + both why-levels)
and to Wahoo. Retire cyclingcoach's direct intervals publish (`tools/intervals_icu_workouts.py`
→ pure renderer Platyplus calls). Add `time_target` to the Platyplus→intervals ride push (Wahoo).

**Plan view (universal shell + sport-specific body):**
- Shell (all sports): 🎯 Objective · 🍽️ Fuel · 🧠 Mind · 🛌 Recovery · ✓ Success · 💬 Cues.
- Body swaps: Ride/Run → power/pace profile + "Ride/Run now"; Gym → exercise list (sets×reps,
  equipment, demo) + Start; Yoga/Pilates → guided class (duration/flow) + Start. **Run ≈ Ride.**

**Fuel/Mind — referencing, not duplication (one source = the day's calendar items):**
- Meals & mind stay separate calendar items (`schedule_meal`/`schedule_mind` → `/api/items`),
  surfaced INLINE in the plan (no jump). On Today they show once (plan chips); the algorithmic
  "Suggested fuel/reset" sections only appear when nothing's scheduled.
- **Meal chips = a 2-COLUMN GRID, not horizontal scroll** (mobile-friendly, all visible, scales).
- **`fuel.meals` is a VARIABLE-LENGTH array** — count is the COACH's call from its nutrition
  knowledge base (e.g. strength days → more frequent protein feedings ~0.4 g/kg ×4–5; endurance →
  fewer/bigger carb meals). Don't hardcode breakfast/lunch/dinner/snack.
- **Two why-levels:** section *strategy* on the plan (`fuel.why`=Pre/During/Post+supplements,
  `mind.why`=mental-focus theme) shown via section ⓘ; per-pick *reason* on each item
  (`schedule_meal/mind` gain `why`), shown on the item's recipe/session page ("Coach's pick: …").
- **Mobile-first "why" (NOT inline expanding slabs):** per-pick why → on the recipe/session PAGE;
  section strategy why → a bottom SHEET (slide-up). Nothing expands inline.

**Coach enablement — replicate the `search_exercises` pattern for food & mind:**
- `search_exercises`→`create_workout` ALREADY works (coach picks exercises, builds, assigns).
- ADD `search_recipes` + `search_sessions` MCP tools (mirrors) so the coach picks REAL recipes +
  meditation/yoga/pilates classes by id, then `schedule_meal/mind(refId, why)`.
- Extend `create_ride/create_workout/create_run` + `schedule_meal/mind` with the structured fields
  (objective, cues[], success, recovery, fuel{why,supplements}, mind{why}, per-item why).
- Update the coach instructions + BYO-AI MCP descriptions: author via Platyplus, SELECT content
  from the catalog, fill the why's, variable meal count from theory, per sport (author ride/gym;
  SELECT a class for yoga/pilates). cyclingcoach `AGENTS.md` + cycling-coach SKILL updated.

**Mockup (clickable, multi-sport toggle):** `gymapp/mockups/plan-view.html`.

**Phase 1 build (in progress):** server schema (plan structured fields + item.why) → planToIcuEvent
render+time_target → PlanDetail UI (grid chips + sheet why) → recipe Coach's-pick banner →
MCP (search_recipes/search_sessions + structured fields) → cyclingcoach publisher + instructions.

## 🗓️ 2026-06-23 — Check-in (SHIPPED to QA)
- Emoji faces 💀😩😐😀🤩 (obvious+funny), 1–5, ALWAYS visible (no collapse — gets skipped).
  "Soreness"→"Freshness" so all rows read higher=better (stored soreness inverted server-side).
  Compact; picked face = green pop, others dim. Fixed ⓘ popover clipped by card overflow.
- TODO: history (collapse-when-done on Today + list in Logs).

## Process rule (JM, 2026-06-23): OPTIONS + MOCKUPS FIRST
Before any UX change: research best practice, then present 2–3 options WITH mockups (HTML render
when it helps) and get the pick BEFORE building. Never implement-then-iterate. (Memory:
`show-options-and-mockups-first` + skill `options-first`.)
