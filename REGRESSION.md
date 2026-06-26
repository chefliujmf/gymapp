# Regression queue — test one by one

The honest list of things **JM reported** that are broken or unverified. Each has a
**unit test** (committed → `npm test`, the permanent regression net) and/or a **manual
test** (steps + expected). JM verifies **one at a time**; only JM marks ✅.

**How to run the automated net:** `npm test` (unit, `src/*.test.ts`) · `npm run test:smoke`
(API integration, `scripts/smoke-test.mjs`). Status: ❌ broken · 🔧 fixing · 🧪 fixed +
test, awaiting JM · ✅ JM-verified.

---

### R1 · #72 — ride thumbnail flat blue 🧪
**Bug:** card thumbnail (MiniProfile) didn't show the green endurance middle; didn't match the detail.
**Root cause:** thumbnail coloured by segment AVG, detail by MAX; `zoneColor` recovery/endurance boundary was 60% (Z2 starts at 56%).
**Unit test:** `src/zones.test.ts` → `npm test` — 56% = Endurance, `segPower` = peak, Saturday = `Recovery/Endurance/Recovery`.
**You test (manual):** QA → Today/Plan → the "Saturday Recovery Spin" card thumbnail.
**Expected:** thumbnail reads **blue / green / blue** (green endurance middle), same as the detail profile.

### R2 · #139 — desktop can start a ride 🧪
**Bug:** the "▶ Ride now" button is tappable on desktop; rides are mobile-first (or sensor-bridge).
**Unit test (planned):** `src/ride.test.ts` → `canPlayHere(false)` is false at desktop width; `canPlayHere(true)` is true.
**You test (manual):** on a **desktop** browser (no bridge), open a ride plan.
**Expected:** no actionable "Ride now" — shows "Open on your phone"; on mobile it works normally.

### R3 · #146 — Today "Add" jumps to the Calendar ❌
**Bug:** tapping Add on Today navigates away to /plan instead of adding in place.
**Test:** manual (navigation).
**You test:** on the **Today** tab, tap **Add**.
**Expected:** the Add sheet opens **on Today** (you stay on Today; URL doesn't switch to Plan).

### R4 · #147 — feedback choices don't match intervals ❌
**Bug:** post-workout fields/choices differ from intervals.icu's custom fields (Legs After has 6 opts; Life Constraint + Mental State missing).
**Unit test (planned):** `src/feedback.test.ts` → `FIELDS` equals the intervals field/option set.
**You test:** open post-workout feedback for a ride.
**Expected:** the fields + choices match what intervals shows (Legs After = strong/normal/tired OK/barely tired/heavy/sore, + Life Constraint, Mental State, …).

### R9 · #148 — "Add → Search gym" list is empty ❌
**Bug:** picking Gym in the Add sheet shows blank lines, no workouts.
**Unit test (planned):** the gym-list builder returns a non-empty list for the catalog.
**You test:** Plan → Add → **Gym**.
**Expected:** a searchable list of gym workouts/templates.

---

### Built but UNVERIFIED (I marked done without you testing — please confirm)
| R# | What | You test | Expected |
|---|------|----------|----------|
| R5/#137 | Check-in only showed for today | On Today, pick a **past** day in the strip | that day's check-in shows |
| R6/#140 | Calendar Day snapped to today | Go to another day, leave + come back | the day is preserved |
| R7/#141 | Route had no map tiles | Import a `.fit` with GPS | route on a real OSM map |
| R8/#142 | Imported-file fields editable | Import a file | metric fields are read-only |

> **Discipline (now permanent):** every fix lands with a test here + in `src/*.test.ts`; `🔨 built ≠ done`;
> only JM marks ✅ after the manual step passes. See `CLAUDE.md` → Testing, skill `platyplus-testing`,
> memory `platyplus-testing-workflow`.
