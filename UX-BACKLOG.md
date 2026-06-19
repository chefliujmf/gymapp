# Platyplus — backlog (UX + ops)

Everything captured from product direction. ✅ done · �doing · ⬜ todo.
Tackle UX roughly top-down; the calendar is the centerpiece most items hang off.

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
  (`platyplus-dev.duckdns.org`, NPM + cert) for full prod parity incl. passkeys.
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
- ⬜ **Ride device pairing labels are too specific**: we added "HR" + "Trainer".
  - HR can be a **chest strap OR a watch** (Garmin, Coros, Apple Watch, …) — don't assume a strap.
  - Trainer **brand is unknown** (Wahoo/Tacx/Saris/…) — keep it generic.
  → Use neutral labels ("Heart rate", "Trainer / power") + a generic device icon; show the
  actual advertised device name from the Web Bluetooth/ANT pairing rather than a hardcoded brand.
