---
name: platyplus-intervals-sync
description: Diagnose + fix the Platyplus↔intervals.icu plan mirror — the push/dedup/delete model, the box-inspection recipe, and the "Platyplus is master" rules. Use for any "duplicate / missing / won't-delete / wrong-text" intervals-sync bug.
---

# platyplus-intervals-sync

How the Platyplus ↔ intervals.icu **plan mirror** works and how to debug it. Reach for this on
any sync bug: duplicates, "in one but not the other", deletions that don't stick, or pushed text
that looks wrong. Code lives in `server/server.js` (`pushPlanToIcu`, `findIcuEventsForPlan`,
`reconcileFromIcu`, `deletePlanById`) + the pure matcher `server/icu-match.js` (unit-tested in
`src/icu-dedup.test.ts`).

## The model (LOCKED) — Platyplus is the MASTER
- **Plans authored in Platyplus** push OUT to intervals as a calendar EVENT (`pushPlanToIcu`):
  rides/runs carry a `workout_doc` (power/pace steps, + `time_target`) so the Wahoo/Coros gets a
  real structured workout; gym → `WeightTraining` + `[gymapp]` text. `external_id` = the plan id.
- **Results** (completed activities) flow the other way and are MATCH-FIRST, never duplicated
  (`/auth/activity/complete`): if a device already logged it in intervals → link; else upload a TCX.
  **No Strava dependency** — Strava only via the athlete's own intervals→Strava forwarding.
- **intervals → Platyplus** is a read MIRROR (`reconcileFromIcu`) for events Platyplus doesn't own.

## Dedup rules (the #150 bugs — get these right)
- An intervals event "is" a plan if `eventMatchesPlan` (icu-match.js): same `external_id` **base**
  (strip the `:YYYY-MM-DD` instance suffix intervals adds on re-push) OR same sport + **fuzzy title**
  — `normTitle` drops a trailing ` #hashtag` suffix (another coach appends e.g. `#Codex Coach`).
  Exact-title matching was the duplicate bug.
- `pushPlanToIcu` is **self-healing**: COLLAPSE events sharing our `external_id` base to ONE (delete
  extras — the `:date` instance copy); **PAST** (date < today) → delete our event, never create
  (Platyplus keeps no past planned events); else update ours / adopt a foreign (other-coach) event
  without duplicating. `icuEventMine` tracks whether WE created it (only delete/overwrite our own).
