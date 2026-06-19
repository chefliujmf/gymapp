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

## Ride & Run ⬜
- A **builder for rides** (structured power/interval) and the **same for runs**,
  reusable like gym workouts. (Pushes to intervals.icu via `/auth/plans`.)

## Eat (meals) ⬜
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
- ⬜ **Dev account mirror**: dev shows initials "DE" + no avatar; copy prod display name +
  avatar so dev looks like the real account (dev store is intentionally isolated).
