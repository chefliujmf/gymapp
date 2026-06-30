# Platyplus — Feedback & Ideas Log (ACTIVE queue)

**This is the live working queue + design reference + test guide — the SINGLE source of truth.**
Completed items are archived in `FEEDBACK-LOG-ARCHIVE.md` (full record #1–#116). Numbers are never
reused; new feedback continues from **#117**. Status: 🔨 building · ⬜ todo · 🧪 fixed-awaiting-verify ·
🔎 verifying. Design detail for big items → the **🎨 Design reference** section below; the one-by-one
test guide → the **🧪 Test guide** section below.
(Edit with Write — NOT `perl -0pi`, which mangles the UTF-8.)

> **INTAKE PROTOCOL (fire-and-log).** JM dumps feedback freely, anytime, even mid-build. On EACH item:
> (1) immediately append it here with the next number + a one-line ack, (2) do **NOT** stop the
> current build — keep working the queue in numbered order; implement when it comes up, unless tagged
> URGENT. The log is the durable store. Never make JM ask "are you logging this?".

> **👉 YOU ARE HERE (after 2026-06-23 QA marathon):** #39–#116 shipped to QA (coach notifications,
> diet-governs-meals, Progress redesign w/ search+facets, History by-day, nav rework
> Today·Plan·Train·Eat·Stats, ride-player gauge + 1% intensity bias, sensor bridge, HR fix +
> per-row ＋). The OPEN queue below is what's left. Next up: the two real bugs (#72, #107), then the
> coach-intelligence wiring (#91 cyclingcoach side) and the bigger builds (#102 signed app, #93 chart).

---

## 🔨 / ⬜ Open queue

> **✅ SHIPPED TO PROD #2 (2026-06-25, PR #38):** the WHOLE session batch is now live on prod —
> #51/#54 activity detail+flyby+timeline, #64/#74 check-in wellness, #72/#107 profile, #93 lift chart,
> #118/#119 gym page, #129/#130/#131 activity flow, #137-#143 fixes, #75 trim. Prod healthy + 200.
> (Earlier #1, PR #37: #125–#131 + Postgres + encrypted nightly pg_dump.)

228. ⬜ **Profile vs Stats streamline — global athlete data buried in Profile; global belongs at TOP of Stats.** JM
    2026-06-30: "this Profile page has [the General/global stats] at the end of the page — reorganize so global is at the
    top of Stats; need to think how to streamline this too." Profile's "General" (sleep need / VO₂max / weight) + the
    per-sport "Your stats" (FTP/maxHR/threshold pace) are EDITABLE athlete inputs living in Profile, but they overlap
    with — and should LEAD — the Stats pages. PROPOSED split: **Profile = the person + EDIT your benchmarks** (coach,
    sports, diet, sleep/VO₂max/FTP/pace inputs that sync to intervals); **Stats = VIEW + TREND them**, global snapshot at
    the TOP. Decide whether benchmarks stay edit-in-Profile/view-in-Stats or move entirely. Pairs #225 (Stats IA) + #164
    (Profile vs Settings split). Part of one Stats+Profile IA pass. gymapp-only.
227. 🧪 **Gym/strength sessions in History should be COLLAPSED by default.** JM 2026-06-30: a logged strength session
    expands all exercises × sets (kg/reps spinners) → the History page gets very long. Show a compact summary row
    (title · duration · volume · TSS) collapsed by default; tap to expand the sets. Applies in History (`/logs`) at least.
    Pairs with #226 (History filters). gymapp-only.
226. 🧪 **History needs FILTERS + SORTING at the top (and list pages generally).** JM 2026-06-30: "digging in history
    without dates or by activity type makes it hard to find what I'm looking for, even the title." Add a filter/sort bar
    to History (`/logs`): **date range**, **activity type** (ride/run/gym/mind/…), **title search**, maybe sort
    (newest/oldest). GENERAL PRINCIPLE (banked to memory): every list/history page should have top filters + sorting —
    always design them in. gymapp-only; pairs #227.
225. ⬜ **Stats IA: GLOBAL vs PER-SPORT — get it deliberately right (the #194b toggle was the wrong model).** JM
    [IA confirmed: global + per-sport pages, build Running page, per-context ranges — but now folded into ONE Stats+Profile
    IA pass with #226/#227/#228 so we build once, not thrash. Mock the full hub + Profile streamline first.]
    2026-06-30: "Power & FTP page is great but it's cycling-only — we still need to think carefully for global stats vs
    per-sports." PROBLEM: `/fitness` now mixes a GLOBAL view (Load & Form, all sports) with a PER-SPORT view (cycling
    power) behind a toggle, and the Stats **Running** card routes to `/fitness` → shows CYCLING power (wrong). PROPOSED IA:
    • **GLOBAL:** Load & Form (`/fitness`, make it global-ONLY — drop the cycling toggle), Wellness (`/wellness`),
      History (`/logs`). • **PER-SPORT (one page each):** Cycling (power/eFTP/VO₂max/W·kg — its own page), **Running (NEW —
      threshold pace / Daniels zones / VDOT / race predictions; today this lives in Profile)**, Strength (`/progress`),
      Mind (`/mind-stats`). Also: **range presets are inconsistent** (Fitness 6wk/3mo/6mo/1yr vs Wellness 7d/30d/60d) —
      standardise. DECISION PENDING (JM to confirm IA + whether to build the Running stats page + range standardisation).
      Supersedes the #194b toggle approach. gymapp-only.
224. ✅ **DECIDED — intervals stays the SINGLE hub; do NOT pull from Coros directly.** JM 2026-06-30: "the point of
    having intervals is to not have to maintain a million integrations, so no I don't want to pull from Coros directly."
    So the Coros→intervals morning lag is ACCEPTED and handled in-app only: lean on **Freshness/Form + the subjective
    check-in** (always available, #206/#207) and **auto-refresh when intervals catches up** (#206 — done). No Coros Open
    API / MCP / aggregator / unofficial pull. (Manual HRV/sleep quick-entry remains available as a no-integration
    fallback IF ever wanted, but not requested.) Architectural rule banked in memory. Original research kept below ↓
    ~~Get morning HRV/sleep faster than the Coros→intervals lag (options).~~ KEY CONSTRAINT: nothing is fresher than the
    WATCH→Coros-cloud sync (only on phone+Coros-app sync), so the real lag is watch→Coros then Coros→intervals; the
    options below remove the SECOND hop / nudge the first. RESEARCHED (web, 2026-06-30):
    • **Ships now (free):** manual morning quick-entry of HRV/sleep (glance at the Coros app) + we ALREADY lean on
      Freshness/Form + subjective check-in (#206/#207) so the morning decision doesn't NEED HRV — likely the right
      primary answer. • **Proper:** COROS **Open API** (partner application — sanctioned direct HRV/sleep, fresher than
      intervals) OR the official **COROS MCP server** (exposes sleep/HRV/load to AI tools — our coach IS Claude-CLI on
      the XPS, so it could read Coros directly; most architecture-fit). • **Avoid:** aggregators Terra/Spike (paid +
      dependency); unofficial reverse-engineered Coros API (stores the Coros password, fragile). Sources: COROS API
      application page, the5krunner COROS-MCP writeup, Terra/Spike Coros integrations. DECISION PENDING (JM to pick). gymapp-only.
223. 🧪 **Readiness/check-in is a TODAY concept — future days must show an EXPECTATION, not a live verdict.** JM
    2026-06-30: "the coach message is for today, the following days is maybe something more (we expect something) —
    saying it's fresh when I'm looking 4 days out at a workout is stupid." On a FUTURE day the Today view still shows
    "How do you feel today?" + the readiness verdict banner ("Moderately ready…") / a Freshness face — but there's no
    real readiness for a day that hasn't happened. FIX: branch the Today view by date — (a) TODAY = check-in + live
    readiness verdict (as now); (b) FUTURE = no check-in/live verdict; instead a **projected expectation** from planned
    load (CTL/ATL/Form projection given the scheduled TSS up to that day → "expect to be fatigued/fresh after Thu's
    session"), framed as a forecast ("we expect…"), not a fact; (c) PAST = what was logged. Pairs #137 (check-in
    today-only) + #206 (morning readiness) + #207/#208 (Freshness/Form math we already have to project from). Mock the
    future-day card first. gymapp-only.
    **🧪 BUILT 2026-06-30 (mock option A approved):** the Today view now branches by date — TODAY = check-in + live
    verdict (unchanged); FUTURE = a `ForecastCard` showing **expected Freshness** projected from planned load (no
    check-in, no "fresh" verdict), explicit that Energy/Sleep fill in from that day's check-in; PAST = logged check-in
    only (auto-derivation gated to today). New `GET /auth/readiness-forecast` projects CTL/ATL→Form over the planned
    intervals TSS (`projectForm`/`forecastFreshness` in `server/readiness.js`). 11 new tests; 150 green, tsc+build clean.
222. ❌ **DROPPED (JM 2026-06-30: "forget 222").** ~~Show % and watts on the workout thumbnail (watts = % of FTP).~~ JM 2026-06-30: wants the mini card thumbnail
    (MiniProfile) to show the target **%FTP and the watts** it implies (W = %×FTP), not just the coloured shape. Tight
    on an 88px thumb → needs a mock-first pass (e.g. label only the main block, or %/W on tap, or a compact "91% · 237W"
    on the peak block). Needs the user's FTP (we have it per-sport, #210). Mock 2-3 options before building. gymapp-only;
    pairs with #221 (flat blocks) + #210 (FTP).
221. 🧪 **NO inferred ramps — mirror intervals literally, flat blocks (supersedes #219's ramp rendering).** JM 2026-06-30
    (dev): "a ramp up when cooling down?! what the hell" + "let the coach define the ramp when it creates the workout,
    otherwise you mirror what you have in intervals, just fucking take what's there, no ramp for now." TWO bugs from the
    #219 true-shape rewrite: (1) the "Monday Cottage" **cooldown rendered ramping UP** — the stored step is ascending
    (48→58%), and the sloped SVG faithfully drew the wrong direction; (2) **card thumbnail shrank to a tiny glyph** —
    #219 changed MiniProfile from flex-divs to an `<svg>`, which `.thumb svg { width:30px }` capped to 30 px.
    FIX (per JM's directive): **kill inferred ramps everywhere — render FLAT blocks** at each step's mean %FTP (steady
    keeps its value; a {start,end} step → the mean, NOT the peak, so it also answers #219's original "don't show the
    max"). `SegmentProfile` + `MiniProfile` (back to flex-divs → fills the thumb again) in `src/ui.tsx`; ride-player
    preview + the LIVE target both flat (`segPct`/`wattsAt` in `src/ride.ts`, zone label always Z). Coach-defined ramps
    can reinstate the slope later. Tests: `src/ride.test.ts` (segPct mean + wattsAt flat for the backwards cooldown).
    128 tests green, tsc clean. gymapp-only; **supersedes #219** (ramp rendering reverted to flat).
220. 🧪 **= #207 Phase 2b (NOT a new item — don't double-count).** BUILT 2026-06-30 — see #207 Phase 2b: sleep first-guess,
    true VO₂max estimate, and the learn-from-your-overrides calibration. Awaiting JM verify on QA. JM 2026-06-29 (dev): "sleep and vo2max were empty
    in dev… cannot have a first guess? will it change over time?" + "we said earlier we need to LEARN about the user and
    adjust those numbers." This is exactly the #207 vision (personalize + learn over time) — Phase 2 built only the
    storage; the **estimate-then-learn** part was punted to 2b and never built. Folded into #207 below; the concrete
    asks live there. Kept as a pointer so the gap is visible. gymapp-only.
219. 🧪 **Workout chart must show the watt RANGE, not the max (true profile like intervals).** JM 2026-06-29 (QA):
    "in intervals they show a range of watts and in platyplus it's the maximum watts per interval." Platyplus drew each
    segment as a flat bar at its PEAK (`Math.max(powerStart,powerEnd)`), so a warm-up ramp looked as hard as the main
    set. FIX (mock #3 approved): rewrote `SegmentProfile` + `MiniProfile` as a true SVG power profile — each segment
    follows its real start→end (ramps SLOPE, steady blocks flat, step at boundaries), zone-coloured, watt-RANGE labels
    ("130–169 W" for a ramp). Matches the intervals chart shape. gymapp-only; pairs with #217.
    **⚠️ SUPERSEDED by #221 (JM 2026-06-30):** the sloped ramps drew a cooldown backwards (ascending data → ramp UP);
    JM killed inferred ramps — now FLAT blocks at the mean %FTP everywhere. The "show the range not the max" intent
    survives via the mean (not the peak); coach-defined ramps may reinstate the slope later.
218. 🧪 **Stale PWA bundle persists after deploy (the real #200 root) + icu plans never refreshed.** JM 2026-06-29 (QA):
    the #217 fix was LIVE in the deployed bundle (`index-2TODaDef.js` contained it) yet JM's app still showed the old
    5 W chart → his installed PWA was running CACHED JS. TWO gaps fixed: (1) **no reload-on-update** — skipWaiting+
    clientsClaim activated the new SW but the open page kept old JS; added a `controllerchange` reload (guarded to fire
    only on real UPDATES, not first install) in `src/main.tsx` + tightened the focus re-check to 30 min. (2) **reconcile
    only ADDED missing plans, never refreshed existing icu-origin ones** → a changed intervals workout (or the #217
    re-parse) never reached the stored `plan.segments` the ride PLAYER uses; reconcile now refreshes title/notes/segments
    of existing icu-origin plans from the live event. Supersedes the earlier "#200 fixed" claim. gymapp-only.
217. 🧪 **Workout power garbled — "175 W then 5 W", nothing like intervals (URGENT, FIXED).** JM 2026-06-29 (QA):
    tomorrow's "Tuesday Cottage Ride" showed an unrealistic 5 W block. ROOT CAUSE: intervals expresses some steps as
    `{units:'power_zone', value:N}` ("ride in Zone N"); `flattenIcuSteps` (+ server `icuEventToPlan`) read the zone
    NUMBER as a %FTP → Zone 2 = 2% × 260 FTP ≈ 5 W. FIX: `stepPctFtp` maps Coggan zones → representative %FTP
    (Z2→65% ≈ 169 W, flat endurance block, labelled Z2); same `resolveStepPct` server-side. Frontend reads workout_doc
    live so it's correct on deploy; server fix corrects `plan.segments` on next reconcile. Test:
    `src/intervals-steps.test.ts` (tomorrow's exact workout + all zones). gymapp-only.
216. 🧪 **Marathon prediction is optimistic vs Coros — realism.** JM 2026-06-29 (QA): our marathon prediction vs
    Coros's 3:56:19 differs a lot. NOT a math bug — our predictions are EXACTLY Daniels VDOT (5K/10K/Half match his
    table within ~1%). But VDOT marathon assumes you're marathon-trained; it ignores endurance/glycogen ("the wall"),
    so it runs optimistic. Coros uses your real training load + long runs → more conservative.
    **BUILT (mock option C, RANGE, approved):** the Marathon row now shows a **potential → realistic band** (e.g.
    "3:10–3:25") instead of a single optimistic time. Low end = the pure Daniels potential; high end adds a
    **durability penalty** (`marathonRealism`/`marathonDurabilityPenalty` in `src/running-paces.ts`, ≤12%, weighted
    0.6 longest-run / 0.4 weekly-volume, 0 at a marathon-ready ~32 km / ~70 km-wk base). The base is pulled from
    intervals run activities over 6 wks via new `GET /auth/intervals/run-volume` (+ `authApi.runVolume`); a "why"
    note explains the penalty + flags that the bulk of any big gap is the VDOT reading fast (→ use #215's estimate).
    Default 8% penalty when no run data. 17 new tests in `src/running-paces.test.ts` (39 total green). KEY FINDING:
    a durability/Riegel correction only moves the marathon ~3–6 min — the 3:10-vs-3:56 gap is mostly VDOT too fast,
    so #215 (auto-estimate VDOT, already 🧪) is the real lever. gymapp-only; pairs with #215.
215. 🧪 **Auto-ESTIMATE running threshold pace + VDOT from recent runs (like eFTP / VO₂max).** JM 2026-06-29: "can we
    estimate those values? it's like the FTP in the end and VO2Max." Today threshold pace is MANUAL — but a too-fast
    manual guess inflates VDOT → optimistic zones/predictions (root of #216). Mirror how cycling gets eFTP + we estimate
    VO₂max: derive running threshold pace / VDOT from the athlete's **best recent efforts** (intervals activities / pace
    curve — pull what we already have), show it as an **estimate** the user can OVERRIDE (manual wins). Same pattern
    everywhere: estimate when we can, let the user correct, learn over time (#207). Needs a small UI affordance (estimated
    vs manual tag + a "use estimate" action) → mock first. gymapp-only; pairs with #209/#210/#216.
214. ✅ **Daniels pace zones + race predictions are too compact / unclear.** JM 2026-06-29 (QA): "for daniels zone,
    it's good but too compact and we don't understand what it shows clearly." The E/M/T/I/R one-letter chips don't say
    what they are. FIX: spell out each zone (Easy / Marathon / Threshold / Interval / Rep) with a one-line purpose +
    its pace, in a readable stacked list (not a cramped wrap row). Same for predictions (clear distance → time → pace).
    Part of the #210/#209 stats UI. gymapp-only.
210b. ✅ **Two-way sync push was a silent no-op — WRONG intervals endpoint.** JM 2026-06-29 (QA): set FTP 262 / run
    pace in Platyplus → intervals didn't change. ROOT CAUSE: `PUT /athlete/{id}` with `{sportSettings}` returns 200 but
    intervals IGNORES it; full-athlete PUT = 403. CORRECT API = `PUT /athlete/{id}/sport-settings/{entryId}` with only
    the changed field (verified: ftp 263 stuck, custom_field_values preserved). FIX: `icuPatchForGroup` + per-entry PUT;
    pull becomes canonical for display (prefer intervals values, re-pull after each edit). gymapp-only.
    VERIFIED on QA real account: cycling 262 + running 4:15 both landed in intervals; custom fields preserved.
    KNOWN LIMITATION: intervals ignores `null` in a PUT → you CANNOT clear a synced stat to blank via the API
    (setting/updating a value works; clearing is Platyplus-local-only). Minor; revisit only if it bites.
213. ✅ **Profile's "workouts / hours trained" tiles are wrong + misplaced → belong under Stats.** JM 2026-06-29 (QA):
    "why in qa workouts and trained in hours are just 1 and 0? why is it in profile? … this kind of stats … should be
    accurate and probably global and by sports or activity." ROOT CAUSE: those tiles counted the **local Dexie `db.logs`**
    (1 imported row on QA, 0 duration) — NOT real history (intervals activities + merged logs). DONE: removed the 3-tile
    grid from Profile (FTP moved into the new per-sport Cycling card). TODO/verify: the **Stats hub (#193, global +
    per-sport)** is the right home — confirm its workout-count + hours are accurate (merge intervals activities, not just
    local logs); if Stats also counts only `db.logs`, fix it to use the merged history (`buildDayEntries`/intervals). gymapp-only.
212. ✅ **Move Diet from Settings → Profile (coaching input, not config).** JM 2026-06-29: "diet is still in settings
    instead of profile, normal? right place? it was reported before." AGREED: diet drives meals + the coach (#40), same
    as the **Sports** chips which already live in Profile. Units/equipment/API tokens are true config → stay in Settings;
    Diet moves up to Profile, grouped right under "Sports you do" as a coaching preference. Server stays the same
    (`info.diet` via saveProfile) — pure UI relocation. Folding into the #210 stats batch. gymapp-only.
211. ✅ **Running race predictions (Garmin/Coros-style).** JM 2026-06-29: "can you also add race predictions like in
    Garmin or Coros for running." From the runner's **VDOT** (#209), predict finish times for **5K / 10K / Half /
    Marathon** using Daniels' VDOT→race-time tables (same basis Garmin/Coros use). Show as a small "Race predictions"
    block under Running in "Your stats" (and/or Fitness page): each distance → predicted time + the pace it implies.
    Recompute whenever threshold pace / VDOT changes. Pure function `racePredictions(vdot)` in a unit-tested module.
    Pairs with #209 (VDOT) + #210 (per-sport stats). gymapp-only.
210. ✅ **Per-sport athlete settings, TWO-WAY synced with intervals.** JM 2026-06-29: FTP/maxHR/thresholdHR/VO₂max/weight
    that live in intervals must stay in sync both ends. FINDINGS (jmfiset's real athlete): intervals stores these
    **per-sport** in a `sportSettings[]` array — Ride{ftp 260, lthr 170, max_hr 185}, Run{lthr 170, max_hr 194,
    threshold_pace NULL, units MINS_KM}, Swim{threshold_pace .83 SECS_100M}, Weights{…}. **VO₂max is NOT an intervals
    field** → stays Platyplus-computed/manual (can't sync). Weight syncs from Garmin (`icu_weight`). JM DECISIONS:
    **(1) per-sport stats** (not one overall value); **(2) two-way** — pull to prefill, push overrides back to intervals.
    BUILD: per-sport settings store mirroring `sportSettings`; `GET /auth/intervals/athlete` (pull, mapped); push via
    `PUT /athlete/{id}` (GET→modify only sportSettings→PUT full, so custom fields #147 are untouched — be careful);
    redesigned per-sport "Your stats" UI (mock first); pairs with #209 (run pace → VDOT/zones). Phase it: mock UI →
    backend store+pull → push (careful) → #209 VDOT. gymapp-only.
209. ✅ **Running Threshold Pace (FTP-equivalent) + Daniels VDOT + running VO₂max.** JM 2026-06-29: "for running, do we
    have an estimation of paces similar to FTP?" CURRENT: VO₂max est. exists only for CYCLING (Fitness page, Coggan
    `10.8·eFTP/kg+7`); **no running VO₂max (VDOT), no first-class running threshold pace.** Run plans express intensity
    as "% of threshold" but there's no stored pace anchor → no real min/km targets/zones. BUILD: add a **Threshold Pace**
    stat to "Your stats" (running's FTP — Daniels T-pace / critical velocity / lactate-threshold pace; manual + prefill
    from intervals' athlete pace), derive **Daniels pace zones** (E/M/T/I/R) + **VDOT → running VO₂max**, wire into the
    RunPlayer (target paces) + coach (prescribe by pace). Pairs with #207 Phase 2 (athlete-stats) + Phase 2b (wire
    VO₂max into readiness). gymapp-only.
208. 🔨 **Freshness recalibration — less conservative (DONE).** JM 2026-06-29: Form −1 reading 3/5 is too conservative
    + clashed with the "You're fresh" verdict. The mapping was the research-doc table (TSB −15..0 → 3). Re-anchored to
    TrainingPeaks Form zones + ACWR sweet-spot 0.8–1.3 (low risk = good): balanced (Form ~0 / ACWR ~1) → ~4; 5 reserved
    for tapered (Form ≥ +12); drops to 2–1 as real fatigue accumulates. JM real days: Form −1 → 3.4→**4**, normal days
    4–4.7. `server/readiness.js` + test. On QA. Supersedes the conservative table for Freshness; revisit when #207 lands.
207. 🔨 **Personalize the WHOLE readiness model from the athlete's own stats (not just HRV).** JM 2026-06-29: "each
    user has specificities — learn from my stats: HRV, max HR, FTP, VO2max, etc." CURRENT state: Energy HRV/RHR are
    ALREADY z-scored vs the user's rolling personal baseline (lnRMSSD, ≥14d) — not population brackets. Gaps: (a) Sleep
    need is a default 8h (→ per-user #159); (b) **Freshness 1–5 mapping is a population default** (now less conservative,
    #208) — should z-score the user's TSB/ACWR against THEIR own range like HRV; (c) **max HR / FTP / VO2max are NOT in
    the model** — wire an athlete-stats profile (FTP, maxHR, VO2max, sleepNeed, baselines) so scores + the coach learn
    "how hard is this FOR YOU" → personal zones + expected fatigue. Data exists (intervals eFTP/maxHR/VO2 est, coach
    profile) — gap is a unified per-user model. Big item; phase it (TSB personal baseline → athlete-stats store → wire
    FTP/maxHR/VO2 → coach reads it). gymapp-only.
    **Phase 1 BUILT 2026-06-29 (on QA):** Freshness now z-scores your TSB vs your rolling baseline (≥14d, sd-floored) and nudges the absolute anchor ±1 — a day unusually loaded FOR YOU reads lower, an unusually rested one higher, your typical day stays at the anchor (~4). `baselines.tsbBaseline` + `freshness({tsbBaseline})`, the ⓘ says "more loaded/fresher/about your usual". 23 tests. Phase 2 = athlete-stats store (FTP/maxHR/VO2max) + coach.
    **Phase 2 BUILT 2026-06-29 (on QA):** per-user athlete stats — sleepNeed, maxHR, FTP, VO2max — stored on the user, exposed in pub(), settable via PUT /auth/profile (clamped). New "Your stats" section in Profile (autosave). readiness uses sleepNeed (fixes Sleep vs JM's ~9h, #159 DONE). buildSystemPrompt now gives the coach "THIS ATHLETE'S BENCHMARKS" so it judges intensity FOR THEM. Next (2b): wire FTP/maxHR into the readiness math (expected fatigue) + learn a calibration offset from systematic overrides.
    **🔨 Phase 2b — ACTIVE (this is what JM flagged via #220: "learn about the user + adjust those numbers / first guess / change over time").** Phase 2 stored the stats but left them blank/manual — the *estimate + learn* layer is the gap. Build:
      1. **Seed first-guess defaults** so nothing's blank: Sleep need shows **8 h** (the value readiness already assumes) as an editable default; clearly tagged as a starting point.
      2. **VO₂max becomes a TRUE estimate** (not a stored manual #): prefill from intervals — cycling `10.8·eFTP÷weight+7` (Coggan, already on Fitness page) and/or running VDOT (#215) — tag "est." only when computed, "you" when overridden (manual wins). Recompute when eFTP/VDOT/weight change → it **refines over time**.
      3. **Learn a personal calibration offset from systematic overrides** (the real "learn about ME"): when JM consistently bumps a computed score the same direction, nudge the model's anchor toward his correction over time (bounded), so auto-scores drift toward what he actually reports. Persist per-user; show it's learned.
      4. **Wire FTP/maxHR into expected-fatigue** so "how hard is this FOR YOU" uses personal zones, not population.
    In dev (no intervals) VO₂max stays blank — expected. Tests for the estimate + the learning offset (pure fns). gymapp-only; pairs #215 (VDOT) / #208 (Freshness anchor).
    **🧪 Phase 2b BUILT 2026-06-30 (on QA after push):** (1) **Sleep need** shows the 8 h first-guess (tag "default" → "you" once set) so it's never blank. (2) **VO₂max = a TRUE estimate** — `estimateVo2max` (cycling `10.8·FTP÷weight+7` or running VDOT, takes the higher) shown live in Profile with a "what it's from · updates as you train" line; manual entry overrides ("you"). (3) **Learning calibration (gradual drift)** — `calibrationOffset`/`learnedOffsets`/`applyOffset` in `server/readiness.js`: check-ins now store the auto score shown (`ci.auto`), and `/auth/readiness` drifts each auto score toward the athlete's MEDIAN override (≥5 days, evidence-weighted, ±1 cap, ignores <0.2 noise); Today shows "· tuned to you" + a why. 31 new tests (readiness + running-paces), 145 green, tsc + build clean. REMAINING (part 4, deferred): wire FTP/maxHR into the expected-fatigue math + have the coach read the VO₂max estimate server-side.
    **🧪 Phase 2b Part 4 BUILT 2026-06-30:** the COACH now reads a complete benchmark set incl. **VO₂max** — manual value if set, else a server-side **estimate** (`estimateVo2max` in `server/readiness.js`, mirrors the client: cycling `10.8·FTP÷weight+7` or running VDOT, higher wins). Weight is now stashed on the user from the intervals athlete pull. The "THIS ATHLETE'S BENCHMARKS" prompt shows it "(est. from …)" when computed. HONEST NOTE on "wire FTP/maxHR into the readiness MATH": FTP/maxHR are ALREADY in Freshness via intervals' CTL/ATL/TSS (TSS comes from power/HR zones) — no separate score-math to add; the coach is where these benchmarks change behaviour. 3 parity tests; 153 green, tsc+build clean. **#207 now fully built.**
206. 🧪 **Morning readiness data + coach stick-vs-adjust decision.** JM 2026-06-29: today's HRV/sleep isn't in intervals
    yet in the morning, so the coach can't decide. ROOT CAUSE (verified in JM's data): the lag is **Coros → intervals**,
    not Platyplus — overnight HRV/sleep lands in intervals hours late (often afternoon/next-day; `updated` timestamps
    show next-day 17:18–22:32; today 06-29 at 14:18 EDT still empty). Platyplus reads intervals live, so it's only as
    fresh as intervals. Coros has no open API → only path is via intervals (memory `platyplus-readiness-model`).
    **Always available in the morning: Freshness (CTL/ATL/Form).** So the morning flow = manual check-in (subjective) +
    Freshness → coach decides; auto HRV/Sleep backfills on Coros sync. PROPOSED builds: (1) **re-fetch readiness on app
    focus + a "⟳ refresh" on the wellness chips** so a Coros sync shows up without a reload; (2) a **morning coach
    decision** (extend the existing poor-recovery→notify hook into a real stick-vs-adjust call once the check-in is in).
    Also advise JM: open the Coros app on waking + check the intervals↔Coros pull cadence. gymapp-only.
    **🧪 BUILT 2026-06-30:** (1) **refresh** — CheckInCard re-pulls readiness on app focus/visibility + a **⟳ button**
    on the wellness chips (today only); when HRV/sleep aren't in yet it shows "HRV/sleep not synced yet" so the ⟳ is
    obviously useful. (2) **stick-or-adjust** — the morning coach hook now fires on ANY complete check-in for today (not
    just poor days), once/day (`ci.coachDecided`), and is told to lean on the check-in + **Freshness/Form** since HRV/
    sleep are usually mid-sync; it makes a STICK (one-line confirm) or ADJUST (ease + notify) call. tsc+build clean, 150
    tests green. ADVICE for JM: open Coros on waking to push the sync sooner. gymapp-only.
205. 🔨 **WeekStrip: select edge date on week change + "Today" shows whenever off-today.** JM 2026-06-29: changing
    week should move the selection — **next week → that week's Monday (first)**, **prev week → its Sunday (last)** — so
    it scrolls continuously; and the **Today** button should appear as soon as the selected date isn't today (even
    within this week), not only on a different week. BUILT (`src/ui.tsx`): `goWeek(delta)` sets the offset + selects the
    edge date; `away = offset!==0 || selected!==today` shows Today. tsc clean.
204. 🔨 **Override indicator in the check-in (keep the auto trace).** JM 2026-06-28: after editing a score the "· auto"
    tag just disappears — no sign it's a manual override + the computed value is lost. BUILT: overridden score now shows
    **"· edited (auto N)"** (amber) in both the expanded rows and collapsed chips; the ⓘ also adds "Auto computed X · you
    set Y". `Today.tsx`/`styles.css`. tsc clean.
203. 🔨 **Collapsed check-in: ⓘ explanation + override transparency + coach hook.** JM 2026-06-28 (liked the auto
    check-in). Asks: (a) in the COLLAPSED "✓ Checked in" chips, be able to tap an **ⓘ for the per-day explanation**
    (currently only the expanded faces have it); (b) surface the **verdict / "add it to the coach (you're fresh)"** —
    a way to see/send the readiness verdict to the coach from there; (c) when a score is **overridden**, show **what was
    COMPUTED vs the user's input** (e.g. "Freshness 3 · auto was 4"), so the override is transparent. Mock the collapsed
    states first (options-first). Build on the existing CheckInCard (`Today.tsx`); the per-day why already exists in the
    expanded ⓘ — extend it to the collapsed chips + add the computed-vs-input delta.
202. 🔨 **Today/home redesign — "your day" as a flexible typed-block stack (DESIGN LOCKED 2026-06-28, option C2).** JM
    picked **C2** (readiness verdict as a banner ON the plan card, then 🍽️ Fuel + 🧠 Mind as their own labelled cards).
    Mockups: `mockups/today-ux.html` (A/B/C), `today-blended.html` (C1/C2), `today-c2-sports.html` (multi-sport),
    `today-c2-flex.html` (extensible). **LOCKED model:** Today renders an **ordered list of typed blocks** from the
    day's data — `Workout×N` (body renderer per sport: gym sets×reps · ride/run power/pace · swim laps · pilates/yoga
    class) · **🍽️ Fuel** (2-col meal chips + 💊 **Supplements** sub-block + ⓘ strategy) · **🧠 Mind** · **🛌 Recovery**
    (sauna/cold/massage/mobility) · …future. Universal top = the readiness check-in (auto). Rules kept: meal chips
    WRAP 2-col (no side-scroll); empty block → algorithmic "Suggested"; a module the user doesn't do is hidden (#198);
    readiness banner + fuel strategy adapt to what's on (carb vs protein). **Adding a sport/section/sub-item later =
    data + one renderer, not a redesign.** Build needs: new block types for Recovery + Supplements (item model), the
    readiness→verdict banner, the per-sport body renderers. Phase the build (layout + readiness banner + existing
    fuel/mind first; Recovery/Supplements data model next). gymapp-only.
    **Phase 1 BUILT 2026-06-28 (on QA):** Today restructured — readiness **verdict banner** on the plan (good/mixed/low
    from the check-in), meals/mind split into **🍽️ Fuel** (2-col chips: scheduled once, else carb/protein-aware
    suggestions) + **🧠 Mind** sections, notes stay with workouts. tsc clean, build OK.
    **Phase 2 BUILT 2026-06-28 (on QA):** new item types **'recovery'** + **'supplement'** (server validateItem +
    `kind` field; CalItem type; openapi). Today renders **🛌 Recovery** section (sauna/cold/massage/mobility/foam/walk,
    emoji + minutes + remove) and **💊 Supplements** pills under Fuel (with ×). AddSheet gains Recovery (preset list)
    + Supplement (text + quick-chips) authoring. Coach MCP tools `schedule_recovery` + `schedule_supplement` added
    (gymapp `mcp/server.js` — needs host MCP re-sync to reach the live coach). tsc clean, build OK. Remaining (low-pri):
    swim/pilates body polish; algorithmic Recovery suggestion when empty.
201. 🔨 **Score explanations: definition under the label, per-day WHY in the ⓘ.** JM 2026-06-28: the line under each
    score is the *definition*; the **ⓘ should explain WHY this day's score** is what it is. Now: dim one-liner under
    each row = definition (Energy "How ready your body is to train right now", Sleep "How well last night recovered
    you", Freshness "How recovered you are from training load"); the **ⓘ = the day's actual inputs** ("Why today: HRV
    +0.4σ vs your baseline, sleep 4/5, resting HR −0.2σ" / "Form 8, acute-vs-chronic 0.7") + the 1–5 scale — computed
    from the wellness data whether or not the row is answered, with a clear "no HRV/sleep synced yet" fallback. "· auto"
    shows only while the value still equals the data-derived one.
200. 🔨 **"Can't log in after a deploy" — PWA stale-bundle, FIXED once-and-for-all.** JM: dev/QA often won't let him log
    in after changes. Verified the SERVER is fine (QA boot "Session key loaded", sessionSecret STABLE in Postgres
    `a35f3a13…`, login endpoint clean 401 on wrong pw). Root cause = the **service worker served the OLD precached
    bundle** until every tab closed (the app never registered the SW or checked for updates; workbox lacked
    skipWaiting/clientsClaim/cleanupOutdatedCaches). Fix (gymapp-only): workbox `skipWaiting + clientsClaim +
    cleanupOutdatedCaches`; `injectRegister:false` + explicit `registerSW` in `main.tsx` that re-checks for a new
    build on **visibilitychange / online / hourly**, so an open or installed PWA auto-updates to the fresh bundle
    instead of getting stuck. Build verified (dist/sw.js generates). JM verify: deploy, then reopen QA — should log in.
199. ✅ **Check-in scale = 1–5 Energy/Sleep/Freshness (RESOLVED).** Correction: my earlier 1–10 edit (3280c8f/e54e908)
    was superseded by df54b26 ("compact 1–5") + 7a2c024 ("Soreness→Freshness"). **Current shipped state (dev/QA/prod):**
    Energy / Sleep / **Freshness** on a 1–5 face scale (💀😩😐😀🤩), Sleep AUTO-prefills from intervals wellness
    (`sleepTo5`, shown "· from tracker", editable), HRV/RestHR/sleep wellness chips. Scale already matches the readiness
    model (1–5). REMAINING work is the auto-DERIVE of Energy + Freshness → that's #195/#158 below, not a separate item.
198. 🧪 **Sports as show/hide MODULES (cycling/running/strength/yoga/pilates/meditation).** JM (2026-06-27): each
    discipline is a "module"; make it trivial for the app to show/hide everything tied to one (nav hubs, Today
    suggestions, Stats cards, coach gating, Add sheet). Today it keys off `user.sports`; audit that EVERY surface
    reads one central helper (e.g. `hasModule(sport)`) so adding/removing a module flips all UI consistently. No
    half-gated surfaces. Keep CONTENT adaptive, structure stable (memory `platyplus`/nav IA). gymapp-only.
    **🧪 BUILT 2026-06-30:** new central **`src/modules.ts`** — `MODULES`, `userModules(sports)` (triathlon→cycling+
    running, yoga/pilates/meditation→`mind`, cycling/running→`endurance`), and `hasModule(sports, m, {emptyShowsAll})`
    (no selection yet = shown, so the app isn't empty for a new user; `emptyShowsAll:false` for "is this MINE"). Refactored
    the surfaces that each rolled their own logic onto it: **TrainHub** ordering, **statsGroups** (Stats cards), **Fitness**
    (endurance/cycling sections) — killed the duplicated `ENDUR`/`ENDURANCE` consts. **AddSheet** now hides the Ride/Run/
    Gym tabs you don't do (meal/mind/recovery/supplement/note stay universal). NOT changed: the **coach** (server JS, can't
    import the TS helper; keeps its own sport gating + profile-text fallback — fine) and the **mind** tab is left universal
    (open Q if JM wants it gated too). 8 new tests; existing statsGroups test still green; 160 total, tsc+build clean. gymapp-only.
197. 🔨 **Friday shows "2 completed workouts" incl. a phantom "Ride to Skov" (prod).** JM (2026-06-27) did ONE ride
    (not Ride to Skov). VERIFIED server+intervals CLEAN for 06-26: 1 plan + 1 activity + 1 event, all "Friday
    Endurance Ride"; **0 logs**; no "Ride to Skov" anywhere. ⇒ phantom was a **stale local `db.logs` entry**.
    **BUILT (gymapp-only, awaiting JM verify on QA/prod):** (1) History (`Logs.tsx`) calls `syncLogsFromServer()` on
    open → reconciles local logs to the server truth so an orphan can't linger; (2) new pure `src/logs-merge.ts`
    `buildDayEntries` collapses to ONE entry per (day, sport) — gym-with-sets > device activity > bare log — with a
    robust `bucketSport` (no raw-string fall-through, the old dup cause), unit-tested in `src/logs-merge.test.ts`
    (5 cases incl. the exact Friday scenario); (3) `deletePlanById` cascades — also drops the matching completed log
    (workoutId === plan id). Constraint: cyclingcoach untouched; #185 reverted, stays gymapp-side. Open: dev can't
    connect to intervals (separate, low-pri).
196. 🧪 **Duplicate workout in prod (intervals sync).** RESOLVED (data): deleted the stale Platyplus plan
    `friday_ride_to_skov_2026-06-26` via the proper deletePlanById path (DELETE /api/plan → 200). Friday 06-26 now
    has ONE plan — the coach's icu "Friday Endurance Ride" (ev 118860036) — matched to the completed activity
    `i160604649` of the same name = one ✓Completed card. JM: refresh the app to confirm. CLARIFIED workflow: **jmfiset
    authors in intervals via cyclingcoach, NOT Platyplus** — Platyplus should be a pure mirror for him; "Friday Ride to
    Skov" was a leftover that JM removed in intervals but it lingered as a Platyplus master (skill #160: must remove IN
    Platyplus). **Durable fix = #185** (retire cyclingcoach's split publish so there's ONE author) — different-title dups
    can't be auto-deduped by design, so until #185 the coach must not write the same session to both intervals and the
    Platyplus API. Original report (for history):
    JM "did a workout today, seems it's a duplicate in platyplus prod;
    not in QA; dev can't connect" (2026-06-23). Live-store inspection: **today (06-23) is clean** — 1 plan "Tuesday
    Endurance Rebuild" matched to the device activity "South Shore Endurance Ride" → one ✓Completed card (the plan's old
    mirror event 118096072 is 404/already collapsed). **Real remaining dup is FRIDAY 06-26:** two plans same slot —
    "Friday Ride to Skov" (origin=platyplus, ev 118087608) **and** "Friday Endurance Ride" (origin=icu, ev 118860036,
    external_id `friday_classic_endurance_2026-06-26:2026-06-26`). Different TITLES → slip the day+sport+title dedup. Root
    cause = the external **cyclingcoach publishes straight to intervals** (#185 keystone), so Platyplus imports it as a 2nd
    plan. Fix now: remove the icu interloper for the chosen Friday plan (await JM's pick); durable fix = #185 (retire the
    external coach's direct intervals publish so Platyplus is sole author). Also: confirm 06-23 dup was just a cached view.
195. 🧪 **Readiness engine — our own WHOOP (Sleep·Freshness·Energy 1–5).** BUILT 2026-06-28 (on QA, awaiting JM verify).
    Deep-research (24 sources, 21 verified claims) folded into **`docs/readiness-scores.md`** ("WHOOP deep-dive").
    Pure unit-tested **`server/readiness.js`** (20 tests): lnRMSSD z-scored vs a personal baseline, RHR
    parasympathetic-saturation guard, ACWR+TSB Freshness, personalized Sleep need, **cold-start gate** (no HRV
    baseline → Energy null → manual tap). New **`GET /auth/readiness`** computes it from 60d intervals wellness; the
    Today check-in auto-fills all three from one fetch, each with an ⓘ "why" (HRV ±σ, Form, sleep-need) + "· auto"
    tag, tap overrides. Supersedes #158 (done). **Still open:** per-user `sleepNeed` setting (now defaults 8h — #159);
    coach signals (Freshness-Energy paradox, poor-sleep-nullifies-gains, HRV-CV) not yet wired into reviews; resp-rate/
    skin-temp illness layer not ingestable from intervals. JM verify: do the numbers match how you feel?
194. 🧪 **Stats v1 follow-ups (after #193 grouping) — (a)(b)(c) ALL BUILT.** v1 routes to EXISTING pages, so: (a) WELLNESS card from the
    mockup isn't in v1 — needs its own page (sleep/HRV/RestHR/weight trends from intervals + check-ins); (b) split
    `/fitness` into the GLOBAL "Training load & Form" view vs the CYCLING "power curve/FTP/VO₂max" view (today both cards
    route to /fitness); (c) a Mind/Meditation stats page (today the Mind card → /logs). JM 2026-06-26.
    **🧪 (a) Wellness page BUILT 2026-06-30 (mock round 2, option B approved):** new `src/pages/Wellness.tsx` + `/wellness`
    route + a "Wellness" card in the Stats hub global group. Sleep / HRV / resting-HR / weight trends from `fetchWellness`
    + a check-in (1–5) trend, each a RICH chart (`WTrend`): Y axis (min/mid/max), dated X axis, faint daily line, bold
    **7-day moving average**, shaded **min–max band** with dashed bounds + labels (RHR inverted so "good" reads right).
    **Range filter 7d / 30d / 60d / custom** (reuses the Fitness chips + date-range). Works without intervals too (check-in
    trend still shows). statsGroups test updated (Wellness now global). 160 tests green, tsc+build clean.
    **🧪 (b) Fitness split BUILT 2026-06-30:** the two Stats cards open FOCUSED `/fitness` views via `?focus=` —
    `load` (Fitness/Fatigue + Form + training-load) vs `power` (VO₂max/eFTP/power-curve/W·kg). A 2-chip toggle switches
    them (cyclists only); the title adapts; sleep/HRV/RHR/weight removed from Fitness (now on the Wellness page) → replaced
    by a link there. **🧪 (c) Mind page BUILT 2026-06-30:** `src/pages/MindStats.tsx` + `/mind-stats` (Stats Mind card now
    points there) — minutes/sessions/streak + an 8-week minutes bar chart + recent sessions, from logged mind sessions.
    Mind sessions now actually LOG on completion (MindDetail → `logWorkout` discipline 'mind', which fed nothing before).
    Pure `mind-stats.ts` (streak/weekly buckets) + 7 tests; 167 total green, tsc+build clean. #194 fully built. gymapp-only.
193. 🧪 **Rework the Stats page: separate SPORT-SPECIFIC vs GLOBAL metrics.** DONE v1 (hub grouping): `hubs.tsx`
    `StatsHub` now renders a **GLOBAL** section (Training load & Form → /fitness · History → /logs) + a **PER SPORT**
    section (Cycling/Running → /fitness · Strength → /progress · Mind → /logs), gated by `statsGroups(sports)` (pure +
    unit-tested, `src/stats-hub.test.ts`, 5 tests). Matches the approved `mockups/stats-view.html`. Routing/new-page
    refinements → #194. JM approved the mockup 2026-06-26.
192. 🧪 **WeekStrip: show which day is TODAY (distinct from the selected day).** The strip only highlights the SELECTED
    day (green pill); when another day is selected there's no marker for today (Jun 26). Add a persistent "today"
    indicator (ring/underline/dot/label) so today is always identifiable even when another day is selected. Pairs with
    #153. JM 2026-06-26.
160. ⬜ **Deletion model confusing: deleting a Platyplus plan's event IN intervals doesn't remove the Platyplus plan,
    and re-sync re-creates it.** QA: JM deleted today's ride; it cleared from intervals but still shows in Platyplus.
    Diagnosed: only 1 plan ("Friday Ride to Skov", `mine:true`, icuEventId 118840139); intervals now has 0 events for
    that day. So the event was deleted in INTERVALS, but Platyplus is MASTER → keeps the plan (stale icuEventId), and a
    re-sync/save would RE-PUSH it. Right path = delete IN Platyplus (⋮ → Remove) which removes plan + event. FIX OPTIONS:
    (a) make the in-app Remove the obvious/only path; (b) reconcile DETECTS an intervals-side deletion of a platyplus
    plan's tracked event and prompts "remove from Platyplus too?"; (c) ensure the Platyplus Remove definitely works (if
    JM used ⋮→Remove and it persisted = real bug in deletePlanById). JM screenshot QA 2026-06-26.
159. ✅ **Sleep 1-5 PERSONAL (WHOOP-style).** Mostly DONE in #195: `readiness.sleep` = device sleep score (0–100)→1-5
    else **hours ÷ personal need** (replaces the old fixed `sleepTo5` hour-bins). REMAINING: expose a per-user
    **sleep-need setting** (server reads `user.sleepNeed`, default 8h — JM needs ~9h) in Profile/Settings + a UI to set
    it; WHOOP's debt+strain additions are phase 2. JM 2026-06-26.
158. ✅ **Auto-derive Freshness + Energy from data (DONE in #195).** Freshness ← Form/TSB + ACWR; Energy ← lnRMSSD-z +
    sleep + RHR-z + subjective. Auto-fill + ⓘ on the check-in. Original note:
    JM: sleep auto-fills 1-5 from
    the tracker — can freshness + energy too? FROM THE DATA WE HAVE: **Freshness** ← intervals **Form/TSB (CTL−ATL)**
    and/or **HRV vs baseline** + **RestHR vs baseline** → 1-5 (legit, objective). **Energy** is subjective (that's why
    it's a manual tap) — best proxy is a composite of HRV+RestHR+sleep, label it a soft estimate, manual tap always
    overrides. Sleep mapping today (Today.tsx `sleepTo5`): device sleepSCORE/20→1-5, else hours <5/<6/<7/<8/≥8→1-5.
    JM 2026-06-26.
157. ⬜ **The workout TEXT Platyplus pushes to intervals is very different from a real planned workout's text.** JM:
    "look at the text in intervals in a planned workout vs what Platyplus pushed — huge difference." `planToIcuEvent`
    builds description = native "## Workout\n- 10m 50-62%" + notes + coach brief; intervals' own planned-workout text/
    format (the structured/native workout the chart renders from) differs. Align the pushed description + workout_doc to
    intervals' native format so the pushed event reads + charts like a proper planned workout (cf. cyclingcoach
    instructions_intervals_icu). Pairs with #150. JM screenshot 2026-06-26.
156. ⬜ **Missed-workout UX: red day-dot + clearly-"missed" activity.** A PAST Platyplus planned workout NOT linked to
    a completed activity = MISSED. The WeekStrip dot for that day should be **red** (today the dots are green/neutral),
    and the session should render as clearly "missed" (not just a faint planned card). Part of the #155 state model
    (missed = past + not done). JM 2026-06-26.
155. ⬜ **Detail page must branch on session STATE (JM spec 2026-06-26) + unify the "use your phone" messaging.**
    JM update 2026-06-26: on **desktop you should NOT even have the "play" button** at all (not just gated) — the
    full-page "Ride from your phone" gate is moot; just no play affordance on desktop, show the workout + inline hint.
    JM: "planned → you see info about the workout; done → you see STATS about the session; missed (past, not done) →
    like planned." Today it always shows the plan (profile + ride gate) even when done. ALSO inconsistent: two "use
    mobile" treatments — a FULL-PAGE gate ("Ride from your phone", RidePlayer) AND an inline banner ("Open Platyplus
    on your phone to ride", my R2 fix on the detail page). PLAN:
    • **planned / missed** → workout info (profile/exercises) + action: mobile = Ride/Run now; desktop = the INLINE
      phone hint (non-blocking, keeps the workout visible). Reserve the FULL-PAGE gate ONLY for actually launching the
      player on desktop. Unify copy/tone between the two.
    • **done** → RESULTS: actual stats (duration/distance/HR/power/TSS), planned-vs-actual, HR/power graph, GPS map+
      flyby (#51), RPE/feedback — reuse the activity-detail UI (/activity/:id, built 2026-06-25). No ride gate.
    Done-detection: a completed activity/log matches this plan's date+sport(+title). JM screenshots 2026-06-26.
154. ⬜ **R4 feedback fields may not be mobile-friendly — chips, consider a dropdown.** The post-workout fields render
    as chip rows; with 6 fields × 6-8 options that's a lot of chips on a phone. JM: "not sure this is mobile friendly
    (dropdown?)". Evaluate chips vs a compact native `<select>` per field on mobile. JM 2026-06-26.
153. ⬜ **BUG: Today week strip shows the WRONG "today" (23 highlighted on June 26).** On dev the strip green-selected
    TUE 23 as today though it was Fri 26 (Log-activity correctly showed 26). `localISO()` uses `new Date()` (correct),
    so a fresh load = today; likely a STALE long-open tab (selDay/WeekStrip captured `new Date()` at mount days ago and
    never re-anchored). Fix: re-anchor "today" + selDay when the app regains focus / the date rolls over (so a PWA left
    open across days self-heals). Confirm a hard-refresh fixes it. JM screenshot 2026-06-26.
152. 🧪 **Gym feedback must be its OWN set, not cycling's (corrects R4/#147).** My R4 applied the 6 intervals
    ACTIVITY_FIELDs (Legs Before/After, Fuel/GI…) to ALL sports incl. gym. JM: "gym is not the same as cycling, it's
    own as discussed in the past." → ride/run keep the intervals 6; gym gets a gym-specific set (Soreness/pump, Form,
    Pain/Niggles, …). JM 2026-06-26.
151. 🔎 **VERIFY (done — mostly works, one gap): when a workout is DONE, does it write to Platyplus per the flows?**
    TRACED the three finish paths (2026-06-26):
    • **Writes to Platyplus? YES (all 3).** RidePlayer/RunPlayer/GymPlayer each call `logWorkout()` (db.ts:228),
      which POSTs `/logs` to the SERVER first (cross-device) then mirrors to Dexie; History reads it. ✅
    • **Indoor RIDE results flow WORKS:** records per-sec samples → `/auth/activity/complete` → **match-first**
      (server.js:994): if a device already logged it in intervals → link (no dup), else build a **TCX** and upload to
      **intervals** (`icuUploadTcx`). NB: real model is "→ TCX → intervals", **NOT FIT→Strava** — server comment says
      "No Strava dependency"; Strava only gets it if the athlete has intervals→Strava forwarding. (memory note corrected.)
    • **GYM:** `completeActivity` with empty samples → match-first only; no stream → stays local (coach reads the rich
      set/rep log from Platyplus). ✅ by design.
    • **GAP — RunPlayer.finish() does NOT call `completeActivity`** (RidePlayer/GymPlayer do). So a planned run done
      in-app never match-links a device-recorded run in intervals. Small consistency fix: mirror RidePlayer's call
      (samples empty for runs → 'no-stream', but match-first would link a Garmin/Coros run). PROPOSED, not yet done.
    • **Coach review** fires on the FEEDBACK step ("✓ Done? Log how it went" → /auth/plan/:id/feedback → runCoachTask,
      #76), NOT on bare finish — by design (one feedback model). ✅
    JM 2026-06-26.
150. 🧪 **Platyplus→intervals PUSH + re-sync button (dedup-aware) — items in intervals aren't "seen" in Platyplus, and vice versa.** JM
    sees divergence both ways. Suspected causes (to confirm against code): (a) Platyplus READS intervals only within a
    fetched date RANGE + filters some out (ATP/NOTE markers, categories), so out-of-window or filtered events don't show;
    (b) items ADDED IN Platyplus (Add sheet → gymapp coach-plans / calendar_items in Postgres) are gymapp-LOCAL and are
    NOT pushed back to intervals (only the coach engine dual-writes by shared ID), so they never appear in intervals;
    (c) the reconcile/dedup (external_id `:date` suffix, day/sport/title) may hide one side. Need a screenshot + a
    specific example (which item, which direction, which date) to pin the exact path. JM 2026-06-26.
149. ⬜ **Strava: confirm completed activities actually reach Strava.** JM's "morning run" was in intervals
    but NOT in Strava. Likely the device→Strava sync (Garmin/Coros account config), not Platyplus — but
    confirm: (a) for DEVICE activities, Strava comes from the device's own Strava link, not us; (b) for
    PLATYPLUS-recorded/uploaded activities (#122), verify the opt-in Strava push works. JM 2026-06-25.
148. 🧪 **BUG: "Add" sheet → "Search gym…" shows an EMPTY list (no gym workouts).** In the calendar Add
    sheet (Week/Day), picking Gym shows just blank divider lines — no templates and no catalog gym workouts
    to pick. (Calendar.tsx AddSheet gym section — templates + workouts not rendering.) JM screenshot 2026-06-26,
    reported before.
147. 🧪 **Post-workout feedback choices don't match intervals.icu's custom fields.** intervals has these
    activity custom fields with FULL option lists (e.g. Legs After = strong / normal / tired OK / barely
    tired / heavy / sore — 6 opts; also Fuel/GI, Legs Before, **Life Constraint**, **Mental State**,
    Pain/Niggles). Platyplus FIELDS (PostWorkout) have fewer/different choices and is MISSING Life Constraint
    + Mental State. Since feedback syncs to those intervals fields, ALIGN the field names + choices exactly
    (ideally fetch the athlete's custom-field defs from intervals, or mirror them). JM screenshot 2026-06-26.
146. 🧪 **BUG: Today "Add" navigates AWAY to the Plan/Calendar page (reported before).** Clicking Add on the
    Today page jumps to /plan (calendar Day view) + opens the Add sheet there, instead of opening the Add
    sheet IN PLACE on Today. JM wants to add without leaving Today. (Today.tsx swapOn → navigate; #56/#57 made
    it jump — JM dislikes that.) JM screenshot 2026-06-26.
145. 🧪 **REOPENED #139 — desktop CAN still start a ride; the BUTTON isn't gated.** I gated the PLAYER (and
    RunPlayer) but the "▶ Ride now" button on the ride-detail pages (CoachPlanDetail + PlanDetail) is still
    actionable on desktop. JM has said 2-3× you CANNOT ride from desktop. FIX: gate the BUTTON itself
    (canPlayHere = isMobile || sensor-bridge) so it shows "Open on your phone" on a sensor-less desktop. JM 2026-06-26.
144. 🔨 **In-app Promote button → GitHub 403 — FIXED IN CODE.** The button POSTed a workflow_dispatch,
    which needs `actions: write`; the PAT has Contents+PRs only → 403. Rather than ask JM to widen the PAT,
    rewrote `/auth/promote-prod` to open/reuse a dev→main PR + enable auto-merge directly (Contents+PRs —
    which the token HAS). No PAT change, no actions:write. Ships in this promotion; verify the button on prod.
143. 🔨 **Align Log-activity feedback with the post-workout feedback page.** The "How hard? (RPE)" + Notes
    in /log-activity should match the existing post-workout feedback flow (PostWorkout.tsx, `feedback/:id`) —
    same fields/component (feel/RPE/form/notes) + feed the SAME coach-review pipeline (#76) so a logged/linked
    activity reviews like a completed planned workout. One feedback model, not two. JM 2026-06-25.
142. 🔨 **Imported file = read-only metrics (#129).** When a .fit/.gpx/.tcx is imported, the file-driven
    fields (sport, date/time, duration, distance, avg HR, avg power) should be LOCKED/display-only — the file
    is the source of truth, not editable number inputs. Keep RPE + Notes editable (not in the file). Manual
    (no file) entry stays fully editable. JM 2026-06-25.
141. 🔨 **Route shows as a bare line, no actual MAP underneath (#129 import).** The GPS route renders
    (green SVG polyline, confirmed on QA w/ the .fit — 300 pts) but there are no map tiles/streets behind it,
    so JM reads it as "no map." Decision needed (mock-first): (a) real tile map — Leaflet + OpenStreetMap
    tiles (free, no key, but a live third-party source — weigh vs the media-independence rule, which is about
    BUNDLED catalog media, not a live map service); or (b) keep it independent but make it read as a route
    (graticule/grid bg, start/end pins, distance label). Pairs with #51 (post-workout GPS map + flyby). JM 2026-06-25.
140. 🔨 **BUG: Plan/Calendar Day view snaps back to TODAY.** Navigating to another day then clicking Add /
    changing something resets the selected day to today ("Add to <today>" instead of the day you were on).
    The selected-day state isn't preserved across the action/re-render. (Calendar.tsx `sel`.) JM 2026-06-25.
139. 🔨 **BUG: desktop can start a ride — mobile-only gate not enforced at "Ride now".** On desktop (dev),
    the ride detail page shows "▶ Ride now" and lets you proceed; rides are MOBILE-FIRST (#109) — there was
    a "Ride from your phone" gate page. Re-enforce it (the RidePlayer gate exists for no-bridge desktop; make
    sure "Ride now" routes through it / hides on desktop). NOTE: the ride PROFILE now renders correctly
    (varied green/blue bars) — #72/#107 fix confirmed in JM's screenshot. JM 2026-06-25.
138. ✅ **Dev keeps "can't connect / Something went wrong" — backend not running.** Recurring: local
    `npm run dev` stops (terminal closed / api exits) → :8088 dead → vite proxies /auth to nothing → 500.
    Mitigated: `npm run dev` self-heals (`--restart-tries 20`) + must stay in its own terminal. During a
    session, keep a persistent dev server running for JM. (See memory [[platyplus-testing-workflow]].)
137. 🔨 **BUG: check-in summary only shows for TODAY in the Today view.** Selecting another day in the
    WeekStrip hides the "Checked in · Energy/Sleep/Freshness" block even when that day HAS a check-in (it's
    in History). Today.tsx renders the check-in for `today` only — should render it for the SELECTED day
    (fetch/show the check-in for the day picked in the strip). JM screenshot 2026-06-25.
136. ✅ **PROMOTED to prod (2026-06-25).** Postgres (#125) + logging/errors/eye (#126–#128) + manual
    activity entry (#129) + calendar import & plan-link (#131) shipped. Set real PG_PASSWORD_PROD secret +
    wired deploy.yml; nightly `pg-backup.timer` (age-encrypted pg_dump → Drive, 30-day retention). Prod
    verified: migrated, healthy, backup runs.
135. ✅ **Local dev login == QA.** Local dev used isolated `dev-data` (seeded `devpass`) so JM's QA password
    was rejected. Synced the QA account (same bcrypt hash + 17 plans) into `server/dev-data/store.json`.
134. ✅ **`npm run dev` now starts BOTH api+web.** Running `npm run dev` alone = frontend only → :8088 dead →
    vite proxied /auth to nothing → text/plain 500 → "Firefox can't connect 5173" / "Something went wrong".
    Fixed: `dev` = concurrently api+web; `dev:web` = frontend-only.
133. ✅ **Local dev backend broke under the Postgres migration.** server.js required DATABASE_URL + db.js
    imported `pg` at top → local dev (no DATABASE_URL, no pg installed) crashed → passkey fell back to
    password, login failed. Fixed: dual-mode store (file store when no DATABASE_URL) + lazy `pg` import.
132. ✅ **HTTP 500 on login after the Postgres deploy.** loadStore() dropped the top-level `sessionSecret`
    (signs every JWT) → after a redeploy it was undefined → jwt.sign threw → every login 500'd + sessions
    died. Fixed: persist/restore sessionSecret+resets via an `app_meta` table; boot self-check logs if missing.
131. ✅ **Import an activity from the calendar + link it to a planned workout (long-standing).** BUILT
    (Option A, JM's pick — mockup mockups/import-activity.html): calendar Add sheet gains an "Import an
    activity" row → opens /log-activity?date=<day>. LogActivity reads ?date, loads that day's plans, and
    shows "Link to plan: <title>" (auto-on when sport matches) → on save it names the activity after the
    plan + stores planId so day+sport+title matching counts it done. QA-verify. ORIGINAL ASK: The day/"Add
    to <date>" modal only searches PLANNED workouts — no way to import a completed one, and no way to link an
    import to that day's plan. Build: (a) entry point "Import an activity" in the calendar day + Add modal →
    opens /log-activity with date prefilled; (b) in /log-activity, if a plan exists that day (matching sport),
    show "Link to plan: <planned workout>" → on save, mark the plan done + attach the activity (reuse Today's
    actFor day+sport match). Builds on #129 (manual entry) + #130 (History merge). JM: reported long ago.
130. 🔨 **History should surface intervals activities (read-hub direction).** A device activity recorded
    straight to intervals (e.g. a "morning run" not done via Platyplus) shows in intervals but NOT in
    Platyplus History — History reads only local `db.logs`. Per #121 (intervals = read hub), History/Progress
    should MERGE intervals activities (match-first by day+sport so a Platyplus-logged + intervals copy aren't
    shown twice), with the intervals↗/Strava↗ links (ui.tsx already renders these). NOTE: the manual-entry
    upload (#129) DOES create a local copy, so it'll appear in both — this gap is only for activities born on
    a device. (Separate: "not in Strava" = intervals→Strava sync isn't automatic unless the recording
    source/Strava is configured to; Platyplus doesn't control that.)
129. ✅ **Manual activity entry — with/without a workout file, with/without GPS.** BUILT (single smart
    form, JM's pick; FIT+GPX+TCX): `/log-activity` page (file import prefills, SVG route map when GPS,
    sport/date/time/duration/distance/HR/power/RPE/notes) + entry points (Train hub + History "+ Log").
    Server: `server/activity-parse.js` (fit-file-parser + fast-xml-parser) + `/auth/activity/parse` +
    `/auth/activity/manual` (match-first → raw-file or summary-TCX upload). openapi updated. Verify on QA.
    Original (verbatim): Log an activity by
    hand (sport, date/time, duration, distance, avg HR/power, RPE, notes, elevation/calories), OR drop a
    `.fit/.tcx/.gpx` to prefill + attach the track (map only when GPS exists). Goes to Platyplus (local home)
    + match-first / optional push to intervals (per #121 data-flow model). Mock-first; FIT needs a parser lib
    (GPX/TCX are XML). Reuses `completeActivity` (api.ts) + server TCX upload.
128. ✅ **Password show/hide "eye" toggle.** Reusable `PasswordInput` (Eye/EyeOff) on the login password, reset "new password", and account change-password fields.
127. ✅ **Human-readable errors (not "HTTP 500").** Server returns a plain-English message + a short `ref`; client turns network/5xx/4xx into real sentences; logs lead with a human summary line. `humanizeError()` maps known causes (session key, DB down, upstream unreachable, disk).
126. ✅ **Observability logging (for review + a future watchdog bot).** Global Express error handler logs every failure as `[err <ref>]` (human summary + where + raw detail + stack); `unhandledRejection`/`uncaughtException` nets; `[boot]` self-check that screams if the session key is missing. The 500 that started this was SILENT before. Foundation for a bot that scrapes the rotated docker logs, flags spikes, acts.
125. ✅ **Postgres migration (JM: "full relational, most robust").** Built + **verified on QA**:
    `server/db.js` drop-in for store.js (relational tables + JSONB doc); pg `db` service in both
    compose files; first boot auto-migrates store.json (QA migrated 1 user/17 plans/1 log/1 passkey,
    healthy, 200). REMAINING before heavy prod use: real `PG_PASSWORD` + nightly `pg_dump` backup;
    later per-entity writes. Prod promote will auto-migrate prod's store.json the same way.
18. 🔨 **Coach P1f — verify the full coach→Platyplus loop with the LIVE coach.** Native-text mirror + host-MCP sync done; REMAINING: `publish_platyplus_plan.py` structured-field mapping + a real QA run with the coach. (cyclingcoach is its own repo.)
23. ⬜ **intervals indoor-completion labeling** — confirm an indoor-done workout reaches intervals labeled (pairs w/ coach + a real completion).
51. 🔨 **Post-workout GPS map + Strava-style flyby** — route map + an animated dot replaying the path. Needs the activity GPS stream + a map render. Pairs w/ #54.
54. 🔨 **Clone rich post-workout RIDE analytics** — intervals-style tabs: TIMELINE (power/HR/cadence/altitude) · POWER (zones, curve, decoupling) · HR · ROUTE (map) · DATA. Big; from intervals/Strava streams.
61. ⬜ **(ref) Xert-style weekly ride calendar** — inspiration for a richer Plan view (per-day score badge, mini map, power profile, weekly-stats bar).
62. ⬜ **(ref) TrainerRoad in-workout + ride summary** — inspiration for the ride player + post-ride summary (#54).
64. 🔨 **Infer Sleep from intervals wellness** — when intervals is connected, prefill the check-in Sleep from the wellness sleep score (still editable). Extends into #74.
65. 🔨 **Check-in auto-adapts today's workout (coach)** — on a poor check-in, the coach evaluates + adjusts TODAY's plan (recovery/cut intensity) with a note. Design the trigger; pairs #76/#91.
72. 🔁 **BUG (REOPENED — still flat): ride thumbnail = flat blue, doesn't match the workout** — CoachPlanCard MiniProfile from `p.segments` isn't reflecting the real structure (segments missing/flat). Fix the thumb or fall back to a sport icon. (Likely same root as #107.)
74. 🔨 **Check-in chips: add Sleep / HRV / Rest HR** — from intervals wellness when connected, else manual input. Extends #64; #63 chip UI is the home.
75. 🔨 **Post-workout: trim feel/form redundancy** — RPE 1–10 DONE; still review whether "How did you feel?" vs the gym fields (Form etc.) overlap and trim.
76. 🔨 **Coach triggers on post-workout feedback** — on feedback submit, the coach reviews + adjusts the plan (cyclingcoach engine). Pairs #65/#91; server-side trigger → coach → plan update + note.
81. 🔨 **Gym TSS theory → estimate + post-calc** — capture a strength training-load methodology into the cyclingcoach KB; use it pre (estimate) + post (from logged sets) to replace the rough gymTSS. (cyclingcoach repo.)
91. 🔨 **Coach takeaways = REAL cyclingcoach output** — Platyplus side DONE (`POST /api/coach-review` store + Progress renders the real Verdict/Execution/Mind/Next, heuristics fallback). REMAINING: adapt the cyclingcoach skill (COACHCHECK) to POST there instead of intervals-only. (cyclingcoach repo.)
93. 🔨 **Open a lift → full labeled chart** — tapping a strength-trend row opens a detail view with a proper dated-X / weight-Y chart (points, values, PR markers), not just the sparkline. Mock first.
102. 🔨 **macOS sensors for everybody = signed menubar app** — bridge refactored to a `startBridge()` module; REMAINING: Electron wrapper + tray + electron-builder (.dmg/.exe) + signing/notarization (needs JM's Apple Developer cert). Makes native sensors one-click on macOS in any browser. (Built bridge + analysis archived as #99–#101.)
106. ⬜ **Advanced pedaling metrics + coach drills** — L/R balance + force-distribution "oval" (torque effectiveness / pedal smoothness) from the trainer/power meter; coach gives drills. Ref: pycycling. Pairs #91.
107. 🔨 **BUG: ride profile preview misses the first (green) warmup segment** — the setup-preview AND in-ride bar chart show only the yellow intervals, not the warmup. First/low segment clipped or dropped (parsing/rendering). Confirm the warmup ramp is intended too.
118. 🔨 **Gym workout builder — missing/not surfaced** — there's a Ride builder (/ride-builder) and Run builder (/run-builder) but no GYM builder on the Gym page. (A `builderDraft` + `addToDraft` exist under the hood, used from ExerciseDetail.) Add/surface a "Build a gym workout" flow on the Gym page: pick exercises, set sets/reps/rest, save as a template → play. Parity with Ride/Run "+ Build".
119. ✅ **Remove "Programs" from Gym — a program is a plan (coach's domain)** — the Gym page lists "Programs" (+ Trainers). A program = a multi-week PLAN, which the COACH now owns. Remove the Programs section from the Gym page (decide on Trainers too) so planning lives with the coach, and Gym = workouts + builder + library.
121. ✅ **DATA-FLOW MODEL — LOCKED (2026-06-25).** Reviewed all flows w/ JM (see 🎨 Design reference "Workout data-flow model"). Principles: (a) **intervals.icu = the read hub** — Platyplus reads every completed workout back from intervals (everything lands there: Garmin/Wahoo/Coros/Strava→intervals). (b) **Platyplus is always the local home** for in-app workouts (works with ZERO external connections — coach reads its own data; intervals AND Strava are optional). (c) **MATCH-FIRST, upload-only-if-missing** — Platyplus checks intervals for a matching device activity; if present (day+sport+time) → match + enrich (don't duplicate); if absent and Platyplus is the source → upload its own. (d) Fan-out target for Platyplus-recorded workouts = **intervals direct** (no Strava dependency); Strava optional. Planning direction = Platyplus→intervals→device (Garmin/Wahoo for bike, Coros for run — Coros does planned-workout DOWNLOAD).
122. 🔨 **BUILD #3 — indoor ride: capture stream + upload.** [BUILT, QA-verify] RidePlayer currently logs `duration` only + no push. Build: record per-second power/HR/cadence during the ride → on finish encode a FIT/activity → **upload to intervals when connected** (Strava optional), ALWAYS keep the Platyplus copy. Match-first (skip upload if a device already recorded it). (Replaces the false "indoor→FIT→Strava already works".)
123. 🔨 **BUILD #4 — gym source + match.** [match-first wired; manual-strength-upload deferred] Platyplus gym log (GymPlayer, real sets/reps/weights) is the exercise SOURCE. Match-first against any Coros/device strength activity in intervals (by day/sport/time) → ONE merged session = Platyplus exercises + Coros HR; optionally write the exercise list into that activity's notes (Strava shows exercises). Upload our own strength activity ONLY when no device recorded it. (Coros has no open OAuth — direct connect isn't possible nor needed.)
124. ✅ **#5 — planned runs already mirror to intervals (planToIcuEvent run→Run); Coros pulls them.** Completed runs/walks/hikes = the read/match path (shared w/ #2). Planned runs ALREADY flow Platyplus→intervals (same mirror as rides); Coros pulls them to the watch (download confirmed). Minimal build — mostly ensure run plans publish to intervals like rides + JM verifies the Coros↔intervals planned-sync toggle.

---

### Folded in from UX-BACKLOG (open items not already covered above) — continuing #161+

161. ⬜ **In-app assistant chatbot / BYO-AI.** Owner: **Claude CLI on the XPS** (app proxies to `claude`, no API
    key in app). Other users: **BYO-AI** — punch in their own **Claude / OpenAI-Codex / Gemini** creds, per-user.
    Built on dev: locked-down `claude -p` (deny Bash/Edit/Write/Read + allow ONLY the `gymdata`/Platyplus MCP),
    `POST /auth/chat` spawns it user-scoped, chat panel. REMAINING: ⬜ stream the reply token-by-token · ⬜ take
    live on QA/prod (bridge container→host `claude`, bake in `mcp/`) · ⬜ per-user coach persona name (default
    JM→Tadej, wife→Bert, editable from Profile) · ⬜ subscription rate-limit caveat (2 users only; API only if sold).
    (source: UX-BACKLOG "User assistant chatbot" + "Chatbot / AI".)
162. ⬜ **Anti-scrape / anti-download of self-hosted media (re-stressed, important).** Users must not be able to
    scrape/download the self-hosted video/audio/images. Deter download + screenshots (signed/expiring URLs,
    range-only, obfuscation, no-download attrs already added). True DRM is hard — raise the bar meaningfully.
    Also: Centr video resolution is poor (source quality; consider re-encode / better source). (source: UX-BACKLOG.)
163. ⬜ **intervals.icu "Connect" button (OAuth).** Needs OAuth creds **requested from the intervals dev** (not
    self-serve). Until then, the key-paste flow (friendlier UX, shipped) stands. For public launch. (source: UX-BACKLOG.)
164. ⬜ **Profile vs Settings split + section nav.** Profile = the person (avatar, name, account, passkeys,
    connections like Strava/intervals). Separate **Settings** page for small config (API tokens, units, diet,
    video stills, equipment list, etc.). Add a table-of-contents / section nav so Profile isn't one long scroll.
    Decide the split (judgement call). Design detail in 🎨 Design reference. (source: UX-BACKLOG "Profile vs Settings".)
165. ⬜ **Admin page — split out of Profile (admin-only).** "Admin · Users" becomes its own admin-only page. Keep
    it SIMPLE + admin-focused (no workout features). Mobile-first: user cards, role badges, "+Add user" sheet,
    per-user actions sheet (reset / change role / remove) with confirmations. Coach API token stays in Profile.
    (source: UX-BACKLOG Session-2.)
166. ⬜ **Calendar density + polish (centerpiece).** Big, modern, close to Google Calendar: Day/Week/Month/
    Schedule views; clean event blocks; today highlighted. Everything (workouts, rides, runs, meals, mind) is an
    event on a day. The current calendar still feels empty/sparse — needs density + polish. (source: UX-BACKLOG Calendar.)
167. ⬜ **Gym player refinements (live workout screen).** Pre-workout **time estimate** (total + per-exercise,
    reps × time-under-tension); **reorder exercises before starting**; **add-set / skip-set** in player + full
    set TABLE (JetFit-style); **history back-nav** returns to your position (today dumps to exercise 1); a
    **dedicated swipe gesture** to change exercise (currently arrows + dots). (source: UX-BACKLOG Session-4 gym player.)
168. ⬜ **Coach generation quality.** Generated workouts have **no warm-up / cool-down**; should **group similar
    exercises by equipment** so you don't move around (e.g. dumbbell+bench together) when it doesn't compromise
    the goal; **Pallof press should be represented both sides**. (cyclingcoach / via MCP.) (source: UX-BACKLOG.)
169. ⬜ **Eat: meal packs + shopping-list generator.** Eat list is built; REMAINING: **meal packs** (pre-packaged
    breakfast/lunch/snack "packs" that roll up kcal + protein — JM specifically likes this); **shopping-list
    generator** for selected days / a full week (consolidate from assigned meals + snacks). (source: UX-BACKLOG Eat.)
170. ⬜ **Train filters & sorting + equipment list.** Filter + sort **Workouts AND Exercises** by **equipment**,
    **time/duration**, **intensity**. Powered by a **Settings → equipment list** (what the user owns). (source:
    UX-BACKLOG 2026-06-23 session.)
171. ⬜ **Check-in history: collapse-when-done + Logs list.** Once all 3 (energy/sleep/freshness) are logged,
    collapse the Today check-in card to a one-line summary; full history in Logs. (source: UX-BACKLOG check-in.)
172. ⬜ **Remove the "(indoor)" tag shown on rides.** Small label cleanup. (source: UX-BACKLOG ride/strava session-3.)
173. ⬜ **BYO Strava (multi-provider activity source).** A user may not use intervals.icu at all — let them link
    their own **Strava** (OAuth) in account settings as an alternative source/sink for activities. Same
    provider-abstraction idea as BYO-AI (`intervals | strava | …`). (source: UX-BACKLOG.)
174. ⬜ **Bluetooth HR during a bike workout (+ HR affordances).** Confirm + fix: (1) Web Bluetooth is
    Chrome/Edge-only + needs HTTPS — make the unsupported-browser message LOUD, recommend the PWA/Chrome;
    (2) add a device affordance DURING the ride (pairing only exists in setup today); (3) decide whether to add
    BLE HR to the GYM player at all. (source: UX-BACKLOG session-5.)
175. ⬜ **Cross-cutting: consistent add-to-calendar + shared reusable-template concept.** A consistent "add to
    calendar → pick day" affordance across recipes/mind/workouts/rides/runs; one reusable-template concept
    shared by gym/ride/run workouts and meal packs. (source: UX-BACKLOG cross-cutting UX.)
176. ⬜ **Recipe data cleanup at SOURCE (build-time).** Render-time already strips HTML/entities + junk tags;
    also clean at SOURCE in build-catalog so stored data + calendar/Today meal titles are clean. Likely moot
    once recipes move to TheMealDB. (source: UX-BACKLOG.)
177. ⬜ **New categories: Yoga + Pilates.** Add Yoga and Pilates as categories (exercise buckets + Train filters +
    build-catalog category mapping; today stretching→Mobility). Needs **resell-safe content** (still UNSOLVED —
    free-exercise-db has none; Wikimedia Commons / Pexels-Pixabay video / open pose datasets are the lead; Yoga
    with Adriene, Pilates.com, exerciselibrary.com are NOT resell-safe). (source: UX-BACKLOG yoga/pilates.)
178. ⬜ **Content & licensing for the SELL path.** Replace scraped Centr/MuscleWiki (personal-only) with resell-safe
    sources: ✅ **free-exercise-db** chosen (public-domain, ~800 exercises + images) — integrate/map schema, add
    missing, self-host images; **TheMealDB** for recipes (verify terms/attribution); **CC audio** (Freesound CC0,
    Free Music Archive, Pixabay, Incompetech, mindfulnessexercises.com); **GoldenCheetah/.zwo** ride/run starters;
    optional **Wger** (CC-BY-SA, +breadth) + **ExerciseDB** (personal-only, media unclear). Build an
    **attribution/credits** surface for CC-BY assets. ❌ NOT resell-safe: Centr, MuscleWiki, ExerciseDB media,
    muscleandstrength.com. (source: UX-BACKLOG Content & licensing.)
179. ⬜ **BYO streaming for meditation/workout audio.** Let a user link **Spotify / Tidal** (OAuth) and play from
    their own account (no licensing burden); the MCP/coach picks suitable tracks (calm for meditation, tempo for
    workouts). Same BYO pattern. (source: UX-BACKLOG.)
180. ⬜ **Real per-workout/ride imagery as card background.** Currently a sport-themed gradient + logo overlay
    stopgap; want true per-workout imagery. (source: UX-BACKLOG.)
181. ⬜ **Free CC meditation audio (singing-bowl / chant / "world peace").** Tibetan singing-bowl / chant tracks
    from Freesound CC0 / Free Music Archive / Pixabay Music; self-host + manifest. (source: UX-BACKLOG, user request.)
182. ⬜ **Productizing the coach: engine vs profile split (the SaaS bridge).** Split the cyclingcoach repo into
    **ENGINE** (shared IP in git: logic, KB, books, periodization/nutrition, exercise library — a new user never
    touches it) vs **PROFILE** (per-user data, app-managed: sport, goals, FTP/maxes, days/week, equipment,
    constraints, injuries). One polyvalent engine made safe by (1) **profile-gating** (new capabilities activate
    only for matching profiles → JM's plans can't regress) + (2) **golden-plan regression tests**. Don't fork the
    engine for the wife. Build path: profile schema + onboarding wizard in-app → MCP **read** tools
    (`get_profile`, `get_history`) → coach reads profile from the app, not a repo file. (source: UX-BACKLOG.)
183. ⬜ **Guided onboarding / profile wizard (structured app data, audio STT).** Structured form/wizard (no AI) →
    profile record in the app DB (replaces editing `athlete_profile.md`). Surfaced at first sign-in (onboarding)
    AND under Profile (editable anytime). **Audio answers** option (speech-to-text, quality matters) supporting
    **fr-CA, fr-FR, en-CA, en-US** (Whisper-class STT preferred; Web Speech API fallback). (source: UX-BACKLOG;
    note: a first onboarding interview was started per commit 9f22abc — confirm scope vs this.)
184. ⬜ **Coach MCP enablement: search_recipes + search_sessions + structured fields.** Replicate the working
    `search_exercises`→`create_workout` pattern for food & mind: add `search_recipes` + `search_sessions` MCP
    tools so the coach picks REAL recipes + meditation/yoga/pilates classes by id, then `schedule_meal/mind(refId,
    why)`. Extend `create_ride/workout/run` + `schedule_meal/mind` with the structured fields (objective, cues[],
    success, recovery, fuel{why,supplements}, mind{why}, per-item why). (source: UX-BACKLOG plan-authoring design.)
185. 🧪 **Make Platyplus robust to the coach's split publish (GYMAPP-ONLY).** BUILT 2026-06-27 (awaiting JM verify).
    The coach republishing a workout under a NEW title for a slot you already have left a stale plan beside the new
    one. Fix: pure `planDroppedByReconcile` in `server/icu-match.js` + wired into `reconcileFromIcu` — on each sync,
    drop a plan whose intervals mirror event is GONE: icu-origin always; **platyplus-origin only when a live
    (replacement) WORKOUT event now occupies the same day+sport** (so the stale "Friday Ride to Skov" is removed once
    "Friday Endurance Ride" exists). A pure intervals deletion with NO replacement keeps the Platyplus plan (stays
    master, respects #160); a never-pushed local plan is never dropped. 6 unit tests in `src/icu-dedup.test.ts` (38
    total green). Existing dev+QA dups already cleaned. Paired with #197 (render/log dedup) + the cyclingcoach side
    stays untouched per JM. Verify: republish a renamed workout → only the new one remains, no dup.
186. ⬜ **Monitoring routine.** Scheduled check of `docker ps` health + `docker logs` to maintain the PWAs and act
    on issues (logs already set up for this; a watchdog bot foundation exists from #126). (source: UX-BACKLOG infra.)
187. ⬜ **Unified media manifest.** Single inventory of every self-hosted asset (images + audio + video) for
    integrity — currently only the video manifest exists. (source: UX-BACKLOG infra.)
188. ⬜ **Dev avatar photo empty in dev.** Dev shows "JM" initials; the photo lives only in prod. Mirror by
    re-uploading in dev Profile, or copy the prod store's avatar when we have XPS/prod access. (source: UX-BACKLOG.)
189. ⬜ **Train back-arrow on a root tab.** Train is a root tab (no back by design); revisit only if reached via a
    hub. (source: UX-BACKLOG nav.)
190. ⬜ **(ref) Inspiration / future Plan view.** Xert-style weekly ride calendar (per-day score badge, mini map,
    power profile, weekly-stats bar) — see also #61/#62. Reference, low priority. (source: UX-BACKLOG.)
191. ⬜ **Deferred (non-Platyplus).** Daily **Centris scrape** on the XPS for new houses → push to Pixel if found;
    `exp1-checkcheck-review` (Croissant climate review) on the XPS (needs HA on LAN). Parked. (source: UX-BACKLOG deferred.)

---

### Also pending (infra, not feature feedback)
- **Wire `GH_PROMOTE_TOKEN`** into the deploy secrets so the in-app Promote-to-prod button works (#47/#78). Needs a GitHub PAT with **Actions: write** added to `AUTH_ENV_STAGING`/`_PROD`, then redeploy. Until then the button correctly says "not set on the server"; prod promotion still works via the GitHub Actions tab.

---

## 🎨 Design reference (locked specs — detail for big items)

These are reference specs and locked decisions for the bigger queue items above — NOT numbered queue
items themselves. Folded in from the former UX-BACKLOG.

### Process rule (JM, 2026-06-23): OPTIONS + MOCKUPS FIRST
Before any UX change: research best practice, then present **2–3 options WITH mockups** (HTML render
when it helps) and get the pick BEFORE building. **Never implement-then-iterate.** (Memory:
`show-options-and-mockups-first` + skill `options-first`.)

### Coach plan-authoring → Platyplus (DESIGN LOCKED 2026-06-23)
**Architecture:** Platyplus = single MASTER for planning. cyclingcoach (and every BYO-AI) authors
INTO Platyplus via the MCP/Coach-API; Platyplus **mirrors to intervals.icu** (workout steps + a
rendered rich description, WITH the meal/mind references + both why-levels) and to Wahoo. Retire
cyclingcoach's direct intervals publish (`tools/intervals_icu_workouts.py` → a pure renderer Platyplus
calls). Add `time_target` to the Platyplus→intervals ride push (Wahoo). (Queue: #185.)

**Plan view (universal shell + sport-specific body):**
- Shell (all sports): 🎯 Objective · 🍽️ Fuel · 🧠 Mind · 🛌 Recovery · ✓ Success · 💬 Cues.
- Body swaps: Ride/Run → power/pace profile + "Ride/Run now"; Gym → exercise list (sets×reps,
  equipment, demo) + Start; Yoga/Pilates → guided class (duration/flow) + Start. **Run ≈ Ride.**

**Fuel/Mind — referencing, not duplication (one source = the day's calendar items):**
- Meals & mind stay separate calendar items (`schedule_meal`/`schedule_mind` → `/api/items`), surfaced
  INLINE in the plan (no jump). On Today they show once (plan chips); the algorithmic "Suggested fuel/
  reset" sections only appear when nothing's scheduled.
- **Meal chips = a 2-COLUMN GRID, not horizontal scroll** (mobile-friendly, all visible, scales).
- **`fuel.meals` is a VARIABLE-LENGTH array** — count is the COACH's call from its nutrition KB (e.g.
  strength days → more frequent protein feedings ~0.4 g/kg ×4–5; endurance → fewer/bigger carb meals).
  Don't hardcode breakfast/lunch/dinner/snack.
- **Two why-levels:** section *strategy* on the plan (`fuel.why`=Pre/During/Post+supplements,
  `mind.why`=mental-focus theme) shown via section ⓘ; per-pick *reason* on each item (`schedule_meal/
  mind` gain `why`), shown on the item's recipe/session page ("Coach's pick: …").
- **Mobile-first "why" (NOT inline expanding slabs):** per-pick why → on the recipe/session PAGE;
  section strategy why → a bottom SHEET (slide-up). Nothing expands inline.

**Coach enablement — replicate `search_exercises` for food & mind:** add `search_recipes` +
`search_sessions` MCP tools so the coach picks REAL recipes + meditation/yoga/pilates classes by id,
then `schedule_meal/mind(refId, why)`. Extend `create_ride/workout/run` + `schedule_meal/mind` with the
structured fields. Update the coach instructions + BYO-AI MCP descriptions (author via Platyplus, SELECT
content from the catalog, fill the why's, variable meal count, per sport). (Queue: #184/#185.)

**Mockup (clickable, multi-sport toggle):** `gymapp/mockups/plan-view.html`.

**Phase 1 build (in progress):** server schema (plan structured fields + item.why) → planToIcuEvent
render+time_target → PlanDetail UI (grid chips + sheet why) → recipe Coach's-pick banner → MCP
(search_recipes/search_sessions + structured fields) → cyclingcoach publisher + instructions.

### Workout data-flow model (LOCKED 2026-06-25, reviewed w/ JM) — backs #121/#122/#123/#124
**intervals.icu = the READ HUB.** Everything funnels there (Garmin/Wahoo/Coros push to intervals;
Strava→intervals). Platyplus reads every completed workout back from intervals.

**Platyplus = the always-present LOCAL HOME.** In-app workouts save to Platyplus first and work with
ZERO external connections (the coach reads Platyplus's own data). intervals AND Strava are BOTH optional
— never hard dependencies.

**MATCH-FIRST, upload-only-if-missing** (the one rule that covers every flow): Platyplus checks
intervals for a matching device activity (by day + sport + time window).
- Match found (device recorded it) → **match + enrich** that activity; do NOT upload (no duplicate).
- No match AND Platyplus is the source → **upload its own** (FIT/activity) to intervals.

**Fan-out for Platyplus-recorded workouts** = upload **directly to intervals** when connected (no Strava
dependency). Strava is an optional extra doorway (one upload; let Strava→intervals carry it, never both-
at-once → dup).

**Planning direction** = Platyplus → intervals → device: bike planned workouts reach the head unit
(Garmin/Wahoo), run planned workouts reach the **Coros** watch (Coros supports planned-workout download
from intervals). Same mirror Platyplus already builds for rides.

| Flow | Recorded where | Into Platyplus | Build |
|------|----------------|----------------|-------|
| 1 Planning | Coach→Platyplus | n/a (authored) | ✅ Platyplus→intervals→device |
| 2 Outdoor ride | Garmin/Wahoo | read+match from intervals | ✅ works |
| 3 Indoor ride | Platyplus player | own it → upload to intervals | ⬜ #122 (capture stream + upload) |
| 4 Gym | Platyplus log (+Coros HR) | match-first vs Coros activity | ⬜ #123 (source + match) |
| 5 Run/walk/hike | Coros | read+match (completed); plan→Coros | ⬜ #124 (mostly verify) |

Coros has **no open OAuth** — never a direct Platyplus↔Coros link; it reaches Platyplus only via
intervals/Strava (read) and receives plans via intervals (download). That's fine — match-first needs no
direct device connection.

### Profile vs Settings (UX) — backs #164
**Split Profile and Settings.** Profile = the person (avatar, name, account, passkeys, connections like
Strava/intervals). A separate **Settings** page for small config (API tokens, units, diet, video stills,
equipment list, etc.). Add a little **table-of-contents / section nav** to the right of Profile so it's
not one long scroll. Decide the split (what lives in Profile vs Settings) — judgement call.

### intervals.icu sync — clean up what shows as a "workout" — backs #150/#157
- **Filter the ATP / Annual Training Plan entries** out of the day/today view. The coach writes these to
  intervals as a *representation/target*, not an executable session — they should never appear as
  something to "do" in Platyplus. Detect by category/type (ATP is not a `WORKOUT`) and exclude from the
  gym/ride execution list.
- **De-dupe multiple bike rides on one day** — the sync sometimes surfaces several rides where there
  should be one. Pick the canonical event (e.g. the coach's `[gymapp]`/structured one, or latest by
  `external_id`) and hide the rest. Reference: `fetchGymPlans` / `parseGymWorkout` in `src/plan.ts` +
  `src/intervals.ts`.

### Engine vs profile (productizing the coach) — backs #182/#183
The cyclingcoach repo conflates two things; splitting them is what makes the coach sellable:
- **ENGINE (shared IP, in git):** coaching logic, skills, knowledge base, books, periodization/nutrition
  rules, exercise library. SAME for everyone (or per-sport). A new user NEVER touches this — the moat.
- **PROFILE (per-user DATA, app-managed):** sport, goals, experience, FTP/maxes, days/week, equipment,
  constraints, injuries, preferences. Today `codex_coach/athlete_profile.md` (a file) → must become
  **structured app data**.

**Don't fork the engine for the wife.** One polyvalent engine, safe via (1) **profile-gating** (new
capabilities activate only for matching profiles → JM's cyclist/male/FTP profile never triggers them →
plans can't regress; additive + gated = no regression by construction) + (2) **golden-plan regression
tests** (snapshot JM's plan outputs; on every engine change, regenerate + diff, fail on unexpected
change). The `bertfitnesscoach` full-clone should slim toward shared-engine + her PROFILE/books, not a
second engine. A new user adapts the coach through two in-app surfaces (guided onboarding/profile +
conversational chatbot via MCP), zero GitHub/Claude. At plan-time: **engine (fixed) + this user's
profile (injected) → plan.** Brain repos: JM → `chefliujmf/cyclingcoach`; Bert →
`chefliujmf/bertfitnesscoach`.

---

## 🧪 Test guide (one-by-one) — folded in from REGRESSION.md

The honest list of things **JM reported** that are broken or unverified. Each has a **unit test**
(committed → `npm test`, the permanent regression net) and/or a **manual test** (steps + expected). JM
verifies **one at a time**; only JM marks ✅.

**How to run the automated net:** `npm test` (unit, `src/*.test.ts`) · `npm run test:smoke` (API
integration, `scripts/smoke-test.mjs`). Status: ❌ broken · 🔧 fixing · 🧪 fixed + test, awaiting JM ·
✅ JM-verified.

### R194bc · #194 (b) Fitness split + (c) Mind page 🧪
**Unit:** `src/mind-stats.test.ts` (month minutes/sessions, streak incl. grace + gap-break, weekly buckets) + stats-hub routes updated. `npm test` (167).
**JM manual (QA):** (b) Stats → "Training load & Form" opens a load-only Fitness view; "Cycling" opens a power-only view; a chip toggle switches; sleep/HRV/weight now link to the Wellness page, not duplicated. (c) Finish a session in Mind (timer to 0) → it logs; Stats → "Mind" shows minutes/sessions/streak + an 8-week chart + recent sessions.

### R194a · #194a — Wellness stats page 🧪
**Unit:** statsGroups test updated (Wellness in the global group); `WTrend`/movingAvg are render-side (no pure test). `npm test` (160).
**JM manual (QA):** Stats → **Wellness**. Range chips 7d/30d/60d/custom. Each metric (Sleep/HRV/Resting HR/Weight + Check-in) is a big chart with **axes**, a faint daily line, a bold **7-day average**, and a shaded **min–max band**. Resting-HR's "good" label is the low end. With intervals off, the check-in trend still renders.

### R198 · #198 — sports as show/hide modules (one central helper) 🧪
**Unit tests:** `src/modules.test.ts` (userModules umbrellas: triathlon→cycling+running, yoga/pilates/meditation→mind; hasModule empty-default) + existing `src/stats-hub.test.ts` still green (behavior preserved). `npm test` (160).
**JM manual (QA):** Profile → toggle a sport on/off → it should flip consistently: the **Train hub** ordering, the **Stats** per-sport cards, the **Fitness** sections, and the **Add sheet** sport tabs (Ride/Run/Gym appear/disappear; meal/mind/recovery/supplement/note always there). New user (no sports) sees everything (not an empty app).

### R206 · #206 — morning readiness refresh + coach stick-or-adjust 🧪
**No pure unit (UI focus-listener + a live coach side-effect).** Frontend + server change only.
**JM manual (QA):** (1) Today (current day): the wellness row shows a **⟳** button; before the Coros sync it reads "HRV/sleep not synced yet" — switch away & back to the app (or tap ⟳) and a newer sync appears without a full reload. (2) Submit a complete check-in for today with a workout planned → the coach makes a **stick-or-adjust** call (notify): confirms the plan when you're ready, eases it when run-down, leaning on Freshness/Form when HRV/sleep aren't in yet. Fires once/day.

### R223 · #223 — future days show a freshness FORECAST, not a live verdict 🧪
**Unit tests:** `src/readiness.test.ts` → `projectForm` (CTL τ42 / ATL τ7 → Form; rest raises Form, hard drops it) + `forecastFreshness` (a planned block forecasts lower freshness than rest). `npm test` (150 green).
**Server:** `GET /auth/readiness-forecast?date=<future>` projects from your latest CTL/ATL over planned intervals TSS to that day. Verify on QA it returns a sane `form`/`freshness`.
**JM manual (QA):** select a FUTURE day in the week strip → no "How do you feel" / no "you're fresh" verdict; instead a blue **"Expected · <day> · forecast"** card with a projected Freshness face + "why" (Energy/Sleep noted as not-forecastable). TODAY unchanged. A PAST day shows only what you logged.

### R207b · #207 Phase 2b / #220 — learn-from-you stats (sleep default · VO₂max estimate · calibration) 🧪
**Unit tests:** `src/readiness.test.ts` (`calibrationOffset` gradual-drift: needs ≥5 days, median-robust to one outlier, caps ±1, ignores tiny bias; `learnedOffsets` per-dim incl. freshness=6−soreness; `readiness()` nudges the score + keeps `.raw`) + `src/running-paces.test.ts` (`estimateVo2max` Coggan/VDOT, takes the higher). `npm test` (145 green).
**JM manual (QA):** (1) Profile → General: **Sleep need** shows **8** with a "default" tag until you set it; **VO₂max** shows an **est.** value from your power/pace with a "updates as you train" note (type a value → "you" overrides). (2) Today check-in: edit a score consistently the same way across several days → after ~5 days the auto value should start showing **"· tuned to you"** and drift toward your ratings (the ⓘ explains the nudge). Expected: the model learns your bias; one off day doesn't move it.

### R216 · #216 — marathon prediction realism (potential→realistic range) 🧪
**Unit test:** `src/running-paces.test.ts` → `marathonDurabilityPenalty` + `marathonRealism` (17 cases: penalty 0 at race-ready base, max at no base, longest-run weighted > weekly volume, realistic ≥ potential, default 8% when no data, paces match times). `npm test` (39 green).
**Server:** `GET /auth/intervals/run-volume` → `{ available, longestKm, weeklyKm, runs }` from intervals run activities (last 6 wks). Verify on QA real account it returns sane km.
**JM manual (QA):** Profile → Running → Race predictions. Marathon row now reads a **range** "h:mm–h:mm" (amber, "range" badge, "potential → realistic", pace band below). The note explains the durability penalty (with your longest-run + weekly km when intervals connected) and points to the #215 estimate for the bigger gap. 5K/10K/Half unchanged. Expected: realistic (high) end sits closer to Coros than the old single optimistic time.

### R215 · #215 — estimate running threshold/VDOT from pace curve 🧪
**Unit test:** `src/sport-settings.test.ts` → `runThresholdFromPaceCurve` (Critical Speed → sec/km, r²-gated, garbage-safe).
**Verified on QA (real account):** `GET /auth/intervals/run-estimate` → 5:21/km (CS 3.117 m/s, r² 0.999) from jmfiset's runs.
**JM manual (QA):** Profile → Running. Blank pace → blue "Estimated from your recent runs: 5:21/km · VDOT N [Use this]"; pace set → quiet "Your runs suggest 5:21/km [Use]". Tap **Use** → fills + syncs to intervals + zones/predictions recompute (closer to Coros). Manual entry still wins.

### R210 · #210/#209/#211/#214 — per-sport stats two-way synced with intervals ✅ (JM-verified 2026-06-29)
**Unit tests:** `src/sport-settings.test.ts` (pull/push mapping, per-entry PUT body, CS estimate) + `src/running-paces.test.ts` (VDOT↔pace vs Daniels' VDOT-50 table, zones, predictions, RunPlayer pace). `npm test`.
**Push bug found+fixed in verify (#210b):** `PUT /athlete/{id}` {sportSettings} returns 200 but is a SILENT NO-OP; correct API = `PUT /athlete/{id}/sport-settings/{entryId}` with only the changed field (verified: ftp 262 + run pace 4:15 landed; custom fields preserved). KNOWN: intervals ignores `null` → can't clear a synced field to blank via API.
**JM-verified on QA:** 209 ✅ 210 ✅ 211 ✅ 212 ✅ 213 ✅ 214 ✅ (per-sport sync round-trips; race predictions + legible zones; diet in Profile; bad tiles gone).

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
now all show the same 6. (Note: that means **gym** now shows "Legs After / Fuel/GI" too — see #152,
JM wants gym to keep a gym-specific set.)
**Unit test:** `src/feedback.test.ts` → `npm test` (6 tests) — asserts the 6 field names in order,
Life Constraint + Mental State present, and every option list matches the intervals defs.
**You test:** open "✓ Done? Log how it went" for a ride/run.
**Expected:** fields read **Legs Before · Legs After · Fuel/GI · Pain/Niggles · Life Constraint ·
Mental State** with the exact intervals options (Legs After = strong/normal/tired OK/barely tired/
heavy/sore/cooked). NOTE: feedback is still Platyplus-local + fed to the coach — it does NOT yet
WRITE BACK to intervals (codes are stored for when we build that).

### R5 · #137 — check-in only showed for today (built + code-verified)
**Code evidence:** `Today.tsx:322` `<CheckInCard key={selDay} day={selDay}/>` → `checkins(day,day)`.
**You test:** on Today, pick a **past** day in the strip.
**Expected:** that day's check-in shows.

### R6 · #140 — Calendar Day snapped to today (built + code-verified)
**Code evidence:** `Calendar.tsx:81` syncs `sel`→URL; `:44` restores `?d=`.
**You test:** go to another day, leave + come back.
**Expected:** the day is preserved.

### R7 · #141 — route had no map tiles (built + code-verified)
**Code evidence:** `FlybyMap.tsx:20` `L.tileLayer(openstreetmap)`.
**You test:** import a `.fit` with GPS.
**Expected:** route on a real OSM map.

### R8 · #142 — imported-file fields editable (built + code-verified)
**Code evidence:** `LogActivity.tsx:153-175` every metric `disabled={!!fileB64}`.
**You test:** import a file.
**Expected:** metric fields are read-only.

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

> **Discipline (now permanent):** every fix lands with a test here + in `src/*.test.ts`; `🔨 built ≠ done`;
> only JM marks ✅ after the manual step passes. See `CLAUDE.md` → Testing, skill `platyplus-testing`,
> memory `platyplus-testing-workflow`.