- **Deletions must happen IN Platyplus** (`⋮ → Remove` → `deletePlanById`). Deleting the event in
  intervals does NOT remove the master plan, and a re-sync RE-CREATES it. (#160)
- Re-sync button = Settings → Connections (`/auth/plans/resync`), reports created/exists/updated/skipped/errors.

## ⚠️ Per-user athlete — NEVER default to the seed i28814 (#453/#456, JM directive 2026-07-08)
Each user reads/writes **their OWN** intervals athlete (`user.icuAthlete`; JM = i28814, Xenia = i628280).
Multi-user, ONE intervals account historically → the code was littered with `user.icuAthlete || 'i28814'`,
so a user with no athlete silently hit **JM's** calendar. Two live bugs came from this: Xenia saw JM's
activities (#453) and the coach could push/delete on JM's calendar (#456). **LOCKED rules:**
- The client picks its athlete from a device-local `icu_athlete_id` that DEFAULTS to i28814 → on a shared/
  unsynced browser it leaks JM's data. The **server `/icu` proxy is authoritative**: it FORCES the
  `/athlete/<id>` segment to `req.user.icuAthlete`, and **409s** an athlete-scoped call when the user has none.
- **NO per-user path may fall back to i28814.** The `|| 'i28814'` default was removed everywhere except the
  admin SEED (`server.js` ~67/80). A missing athlete must **BLOCK + report an error**, never touch the seed
  calendar: `pushPlanToIcu`/`reconcileFromIcu` return `{skipped:'no intervals athlete'}` + log; `deleteIcuEvent`/
  `findIcuEventsForPlan` bail; endpoint `icuKey` guards also require an athlete. Don't reintroduce the default.
- Client `syncIcu` (AuthContext) ALWAYS writes the current user's athlete on login/restore (never leaves a stale one).
- **QA still shares i28814** for JM's account (QA+prod = one intervals athlete for him, #381); Xenia has her own.

## Diagnostic recipe (read-only — ALWAYS inspect real data, don't guess)
**Use the USER's `icuAthlete`, not a hardcoded i28814** (i28814 = JM only; Xenia = i628280).
Inspect the user's PLANS on the box (QA = `gymapp-staging`, prod = `gymapp`):
```
ssh root@100.104.241.95 'docker exec gymapp-staging node -e "import(\"./db.js\").then(async m=>{const s=await m.loadStore();const u=(s.users||[]).find(x=>x.icuKey);for(const d of [\"YYYY-MM-DD\"]){console.log(d);(u.plans||[]).filter(p=>p.date===d).forEach(p=>console.log(JSON.stringify({id:p.id,title:p.title,origin:p.origin,icuEventId:p.icuEventId,mine:p.icuEventMine})))}process.exit(0)})"'
```
Then the intervals EVENTS for that day (key = `SEED_ICU_KEY` in `/home/jmf/gymapp/auth.env`, athlete `i28814`):
```
curl -s -u "API_KEY:$KEY" "https://intervals.icu/api/v1/athlete/i28814/events?oldest=DATE&newest=DATE"
```
Compare: matching `external_id` bases (slug vs slug:date) = a duplicate to collapse; `mine:true` = we
created it; `mine:false` = adopted the other coach's. Custom activity FIELDS (#147) live at
`/athlete/i28814/custom-item` (type `ACTIVITY_FIELD`).

## Athlete STATS sync — per-sport, two-way (#210, since 2026-06-29)
Separate from the plan mirror: the athlete's **per-sport settings** (FTP, max HR, threshold HR,
threshold pace) sync both ways with intervals. Code: pure mapper `server/sport-settings.js`
(unit-tested `src/sport-settings.test.ts`) + endpoints `GET /auth/intervals/athlete` (pull) and
`PUT /auth/sport-stat` (auto-push on edit). UI = Profile → "Your stats" per-sport cards.
- intervals stores these in the athlete record's **`sportSettings[]`** array — one entry per
  sport-GROUP keyed by `types:[...]` (Ride/Run/Swim/…), each with `ftp`, `lthr`, `max_hr`,
  `threshold_pace` (**metres/second**), `pace_units` (display only). We map groups cycling/running/
  swimming; expose run pace as **sec/km**, swim as **sec/100m** (convert at the boundary).
- **VO₂max is NOT an intervals field** → Platyplus-only (`user.vo2max`); running VDOT (`user.runVdot`,
  Daniels, from threshold pace via `src/running-paces.ts`) is also Platyplus-only. Weight comes IN from
  the device (`icu_weight`), shown read-only. Never try to push VO₂max/VDOT to intervals.
- **PUSH uses the per-entry endpoint — NOT the athlete record.** ⚠️ `PUT /athlete/{id}` with
  `{sportSettings}` returns **200 but is SILENTLY IGNORED** (the value never changes); a full-athlete
  PUT is **403**. The ONLY working write is **`PUT /athlete/{id}/sport-settings/{entryId}`** with just
  the changed field(s) — verified on the real account (ftp 263 stuck; `custom_field_values` and every
  other field preserved). Each `sportSettings` entry carries its own `id` (e.g. Ride 172071). Code:
  `icuPatchForGroup(list, group, patch)` → `{id, body}` → per-entry PUT. Get the list from
  `GET /athlete/{id}/sport-settings`. (custom_field_values #147 live INSIDE each entry, so sending
  only the changed field is what keeps them safe.)
- **You CANNOT clear a field to blank via the API:** PUT with `threshold_pace: null` (per-entry OR
  full-entry) returns 200 but intervals keeps the old value — null is ignored. Setting/updating a
  real value works; clearing to empty does not propagate. Treat clear as Platyplus-local-only.
- Debug recipe (real data): inside the QA/prod container, `loadStore()` → user's `icuKey` →
  `fetch /athlete/i28814` → `fromIcuSportSettings(a.sportSettings)`. Don't rely on
  `process.env.SEED_ICU_KEY` (may be empty in-container) — use the **user's stored key**, like the endpoint.

## When you change the sync, also
- Keep `server/icu-match.js` pure (no side effects) so `src/icu-dedup.test.ts` can unit-test it; add a case.
- Any `server/` change rebuilds the image (CI smoke-tests the module graph) — `node --check` first.
- Keystone (#185) — still OPEN, and must be solved **gymapp-side only** (JM 2026-06-27: do NOT modify the
  cyclingcoach repo; a cyclingcoach-side fix was tried then reverted). Design stays "Platyplus is master,"
  but since the external coach keeps publishing some plans straight to intervals (different titles, e.g.
  "Friday Endurance Ride" vs a stale "Friday Ride to Skov"), Platyplus has to be **robust to it**: dedup
  same day+sport on import/render (Platyplus-wins), make `deletePlanById` also clear the matching device
  activity/local log, and let the user remove a stale plan IN Platyplus. Don't rely on changing the coach.
