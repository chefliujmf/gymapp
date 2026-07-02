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

302. ⬜ **Flag incomplete onboarding / minimal setup.** JM 2026-07-02: if onboarding is unfinished or config incomplete,
    flag it. MUST-HAVES: intervals.icu connected (account + key); Strava connected INSIDE intervals; coach set up
    (coachProfile); sport/FTP/equipment set. Show a setup checklist / banner with what's missing + how to fix. gymapp-only.

301. ⬜ **Bi-directional EXERCISE sync intervals ↔ Platyplus.** JM 2026-07-02: changes to an exercise in intervals should
    mirror to Platyplus, and coach/athlete changes in Platyplus should reflect in intervals — both ways. STATUS: rides now
    round-trip (segments, #293). Gym exercises live in the plan NOTES (markdown table) → text syncs both ways, but STRUCTURED
    gym fields (tempo/sets/reps as data) don't round-trip because intervals has no gym-exercise structure. Architecture
    decision needed (canonical structured store + reconcile). gymapp-only.
300. ⬜ **No-video exercises — remove from the library OR source free/open-source videos.** JM 2026-07-02. Library: 3102
    video · 1379 image-only (Centr .jpg) · 49 no-media. Matcher now PREFERS video (#296) so prescribed exercises resolve to
    video ~93%+. Options: (a) drop the 49 no-media + hide image-only from browse; (b) source video for image-only from OPEN/
    FREE libs (wger, free-exercise-db, exercisedb). JM prefers videos. Decision needed before deleting 1379 entries.
299. ⬜ **Auto-trigger coach review on activity completed + feedback — EXISTS, verify.** JM 2026-07-02. Already wired:
    `/auth/activity/:id/feedback` → `runCoachTask` reviews the activity → `save_coach_review` (→ intervals Notes #290 + bell
    notification #233) + `set_activity_text` (#289). Gated on `coachProfile` (set for JM). Verify end-to-end on QA/prod.

298. 🔨 **Tag band exercises + make "Bands" a filter/equipment.** JM 2026-07-02: "identify and tag the ones with small
    band and make this available as a filter and equipment." FOUND: equipment "Bands" already exists (203 exercises) + the
    equipment filter is data-driven, so a Bands chip already showed — BUT ~25 band-ASSISTED moves (e.g. "Barbell Banded
    Squat", "Deadlift with Bands") were tagged by primary kit (Barbell/Dumbbell) so they were missed. FIXED: catalog.ts
    derives a `band` flag (equipment 'Bands' OR band in name) → 228 flagged; the "Bands" filter chip now matches the flag
    (catches band-assisted too); "Bands" always present in the equipment list. gymapp-only. **JM to verify on QA.**
297. ⬜ **Tempo chip (#284) not showing in dev.** JM 2026-07-02: "I don't see the tempo chip we agreed on." Verify the
    per-exercise tempo pill (e.g. 3-1-1-0) renders on the gym exercise cards (CoachPlanDetail + player). Likely a data
    issue (coach not setting `tempo`) or a render regression. gymapp-only.
296. ⬜ **Some exercises still have no video — the free library should cover them.** JM 2026-07-02. Investigate the demo
    match (matchExercise / exercise library): which exercises miss video, and whether the free (self-hosted) library has
    a clip we're not matching (name-matching gap) vs genuinely missing media. gymapp-only.
295. ⬜ **Pre-workout GYM insights — show stats before starting (e1RM / suggested weight per exercise if we have data).**
    JM 2026-07-02: "would be cool to have insights before starting the workout — 1-rep-max or suggested weight kind of
    thing if we have the data." Add per-exercise pre-workout stats to CoachPlanDetail/GymPlayer pre-start (est 1RM from
    history + suggested working weight for the prescribed reps via weightForReps). Same spirit as post-workout. gymapp-only.
294. ⬜ **Lost the gym REORDERING page in dev.** JM 2026-07-02: the pre-start "reorder exercises (↑↓)" step is gone.
    Investigate the flow CoachPlanDetail "Start workout" → GymPlayer pre-start (`!started && !done`) — did it get skipped/
    auto-started, or a routing regression? Restore it. gymapp-only.
292. 🔨 **Power-curve chart missing the hover scrubber the timeline has — standardize.** JM 2026-07-02 (DEV): the timeline
    charts show a vertical line + tooltip with the value at a point on hover; the POWER CURVE doesn't. "Standardize those
    graphs to be consistent." FIXED: `PowerCurveChart` now has the same hover scrubber — snaps to the nearest curve point,
    draws the vertical line + highlighted dot, and a `.chart-tip` tooltip ("20m · 179 W"). Same interaction/classes as the
    timeline TrendChart. gymapp-only. **JM to verify on QA.**
291. ⬜ **Replicate cyclingcoach "brian" logic + adapt to Platyplus — the engine port is INCOMPLETE.** JM 2026-07-01:
    "we need to replicate cycling coach brian and logic and adapt it to platyplus" + "other files like that you missed?"
    AUDIT: `sync-coach-engine.mjs` bundles only 11 of ~45 codex_coach files. MISSED behaviour files that matter:
    • `feedback_protocol.md` — WHERE coach output goes (public title/description = Strava-safe · private context → Notes/
      comment thread · quick-select fields). This is the rule JM is hitting.
    • `instructions_intervals_icu.md` — the public-vs-private PRINCIPLES (description can appear on Strava; free-text →
      Notes thread; never leak health/knee/"protect Saturday"). (API-direct bits don't apply — we act via Platyplus tools.)
    • `coach_feedback_format.md`, `coach_action_feedback.md`, `workout_analysis_template.md` — review structure/format.
    • Learned prefs in `coach_feedback_memory.md` (public-title examples) — currently only via per-user memory.
    PLAN: (1) port the missing knowledge into the engine (adapt API-direct → Platyplus-tool language); (2) give the coach
    the ACTIONS it's missing (#289 title/description, #290 review→Notes); (3) full behaviour audit brian↔Platyplus + close
    remaining gaps. Big — phase it. gymapp-only.
    🔨 DONE (2026-07-02): full triage of ~45 codex_coach files. PORTED (adapt): `coach_feedback_format.md` +
    `coach_action_feedback.md` + `weekly_checkin.md` → SHARED; `workout_analysis_template.md` + `training_zones.md` (canonical
    %FTP zones) → CYCLING; + the OUTPUT-ROUTING block (#289/#290). Engine now 8 generic / 7 cycling files. SKIPPED w/ reason:
    `gym_execution_options.md` (Centr-specific — Platyplus uses its own catalog + search_exercises); `instructions_intervals_icu.md`
    + `feedback_protocol.md` (CLI/API-direct — principles already ported via OUTPUT-ROUTING + coach_feedback_format);
    book source-notes (roar/next-level/boyle/plant-based — reference KNOWLEDGE, would bloat the prompt, not runtime method);
    Centr/cookbook nutrition-catalog files (Platyplus recipes + schedule_meal cover them); `athlete_profile.md`/`coach_feedback_memory.md`
    (per-USER, injected separately, not generic engine). Remaining phase: verify the ported behaviour on QA + fold learned public-text
    prefs into per-user memory. gymapp-only. **JM to verify coach behaviour on QA.**
290. 🔨 **Coach review/comments show in Platyplus but DON'T sync to intervals Notes.** JM 2026-07-01: "coach comments do
    not appear in the notes section (see it in platyplus but not sync)." ROOT CAUSE: `/api/coach-review` saves to
    `coachReviews` (Platyplus store) only — nothing is posted to the intervals activity message/comment thread. FIX: after
    saving, post the coach's PRIVATE-safe review (verdict + takeaways + recovery/next) to `/activity/{id}/messages` (like
    #287 does for the athlete comment) so it shows in intervals Notes. Keep private context OUT of the public description
    (feedback_protocol.md). gymapp-only.
289. 🔨 **Coach doesn't set the activity TITLE + DESCRIPTION in intervals (it's "not renamed").** JM 2026-07-01: "the coach
    has directives on how to give a title to strava + description … it's not renamed now … in fact it does it in intervals."
    The directive (`instructions_public_text.md`) IS in the compiled engine, but the coach has NO tool/action to WRITE a
    title/description onto the completed activity → nothing renames. FIX: add a Platyplus tool + server endpoint to PUT a
    public-safe `name` + `description` on the intervals activity (syncs to Strava); instruct the coach (post-workout flow)
    to set them per instructions_public_text (center the workout, no private-life/health leaks). gymapp-only.
288. 🔨 **New users won't have the custom feedback fields in intervals — create them on connect.** JM 2026-07-01:
    "a new user might not have the fields created (custom) so you'll have to create them in intervals in onboarding."
    Right — the 6 ACTIVITY_FIELDs (LegsBefore/LegsAfter/FuelGI/PainNiggles/LifeConstraint/MentalState) exist on JM's
    account but not a fresh one, so the 1-based values we write have nowhere to land. FIXED: `ensureIcuFields(user)` in
    server — GETs `/athlete/{id}/custom-item`, creates any missing field (POST custom-item, type select, options with
    1-based values matching icu-fields.ts), idempotent + best-effort. Called from `/auth/icu` whenever a key is set
    (covers onboarding connect + reconnect). gymapp-only. **JM to verify on a fresh QA account.**
287. 🔨 **Free-text comment doesn't sync to intervals (feel/RPE/fields do).** JM 2026-07-01 (QA): entered a comment on
    today's activity in Platyplus; the rest synced but the comment didn't appear in intervals. ROOT CAUSE: the comment
    isn't a field — it belongs in the intervals MESSAGE thread, and the write-back only PUT the custom fields. FIXED:
    `syncActivityNote(user, id, content)` POSTs the note to `/activity/{id}/messages` (deduped — skips if an identical
    comment already exists, so re-saving doesn't spam). Wired into `/auth/activity/:id/feedback`. Reads already surface it
    (#286 fetchActivityThread). gymapp-only. **JM to verify on QA.**
286. 🔨 **Monday post-workout round — bi-directional feedback + coach text + charts to standard (a #273 re-report).**
    JM 2026-07-01 testing "Monday" (completed ride i161348698): (a) "most feedback from intervals were NOT collected = no
    bi-directional sync" — his feel/RPE/fields didn't show; (b) "anything else should have my comments, it's empty" — his
    free-text comment didn't show; (c) "notes contain the description, it's wrong and not the coach feedback" — the plain
    workout description was shown as if it were coach notes; (d) "too bulky the fields with data"; (e) "our graphs are not
    following standards" — Y axis too compact, X axis not on every track; (f) "powercurve also without proper axis"; (g)
    "how are the intervals below defined? intervals isn't good at creating this → remove"; (h) "no coach feedback as per
    mockups… disappointed how far it is vs mockups". ROOT CAUSE (verified by SSH-inspecting the real intervals activity):
    the athlete's feel/fields are stored as **1-based number indices** (not strings); the **coach's review + the athlete's
    own comment live as intervals MESSAGES** (a comment thread), not in the activity description. FIXED:
    • `readIcuFeedback` maps numeric indices→labels (feel/RPE/6 custom fields) so his feedback shows read-only ("from
      intervals"), Edit to change — a→resolved.
    • New `fetchActivityThread(id)` reads the message thread → parses the **coach note** (score chip + verdict + takeaways +
      Next + a "Recovery & full note" expander for nutrition/supplements) AND the **athlete's own comment**; both shown.
      Coach review recognised by template (a "Coach note …" header / "Score: N/10" / "Recovery / Supplements"). c/h→resolved.
    • Feedback summary compacted: feel·RPE headline + small field pills + the comment in italics (was one long joined line). d→.
    • Charts to standard: PowerCurve gained a **Y axis (W) + X duration ticks**; timeline tracks taller (90px) so Y
      min/mid/max is readable + **X (time) on every track**; **removed the interval breakdown list** (intervals' auto-detect
      unreliable). e/f/g→resolved. Unit test `src/coach-note.test.ts` (parseCoachNote on the real Monday text).
    Self-validated vs mock (`mockups/monday-validate.html`) before flagging for JM test. gymapp-only. **JM to verify on QA.**
    **REWORK (mock-agreed 2026-07-01, `mockups/monday-postworkout.html`, 5 rounds):** JM reworked the whole detail view.
    BUILT to the agreed mock: (1) **thumbnail** = zone-coloured power blocks binned from the REAL stream (`PowerBlocks`),
    since the plan segments are degenerate (Monday's main 42-min block is 0 W); (2) **stats** = layout **B hero+chips**
    (4 headline tiles: Load/NP/Intensity/AvgHR + rest as chips); (3) **coach insight line under EVERY section** (Power/HR/
    Altitude timeline + power-curve + zones), computed from the metrics; (4) **denser axes on ALL charts** — TrendChart Y
    ticks now scale with height (~9 on a tall chart), round-minute TIME x-axis with gridlines both ways, wider Y gutter;
    PowerCurve got dense watt gridlines too. Removed the bulky per-track readout chips. gymapp-only. **JM to verify on QA.**

284. 🔨 **Gym UX: per-exercise TIPS + TEMPO (time-under-tension, e.g. 3-0-1-0) + a full-WORKOUT tip.** JM 2026-07-01:
    tips are good per-exercise (form cues) AND for the whole session; add a **tempo/TUT** prescription per lift
    (eccentric-pause-concentric-pause seconds → ~TUT/set). Data model: gym exercise gains `tempo` + `tip`; plan gains a
    session-level `tip`/focus. Coach prescribes them (update the coach prompt + create_workout tool). Show on the exercise
    card (planned/player/completed) + a workout tip banner. Pairs #242 (exercise list) + #255 (per-exercise insights) +
    the gym post-workout rework. Mock-first. gymapp-only.
285. 🔨 **Gym COMPLETED view still the OLD form (PostWorkout /feedback/:id) — doesnt match #273 mock.** JM 2026-07-01
    ("not much like the mockups"). #273 rich view is on ActivityDetail (device rides/runs); coach-plan + GYM completions go
    through PostWorkout, which is the old feel/RPE form. Rework the completed-workout path (esp. gym) to the #273 mock:
    verdict + sets/PR + feedback collapse. Unify onto one component with ActivityDetail. gymapp-only.
    🔨 BUILT 2026-07-02 (mock `mockups/gym-completed.html`, approved): new shared `src/GymSummary.tsx` — coach verdict +
    hero/chips (Volume/Sets/Reps/Time + muscles + PR count) + computed coach insight + by-exercise sets/PR cards (est 1RM,
    volume bar, tap→/progress) + feedback. Used by BOTH the GymPlayer done screen (dropped the old inline totals/highlights)
    AND the revisit path PostWorkout `/feedback/:id` (loads the local log by `plan-<id>` + PR baseline + review) instead of the
    bare feel/RPE form. PR badge from bestE1rmByExercise. **JM to verify on QA.**

283. 🔨 **Remove direct Platyplus↔Strava connect (use intervals as the hub).** JM 2026-07-01: his wife hit Strava 403
    "limit of connected athletes exceeded" — Strava caps an API app at 1 athlete until reviewed, and it's redundant since
    intervals already aggregates Strava/Garmin/Coros/Wahoo. REMOVED: the "Connect with Strava" UI in AccountSection + the
    coach's Platyplus-Strava guidance; onboarding + APP_HELP now say connect Strava/device INSIDE intervals.icu. KEPT:
    "view on Strava ↗" activity deep-links (via strava_id intervals fills in). `/auth/strava/*` + server/strava.js left
    dormant (gated) — removable later. Updated memory (platyplus-integrations, MEMORY index) + skill (platyplus-ops). gymapp-only.

282. ⬜ **(POST-LAUNCH) i18n — French & English, switchable in Settings.** JM 2026-07-01: after launch, support FR + EN
    with a language toggle in preferences/settings (default to device locale). Externalize UI strings (a lightweight i18n
    layer / string catalog), translate app copy + coach-facing labels; the COACH itself can already reply in the user's
    language via the prompt. Sizeable (touches most components) — do it as one pass post-launch. gymapp-only.

281. 🔨 **Login by EMAIL (not just username).** JM 2026-07-01: allow email as the credential. Client already offered
    "Username or email"; server `findByLogin` compared the raw stored email so it broke on any uppercase. FIXED: normalize
    both sides to lowercase (+ trim). Email or username both work now. gymapp-only.

280. 🔨 **PRE-workout UX rework — KEEP THE SAME SPIRIT as the post-workout view (#286).** JM 2026-07-01: "let's keep the
    same spirit for pre-workout." Mirror the LOCKED post-workout look on PlanDetail + CoachPlanDetail: **planned
    SegmentProfile thumbnail** (same clean treatment as PowerBlocks), **hero+chips** target summary (target TSS/IF/
    duration/zones), a **coach insight/tip line under EVERY section** (what to expect, key set, cues), and the planned
    power/pace SHAPE chart to the **dense chart standard** (round-minute-equivalent X, dense Y, gridlines). Mock-first,
    then build. Memory `platyplus-activity-view` + skill `platyplus-charts` hold the spec. (Original detail below.)
    JM 2026-07-01: rework the planned-workout
    detail to match the polish of the post-workout view (#273). Screens: `PlanDetail` (intervals-sourced) + `CoachPlanDetail`
    (coach-authored). TARGET (mock-first, mirror #273 components): a clean header (sport · date · duration · target TSS/IF),
    the **coach shell** (objective · cues · success · fuel · mind · recovery — already partly there), the **planned power/
    pace SHAPE** chart (watts via #276, chart-standard axes/labels, indoor/outdoor aware), a **"what to expect"** line
    (target zones, key set), gym = the exercise list (#242) with links, and a clear **Start/Play** CTA (or "open on phone"
    for rides). Pairs #273 (shared SegmentProfile/shape + coach text), #157 (intervals text parity), #242 (exercise list),
    (…original detail…) 🔨 BUILT 2026-07-02 (mock `mockups/pre-workout.html`, approved): CoachPlanDetail + PlanDetail ride
    views now have the MiniProfile header thumbnail, hero+chips of planned TARGETS (TSS/IF/Duration/Key-set + chips), the
    dense PLANNED POWER shape chart (TrendChart + round-minute x-ticks + gridlines) with a coach insight, a "what to expect"
    line, + the existing structure list + coach shell. New pure helpers `plannedSeries`/`plannedLoad` (IF/TSS) + tests.
    Gym plans keep the exercise list (#242/#284). **JM to verify on QA.**
    #167 (gym-player pre-workout time estimate). Build alongside #273 to reuse components. gymapp-only.
279. 🔨 **Missing-data handling: graceful degrade + "unlock" nudge + label estimates (don't fabricate).** JM 2026-07-01
    ("what happens if we don't collect data needed for coach calls / estimates?"). AUDIT: pure calcs already return null →
    UI shows "set X"/manual fallback; readiness gated on 14-day baseline (cold-start null); VO₂max/BMR null when inputs
    missing; coach told "adapt, don't invent" + onboarding data-readiness gate. RISK found: workout chart showed watts off a
    default FTP with no label. BUILT: (a) pure `dataGaps(user)` (+6 tests) → what's missing + what it unlocks (intervals /
    FTP / threshold pace / max HR / sleep need, sport-aware); (b) "⚡ Unlock more from your data" nudge card on Profile;
    (c) SegmentProfile FTP label now shows "· est — set yours" when using the fallback FTP (PlanDetail/CoachPlanDetail pass
    `ftpEstimated`). TODO later: extend to fuel targets once height/DOB collected (#265/#268). gymapp-only.
278. ⬜ **BYO-AI coach: support Gemini / Codex / Claude via the user's SUBSCRIPTION (no API), for QA.** JM 2026-07-01:
    build the coach runner to work with the user's own **subscription-logged CLI** (`claude`, `codex`, `gemini`) — NOT API
    keys — limited to these three for now (QA/testing, nothing else). Requires abstracting the coach invocation (today
    hardcoded `claude -p`) into a **runner interface** `(systemPrompt, message, tools, session) → stream + tool calls` with
    a per-provider adapter: each CLI in headless mode, MCP config for the platyplus tools, system-prompt injection, stream
    parsing, session handling (Claude `--resume`; others manage history ourselves). The coach IP (prompt/tools/
    coachProfile/coachMemory) is provider-agnostic — only the runner changes. Note: consumer-subscription hosting has ToS
    friction (see design analysis) — this is for QA/self-host, provider-selectable per user. gymapp-only.
277. 🔨 **Manual/Computed flow: add AUTO (computed-when-ready, manual until then).** JM 2026-06-30: when computed isn't
    ready he has to remember to switch to computed later — wants to "select computed but use manual until we learn enough."
    BUILT: statPrefs gains `auto` (now the DEFAULT). Benchmarks sheet = 3-way Manual / Auto / Computed with a hint
    explaining auto; the tag shows "auto · computed" or "auto · manual" so it's clear what's driving. Resolution: auto/
    computed prefer the computed value when available, fall back to manual. Server buildSystemPrompt honours auto too
    (`wantsComputed` helper) so the coach uses the estimate once ready. gymapp-only.
276. 🔨 **Workout power shows % on dev but WATTS on QA — JM wants WATTS.** JM 2026-06-30: same workout rendered % of FTP on
    dev, watts on QA — `SegmentProfile` shows watts only when an `ftp` prop is passed, and the detail pages sourced it from
    the local `getSetting('ftp')` which the dev test user lacked. FIXED: PlanDetail + CoachPlanDetail now resolve
    `ftp = plan.ftp || localFtp || user.ftp || 200`, so the chart always renders watts (real FTP when known, 200 W
    fallback otherwise). gymapp-only.
275. 🔨 **Running "Threshold" stat cell was EMPTY + not editable there.** JM 2026-06-30: the Threshold MiniCard on the
    Running stats page was hardcoded `null` (showed "—") though a threshold pace exists, and he wanted to edit it there,
    not only in Profile. FIXED: RunningStats Threshold cell now shows the pace and is tap-to-edit inline (parses m:ss,
    saves via saveSportStat → syncs to intervals + updates VDOT). (Also confirms #269 VO₂max fix: now reads 50.5 from HR,
    not 43.9.) gymapp-only.
274. ⬜ **"Why a beaver?" — onboarding card used 🦫 (beaver) but the brand is Platyplus (platypus).** JM 2026-06-30.
    FIXED: the Today "Meet your coach" card now uses the real Platyplus logo (favicon.svg) like the login screen, not a
    beaver emoji. (No platypus emoji exists → use the logo.) gymapp-only.
273. 🔨 **Post-workout UX, per activity type — intervals.icu-style analysis + coach text. MOCK LOCKED (5 rounds).**
    JM 2026-06-30/07-01. Mock: `mockups/post-workout-insights.html` (toggles: pre/post review, indoor/outdoor; tabs
    ride/run/gym/mind). LOCKED SPEC to build:
    • **Feedback-first flow**: before a review exists → header + "log how it went" + the FULL feedback form FIRST, stats
      below (no scrolling past stats to input). After submit + coach review → verdict on top, and the feedback **COLLAPSES
      to a one-line summary** ("🙂 Good · RPE 5 · legs normal→tired OK · focused") with tap-to-edit.
    • **Coach verdict** = existing `save_coach_review` (verdict/takeaways/next); EXECUTION SCORE shown as a **chip**, text is
      pure pro-coach voice (what's good/not, 💡 tip, 📈 progression, 🔥 motivation) — NO score in prose.
    • **Stats**: intervals-style metric GRID (Intensity, Load, NP, Avg P, VI, Act.eFTP, Avg/Max HR %, TRIMP, cadence, work,
      Form→) + **route map** (Leaflet, reuse #141/#51) + **stacked multi-track timeline** Power(vs planned band)/HR/Cadence/
      Altitude sharing an x-axis + per-interval CARDS (zone tag · dur · watts|pace · HR) + time-in-zone. Run mirrors it
      (pace/GAP/stride). **Charts MUST follow the chart standard** (Y min/mid/max, X labels, crisp non-overlapping text,
      insight line, not cramped — skill `platyplus-charts`).
    • **Indoor vs outdoor** = ride/run ONLY: indoor hides route + altitude, keeps sensor tracks. Gym/mind ignore venue.
    • **Gym**: each lift row links to its progress (e1RM/#255) + PR badge; no perf timeline.
    • **Activity-type buckets** (JM 2026-07-01): Ride · Run · Gym · **Yoga/Pilates** (mobility) · **Meditation** (= "Mind").
      Yoga/Pilates and Meditation are SEPARATE (not grouped) — both LIGHT (no perf charts; consistency/streak + a simple
      after-session check: yoga/pilates = "looser?/body", meditation = "calmer?/stress"). NO swimming (dropped). A generic
      **"Other / imported"** fallback (hike/walk/row/etc., render whatever streams exist) = POST-LAUNCH, later.
    • **Platform links**: Strava / intervals.icu / Garmin / Coros / Wahoo — only those the activity was actually pushed to.
    • **TRIMP**: surface in stats + use as the LOAD driver when no power (HR-only runs/indoor).
    Build: charts from activity streams (fetchActivityStreams #51); pre/post keyed on whether a coach-review exists.
    Pairs #54 + #91 + #255. gymapp-only.
272. 🔨 **Onboarding chat ERRORED: "No conversation found with session ID …".** JM 2026-06-30 (dev test of #257): tapping
    Set me up → coach chat died with a stale-session error. ROOT CAUSE: `/auth/chat` blindly passed `--resume
    <user.chatSession>`, but claude's local session store had been cleared (restart/deploy) → resume hard-fails. FIXED:
    dev path now retries ONCE with a fresh thread when resume fails ("no conversation found"); QA/prod helper path clears
    the stale id + asks the user to resend. So onboarding (and any chat) self-heals instead of dying. gymapp-only.
271. 🔨 **Running threshold suggestion: ASSESS confidence before suggesting (don't push a slower pace off thin data).**
    JM 2026-06-30 (dev): the #215 Critical-Speed estimate suggested a threshold SLOWER than set (5:21 vs 4:57), bare "Use"
    button → looks like an unexplained downgrade. JM: "if we're not confident because the user barely ran, we should
    assess before suggesting." FIXED: server `/run-estimate` now gates on recent run VOLUME (≥4–8 runs + km in 6 wks) AND
    fit (r2) → returns `confidence` high/medium/low; **low = not surfaced** (returns `assessed/reason`). Profile UI: shows
    a confident estimate only; if slower than set → muted "recent runs read slower… only switch if your threshold dropped"
    + "Use anyway"; if faster → "you've gained fitness"; if too few runs → gentle "not enough recent runs yet" (no Use).
    gymapp-only.
270. 🔨 **QA "lost my connection" to intervals (had to click sync to recreate).** JM 2026-06-30 (QA): the Today page showed
    "Connect intervals.icu…" though he was connected; clicking sync restored it. LIKELY a transient on QA container
    restart during a deploy (each dev push auto-redeploys QA → brief reconnect needed), NOT a data loss (Postgres pgdata
    persists; clicking sync re-resolved via the key). TODO: confirm no code path clears icuKey; consider the client
    auto-retrying the athlete pull / showing "reconnecting" instead of "Connect" right after a deploy. Watch for recurrence;
    not reproduced after sync. gymapp-only.
269. 🔨 **VO₂max too LOW / wrong again (Profile + per-sport).** JM 2026-06-30: Profile showed VO₂max 43.9 = ONLY the
    cycling Coggan (10.8·FTP/wt+7 = 10.8·260/76+7) and ignored the HR-ratio method we built in #234 → under-rated. ROOT
    CAUSE: Profile used the old `estimateVo2max` (Coggan + VDOT only), not `headlineVo2max` (#234, incl. HR-ratio
    15.3·HRmax/HRrest, ranked by confidence). FIXED: Profile now fetches resting HR from wellness + uses
    `headlineVo2max([running, cycling])` with per-sport max HR; running (medium conf, incl. HR-ratio) beats the low-conf
    cycling Coggan, so a high HRmax/HRrest reads a believable higher value. Copy shows source + confidence; manual wins.
    Tests: vo2max-submax (12) still green. Manual test: Profile VO₂max ≈ HR-ratio value, not 43.9. gymapp-only.
268. ⬜ **Two-way sync the intervals Basic Settings profile fields (don't re-enter them).** JM 2026-06-30 (screenshot of
    intervals → Settings → Basic Settings): instead of capturing profile data manually, **bi-directionally sync** the
    canonical fields from intervals.icu: **Sex, Weight, Height, Date of Birth (→ age), Resting HR** (+ units already there).
    intervals is the hub (architecture) — extend the athlete PULL (`/auth/intervals/athlete`, `fromIcuSportSettings` /
    the `/athlete/{id}` payload has `sex`, `height`, `weight`, `icu_resting_hr`, `date_of_birth`) to also read these into
    the Platyplus profile, and WRITE BACK on edit (mirror #210 ftp/maxHr two-way). This FEEDS #265 (BMR/TDEE/protein need
    sex+height+age+weight) — so #265's inputs come from intervals, edited in either place. Manual fallback for the few
    fields intervals lacks. gymapp-only. Pairs #265 + #257 (onboarding).
267. 🔨 **Intervals sync doesn't REMOVE upstream-deleted activities.** JM confirmed: the session was CREATED in
    intervals then DELETED there, but stayed in Platyplus → a device/intervals activity served from cache (the live fetch
    shouldn't return a deleted one). FIXED: intervals proxy now sends `Cache-Control: no-store` + client `fetchActivities`
    uses `cache:'no-store'`, so a deleted-upstream activity can't be served stale. Manual test: delete an activity in
    intervals → reopen History → it's gone. JM 2026-06-30 (QA): deleted/removed a session in
    intervals yesterday, ran an intervals sync in Platyplus, but the stale session still shows — deletions aren't
    reflected. Our sync likely only UPSERTS fetched activities and never prunes ones that vanished from intervals (or
    History merges a cached copy). FIX: on activity sync, reconcile = anything previously synced from intervals that's no
    longer in the fetched window should be removed/hidden (mirror the plan reconcile #150/#185, but for ACTIVITIES). Check
    where History merges intervals activities (`platyplus-activity-flow`) + any local cache. gymapp-only.
266. 🔨 **Passkey button does NOTHING on desktop (prod).** JM 2026-06-30: a fresh desktop has NO passkey, so the
    SIGN-IN button can't do anything useful + the only feedback was a tiny error line → "nothing happens". JM chose:
    A (suggest add after login) + C (clear error if you try passkey login with none). BUILT: (A) `PasskeyPrompt` modal —
    one-time, dismissible, shows after sign-in when WebAuthn is supported AND the account has 0 passkeys on this device →
    "Add a passkey" (registers via the existing authed flow). (C) Login passkey failure now shows a clear guide
    ("No passkey on this device yet — sign in with your password, then we'll offer to set one up.") instead of dying
    silently. Registration still also available in Settings → Passkeys. Manual test: fresh browser → password login →
    modal appears → Add → next sign-in uses Touch ID. gymapp-only.
265. ⬜ **Eat/Fuel: capture biological sex + compute BMR/TDEE & protein needs.** JM 2026-06-30: for fuelling we should
    capture male/female (biological sex drives BMR). Where under Profile? — add to the Profile "about you" block (already
    has weight/maxHR/sleepNeed; `sex` field already exists in `pub()` but isn't edited in the UI). Then compute:
    **BMR** (Mifflin-St Jeor: sex+weight+height+age), **TDEE** (BMR × activity, or better: BMR + intervals daily
    calories), **protein target** (1.6–2.2 g/kg by goal), and show on Eat (daily targets vs intake). Needs new fields:
    height, age/birth-year (sex exists). ALSO: cycle/menstrual considerations for women later (optional). Pure unit-tested
    `nutrition.ts` (BMR/TDEE/protein). gymapp-only.
264. 🔨 **Non-admin users must NOT have Coach API page access.** JM 2026-06-30: the Coach API token page (REST token for
    the coach bot) should be admin-only — hide the nav entry + guard the route for `role !== 'admin'`. (Token is a
    power-user/integration feature; a normal user like xenia shouldn't see it.) gymapp-only.
263. 🔨 **Profile page has no back button.** JM 2026-06-30: Profile is missing the ‹ back button every other sub-page has.
    Add the standard `sub-head` back button. gymapp-only.
262. 🔨 **New user inherits MY info.** JM 2026-06-30 (xenia's profile shows FTP 260, coach "Tadej", sports, 1 workout).
    ROOT CAUSE(S): (a) **server bug** — new users are seeded `icuAthlete: 'i28814'` (JM's intervals athlete ID), and ~10
    endpoints fall back to `|| 'i28814'`; so the moment a new user connects THEIR OWN intervals key they'd read JM's
    account. FIX: new users default to empty athlete, resolve the real athlete id from their own key (don't hardcode JM's).
    (b) **FTP 260** is a hardcoded local default (`setSetting('ftp','260')`) shown to everyone — not JM's data, but cosmetic
    (should be blank until set). (c) **coachName "Tadej" / "1 workout" / local logs** come from browser-local storage
    (Dexie + localStorage) shared when both accounts are tested in the SAME browser — not a server leak, but confirm
    per-user scoping (namespace local data by user id, or it bleeds across accounts on one device). gymapp-only.
261. 🔨 **Admin: click a user → see + SET a specific password.** JM 2026-06-30: as admin, click a user to expand and set a
    chosen password (not just the random reset). BUILT: `POST /auth/users/:id/password` (admin, bcrypt, min 6) +
    `authApi.setUserPassword` + Admin.tsx expandable row (Set password / Random reset / delete). gymapp-only.
260. 🔨 **Admin: "No users loaded (sign in as an admin)" shown during load (misleading).** JM 2026-06-30: the empty-state
    message flashes while the list is still fetching (and the admin IS signed in). BUILT: `loaded` flag → show "Loading…"
    until the fetch resolves, then "No users yet." if truly empty. gymapp-only.
259. ✅ **DECIDED: hand over credentials directly (no email). Free email for Add-user (account invite) + onboarding.** JM 2026-06-30: adding his wife — what's free to
    send the welcome/temp-password email? Server has `sendMail` but SMTP is unset. OPTIONS: (a) **just skip email** — the
    Add-user response already returns the temp password to the admin; for 1–2 users, hand it over directly (zero setup);
    (b) **Gmail SMTP via an App Password** (free, low-volume; nodemailer smtp.gmail.com) → set SMTP_* in AUTH_ENV secrets;
    (c) Resend/Brevo free tier (needs domain/verification — overkill for now). REC: (a) now, (b) if we want a real invite
    email. Then → onboarding (#257). gymapp-only.
258. 🧪 **Duplicate readiness note in TWO places (Today).** JM 2026-06-30: the collapsed check-in says "Coach knows
    you're run-down today" AND the plan banner says "A bit run-down — keep it easy…" — same insight twice. FIX: drop the
    restatement in the check-in card, keep the actionable plan banner + the "Ask coach" link. gymapp-only.
257. 🔨 **Onboarding flow for a new user → conversational, coach-led, generates first week.** JM 2026-06-30: chosen design —
    **conversational** (real-coach chat, tap/type/VOICE, chips are suggestions not limits), capture profile basics+sports,
    real-week availability, goal+experience, equipment+constraints + anything else. TRIGGER = **welcome card on Today**
    ("Meet your coach → Set me up"); skippable for the session, reappears until done. COMPLETE = coach saved profile AND
    drafted first week (explicit `finish_onboarding`). BUILT: Today welcome card (`onb-card`) → `/chat?onboard=1` where the
    coach greets first + runs the interview (prompt rewritten to lead, prefill known intervals fields, save via set_sports/
    set_athlete_profile, draft week via create_*, notify, then finish_onboarding); new MCP tool `finish_onboarding` →
    `POST /api/onboarding/complete` sets `onboardedAt` (in pub()); Chat auto-greets in onboard mode + refreshes auth so the
    card clears. Voice already in Chat. NEXT: verify the full loop on QA; richer first-plan quality ties to #256 port. gymapp-only.
    onboarding (structured: sports, goals, experience, equipment, constraints — STT optional, #183) and, from it, have the
    coach generate a compelling first week/plan. **Onboarding also captures the PROFILE basics** (JM 2026-06-30: sex,
    height, DOB, weight, resting HR — see #268/#265) — prefill from intervals when connected, ask for what's missing, so
    BMR/TDEE/protein + readiness work from day one. Pairs #183 (wizard) + the coach engine (#18/#65) + #268 + #265. gymapp-only.
256. ⬜ **(LATER) Test the in-app coach so cyclingcoach can be ARCHIVED + port any missing improvements.** JM 2026-06-30:
    verify the full Platyplus coach loop end-to-end (chat + plan create/adjust + reviews + notify) so the standalone
    cyclingcoach repo can be retired. First **read cyclingcoach for interesting improvements not yet in Platyplus** (method/
    KB/prompts) and port them. Pairs #18 (coach loop verify) + #91 (real coach takeaways). gymapp-only.
    **PORT STATUS (JM 2026-06-30: "port ALL, not just top 5"):** ✅ DONE — public-text/title-description rule (his latest
    cyclingcoach change: center the workout, never leak cottage/home/wealth/health; syncs to Strava) → new
    `instructions_public_text.md` in the generic engine; female module expanded from a 38-line stub to a full distilled
    module (RED-S, fuelling, cycle-phase, perimenopause/masters, heavy-lifting, pregnancy) → recompiled (coach-engine-female
    1514 words). ⬜ TODO knowledge: distill + wire feedback_protocol/COACHCHECK + exercise_library (token-budget aware —
    don't dump raw 500-line KBs into every prompt). ⬜ TODO **code features**: ✅ (1) per-athlete learned baselines
    (HRV/RHR rolling mean±SD from wellness → stashed + injected). ✅ (2) durable coach MEMORY — `coachMemory` field +
    GET `/auth/coach-memory` (review) + PUT `/api/coach-memory` (coach writes) + MCP `save_coach_memory` + prompt injects
    it every session with read-before/update-after instructions (separate from the athlete profile). ⬜ (3) ENFORCED
    health/overtraining gates — the KNOWLEDGE is injected (instructions_health_and_peaking); a code `checkHealthGates()`
    that hard-flags NFO clusters (↑RHR/↓HRV/short sleep/heavy legs/RPE for 3+d) is the remaining piece. ⬜ small: a read-only
    "Coach memory" view in-app (endpoint exists) for transparency; distill feedback_protocol/exercise_library (token-aware).
    **DIFF DONE 2026-06-30 (agent scan of /Users/jmfiset/dev/cyclingcoach):** same engine, but cyclingcoach is ENRICHED
    with per-athlete memory + learned baselines + detailed rule-sets Platyplus lacks. Prioritized port list (ROI order):
    (1) **Per-athlete physiology baselines** — learned HRV mean/SD, RHR, LTHR, FTP, VO₂max from the athlete's own 60–90d
    data (gates readiness/FTP calls; Platyplus injects raw fixed values, no HRV/RHR baseline). Med. Pairs readiness engine.
    (2) **Coach feedback MEMORY** — durable per-athlete rules of what advice worked/failed + comms prefs ("challenge me",
    "be progressive not cautious"); Platyplus starts every session fresh. Large (needs a `coachMemory` store + read-before/
    update-after rules). (3) **Health/overtraining/illness GATES** — neck-check illness rule, return-to-training ladder,
    NFO tripwires (2+ of ↑RHR/↓HRV/short sleep/heavy legs/power fade/↑RPE for 3+d → mandatory downshift), heat/taper. Safety
    guardrail Platyplus has NONE of. Med-Lg (`checkHealthGates()`). (4) **Structured athlete PROFILE** — volume band, ride
    floor (60m), gym duration, travel/cottage pattern, communication style, public-text privacy → feeds #257 onboarding +
    `buildSystemPrompt`. Med. (5) **Weekly-planning macrocycle rules** — availability-anchored week shapes, session-priority
    ladder, ~10–15%/wk ramp gate, Form/CTL projection check. Med. (6) nutrition/recovery framework (quantities, carb
    periodization, vegan B12/iron/creatine). (7) female detail (RED-S, cycle-phase, perimenopause — flesh out the
    `coach-engine-female.md` stub). (8) strength exercise LIBRARY (curated + progressions). (9) FTP multi-method +
    confidence. (10) coach recipe library. Also: intervals publishing rules (time_target mandatory, split >1h, workout_doc)
    → fold into coach-engine; COACHCHECK feedback protocol/completion gate. Already in Platyplus (don't re-port): readiness
    scores, base coach-engine/cycling module. **#4 (+#1) directly inform #257 onboarding** — capture structured profile +
    seed baselines at signup.
255. 🔨 **Per-exercise INSIGHTS for gym.** 🔨 BUILT 2026-07-02: pure `exerciseInsight(pts, fmt)` in strength.ts →
    tone (pr/up/stall/flat/new) + a coach-style line from the dated e1RM history (on-form/PR, trending up, stalled ~N wk
    off peak → vary reps/deload, holding → push top set). Unit-tested (6 cases). Rendered in the Progress lift modal (💡
    Coach line under the e1RM chart), unit-aware. Fits the insights-everywhere directive. **JM to verify on QA.** Original:
    JM 2026-06-30: each gym exercise/lift should get its own insight — progression
    (e1RM trend up/flat/down), PRs, plateau flag, volume, and a coach-style tip ("add a set", "deload", "you've stalled 3
    weeks — vary rep range"). Extends the lift detail (#93 dated e1RM chart) + the chart-standard insight + coach insights
    (#249) to the per-exercise level. Pure insight fn (unit-tested) feeding the Progress lift modal / a per-exercise view. gymapp-only.
254. ⬜ **(NOTE) Respect the cycling coach's WEEKLY MACRO TARGET when updating/reconciling plans.** JM 2026-06-30: the
    cycling coach was entering a weekly macro target (the week's overall load/hours/intensity goal, likely an intervals
    TARGET event or a weekly note). When Platyplus updates/syncs/reconciles plans, it must **preserve** that macro target,
    not clobber/delete it. VERIFY: the reconcile/dedup (#150/#185, `syncIcuPlans`/`planDroppedByReconcile`) only touches
    Platyplus-origin WORKOUT events — TARGET/macro events should already be left alone, but CONFIRM when next touching the
    plan-update path; and the coach engine should read the weekly macro as context. Pairs the coach loop (#18/#65/#76). gymapp-only.
253. ⬜ **(LATER) Extract bodyweight exercises from "la méthode Lafay" — only ones NOT already in the catalog.** JM
    2026-06-30: "to be done much later." Mine the Lafay method (French bodyweight/calisthenics) for movements we lack, add
    them as catalog exercises (name, muscle group, bodyweight, equipment=none). LICENSING: facts/movement names are fine,
    but do NOT copy the book's descriptions/photos (media-independence + content rules, CONTENT.md) — write our own or use
    free-licensed media. De-dup against the existing 4,500 exercises first. Parked. gymapp-only.
252. 🧪 **Date filter MISSING on Progress (standard on every stats page); + domain filters everywhere.** JM 2026-06-30:
    "don't see date filters as per requirements — it's standard" + "add other filters: by exercise type, muscle group,
    equipment, whatever." Progress is hardcoded "8 wk", no range control. FIX: add the shared `DateRangeFilter` to
    **Progress** (audit Fitness/Wellness/per-sport already have it); add **domain filters** (type/muscle/equipment/search)
    to **Exercises** (extends #243) + where relevant. Codified in skill `platyplus-charts` + memory
    `list-pages-filters-sorting` (date filter = standard on every stats/trend page). gymapp-only.
251. 🧪 **Progress: "1 session · 0h" wrong for gym.** JM 2026-06-30 (QA): a logged gym session shows 0h — the
    hours/volume aggregation doesn't count strength duration. Fix the Progress totals to include gym session minutes. gymapp-only.
250. 🧪 **History rows aren't clickable → can't open the activity analysis; + no coach insights.** JM 2026-06-30: tapping
    a History session should open the activity detail (#54 map/flyby/timeline analysis). Also wants coach insights surfaced
    in History (pairs #249/#54). Make rows Links to /activity/:id (device) or the right detail. gymapp-only.
249. 🧪 **Wellness page needs COACH INSIGHTS, not just charts.** JM 2026-06-30: "wellness is nice but no insights from
    coach. Assume the user doesn't know the science — coach explains (to an ADULT, not ELI5) + tips to improve / what to
    watch." Add a coach-generated explanation + tips block on the Wellness page (HRV/sleep/RHR/weight trends → what they
    mean for THEM + actions). Pairs the coach engine + #250. gymapp-only.
248. 🧪 **Load/Form/Training-load: add avg·min·max stats + FUTURE projection from the plan.** JM 2026-06-30: training-load
    insight is there but wants explicit avg/min/max + **projected CTL/ATL/Form from planned load** (dotted future line).
    Same for Fitness & Form charts. We have `projectForm` (#223) — extend the charts with a forward projection. gymapp-only.
247. 🧪 **VO₂max sheet: overlaps the bottom bar + let me type a manual value even in Computed mode.** JM 2026-06-30:
    (a) the manual/computed sheet overlaps the bottom nav (z-index/position). (b) REVISES the earlier "lock input on
    Computed" — the input should be EDITABLE anytime (typing sets the manual value; the toggle just picks which DRIVES).
    Unlock the field + fix the overlap. gymapp-only.
246. ⬜ **Eat → Shopping: no add/modify/delete + the date filter is wrong for groceries.** JM 2026-06-30: can't edit the
    shopping list; "this week / next 14 days" is odd — you don't buy food that far ahead. Add item CRUD + a sensible
    shopping horizon (e.g. today/this-week, editable). gymapp-only.
245. ⬜ **Eat → can't build Packs / can't add new meals.** JM 2026-06-30: the Packs flow doesn't let you build/assign a
    pack; can't add a new meal. Wire pack→calendar + add-meal. gymapp-only.
244. 🧪 **Eat → Packs/Meals/Shopping tabs don't respect the theme (light buttons).** JM 2026-06-30: the segmented tabs
    use the wrong colors (light on dark). Restyle to the dark theme like the rest. gymapp-only.
243. 🧪 **Exercises: filter/tag by equipment (esp. "bands" — elastic/soft bands).** JM 2026-06-30: wants to see which
    exercises use bands. Add an equipment filter/tag (bands incl. soft/elastic) to the Exercises list. gymapp-only.
242. 🔨 **Workouts: where's the exercise list?** JM 2026-06-30: in Workouts he can't find the list of exercises a workout
    contains. Surface each workout's exercises (in the card/detail). gymapp-only.
241. 🧪 **Remove the Trainers section (Train page).** JM 2026-06-30: drop "Trainers" (Alex Rivera / Mia Chen / Dev Okafor) —
    not wanted. gymapp-only.
240. 🧪 **Thumbnail too small AGAIN (Plan/Calendar cards).** JM 2026-06-30 ("checking the batch"): a workout card thumbnail
    is tiny again — likely the Plan/Calendar PlanCard uses a different thumbnail path than the History MiniProfile fixed in
    #221. Find + fix to fill the box. gymapp-only.

239. 🧪 **White native controls on dark (number spinners, date pickers) — FIXED.** JM 2026-06-30: "bad UX, white buttons
    with grey text" — native `<input type=number>` spinner steppers (kg/reps etc.) rendered light on the dark theme. FIX:
    `color-scheme: dark` on `:root` → all native controls (spinners, date pickers, scrollbars) render dark. gymapp-only.
238. ⬜ **Bottom nav bar sometimes disappears.** JM 2026-06-30: "sometimes the bar at bottom goes away, why?" The bottom
    tab bar (Plan/Train/Eat/Stats) is intermittently gone. Investigate: scroll-hide? sub-pages (sub-head/back) dropping
    it? keyboard/viewport? It should be consistent. gymapp-only.
237. ⬜ **VDOT (from threshold pace) contradicts HR-ratio VO₂max → flag stale pace.** JM 2026-06-30 (QA): Running shows
    VDOT 41 (from pace 4:57/km) but VO₂max 50.5 (HR-ratio) — VDOT ≈ running VO₂max so this is contradictory. ROOT: his
    threshold pace is set slow/stale, so VDOT + zones + predictions are all too easy while HR says he's fitter. SHIPPED a
    ⚠️ flag on the Running page ("pace may be stale, update it"). TODO: reconcile properly — prompt to update pace / use
    the **#215** estimate-from-runs so VDOT/zones/predictions match reality. Pairs #215/#216/#234. gymapp-only.
236. 🧪 **Benchmarks = MANUAL vs COMPUTED, both shown, preference in Settings (JM's chosen model).** JM 2026-06-30:
    "I prefer the option to set it manually OR estimated — have BOTH values, and in Settings decide the preference. Same
    for FTP or other data like that. Manual-vs-computed kind of thing." THE MODEL (supersedes the earlier anchor/freeze
    idea, unifies #231): every benchmark holds **both** a `computed` value (engine/intervals estimate) and a `manual`
    value (user-entered); the card shows **both**; a **per-stat Settings preference** picks which one DRIVES (manual /
    computed / maybe auto-prefer). Applies to **VO₂max, FTP (set vs eFTP), threshold pace (set vs estimated), max HR**,
    etc. Computed keeps updating regardless; switching preference just changes which feeds readiness/coach/zones.
    **DESIGN LOCKED 2026-06-30 (mock `mockups/manual-vs-computed.html`, option C):** grid tiles stay CLEAN (in-use value
    + "tap to switch"); tapping a benchmark opens a **sheet** with BOTH values (computed + manual), a value **input**, and
    a **Manual | Computed** toggle (NO Auto — JM). RULE: input is **EDITABLE only in Manual**; in **Computed** it's
    **locked/read-only** (the live estimate drives). Switch to Manual to edit. Settings keeps a master list (mirror).
    Applies to VO₂max, FTP (set vs eFTP), threshold pace, max HR, etc. Computed keeps updating regardless. Build the
    {computed, manual, prefer:'manual'|'computed'} model + the sheet + Settings list. Pairs #231/#234/#215. gymapp-only.
    **🧪 BUILT 2026-06-30:** server persists `user.statPrefs` ({vo2max/ftp/thresholdPace/maxHr: manual|computed}, via
    PUT /auth/profile, in pub()). Rewrote `src/Benchmarks.tsx`: tiles show the in-use value + a manual/computed tag +
    "tap to switch"; tapping opens a **sheet** with BOTH values, an input **editable only in Manual** (locked on Computed),
    a Manual|Computed toggle (Computed disabled when no estimate), Done. Computed sources: VO₂max submax, FTP→eFTP (wellness),
    pace→#215 estimate, maxHr→manual-only for now. Saves manual via saveProfile/saveSportStat + the pref. 179 tests, tsc+
    build clean. Profile's own editors unchanged (Stats card is the new manual/computed home).
    **🧪 statPrefs-aware COACH BUILT 2026-06-30:** the coach prompt now resolves **VO₂max by `statPrefs.vo2max`** —
    `computed` → the server submax estimate (`bestVo2maxEstimate`: HR-ratio/VDOT/power÷weight, mirrors the app, matches
    JM's ~50.5), `manual`/default → his set value. Stashed `user.restingHR` (from /auth/readiness) so the coach's HR-ratio
    matches what the app shows. NOTE: readiness SCORES don't consume these benchmarks (HRV/sleep/Form only), so nothing to
    wire there. **🧪 FTP + pace computed server-side BUILT 2026-06-30:** stash `user.eftp` (from /auth/readiness wellness)
    + `user.runPaceEst` (from /auth/intervals/run-estimate); the coach now resolves **FTP** (computed→eFTP) and **threshold
    pace** (computed→#215 estimate) by statPrefs too, labelled "(estimated)". REMAINING: maxHr computed source (no clean
    one); statPrefs fully end-to-end otherwise. 182 green.
235. 🧪 **Readiness learning: confirm sleep learns + a preference to turn auto-adapt ON/OFF.** JM 2026-06-30: "for sleep
    are we learning? would like our engine to learn & adapt it — with a preference to turn on or off." CONFIRMED: the
    calibration (#207 Phase 2b) DOES learn sleep + freshness + energy from your overrides (sleep NEED stays manual).
    **🧪 BUILT 2026-06-30:** a **"Learn from my check-ins"** toggle in Profile (under Your stats) → `user.learnReadiness`
    (default ON, via PUT /auth/profile + pub()). When OFF, `/auth/readiness` skips the calibration entirely (no offsets,
    no "tuned to you"); ON = adapts as before. tsc+build clean, 182 tests. gymapp-only.

234. 🧪 **VO₂max: SUBMAXIMAL/passive estimate (no max effort) + confidence + learn over time.** JM 2026-06-30: "we need
    to learn + see if this number is right over time… any way to measure WITHOUT max efforts?" Re-anchored on JM's reply:
    the primary method is **submaximal**, the way Coros/Garmin do it — no test required. BUILD:
    (1) **Submaximal estimate** — **HR-ratio** `VO₂max ≈ 15.3 × HRmax/HRrest` (JM: 185/~55 ≈ 51–52, matches his Léger),
    refined per-run by extrapolating steady-run **HR↔pace** toward HRmax (run) / HR↔power (bike). Uses data already in
    intervals (max HR, resting HR from wellness, steady efforts). Replaces the conservative Coggan W/kg as the default.
    (2) **Source + date + confidence** — submax estimate = medium (the new default), a real field test = high (overrides),
    cycling-W/kg = low fallback. (3) **Learn/drift** (JM confirmed) — estimate tracks training; if a one-off test exists it
    anchors; nudge a re-check only if the estimate drifts or it's stale. (4) Max field test (Cooper/Léger/ramp) stays
    OPTIONAL. Pure `vo2max-submax.ts` + tests. Pairs #231 / #207 / #215. gymapp-only.
    **PER-SPORT (JM 2026-06-30 "this for per sports?"):** VO₂max is one engine but reads differently by sport (running >
    cycling typically) — like Garmin/Coros's separate running vs cycling VO₂max. So: **Running VO₂max** (=VDOT, HR↔pace)
    on the Running page (JM ≈52), **Cycling VO₂max** (HR↔power/eFTP) on the Cycling page; HR-ratio is the sport-agnostic
    fallback anchor; the **global benchmark snapshot shows the headline** (best/primary sport) tagged with sport +
    confidence. Per-sport estimates + a global headline.
    **🧪 BUILT 2026-06-30 (mock A approved; estimator + cards, no test):** pure `src/vo2max-submax.ts` — `hrRatioVo2max`
    (15.3·HRmax/HRrest; JM 185/55 ≈ 51.5 ✓ his Léger), `runningVo2max` (VDOT vs HR-ratio, higher wins → 52 not the slow-
    pace 43), `cyclingVo2max` (Coggan, HR-ratio×0.95 fallback), `headlineVo2max` (manual wins, else best by confidence).
    Wired: **Benchmarks card** headline now uses the submax estimate (pulls a recent resting HR) + source/confidence note;
    **Running page** shows VO₂max + "{estimated/measured} from {source}"; **Cycling page** notes its is a rough power-based
    estimate. Manual = high confidence (overrides everywhere). 12 tests, 179 total green. DEFERRED: VO₂max trend chart
    (needs stored history) + optional guided field test. MINOR: Profile's General VO₂max still shows the old Coggan until
    set manually (Stats card is canonical). gymapp-only.
233. 🔨 **Notifications: coach updates (what changed) + new activity arrived.** JM 2026-06-30: "would be cool to know
    when the coach has updates and WHAT; and when a new activity is in there." Build two notification types: (1) **coach
    update** — when the coach adjusts the plan / posts a review, notify with a one-line "what changed" (the coach already
    has a `notify` tool — surface those in-app + push); (2) **new activity** — when a new intervals/device activity
    appears in History, notify. Tie into the existing notifications model + the releases/bell. gymapp-only.
232. ⬜ **Activity + changes/audit log for investigation.** JM 2026-06-30: "have an activity and changes log too for
    investigation." A timestamped log of what changed — plan edits, coach actions, syncs, activity ingest, stat edits —
    queryable for debugging "why did X change?". (FEEDBACK-LOG is the human backlog; this is a runtime/audit trail.)
    Decide scope: server-side audit table vs an in-app "recent changes" view. gymapp-only.
231. ⬜ **Benchmark clarity: eFTP vs FTP + VO₂max reads low vs Coros.** JM 2026-06-30: "FTP intervals but don't see
    eFTP? confusing. VO₂max so low — Coros much higher." The card shows the SET FTP (synced); eFTP (estimated) is only a
    trend on the Cycling page. VO₂max = Coggan `10.8·FTP÷weight+7` ≈ 44, conservative vs Coros's HR-based model. SHIPPED:
    a clarifying note + VO₂max is tap-to-edit (enter your watch's value → "you"). TODO: prefer a REAL device VO₂max if
    intervals carries one (investigate icu fields); consider showing eFTP alongside set-FTP. NOTE: JM's **Léger-Boucher
    test ≈ 52** (a direct maximal running test) — that's the true value, far better than our 43.9 cycling proxy; he should
    set it manually (and it confirms the cycling W/kg estimate reads low for runners). gymapp-only.
230. ⬜ **Chart standard — retrofit all axis-less graphs (codified in skill `platyplus-charts` + memory).** JM 2026-06-30:
    "you keep creating graphs I cannot use — no X/Y axis, no insights. Make ALL graphs useful + consistent. Update skills,
    memory, agent." DONE: skill `platyplus-charts` + memory `platyplus-chart-standard` (every chart = X+Y axes + labels,
    crisp HTML-overlay text, an insight line, shared component, shared DateRangeFilter). RETROFIT (⬜): the activity
    **Timeline** charts (#54 power/HR/altitude/cadence — no axes/values), Mind weekly bars, Running pace trend, per-sport
    minis → all to the standard; generalise Wellness `WTrend` into one shared chart. gymapp-only.
    **🧪 RETROFITS (2026-06-30):** (1) **Training load / day** → chart card w/ axes + labels + insight. (2) **Activity
    Timeline** (#54 power/HR/altitude/cadence) → each chart now has a **Y axis** + a shared **TIME x-axis** (mm:ss from the
    time stream) + an **avg·max** stat in the label; synced scrub kept. (3) **Mind weekly minutes** → axes + week labels +
    insight ("~N min/week"). (4) **Running pace trend** BUILT — new `GET /auth/intervals/run-pace-trend` (per-week
    weighted avg pace, 8 wks) → RunningStats chart card w/ axes + week labels + insight ("Xs/km faster/slower than 8
    weeks ago"). Only the per-sport mini sparklines remain as-is (small cards = the standard's thumbnail exception).
    **#230 effectively done.**
229. 🧪 **Bugs (FIXED 2026-06-30):** (a) check-in falsely showed "edited (auto N)" when the user didn't edit — override
    detection compared the stored value to the LIVE recompute, which drifts (calibration/recalibration/new data); now it
    compares to the auto value RECORDED at fill (`ci.auto`). (b) Load & Form's lone "Training load / day" card was
    half-width — now full-width (`.fit-grid--one`), consistent. gymapp-only.

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
    **🧪 BUILT 2026-06-30:** shared **`BenchmarksCard`** (`src/Benchmarks.tsx`) — VO₂max/FTP/pace/maxHR/weight/sleep-need,
    each tap-to-edit (saveProfile + saveSportStat, intervals-synced), source tag spaced off the label (JM "too close" fix).
    Placed at the **TOP of Stats** (global leads) and editable there (JM chose **edit in BOTH**); Profile keeps its editors
    + gains a "See trends & race predictions in Stats →" link. Weight read-only (intervals). tsc+build clean.
227. 🧪 **Gym/strength sessions in History should be COLLAPSED by default.** JM 2026-06-30: a logged strength session
    expands all exercises × sets (kg/reps spinners) → the History page gets very long. Show a compact summary row
    (title · duration · volume · TSS) collapsed by default; tap to expand the sets. Applies in History (`/logs`) at least.
    Pairs with #226 (History filters). gymapp-only.
226. ✅ **History needs FILTERS + SORTING at the top (and list pages generally).** (JM-verified QA 2026-06-30.) JM 2026-06-30: "digging in history
    without dates or by activity type makes it hard to find what I'm looking for, even the title." Add a filter/sort bar
    to History (`/logs`): **date range**, **activity type** (ride/run/gym/mind/…), **title search**, maybe sort
    (newest/oldest). GENERAL PRINCIPLE (banked to memory): every list/history page should have top filters + sorting —
    always design them in. gymapp-only; pairs #227.
225. 🧪 **Stats IA: GLOBAL vs PER-SPORT (the #194b toggle was the wrong model) — BUILT.** Consolidated Stats+Profile IA
    pass (mock `mockups/stats-profile-ia.html` approved). **GLOBAL:** `/fitness` is now **Load & Form only** (toggle
    dropped), Wellness, History. **PER-SPORT pages:** new `/cycling-stats` (power curve/eFTP/VO₂max/W·kg, moved out of
    Fitness) + new `/running-stats` (threshold pace/Daniels zones/VDOT/race predictions — the missing one, fixes Running
    landing on cycling power). Strength→/progress, Mind→/mind-stats. Stats hub reordered (global on top). **Shared
    `DateRangeFilter`** (always-visible From/To, presets prefill — JM tweak) with **per-context presets** (recovery 7/30/60d,
    training 6wk–1yr). tsc+build clean, 167 tests. gymapp-only.
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
221. ✅ **NO inferred ramps — mirror intervals literally, flat blocks (supersedes #219's ramp rendering).** (JM-verified QA 2026-06-30.) JM 2026-06-30
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
218. ✅ **Stale PWA bundle persists after deploy (the real #200 root) + icu plans never refreshed.** (JM-verified QA 2026-06-30.) JM 2026-06-29 (QA):
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
198. ✅ **Sports as show/hide MODULES (cycling/running/strength/yoga/pilates/meditation).** (JM-verified QA 2026-06-30.) JM (2026-06-27): each
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
194. ✅ **Stats v1 follow-ups (after #193 grouping) — (a)(b)(c) ALL BUILT.** (JM-verified QA 2026-06-30.) v1 routes to EXISTING pages, so: (a) WELLNESS card from the
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

### 🧮 UNIT TEST INVENTORY (`npm test` → 182 in 13 files; keep current with every fix)
- `readiness.test.ts` (45) — readiness math: baselines/freshness/energy/sleep, calibration, forecast, server VO₂max (#195/#207/#208/#223/#234/#236)
- `running-paces.test.ts` (43) — VDOT↔pace, zones, race predictions, marathon realism, VO₂max est (#209/#211/#214/#216/#234)
- `sport-settings.test.ts` (18) — intervals pull/push mapping + run-estimate (#210/#215)
- `icu-dedup.test.ts` (12) — intervals dedup + replaced-plan cleanup (#150/#185)
- `vo2max-submax.test.ts` (12) — submax VO₂max: HR-ratio/running/cycling/headline (#234)
- `intervals-steps.test.ts` (10) — stepPctFtp + flatten zone→%FTP (#217)
- `feedback.test.ts` (7) — post-workout feedback ↔ intervals fields (#147)
- `mind-stats.test.ts` (7) — mind minutes/sessions/streak (#194c)
- `modules.test.ts` (7) — sport modules userModules/hasModule (#198)
- `ride.test.ts` (6) — flat segment no-ramp + mobile gate (#221/#139)
- `logs-merge.test.ts` (5) — day-merge, no phantom dup (#197)
- `stats-hub.test.ts` (5) — Stats global/per-sport grouping + routes (#193/#225)
- `zones.test.ts` (5) — power zones + segment coloring (#72)
**Rule: any pure-logic fix/feature adds (or extends) a file here + this count updates.** UI-only/server-side-effect changes (no pure fn) note "manual test" in the QA checklist instead.

### ✅ QA PASS CHECKLIST — 2026-06-30 (terse — do top-down, mark ✅ in the queue)
Run `npm test` first (math). Then on QA:
- [ ] #221 ✅ Ride with warmup/cooldown → flat blocks, thumbnail full-size
- [ ] #217 ✅ "Cottage" ride → realistic watts
- [ ] #218 ✅ Deploy → app updates, no login wall
- [ ] #198 ✅ Toggle a sport in Profile → hides/shows everywhere
- [ ] #226 ✅ History → search + type + date + sort
- [ ] #227 History → gym session collapsed, tap to expand
- [ ] #194 ✅ Wellness page charts have axes + avg + band
- [ ] #207 Sleep need defaults 8; edit a score ~5 days → "tuned to you"
- [ ] #229 A score you didn't touch → no "edited" tag
- [ ] #223 Future day → forecast card, no verdict
- [ ] #206 Morning → ⟳ on wellness chips pulls a new sync
- [ ] #228 Stats → editable benchmarks card on top
- [ ] #234 VO₂max ~52, not 43.9; tap → enter 52
- [ ] #225 /fitness = Load&Form; Cycling/Running/Mind = own pages
- [ ] #216 Running → Marathon shows a range
- [ ] #239 No white number-spinners (kg/reps) on dark
- [ ] #237 Running → ⚠️ flag if pace is stale

(Detailed steps in the per-item rows below.)

**How to run the automated net:** `npm test` (unit, `src/*.test.ts`) · `npm run test:smoke` (API
integration, `scripts/smoke-test.mjs`). Status: ❌ broken · 🔧 fixing · 🧪 fixed + test, awaiting JM ·
✅ JM-verified.

### R225 · #225/#226/#227/#228 — Stats + Profile IA pass 🧪
**Unit:** stats-hub routes updated (Cycling→/cycling-stats, Load&Form global). Most is page/render work.
**JM manual (QA):** Stats hub leads with an **editable benchmarks card** (tap a value to edit; tags spaced) → Load&Form / Wellness / History → **per-sport pages** Cycling / Running / Strength / Mind. Running opens the new pace/zones/VDOT/predictions page (not cycling power). Every date filter has **From/To pickers + presets that prefill them**. History has search + type chips + range + Newest/Oldest, and **gym sessions are collapsed** (tap to expand). Profile has a "trends in Stats →" link; benchmarks editable in both. Supersedes the #194b toggle.

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
