# Regression queue — JM-reported, NOT verified done

The honest list of things **JM reported** that are broken or unconfirmed. Each gets a
**test** (unit via `npm test` / regression via `npm run test:smoke` / manual steps), then
JM verifies **one by one**. Status: ❌ broken · 🔧 fixing · 🧪 fixed+test, awaiting JM · ✅ JM-verified.

| # | Item | Test | Status |
|---|------|------|--------|
| R1 (#72) | Ride **thumbnail** (MiniProfile on cards) is flat blue — doesn't show the green endurance middle. Root cause: thumbnail colored by seg AVG, detail by seg MAX, **and** zoneColor put recovery/endurance boundary at 60% (Z2 starts at 56%). | unit: `src/zones.test.ts` — 56% = Endurance, segPower = peak, Saturday = blue/green/blue | 🧪 |
| R9 (#148) | **"Add" sheet → "Search gym…" is EMPTY** — no gym templates or catalog workouts to pick. | manual: Add → Gym → list shows workouts | ❌ |
| R2 (#139) | Desktop can still tap **"Ride now"** — the button isn't gated (only the player is). Must be mobile-only (or sensor-bridge). | unit: `canPlayHere` false on desktop/no-bridge; component: button shows "Open on your phone" | ❌ |
| R3 (#146) | **Today "Add"** navigates away to the Plan/Calendar page instead of adding in place on Today. | manual: on Today, tap Add → sheet opens ON Today (URL stays) | ❌ |
| R4 (#147) | Post-workout **feedback choices** don't match intervals.icu's custom fields (Legs After has 6 opts; missing Life Constraint + Mental State). | unit: PostWorkout FIELDS == the intervals field/option set | ❌ |
| R5 (#137) | Check-in shows only for **today**, not the selected WeekStrip day. (built, unverified) | manual: pick a past day on Today → its check-in shows | 🧪 |
| R6 (#140) | Plan/Calendar Day **snaps back to today** after navigating. (built, unverified) | manual: go to another day, leave + return → day preserved | 🧪 |
| R7 (#141) | Route shows as a bare line — **no map tiles**. (added Leaflet/OSM, unverified) | manual: import a .fit with GPS → route on an OSM map | 🧪 |
| R8 (#142) | Imported-file fields should be **read-only**. (built, unverified) | manual: import a file → metric fields are disabled | 🧪 |

> **Process from here on:** each fix lands with its test; JM runs `npm test` + the manual step;
> only JM-verified items become ✅. No "built = done" anymore.
