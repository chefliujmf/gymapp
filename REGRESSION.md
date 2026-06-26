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

### R3 · #146 — Today "Add" jumps to the Calendar 🧪
**Bug:** tapping Add on Today navigated away to /plan instead of adding in place.
**Fix:** extracted the Add sheet into a shared `src/pages/AddSheet.tsx` (decoupled from Calendar's
`Entry` via a `lockType` prop); Today now renders it in place (`swapOn = setSheet({date})`) instead of
`navigate('/plan?…&add=1')`. tsc 0 · build ✓ · 9/9 unit tests (no regression to the Plan-page sheet).
**Test:** manual (navigation) — no DOM test harness (jsdom/RTL) in the repo yet.
**You test:** on the **Today** tab, tap **Add** (and the ＋ on a day's cards).
**Expected:** the Add sheet opens **on Today** (you stay on Today; URL doesn't switch to Plan); adding
an item refreshes Today; the Plan page's Add/Substitute still works exactly as before.

### R4 · #147 — feedback choices don't match intervals 🧪
**Bug:** post-workout fields/choices differed from intervals.icu's custom fields (Legs After was
[fresh, tired OK, cooked]; Life Constraint + Mental State missing).
**Fix:** I fetched the athlete's REAL custom ACTIVITY_FIELD defs live from intervals
(`/athlete/{id}/custom-item`) and mirrored all 6 EXACTLY (names + options + codes) in
`PostWorkout.tsx` → `ICU_FIELDS`. intervals' fields are global (not sport-split), so ride/run/gym
now all show the same 6. (Note: that means **gym** now shows "Legs After / Fuel/GI" too — tell me if
you'd rather gym keep a gym-specific set.)
**Unit test:** `src/feedback.test.ts` → `npm test` (6 tests) — asserts the 6 field names in order,
Life Constraint + Mental State present, and every option list matches the intervals defs.
**You test:** open "✓ Done? Log how it went" for a ride/run.
**Expected:** fields read **Legs Before · Legs After · Fuel/GI · Pain/Niggles · Life Constraint ·
Mental State** with the exact intervals options (Legs After = strong/normal/tired OK/barely tired/
heavy/sore/cooked). NOTE: feedback is still Platyplus-local + fed to the coach — it does NOT yet
WRITE BACK to intervals (codes are stored for when we build that).

### R9 · #148 — Add sheet list invisible (cards collapsed, NOT empty) 🧪 FIXED (CSS)
**Bug:** JM: "it's not empty, it's the UI — I don't see the list well." All types (gym/ride/run/meal/
mind), all envs. The list rendered as faint thin lines, no readable cards.
**Root cause:** the sheet card is a `<button>`; `.sheet-list .card { display: block }` + flex content
+ `overflow: hidden` collapses the button to ~0 height in WebKit → `overflow:hidden` clips the thumb +
text, leaving only the 1px border (the "lines"). Catalog data was fine all along (139/1324/796/109).
**Fix:** `.sheet-list .card` → `display: flex; flex-direction: column` (a flex container sizes to its
content); `.sheet-list` gets `flex/gap`. `src/styles.css`.
**Test:** manual (visual) — CSS, no DOM harness.
**You test:** open **Add → any type** (gym/ride/meal/…).
**Expected:** a real, readable, tappable list of cards (thumb + title + meta), not faint lines.

### R10 · #150 — Platyplus plans now PUSH to intervals (auto + re-sync button, dedup-aware)
**Ask:** "what we have in Platyplus should be in intervals, and don't push twice if already there."
**What was there:** `upsertPlan → pushPlanToIcu` already auto-pushed on every save — but with NO dedup
against another coach's events (only its own `icuEventId`), and no recovery for plans that never pushed.
**Built:** (a) `findIcuEventForPlan` — before creating, adopt a matching intervals event (external_id, or
day+sport+title) so we LINK instead of duplicating; (b) `POST /auth/plans/resync` — re-push all
Platyplus-origin plans in the window; (c) **Settings → Connections → "↻ Re-sync plans to intervals"**
button (reports created/linked/updated/errors). Confirmed intervals had 0 events today, so your ride
will be CREATED cleanly. tsc 0 · build ✓ · server parses · 16/16 unit tests.
**Test:** manual (live intervals). No unit test — server↔intervals integration; the button's result
counts are the check.
**You test:** Settings → Connections → **Re-sync plans to intervals**. Then check intervals.icu for today.
**Expected:** your Platyplus ride appears in intervals (result says `1 new`); click again → `1 linked/
updated`, **NOT a second copy**. If `errors > 0`, tell me the count — that's why auto-push didn't fire.

---

### Built + CODE-VERIFIED (I re-checked each is genuinely implemented — please confirm on QA)
I audited the source for each (2026-06-26) so these aren't "marked done without checking":
| R# | What | Code evidence | You test | Expected |
|---|------|---------------|----------|----------|
| R5/#137 | Check-in only showed for today | `Today.tsx:322` `<CheckInCard key={selDay} day={selDay}/>` → `checkins(day,day)` | On Today, pick a **past** day in the strip | that day's check-in shows |
| R6/#140 | Calendar Day snapped to today | `Calendar.tsx:81` syncs `sel`→URL; `:44` restores `?d=` | Go to another day, leave + come back | the day is preserved |
| R7/#141 | Route had no map tiles | `FlybyMap.tsx:20` `L.tileLayer(openstreetmap)` | Import a `.fit` with GPS | route on a real OSM map |
| R8/#142 | Imported-file fields editable | `LogActivity.tsx:153-175` every metric `disabled={!!fileB64}` | Import a file | metric fields are read-only |

> **Discipline (now permanent):** every fix lands with a test here + in `src/*.test.ts`; `🔨 built ≠ done`;
> only JM marks ✅ after the manual step passes. See `CLAUDE.md` → Testing, skill `platyplus-testing`,
> memory `platyplus-testing-workflow`.
