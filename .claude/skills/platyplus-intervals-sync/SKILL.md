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

## Diagnostic recipe (read-only — ALWAYS inspect real data, don't guess)
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

## When you change the sync, also
- Keep `server/icu-match.js` pure (no side effects) so `src/icu-dedup.test.ts` can unit-test it; add a case.
- Any `server/` change rebuilds the image (CI smoke-tests the module graph) — `node --check` first.
- Keystone (#185) — BUILT 2026-06-23 (cyclingcoach commit fc6082c): the external cyclingcoach no longer
  publishes planned workouts to intervals directly. It authors ONLY into Platyplus via
  `tools/publish_platyplus_plan.py --file <plans.json> --prune` (Coach API `POST /api/plan`); Platyplus is
  the sole author and mirrors to intervals → Wahoo (`planToIcuEvent` emits `time_target`+`workout_doc`).
  `intervals_icu_workouts.py` is reads-only now. So new dupes shouldn't form; if a stale plan lingers, the
  coach's `--prune` (or removing it IN Platyplus) clears it. Still open: #157 pushed-text polish.
