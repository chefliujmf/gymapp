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

## Deferred (non-Platyplus, from earlier in the session)
- ⬜ Daily **Centris scrape** on the XPS for new houses + **push to Pixel** if found.
- ⬜ `exp1-checkcheck-review` (Croissant climate review) on the XPS (needs HA on LAN).
