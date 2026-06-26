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

195. ⬜ **BUILD the readiness engine — our own WHOOP (Sleep·Freshness·Energy 1–5).** JM's deep-research is now in the
    repo: **`docs/readiness-scores.md`** (verbatim + my assessment), skill `platyplus-readiness-scores`, memory
    `platyplus-readiness-model`. We already have the data (intervals wellness: CTL/ATL/Form, HRV, RHR, sleep + the
    check-in), so **Freshness** (ACWR=ATL/CTL + TSB) + **Energy** (0.35 HRV + 0.35 Sleep + 0.15 RHR + 0.15 subjective,
    z-scored vs a 28–90d baseline) are buildable NOW; **Sleep** is personal (#159, hours÷need). Plan: pure
    `server/readiness.js` (unit-tested) → wire intervals wellness → baselines → the Today check-in (auto + ⓘ + manual
    override) + coach signals (Freshness-Energy paradox, poor-sleep-nullifies-gains, HRV-CV). Supersedes #158/#159. JM 2026-06-26.
194. ⬜ **Stats v1 follow-ups (after #193 grouping).** v1 routes to EXISTING pages, so: (a) WELLNESS card from the
    mockup isn't in v1 — needs its own page (sleep/HRV/RestHR/weight trends from intervals + check-ins); (b) split
    `/fitness` into the GLOBAL "Training load & Form" view vs the CYCLING "power curve/FTP/VO₂max" view (today both cards
    route to /fitness); (c) a Mind/Meditation stats page (today the Mind card → /logs). JM 2026-06-26.
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
159. ⬜ **Sleep 1-5 must be PERSONAL (WHOOP-style), not fixed hour thresholds.** Today `sleepTo5` uses <5/<6/<7/<8/≥8h
    → 1-5, but sleep NEED is individual (JM needs ~9h, others 8 or 10). "How whoop does it is how we have to do it":
    score = **hours slept ÷ personal sleep NEED** (= sleep performance %), mapped to 1-5. Need = device sleep SCORE if
    present (already personalized → use it), else a per-user **sleep-need setting** (default 8h; WHOOP also adds recent
    debt + strain — phase 2). So: prefer device score; else hours/need%. JM 2026-06-26.
158. ⬜ **Auto-derive Freshness (and maybe Energy) from data, like Sleep-from-tracker.** JM: sleep auto-fills 1-5 from
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
185. ⬜ **cyclingcoach authors INTO Platyplus (retire direct intervals publish) + add `time_target`.** Platyplus =
    single MASTER for planning; migrate cyclingcoach `tools/intervals_icu_workouts.py` → a pure renderer Platyplus
    calls (`tools/publish_platyplus_plan.py`). **Blocker:** add `time_target` to the Platyplus→intervals event
    push so Wahoo rides are complete; until then do NOT push planned workouts from Platyplus (cyclingcoach owns
    intervals directly — root cause of the 2026-06-23 dupe/"delete them"). Pairs with #18/#157. (source: UX-BACKLOG.)
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
