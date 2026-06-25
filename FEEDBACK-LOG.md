# Platyplus — Feedback & Ideas Log (ACTIVE queue)

**This is the live working queue — OPEN items only.** Completed items are archived in
`FEEDBACK-LOG-ARCHIVE.md` (full record #1–#116). Numbers are never reused; new feedback continues
from **#117**. Status: 🔨 building · ⬜ todo. Design detail for big items → `UX-BACKLOG.md`.
(Edit with Write/sed — NOT `perl -0pi`, which mangles the UTF-8.)

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

> **✅ SHIPPED TO PROD (2026-06-25):** #125–#131 are now LIVE on prod (PR #37, deploy 6cd23a9). Prod
> auto-migrated store.json → Postgres (1 user/17 plans), real 28-char PG_PASSWORD, nightly encrypted
> pg_dump verified (pg-backup.timer → Drive). Healthy + 200.

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
138. ⬜ **Dev keeps "can't connect / Something went wrong" — backend not running.** Recurring: local
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
65. ⬜ **Check-in auto-adapts today's workout (coach)** — on a poor check-in, the coach evaluates + adjusts TODAY's plan (recovery/cut intensity) with a note. Design the trigger; pairs #76/#91.
72. 🔨 **BUG: ride thumbnail = flat blue, doesn't match the workout** — CoachPlanCard MiniProfile from `p.segments` isn't reflecting the real structure (segments missing/flat). Fix the thumb or fall back to a sport icon. (Likely same root as #107.)
74. 🔨 **Check-in chips: add Sleep / HRV / Rest HR** — from intervals wellness when connected, else manual input. Extends #64; #63 chip UI is the home.
75. 🔨 **Post-workout: trim feel/form redundancy** — RPE 1–10 DONE; still review whether "How did you feel?" vs the gym fields (Form etc.) overlap and trim.
76. ⬜ **Coach triggers on post-workout feedback** — on feedback submit, the coach reviews + adjusts the plan (cyclingcoach engine). Pairs #65/#91; server-side trigger → coach → plan update + note.
81. ⬜ **Gym TSS theory → estimate + post-calc** — capture a strength training-load methodology into the cyclingcoach KB; use it pre (estimate) + post (from logged sets) to replace the rough gymTSS. (cyclingcoach repo.)
91. 🔨 **Coach takeaways = REAL cyclingcoach output** — Platyplus side DONE (`POST /api/coach-review` store + Progress renders the real Verdict/Execution/Mind/Next, heuristics fallback). REMAINING: adapt the cyclingcoach skill (COACHCHECK) to POST there instead of intervals-only. (cyclingcoach repo.)
93. 🔨 **Open a lift → full labeled chart** — tapping a strength-trend row opens a detail view with a proper dated-X / weight-Y chart (points, values, PR markers), not just the sparkline. Mock first.
102. 🔨 **macOS sensors for everybody = signed menubar app** — bridge refactored to a `startBridge()` module; REMAINING: Electron wrapper + tray + electron-builder (.dmg/.exe) + signing/notarization (needs JM's Apple Developer cert). Makes native sensors one-click on macOS in any browser. (Built bridge + analysis archived as #99–#101.)
106. ⬜ **Advanced pedaling metrics + coach drills** — L/R balance + force-distribution "oval" (torque effectiveness / pedal smoothness) from the trainer/power meter; coach gives drills. Ref: pycycling. Pairs #91.
107. 🔨 **BUG: ride profile preview misses the first (green) warmup segment** — the setup-preview AND in-ride bar chart show only the yellow intervals, not the warmup. First/low segment clipped or dropped (parsing/rendering). Confirm the warmup ramp is intended too.
118. 🔨 **Gym workout builder — missing/not surfaced** — there's a Ride builder (/ride-builder) and Run builder (/run-builder) but no GYM builder on the Gym page. (A `builderDraft` + `addToDraft` exist under the hood, used from ExerciseDetail.) Add/surface a "Build a gym workout" flow on the Gym page: pick exercises, set sets/reps/rest, save as a template → play. Parity with Ride/Run "+ Build".
119. ✅ **Remove "Programs" from Gym — a program is a plan (coach's domain)** — the Gym page lists "Programs" (+ Trainers). A program = a multi-week PLAN, which the COACH now owns. Remove the Programs section from the Gym page (decide on Trainers too) so planning lives with the coach, and Gym = workouts + builder + library.
121. ✅ **DATA-FLOW MODEL — LOCKED (2026-06-25).** Reviewed all flows w/ JM (see UX-BACKLOG "Workout data-flow model"). Principles: (a) **intervals.icu = the read hub** — Platyplus reads every completed workout back from intervals (everything lands there: Garmin/Wahoo/Coros/Strava→intervals). (b) **Platyplus is always the local home** for in-app workouts (works with ZERO external connections — coach reads its own data; intervals AND Strava are optional). (c) **MATCH-FIRST, upload-only-if-missing** — Platyplus checks intervals for a matching device activity; if present (day+sport+time) → match + enrich (don't duplicate); if absent and Platyplus is the source → upload its own. (d) Fan-out target for Platyplus-recorded workouts = **intervals direct** (no Strava dependency); Strava optional. Planning direction = Platyplus→intervals→device (Garmin/Wahoo for bike, Coros for run — Coros does planned-workout DOWNLOAD).
122. 🔨 **BUILD #3 — indoor ride: capture stream + upload.** [BUILT, QA-verify] RidePlayer currently logs `duration` only + no push. Build: record per-second power/HR/cadence during the ride → on finish encode a FIT/activity → **upload to intervals when connected** (Strava optional), ALWAYS keep the Platyplus copy. Match-first (skip upload if a device already recorded it). (Replaces the false "indoor→FIT→Strava already works".)
123. 🔨 **BUILD #4 — gym source + match.** [match-first wired; manual-strength-upload deferred] Platyplus gym log (GymPlayer, real sets/reps/weights) is the exercise SOURCE. Match-first against any Coros/device strength activity in intervals (by day/sport/time) → ONE merged session = Platyplus exercises + Coros HR; optionally write the exercise list into that activity's notes (Strava shows exercises). Upload our own strength activity ONLY when no device recorded it. (Coros has no open OAuth — direct connect isn't possible nor needed.)
124. ✅ **#5 — planned runs already mirror to intervals (planToIcuEvent run→Run); Coros pulls them.** Completed runs/walks/hikes = the read/match path (shared w/ #2). Planned runs ALREADY flow Platyplus→intervals (same mirror as rides); Coros pulls them to the watch (download confirmed). Minimal build — mostly ensure run plans publish to intervals like rides + JM verifies the Coros↔intervals planned-sync toggle.

---

### Also pending (infra, not feature feedback)
- **Wire `GH_PROMOTE_TOKEN`** into the deploy secrets so the in-app Promote-to-prod button works (#47/#78). Needs a GitHub PAT with **Actions: write** added to `AUTH_ENV_STAGING`/`_PROD`, then redeploy. Until then the button correctly says "not set on the server"; prod promotion still works via the GitHub Actions tab.
