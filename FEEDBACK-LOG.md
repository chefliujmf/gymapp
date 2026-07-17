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

536. ⬜ **Freshness tooltip mislabels raw Form as a 1–5 rating + chip shows a stale morning snapshot (JM 2026-07-16).** Diagnosis: `Today.tsx` ~L100 renders `training load — Form ${tsb}, acute-vs-chronic ${acwr}` — the RAW numbers (JM today: Form +1.0, ACWR 0.97, both FRESH/ideal), but printed as bare "Form 1, acute-vs-chronic 1" right next to the legend "1 = wrecked / very sore" → reads like a wrecked rating of 1 (JM: "form is at 1? really?"). Two bugs: (a) **labeling** — drop of the `+` sign + no plain-language, so a healthy +1 Form looks like a 1/5 score; (b) **stale value** — the model actually returns freshness **5** for today's live wellness (verified), but the chip shows **4** because it stored the value at the morning check-in before today's load settled (JM: "I should be 5, otherwise I'll never be"). **Fix options:** A — tooltip copy only: signed + plain-language, un-confusable ("Form +1 (fresh) · load balance 0.97 (ideal) · about your usual"; separate the 1–5 legend); B — also keep freshness LIVE (re-derive through the day / on view) so the chip reflects current wellness, not the stale morning snapshot; C — both (rec). **Route:** readiness display (`Today.tsx` tooltip + freshness refresh). Ties #158/#159/#207 readiness model. Note: the scale ALREADY reaches 5 for a fresh day (Form ≥ ~-5 + ACWR 0.8–1.2) — no mapping change needed. ✅ BUILT: (A) tooltip signed + plain-word, (B) live-refresh non-overridden rows. **+ AUDIT FINDING FIXED (JM-approved, science-backed):** Xenia (pregnant, CTL ~13) read "Fatigued 2" because ACWR is spurious at LOW chronic load (Impellizzeri 2020 "Conceptual Issues & Pitfalls"; Lolli 2019 coupling; Wang 2020) — `freshness()` now weights ACWR by `clamp((CTL−8)/22)` and ×0.4 more when `pregnant` (HR-load unreliable in pregnancy → ACOG 804). JM CTL30 unchanged (5); Xenia → 3. Threaded `pregnant` through `readiness()`/`forecastFreshness()` + `/auth/readiness` + forecast. Docs: `readiness-scores.md` + `pregnancy-coaching.md`. Tests: 4 new in `src/readiness.test.ts`.

535. 🧪 **Missed-workout handling is INVISIBLE + context-free — the coach should acknowledge it honestly (JM 2026-07-16).** ✅ BUILT (option A, compassionate+persuasive tone JM picked): the missed-handler now stashes `user.recentRemovals` (title/sport/date, ~5-day window) when it removes a missed session; the ONE check-in notification (`server.js` check-in trigger) now injects a `missBlock` that has the coach — inside that SAME single notification — (1) check `get_recent_activities` and CREDIT a replacement workout warmly, (2) else if fitness/freshness is dipping, name it VERY respectfully/compassionately (never guilt-trip) then gently PERSUADE toward the one session that gets them back on track, (3) else note the removal lightly + reassure. Prod-only (like all #498 coach notifications) → JM tests on prod on the next real miss + check-in. **Original:** JM skipped yesterday's workout; the coach correctly removed it — but the notification never said so. Root cause (a deliberate tension): missed sessions are removed **SILENTLY** (`server.js` ~1333, "do NOT call notify" per #498's one-notification rule), and the ONE check-in notification (`server.js` ~746) is told to "keep it to TODAY" → forward-only, so it never mentions (1) that the session was **removed/moved**, (2) the **impact** of missing it — OR acknowledges if the athlete already **did an alternative** (check `get_recent_activities`), or (3) that **cumulative load is dipping below target** ("you're not doing enough"). JM wants the coach to be honest + contextual about misses, not silently delete. **Fix (respect #498 = still ONE notification):** enrich the check-in message so the coach ALSO looks back ~1–2 days, and if a session was missed/removed, folds a brief honest line into that single notification — what was dropped/moved, its consequence for the plan/goal, credit for any replacement activity, and a straight (non-nagging) flag if load is trending low. Prompt change in `buildSystemPrompt`/the check-in trigger + possibly feed the handle-missed context in. **Options (pending JM's pick):** A — enrich the check-in notification only (rec, one notification); B — a separate low-key "here's what I changed" note when a removal happens (breaks the one-push rule); C — a silent in-app "plan changes" log the athlete can review (no push). **Route:** coach engine / notifications (`coach-engine.md` + check-in trigger). Ties #498/#156/#469.

534. 🧪 **GYM COACHING ENGINE — peer to cycling/running, sport+goal-adaptive "like a real coach" (JM 2026-07-16).** ⬆️ Supersedes the goal-aware-insights framing: build a full **strength engine** the way cycling has Coggan/FTP and running has Daniels/VDOT — model = working **1-RM per lift** + **%1RM zones** (NSCA rep-max continuum: strength 85–100%·1–5 · hypertrophy 67–85%·6–12 · endurance <67%·12+); dose = per-goal weekly **sets/muscle** + tonnage (Schoenfeld · MEV/MAV/MRV); progression = progressive overload / linear·undulating periodization / deloads. New `server/coach-engine-strength.md` + `SPORT_ENGINES` row + `buildSystemPrompt` gating. **Adapts to the athlete:** cyclist → gym = support/maintenance (concurrent-training: Hickson, interference effect → minimal effective dose, scheduled away from key rides, in-season maintenance; low gym volume is ON-PLAN, never "low"); "build muscle" → hypertrophy; "300 FTP" → endurance-first, gym supports. Adjusts by phase/calendar. **Science base:** NSCA Essentials, Schoenfeld/Krieger, ACSM, Hickson + concurrent-training reviews, Helms Pyramid, Israetel MEV/MAV/MRV, Zourdos/Tuchscherer. **JM's decisions (2026-07-16):** gym focus is **INFERRED by the coach** from (1) the user's **MAIN sport** — so add a way to indicate the PRIMARY sport when there are several — and (2) the user's **objective text** (parseable: "I want to build muscle" → hypertrophy vs "I want 300 FTP" → endurance→gym-support); NO separate gym-focus toggle. App volume/insights + "needs attention" become goal-aware (fixes the "always low" for a cyclist). **Build (phased):** (1) main-sport indicator in Profile; (2) KB `docs/strength-coaching.md`; (3) pure engine — %1RM zones + per-goal volume targets + goal-aware needs-attention (tested); (4) `coach-engine-strength.md` + SPORT_ENGINES + prompt gating; (5) app wiring; (6) propagate MCP/skills/memory. Folds in #533 (review voice: no jargon, no volatile "Next"). **Route:** strength engine + coach engine. — original critique: the flat 10–20 sets band is a HYPERTROPHY standard; wrong for a cyclist doing supportive gym ("not a fan"; "depends on objectives"; "must be backed by books and science"). The "sets/muscle 10–20" band is a HYPERTROPHY standard (Schoenfeld/Krieger); applying it to a road cyclist who does gym for SUPPORT/maintenance is wrong — he's *supposed* to be "low", so "Chest volume low → add a session" is bad advice ("not a fan of this"). JM: volume "depends on objectives — 1 gym session in summer, 2 in winter → obviously always low"; and "not sure you can understand what to provide as insights, it must be backed by books and science." **Fix (design pending JM's pick):** make the volume target + "needs attention" conditioned on the athlete's GYM GOAL, each science-cited — **muscle** 10–20 sets/muscle (Schoenfeld); **strength** low-volume/high-intensity >80% 1RM (ACSM/NSCA); **sport-support/maintenance** minimal effective dose ~1–2 sessions (concurrent-training: Hickson, maintenance-volume studies); **health** ACSM 2×/wk. For an endurance-first athlete, gym defaults to sport-support → low gym volume shows as "maintenance dose ✓", NOT an alarm. "Needs attention" then only fires goal-independently (a true stall on a lift you're progressing, a PR, a real imbalance); nuanced/phase calls come from the coach (goal+phase aware). Gym-focus derived from sport+goal (or set explicitly). Add to `docs/strength-analytics.md`. **Options A (goal-aware engine, rec) / B (coach-only insights) / C (drop needs-attention).** **Route:** strength analytics / coach engine. Depends on JM's direction.
533. ⬜ **Coach takeaway copy — no jargon, drop the redundant/volatile "Next" (JM 2026-07-16).** On the Strength page coach takeaways: (a) "log tempo (default 3-1-1-0)" — a user won't know what TEMPO is; don't use jargon without explaining, or drop it. (b) The "➡️ Next: aim 60 min, 3×6-8…" prescription changes too often and is **already in the calendar/plan** — don't repeat a volatile per-session prescription in the takeaway. Coach-engine guidance fix (`coach-engine.md` review voice, #425) — reviews should be reflective/insightful, not re-state the next plan. **Route:** coach public/review voice.
532. ⬜ **Completed Platyplus gym logs don't appear on the CALENDAR day (JM 2026-07-16, from #448 testing).** A gym session logged in-app is a LOCAL `db.logs` entry; the Calendar day view only surfaces PLANS + intervals activities (#5013), so a completed local gym session (with no plan / no device activity) shows in **Stats + History** but NOT on its calendar day — so you can't tap the day to open the session. Fix: surface completed local gym logs on their calendar day (tap → the session summary `/feedback/:id` or the completed view), like a device activity. **Route:** Calendar / logs surfacing. (For #448 testing NOW: sessions open via Stats → History, and the Strength page tap-through → per-exercise page.)
531. 🧪 **#448 Strength page — UX polish from JM's QA test (2026-07-16).** (a) **Coach insight now leads the page** (moved Coach-takeaways / synthesized insight to the TOP, right under the summary — "coach insights should always be at the top"). (b) **Chart standard applied** — the Weekly-volume chart + the per-exercise volume chart now have a **Y axis (kg) + gridlines + X axis + an insight line** (peak), per the `platyplus-charts` skill ("as soon as you build a graph, follow the standard"). (c) **"Sets per muscle" is now per TRAINING week** (`activeWeeks` denominator), not diluted by empty calendar weeks in a wide filter — fixes the confusing "0.8 low over 8 weeks" and couples it clearly to the range JM's filter selects; relabeled "Sets per training week · target 10–20" with a clarifying note. Engine `activeWeeks()` + updated `weeklySetsPerMuscle` (tests updated). **Test (QA):** coach card at top; Weekly-volume + exercise-page volume show a labelled Y axis + peak; sets-per-muscle reads a sensible per-training-week number. **Route:** UI (Strength stats) + engine.
530. ⬜ **VERIFY — gym plan (Platyplus→intervals) vs the Coros/Garmin execution activity: pairing + double-load risk (JM 2026-07-16).** Setup: a gym session is PLANNED in Platyplus and pushed to intervals (planned event + planned load, #372). JM executes it wearing a **Coros Pace 2** (or Garmin), which records HR+time and pushes a completed "Weight Training" activity to intervals. **Confirmed by research:** the watch canNOT load the Platyplus plan — intervals can't push structured workouts to COROS at all, and doesn't push structured *strength* to Garmin (Garmin strength workouts only come from Garmin Connect). So the watch always arrives as a **separate generic strength activity**. **Platyplus side is already clean:** `buildDayEntries` (#197) collapses the local sets-log + the device activity to ONE History entry (gym-with-sets wins), and `findGymLogForPlan` (#326) flips the planned card to done; Platyplus never uploads a gym stream (`no-stream`, match-first). **The open question is the INTERVALS side:** does intervals auto-PAIR the completed Coros activity with the Platyplus-planned gym event (→ plan done, load counted once), or leave the planned event + the activity **side-by-side and DOUBLE-COUNT the load** (planned `icu_training_load` + the Coros activity's own load) into CTL/ATL? Intervals pairs power/pace reliably but strength is unreliable. **TEST:** run one real session with the Coros on, then look at intervals — one paired/done item, or two + doubled load? **FIX if it double-counts:** drop/zero the planned LOAD on a gym event once a device activity lands for that day (reconcile), and/or have Platyplus attach the Coros activity to the plan in intervals. **Route:** intervals sync / load accuracy. Ties #372/#380.
529. ⬜ **Coach Strava TITLE — don't name the location when it's near HOME (JM 2026-07-16).** The coach titled a ride "Easy St-Lambert Spin" — St-Lambert is JM's home city, so naming it every ride is repetitive. Rule: only put a PLACE in the public title when it adds signal — a trip / a new place / away from the home city (that's genuinely cool); when the activity is in/around the home city, use a location-free title. The coach knows the home city (Profile location). If home-vs-away can't be inferred reliably, the fallback JM accepts is: **stop putting the location in titles entirely.** Update `set_activity_text` guidance + `coach-engine.md` "TITLE stays human" voice (#425) + memory `platyplus-coach-public-text-voice`. **Route:** coach public-text voice.
528. 🧪 **BUG — intervals "Open workout in Platyplus" deep link fails ("Plan not found") + opens in the wrong user's session (JM 2026-07-16).** JM tapped the "🏋️ Open workout in Platyplus →" link on an intervals activity; it landed on `/coach/mcp-sahq7xm8` showing **"Plan not found — Open it from Today so it can load."** Two root causes: **(1)** `getCoachPlan(id)` reads ONLY `sessionStorage['coachPlans']` (`src/plan.ts:117`), populated when you load Today/Plan — so a COLD deep-link (fresh tab) finds nothing. Fix: on a cache miss, FETCH the plan by id from the server (per-user, `req.user`-scoped so it respects isolation) — add a `GET /auth/plan/:id` (or reuse an existing plan endpoint) + openapi. **(2)** JM's activity + link are SHARED via the athlete i28814, but the browser was logged into **Xenia's** account (avatar "XE") — her account has no such plan (correct isolation, #453/#456), so even a server fetch returns nothing. For the cross-account case, show a clearer message ("this workout belongs to a different Platyplus account") instead of the generic not-found. **Route:** deep-link / per-user isolation. Ties #453/#456. **🔨 BUILT (2026-07-16):** added owner-scoped `GET /auth/plan/:id` (+ openapi); `fetchCoachPlan(id)` in `plan.ts` (caches into `coachPlans`); `CoachPlanDetail` now tries the local cache then fetches by id on a cold link, with a **Loading…** state and a clearer **"Can't open this workout — isn't in this account (different login, or removed)"** message on 404 (the cross-account case). **Test (QA):** open the intervals "Open in Platyplus" link COLD in your own session → the plan loads (no "open from Today"); open it in another user's session → the clearer message, not a bare not-found.
527. 🧪 **BUG — gym session duration is WRONG (11 min for a 20-set session; #251 root).** JM: "you keep saying 11m, it's 1h11m." QA DB confirms his one gym log = "Rainy Day Full-Body Strength" (2026-06-19) with **duration 11 · setsCompleted 20** — 20 working sets in 11 min is impossible, so the stored `duration` is wrong (the display #251-fix is correct; the VALUE feeding it is bad). Root: GymPlayer computes `actualMin = (Date.now() − startedAt)/60000` (`GymPlayer.tsx:240`) and `startedAt` is unreliable across resume/re-render (a stale/late start → far-too-short elapsed). Fix options: persist `startedAt` durably (localStorage, survive reload/resume); and/or sanity-floor the logged duration against work done (e.g. if `duration < setsCompleted × ~0.5 min`, flag/estimate) + let the user edit it on the session. **Route:** gym logging (GymPlayer). This is the real half of #251/#251-in-#448. **🔨 BUILT (2026-07-16, JM: "stay consistent with intervals"):** pure `reliableSessionMinutes({wallMin,setsCompleted,plannedMin})` (+4 tests) — trusts the wall-clock when it's plausible (≥ sets×0.75 min), else falls back to the PLANNED duration (`Session.duration` = exactly what intervals shows). Wired into `GymPlayer.finish` (log + TSS + `completeActivity`) so new logs are intervals-consistent, and into `rangeSummary` (read-side) so a legacy broken log (JM's 20-sets-in-11-min) no longer shows an absurd time. **Test (QA):** log a gym session in-app → its duration ≈ the planned/intervals time, not a too-short wall-clock; the Strength summary "on the bar" is sane.
526. 🧪 **Profile + Stats + Admin polish batch (JM 2026-07-16).** (a) **CoachKnowledge — dropped the goal-FOCUS chips**: the user just writes their objective in their OWN words (or tells the coach in chat; the coach asks follow-ups). (b) **Admin now keeps the header + footer** (`App.tsx` `isDetail` no longer hides chrome on `/admin`; players/builders/chat stay immersive). (c) **Strength Stats:** the Coach-takeaways card now shows a **strength-only** review (was leaking the latest cycling ride review); added an **empty-state** explaining that the rich analytics (working-max, sets/muscle, stalls, per-exercise pages) unlock once you log a gym session IN-APP with weight×reps — an intervals-imported gym carries duration/load only, no set detail (which is why JM saw a near-empty page: his sole gym log has no usable set data + the wrong duration, #527). **Test (QA):** Profile coach card shows only the "Your goal" text box (no chips); Admin has the top bar + bottom tabs; Strength page shows the empty-state (until a real in-app gym log exists) and no cycling review. **Route:** UI (Profile / Stats / shell).
525. 🧪 **Back button on all pages — never strand the user (JM 2026-07-15).** JM: clicking Profile → "See full stats" landed on the **Stats** tab-root, which had **no back button**, so he was stuck. Best-practice IA: detail/sub pages always get a `‹` back (Platyplus already does via `.sub-head` + `navigate(-1)`), but **tab roots** (Stats/Train/More) and section pages (Eat/Exercises/Programs) rendered a `.page-head` with no back — correct when they're your *entry* tab, but a **deep link** into one leaves no way back. Fix: new reusable `src/PageHead.tsx` shows a `‹` back **only when there's an in-app screen behind you** (`history.state.idx > 0`) → `navigate(-1)` returns to exactly where you were; a root stays clean when it's your entry point. Wired into all 6 strandable `page-head` pages (hubs + Eat/Exercises/Programs). **Test (QA):** Profile → "See full stats" → Stats now shows `‹` → tap → back to Profile; open Stats fresh from the tab bar → no back arrow (clean root). **Route:** UI / navigation.
524. 🧪 **Group height + birthday + diet WITH "About you" (JM 2026-07-15).** On Profile, height/birth-date (`FuelFields`) and Diet sat far below the "About you" (sex) block. Moved both up to sit directly under About you, so "who you are" (sex · height · birthday · diet) reads as one cluster. **Test (QA):** Profile → About you shows sex chips, then height/birthday, then Diet, in that order; all still save. **Route:** UI (Profile).
523. 🧪 **App-level coaching behaviour belongs in the SHARED engine, not per-user profiles (JM 2026-07-15).** JM's `coachProfile` was the whole old cyclingcoach `athlete_profile.md` — mixing athlete facts with APP/method content (public activity-text voice, coach-memory upkeep, a `COACHCHECK` command, an Intervals/Wahoo/Google-Calendar "Current project assumptions" infra section). Those behaviours already live in the SHARED engine (`coach-engine.md` #425 public-text, `server.js` coach-memory) so they apply to EVERY athlete — the per-profile copies were redundant leftovers. Fix: **(1)** `set_athlete_profile` MCP now says **ATHLETE-SPECIFIC ONLY** — never write app/method content into a profile (host-synced); **(2)** run-once migration `522_strip_profile_method` (`stripProfileMethod`, pure + idempotent, +5 tests) strips the method bullets + the infra section from existing profiles, keeping every athlete fact — verified on JM's REAL profile (10.5 KB→8.5 KB; goal/FTP/calf/equipment/cottage all kept). **Test (prod):** boot log `[migrate] 522_strip_profile_method … applied`; the coach no longer carries duplicate method rules. **Route:** coach engine / data migration.
521. 🧪 **Profile page reorg — group "What your coach knows about you" (JM 2026-07-15, mock Option B).** The coach-facing bits were scattered: goal SELECTIONS (chips) in one block, the free-text NARRATIVE (`coachProfile`) on a separate `/profile/athlete` page, the LEARNING toggle in a third spot. Merged into ONE card at the top of Profile (`src/CoachKnowledge.tsx`): **✍️ You told it** = goal chips + a plain **"In your words" (Edit ›)** box (`info.goals.notes`, user-owned); **📈 It's learning** = the learn-from-check-ins toggle + a **"See your full stats ›"** link. Benchmarks STAY on Stats (not moved, per JM). Rest of Profile grouped under **⚙️ Setup & about you**. Removed the separate GoalsPicker section, the athlete-profile link, and the old "Your data" section. Inline styles only (no `styles.css` collision with the concurrent UX chat). **#522 CORRECTION (JM 2026-07-15):** the coach's own working profile (`coachProfile` MD) is **NOT** surfaced to the user — it carries system/method content (coach-memory upkeep, public activity-text voice, etc.) no user should review/edit; the user tells the coach via the goal chips + "in your words" only, and can ask the coach in chat. **Removed the `/profile/athlete` editor route** (`main.tsx`) entirely. Mock: `mockups/profile-coach-knowledge.html`. **Test (QA):** Profile shows ONE "What your coach knows about you" card at the top; chips + "in your words" + learn toggle save; the coach's internal MD is nowhere in the UI; Stats reachable via the link; setup sections still save. **Route:** UI (Profile).
520. 🧪 **Athlete-profile MIGRATION (run-once, tracked) + no-hardcoded-athlete GATE (JM 2026-07-15, #519 all-in).** (1) Moved athlete-specifics (goal, cottage rhythm) OUT of the shared engine INTO the per-user PROFILE via a proper run-once migration system — `server/migrations.js` (tracked in `store.appliedMigrations`, applied at startup before serving = the race-free point for a single in-memory-store app, NEVER re-runs), with the pure idempotent merge in `server/profile-backfill.js`. NOT a re-checked-every-boot patch. (2) `sync-coach-engine.mjs` now runs a **NO-HARDCODED-ATHLETE gate** (mirrors the media-independence gate): the build FAILS if any athlete NAME appears in a generated engine. It caught + removed **"Jean-Manuel" from the GENERIC + FEMALE engines** (which every athlete — incl. Xenia — reads). +8 unit tests. **Test (prod):** on boot the migration lands JM's goal/cottage in his profile once; the coach for a non-JM athlete never sees his name/goal. **Route:** coach engine / data migration / build gate.
519. 🧪 **Cycling-engine trim + FIX the source/generated drift (JM 2026-07-15, #516 step d, "all-in").** Cycling engine **67.5KB→45.2KB** (~5.6K tokens/round-trip saved for cyclists): removed the planning ALGORITHM #516 now owns in code + **all single-user leaks** (Jean-Manuel / 300W / Skov / cottage, dead-file refs, the old intervals-publish / Wahoo / nutrition workflow) so a multi-user athlete (e.g. Xenia) stops inheriting JM's personal rules. **Preserved** the coaching KB (TTE, CP/W′/EF, naming, adaptation, skill/mental focus). **Also found + fixed a real trap:** `coach-engine-src/` had gone STALE vs the directly-edited generated `coach-engine*.md`, so running `sync-coach-engine.mjs` REVERTED hand-tuned fixes (#425 voice, #403/#404 metrics). Back-ported every direct edit into the source (verified **lossless** — `coach-engine.md` regenerates byte-identical) + harmonized the sync-script header, so the sync is SAFE again and the source is the truth. Generic engine unchanged (#425 intact); female = header-only. **Test (QA):** cyclist coaching equal-or-better; a female/other athlete's coach no longer mentions JM's goal or cottage rhythm. **Route:** coach engine / build pipeline.
517. ⬜ **Meals/food still showing in the calendar though Eat is OFF (JM 2026-07-15, QA, testing #516).** Diagnosis: NEW meals are server-rejected (`upsertItem` 409, server.js:2272), so these are **stale `type:'meal'` items** left in `user.items` from before deactivation — nothing purged them and `GET /api/items` still returns + renders them. Also the MCP still ships `schedule_meal`/`search_recipes` (mcp/server.js:205/48) labelled "[DEACTIVATED]" but PRESENT, so the coach can still burn round-trips trying. **Fix (proposed):** (a) one-time purge of meal/mind/supplement/recovery items from all stores, (b) `GET /api/items` filters them out while EAT_MIND_OFF (belt-and-suspenders), (c) drop the dead tools from MCP so the coach can't try (host-sync). Eat = ROADMAP/FUTURE per JM. **Route:** coach/eat deactivation.
518. ⬜ **Coach makes a RECOVERY item as a separate entity that can't be opened (JM 2026-07-15, QA).** Recovery was parked → the server already rejects `type:'recovery'` (validateItem, server.js:2266), but MCP `schedule_recovery` (mcp/server.js:215) still posts it → an orphan (stale, or host-MCP out of sync). Recovery should live as the workout's own `recovery` TEXT (per the #JM 2026-07-15 note), never a separate schedulable item. **Fix (proposed):** purge stale recovery items (same as #517), remove `schedule_recovery` from MCP, and my #516c `dailyAdaptMsg` must say "recovery = text on the workout, never a separate item" (I dropped that line — my miss). **Route:** coach/recovery deactivation.
516. 🔨 **Cut coach round-trip WASTE (JM 2026-07-14) — fewer model calls + leaner prompt at EQUAL-OR-BETTER quality.** JM+wife stay on the paid Claude CLI subscription; the goal is to stop hitting Max weekly limits + slow daily-adapt. MEASURED baseline: `runDailyAdapt` spawns 4–8 `claude` sessions/day × 9–31 MCP tool calls = ~30–60 model round-trips/day, each re-loading the ~128 KB prompt; ~60–70% of what the LLM orchestrates is already pure code in `readiness.js`. Plan: move plan MATH to deterministic code, elevate the LLM to reviewer/writer/judge (it always keeps final say over the skeleton). Four sequenced, independently-testable steps:
    - **(a) Reorder `buildSystemPrompt` static-first** (`server.js` ~1427) — move volatile blocks (`# TODAY`, cycle/pregnancy, `# WEEKLY LOAD BUDGET`, `# DAILY FUEL TARGETS`, `# COACH MEMORY`) to the END so the ~17 K-token static engine is a byte-stable cacheable prefix. Pure output reorder, zero behavior change. **Test:** system prompt content identical (diff only shows block order); `cache_read_input_tokens > 0` across a day's calls.
    - **(b) NEW `server/plan-skeleton.js`** — chain existing pure fns (`weeklyLoadBudget`→`defaultLoadPlan`→`recentRestDows`→`periodizedLoads`; `projectFormSeries`/`forecastFreshness` validate green Form; `planCapViolation` gates) + 4 new pure fns (`generateDaySports`, `suggestIntensityZone`, `sessionDuration`, `buildWorkoutSegments` reusing `icu-steps.js` guards). Output a 14-day `skeleton[]`, zero model calls. **Test:** `src/plan-skeleton.test.ts` — cap-respecting plans; `buildWorkoutSegments`→`plannedTss` = same load as today.
    - **(c) Rewrite `runDailyAdapt` skeleton-first** (`server.js` ~3031) — delete the horizon-fill LLM loop (~3041), generate horizon in code, collapse 4–8 sessions → 1–2 (one LLM pass reviews/overrides the skeleton + writes text; review/sharpen only when real work exists). **Test:** stream-json `usage` shows ~30–60 → ~6–10 round-trips; QA A/B plan equal-or-better (JM signs ✅).
    - **(d) Trim `coach-engine-cycling.md`** 67 KB → ~30 KB (re-read every round-trip). Behavior-sensitive → A/B hardest. **Test:** QA A/B coaching unchanged/better.
    **Route:** coach engine / daily-adapt / cost. **Quality gate:** built ≠ done — JM marks ✅ only after the QA side-by-side A/B.

496. 🧪 **PWA freshness — pick up a new build faster.** JM 2026-07-11 kept seeing "old" prod. INVESTIGATED: the SW
    mechanism was actually SOUND — `sw.js` + `index.html` are served `no-cache` (verified on prod, no proxy cache), and
    main.tsx already skipWaiting+clientsClaim+reloads on controllerchange. The real staleness was **prod LAGGING dev**
    (fixes lived on dev until the #163 promote ~3h ago) plus the triage/publish bugs (#485/#495) — NOT the browser cache.
    Remaining gap closed: the open app only re-checked on focus/online/every-30-min, so it could sit on the old bundle.
    Added an **update check on in-app navigation** (App.tsx → `__pwaCheck`, throttled 20 s) so a fresh deploy applies
    within a tap or two. 🧪 **Test (QA):** with the app open, after a new deploy lands, navigate Plan↔Stats a couple
    times → it should quietly reload to the new build (no hard-refresh). **Route:** PWA/infra.
500. ⬜ **Coach must NOT use acronyms/jargon in explanations (JM 2026-07-12).** "not all users know what TTE or other
    terms mean." The coach's notifications + chat explanations should use plain language — spell out or avoid TTE, CTL,
    ATL, VI, W′, IF, NP, etc. (or gloss them in one plain phrase). **Route:** coach voice (coach-engine + notify guidance).
499. ⬜ **Coach notification must clearly explain WHAT he changed (JM 2026-07-12).** When the coach adapts the plan, the
    `notify` message should describe the change well ("moved Thursday's ride to Friday and cut it to 45 min because…"),
    not a vague "plan updated." **Route:** coach voice / daily-adapt notify.
498. ⬜ **ONE coach trigger after check-in, not two (JM 2026-07-12).** This morning: one coach action right after
    check-in (intended), then a SECOND "mystery" one ~30 min later saying "plan updated." JM: we want **exactly one**
    coach trigger after check-in, plus coach action **only when the user asks for a specific change** — no surprise
    second re-plan. ROOT (to confirm): the check-in coach decision (server.js ~598) AND the daily-adapt scheduler
    (`runDailyAdapt`, multi-pass) likely BOTH fire post-check-in; consolidate to one, and don't let later passes
    (horizon-fill / review / round-out) each send their own notify. **Route:** coach triggers / daily-adapt.
512. ✅ **SHIPPED PROD 2026-07-14 (JM: "i like it, so promote"; prod-verified threshold 5:28/CS 5:22/VDOT 36.6/TTE 49:02).** VDOT-based RUNNING engine — ground threshold + CS + TTE in real RACE times, sex-fair + pregnancy-aware (JM 2026-07-14: "buuild it").** JM: running numbers were wrong — threshold 4:42, CS 5:21, **TTE 5:46** (absurd). Root cause: threshold read from the HR-cost of easy runs / a Critical-Speed pace-curve fit that UNDER-reads off easy-run-heavy data, landing threshold FASTER than CS — but CS is the CEILING (threshold ≤ CS), so the "threshold above CS" gap produced a fantasy short TTE. FIX = anchor running in **Daniels VDOT** from the athlete's **best RACE efforts** (the running gold standard: performance-based ⇒ **sex-fair** by construction). Built: (1) `src/running-paces.ts` — `vdotFromRace`/`bestVdotFromRaces` (robust to GPS-glitch spikes — drops fantasy VDOTs >median×1.12), `csPaceFromVdot` (CS at 90% VO₂max, just above the 88% threshold → **threshold ≤ CS ALWAYS holds**), `tteAtThresholdSec` (Daniels pctMax aerobic ceiling ~67 min). (2) `server/sport-settings.js` `runThresholdFromPaceCurve` now PREFERS race-VDOT (extracts best times at 1.5/3/5/10/21 k from the pace-curve), CS-model fallback. (3) run-estimate + athlete-profile (coach `get_metrics`) + the benchmark cards all consume it → **consistent everywhere**. (4) **Pregnancy guardrail** (Xenia): benchmarks flagged as *pre-pregnancy baselines*, every hard-effort "sharpen" prescription stripped, coach-focus replaced with "health & function first" — no aggressive paces surfaced. **VERIFIED on JM's REAL data** (i28814): VDOT **36.6** → threshold **5:28/km**, CS **5:22/km** (threshold ≤ CS ✓), TTE **49:02** (his real 9 k @ 5:27 hold — personal, not the 5:46 fantasy); the 23:12 5k → VDOT 42 was an OLDER PR outside his 12-month window, so 36.6 is his honest CURRENT fitness (all 4 race-distances cluster 36.0–36.6 → tight fit). Propagated: openapi (run-estimate + get_metrics shapes), `coach-engine-running.md` (VDOT anchor + threshold ≤ CS rule). 72 unit tests green, build ✓. **To test (QA):** open **Running Stats** → Threshold ~5:28 (chip "Race VDOT"), Critical Speed ~5:22 (chip "VDOT", faster than threshold), TTE ~49:00 (NOT seconds), VO₂max ~37; tap each card → science says "Daniels VDOT from your best efforts". For a pregnant profile: a "pre-pregnancy baselines" banner + no "Sharpen it" prescriptions. **Route:** stats/benchmarks + coach.
515. 🧪 **"Turn on notifications" banner kept re-appearing after it was approved (JM 2026-07-14).** The opt-in banner ("Never miss a plan change") gated on "is THIS device subscribed right now" (`isSubscribedHere`). A browser DROPS its push subscription on every service-worker update (i.e. every deploy) + on expiry, so that goes false again even though the athlete already granted permission → it re-nagged. Fix (`src/push.ts` + `src/PushNudge.tsx`): pure `nudgeAction(permission, subscribedHere)` — already-`granted` but dropped → **silently RE-SUBSCRIBE** (no prompt, also restores server-side delivery); banner ONLY when permission is still `default` (never asked). +4 unit tests. **To test (QA):** with notifications already approved, reload after a deploy → the banner must NOT reappear. **Route:** UI (notifications). ⚠️ NOTE: originally mis-logged into the app-report space as #5026 where it COLLIDED with JM's live app report — moved here (roadmap #) so my discoveries never race the app's report numbering again.
514. ✅ **SHIPPED PROD 2026-07-14 (JM "i like it, so promote").** VO₂max must be sport-aware for EVERY athlete type, not bike-only (JM 2026-07-14). The Global VO₂max card read "estimated · your 5-min max **power**" / "from your best 5-minute **bike** power" — bike language for everyone. JM: "talk about biking only… what about a person who only runs? and only gym?" Traced each persona: **cyclist** → MAP ✓, **runner-only** → VDOT ✓ (it already adapted), **you (cyclist+runner)** → cycling wins (it IS your higher engine) ✓, but **gym-only was BROKEN** — `runsRecent=0` killed the run estimate and the empty-state wrongly said "after ~4 runs" to someone who doesn't run. Fix (mock `mockups/vo2max-personas.html`, JM picked **Adaptive**): VO₂max reads the best signal the athlete actually has — **bike power → running pace → heart rate** — label + confidence always match the source. `vo2Order` now only the athlete's REAL aerobic sports (no blind cycling+running append). A **non-endurance athlete gets a rough HR-based VO₂max** (max vs resting) — captured by their **watch or wrist band, NOT just a chest strap** (JM's correction) — else a "wear your watch/band on any cardio, or log a bike/run, or set it" gate (never "after 4 runs"). Fixed all "strap"-only copy → "watch or band" across VO₂max + Max HR. tsc 0 · build ✓ · 560 tests green. **To test (QA):** a runner-only account's VO₂max says "running pace (VDOT)"; a gym-only account shows a rough HR read (chip HR) or the wear-your-watch gate, never a bike/4-runs prompt. **Route:** stats/benchmarks.
513. ✅ **SHIPPED PROD 2026-07-14 (JM "i like it, so promote").** Running-page + Wellness cleanup (JM 2026-07-14, reviewing #512 on QA). Three things JM caught: (a) on **Running Stats** the VO₂max card read "51 · your 5-min max **power**" — bike MAP on a running page. JM: "VO₂max and Max HR are NOT per-sport data — put them in the overall benchmark, not per-sport." Right — VO₂max is whole-body, Max HR is a cardiac ceiling. **REMOVED both from the per-sport pages** (`RunningStats` → `thresholdPace/cs/dPrime/tteRun`; `CyclingStats` → `ftp/cp/wPrime/tteRide`); they stay in the **overall Stats benchmarks** (`<BenchmarksCard />`, no `only`) where they belong. (b) **Wellness charts showed "Invalid Date"** on every axis tick + tooltip (sleep/HRV/RHR/weight + check-in breakdown). Root cause: `view.dates` was PRE-formatted to "Jul 14" labels, then `MetricCard` re-parsed them as ISO (`new Date("Jul 14T00:00")` = Invalid Date). Fix: `view.dates` stays RAW ISO; a shared `fmtDayLabel` helper formats in each chart component (MetricCard + CheckinBreakdown). (c) **"6.1 h — what is it? be explicit."** The big number is the LATEST reading but was unlabelled (floating next to avg 8.4 h + the insight's 8.5 h). Now labelled **"latest · Jul 14 6.1 h"** with the reading's date, and the subtitle shows units on min/max + the day count. tsc 0 · build ✓ · 560 tests green. **To test (QA):** Running/Cycling Stats show NO VO₂max/Max HR card (they're on the main Stats page); Wellness charts show real dates ("Jul 14"), not "Invalid Date", and each metric's headline reads "latest · <date>". **Route:** stats + wellness.
509. 🗺️ **EF (Efficiency Factor) as a first-class learned benchmark (JM 2026-07-13).** EF = normalized power ÷ avg HR (cycling) / speed ÷ HR (running); rising EF at the same HR = improving aerobic engine. Today it's only a small trend on the Cycling page (`efTrend`). Make it its own benchmark card with honest confidence + a learned trend (like FTP/VO₂max), and FEED it into the multi-signal threshold (#508). Aerobic-decoupling (Pw:Hr) is the sibling metric. **Route:** stats/benchmarks.
508. 🔨 **Platyplus's OWN multi-signal threshold/eFTP — fuse ALL the metrics, don't defer to intervals' eFTP (JM 2026-07-13, the core of #497).** JM: "I want our own eFTP based on more metrics… combine HR while doing intervals, the drift, and the HRV response the next day." Today `ftpEstimate` blends power-curve eFTP + CP + best-20-min + HR-power (#497). MISSING signals JM wants fused: **cardiac drift / Pw:Hr decoupling** (HR climbing at steady power ⇒ above threshold), **next-day HRV/recovery response** (did the session wreck you ⇒ it was over threshold), **EF trend** (#509). Build a Platyplus threshold model that weights these into one honest number + band, so a clean read emerges from NORMAL training without a formal test. ✅ SHIPPED so far: HR-power method live; FTP card copy reframed to "Platyplus's own blend" (not "intervals computes it"). ⬜ TO BUILD: decoupling signal (per-ride Pw:Hr from intervals) + next-day-HRV-response correlation + fusion weighting + confidence. Mock the model first. **Route:** stats/benchmarks + back-end.
507. 🧪 **Max HR "Observed peak" showed BLANK though the data has a peak (JM 2026-07-13, prod/QA).** JM's i28814 has 135 activities with `max_heartrate`, peak **184** — but the card's Observed-peak row read the HEADLINE value gated on `maxHrFrom==='observed'`, so when the 185 zone ceiling won it showed "—". FIXED: client now stashes `observedMaxHr` + `icuMaxHr` separately; each science row shows its OWN real value (184 peak · 185 ceiling); label 180d→"12 months"; age-fallback source line. **To test:** open Max HR → Observed peak shows 184, Zone ceiling 185 (in use). **Route:** stats/benchmarks.
506. 🧪 **Benchmark "science" panels over-claimed — JM stress-tested them on prod (2026-07-13).** (1) **FTP**: all 5 methods (260/240/248/234/220 — a 40 W spread) were blind-tagged "agrees with the blend" + "IN USE" (JM: "all diff numbers but agrees?!"). Now tagged by REAL agreement vs the value in use ("reads lower/higher than your value"); only the primary is in use. (2) **TTE** used the RAW manual FTP, so switching the picker to Auto didn't move it — now follows `chosenFtp`/`chosenPace` (Auto 250→13min, 245→20min). (3) **VO₂max** showed a bike number + the crude HR-ratio for a RUNNER — now sport-aware (`vo2ScienceRows`), HR-ratio is a last-resort only. DIAGNOSED vs JM's real data (best-20min 246 W, peak HR 184): TTE 12:00 is CORRECT — his FTP 260 is ~15 W high (true ~246), which is why TTE looked short. +11 unit tests (59 green). **To test:** FTP methods now say "reads lower", TTE follows the FTP picker, VO₂max shows only your sport's method. **Route:** stats/benchmarks.
505. 🗺️ **Nutrition / calorie + macro fuel targets — parked for future (JM 2026-07-13: "keep it for roadmap and future work").** REMOVED the Profile "Daily fuel targets" card (calories/macros/Lose-Maintain-Gain/"lean cut" + the stale "coach uses these to pick meals" line): too complicated, Eat is deactivated so the coach can't use it to plan training, and surfacing a weight-loss DEFICIT is wrong — especially during pregnancy (Xenia saw a −18% "lean cut" on prod). KEPT the height + birth-date inputs (feed age-based stats) AND the science engine (`src/nutrition.ts` — Mifflin-St Jeor, unit-tested) for the future build. REVISIT as a proper goal-aware, PREGNANCY-SAFE fuelling feature (never an aggressive default cut; tie it to training load, and only if the coach can actually act on it) if/when Eat is reactivated. **Route:** eat/nutrition.
510. 🗺️ **ALL metric GRAPHS on the Stats pages — parked for the roadmap (JM 2026-07-13: "remove the metric graphs, it's for the roadmap").** After a long iteration the season-compare curve wasn't up to standard (cycling seasons fit IDENTICAL CP/W′ → overlapping lines; running pace GPS-glitch-riddled — raw 0:04/km, all-time CS fit returns an absurd D′=740 m; TRAILING windows make this≈last-season). JM then said remove them ALL. REMOVED from CyclingStats + RunningStats: the **power/pace duration + season-compare curve** (`<SeasonCompare>` + best-efforts table + date filter), the **eFTP trend**, the **EF trend**, and the **pace trend** charts. KEPT the benchmark CARDS (FTP/CP/W′/TTE/VO₂max/threshold/CS/D′/MaxHR), race predictions + training-zone tables. Chart components (`SeasonCompare`, `PowerCurveChart`/`PaceCurveChart`/`DurationCurve`, `TrendChart`) stay in the codebase. **REVISIT** with true intervals-parity: calendar-year seasons (#415), gradient-adjusted pace, robust outlier rejection / monotonic-hull, CS/CP model overlay. Research + cap logic saved in memory `platyplus-chart-standard`. **Route:** stats.
504. ⬜ **Per-set RPE capture to sharpen gym e1RM (split from #497, 2026-07-12).** The RPE-adjusted e1RM (`e1rmRpe`, RTS/RIR) + honest confidence (`e1rmConfidence`) are built + doc'd (`docs/e1rm.md`), but per-set RPE isn't logged yet — `SetEntry` (`db.ts`) is weight/reps/done; RPE lives at the session level. Add an optional per-set RPE tap in the gym logger → feed `e1rmRpe` so a set left short of failure reads a truer 1RM. Mock the tap first. **Route:** gym.
503. 🧪 **Activity-detail redesign — coach shown TWICE + feedback/links buried + plain-icon thumbnails (JM 2026-07-12→14, prod).** Five asks, all built 2026-07-14 (mock B approved, `mockups/activity-detail-top.html`): (a) **coach at TOP only** — was rendered by `CoachVerdict` (top) AND `ActivityFeedback`'s `reviewBlock` (bottom); added a `reviewShownAbove` prop so the bottom copy is dropped. (b) **your feedback merged into the top** (coach verdict → your feedback in one block, JM pick B). (c) **"See all coach takeaways on Progress →" link removed** entirely. (d) **source links (Planned · intervals ↗ · Strava ↗ · from <device>) moved to the TOP**, were hidden at the bottom. (e) **completed-activity thumbnails**: the "lost" detail thumb was a stale PWA bundle (#218, "back in prod" per JM) — so nothing was actually broken. Tried an `IntensityThumb` IF-donut for the unplanned list cards (mock B) but **ROLLED IT BACK** (JM tested 2026-07-14): the IF donut rendered "6346%" — some activities return `icu_intensity` already as a percent (63.46), not a fraction — and JM prefers the previous power-shape thumbnails (planned cards keep `MiniProfile`; unplanned cards keep the sport icon). If we ever want a real power-shape on unplanned cards, that's the rejected option A (per-card stream fetch). **Route:** UI (`ActivityDetail.tsx`, `ActivityFeedback.tsx`). **Test (b–d):** open a reviewed completed ride → coach + your feedback + source links all at the TOP, no bottom duplicate, no "See all coach takeaways" link.
502. ⬜ **Post-workout: 2 notifications instead of 1 (JM 2026-07-12, prod).** Finishing a workout fires TWO coach notifications (and shows 2 in the bell), not one — same double-trigger pattern as the check-in (#498). Likely the feedback endpoint + a second path both notify. FIND the duplicate trigger; ONE post-workout notification. **Route:** coach triggers.
501. 🧪 **ESTIMATE FROM THE FULL AVAILABLE HISTORY, not narrow recent windows (JM 2026-07-12 — "estimate with the data you have").** Benchmarks read "empty / Learning / needs 4 runs" when the user actually HAS years in intervals/Garmin. Root: narrow recency GATES block valid full-history models. Symptoms (Xenia): Max HR "Observed peak" empty (scans only 180d, server.js ~384); VO2max "Running VDOT needs ≥4 runs" (gates on runs in the last **42d**, ~353 — but the pace-curve is built from ALL history); Sleep "Learning 11/21 nights" (Garmin may have synced far more than 21 nights — check the wellness window). FIX: widen the data/confidence windows to the full available history, TRUST the intervals full-history models (pace-curve/power-curve/zone ceiling) instead of requiring recent activity, and add sensible FALLBACKS (age-based max HR = Tanaka 208−0.7·age when nothing observed). Same principle applies to the #497 HR-power points. **Route:** stats/benchmarks + back-end data. 🔧 SHIPPED (QA): Max HR peak scans a full YEAR + Tanaka age fallback; VDOT unblocked (present a valid full-history estimate at honest low confidence instead of “needs 4 runs”); run-threshold gate widened 42d→180d. Sleep-window widen = small follow-up. **To test:** open Stats for a user with real intervals history (e.g. Xenia) — Max HR "Observed peak" and Running VDOT should now populate from history (no "needs 4 runs"), and a freshly-connected account gets FTP + max HR set for the coach WITHOUT opening Stats.
497. 🧪 **Confidence-scored, auto-updating benchmark ANCHORS across ALL sports (JM 2026-07-12, expands #5007).** The
    anchors everything scales from — cycling FTP·CP·W′·TTE, running threshold-pace·CS·D′·VDOT, gym e1RM per lift — must
    be ACCURATE, auto-update from NORMAL training, and carry an HONEST confidence band; when the band is too wide, the
    coach + MCP PRESCRIBE a targeted refining effort (not necessarily an all-out test). Estimators:
    • **Cycling** = submaximal **HR-power** model (infer FTP from the HR cost of easy/varied rides — e.g. 200 W @ 110 bpm,
      max 185 ⇒ FTP ~320-340, not 200) + EF + Pw:Hr decoupling + the FTP·CP·W′·TTE consistency check.
    • **Running** = **HR-pace / GAP** model + Daniels VDOT + CS·D′ (pace is noisier than power — terrain/GPS/wind — so
      lean on grade-adjusted pace + a wider band).
    • **Gym** = **e1RM** from working sets (weight × reps × RPE/RIR; Epley/Brzycki) — "as far as we can go" (no HR-power
      analog; needs some near-failure sets to be accurate). A heavy low-rep set tightens it, no true 1RM grind.
    Report number + band + "what's driving it + how to sharpen"; band NARROWS automatically as varied data accumulates.
    Grounded in `docs/beyond-ftp-metrics.md` + `docs/tte.md` + `src/running-paces.ts` (Daniels) [+ add a gym e1RM ref doc].
    Build order: MOCK the per-sport benchmark card → estimator engines (pure + tested vs the docs) → coach/MCP
    test-prescription → plumbing/UI. Everything checked against the source formulas so nothing drifts. **Route:** stats/benchmarks + coach/MCP.
    🔧 SHIPPED so far (QA, 2026-07-12): **Cycling HR-power** (`ftpFromHrPower`, fed real ride data on the card); **Running HR-pace**
    (`thresholdPaceFromHrPace` — infers threshold pace from the HR cost of steady runs; shows as its own method + fallback when the
    Critical-Speed model is thin); **Gym e1RM** (`e1rmRpe` RPE/RIR + `e1rmConfidence`, `docs/e1rm.md`); **new-user analysis on connect**
    (`computeAndStashAnchors` computes FTP/maxHR/run-pace from history so the coach has anchors without opening Stats). All pure +
    unit-tested (44 green). Coach now **prescribes ONE targeted refining effort when a benchmark is unconfirmed** (buildSystemPrompt
    `# KEEP THE ANCHORS SHARP` — a hard 15–20 min ride / hard 20 min or 5k run / heavy 3–5 rep set, NEVER an all-out test, plain-language
    why). **To test:** Stats cards show a number + method for FTP / threshold pace (incl. a runner with HR but no hard efforts) / e1RM;
    connect an account and the coach has anchors without opening Stats; ask the coach to plan after weeks of easy riding → it works in one
    quality effort to confirm your threshold (not a max test). ⬜ Small follow-up split to #504 (per-set RPE capture, sharpens gym e1RM).
495. ⬜ **QA ≠ PROD for backlog TRIAGE + user reports (extends #485).** JM 2026-07-11: can't see #1002/#1003/#1006 in the
    QA Road map. #485 synced the generated item LIST, but the triage overlay + user-added reports (`app_meta.backlog` =
    {triage, added}) are PER-ENV Postgres — QA has 11 added, prod has 8, DIVERGED. Reports filed on one env are invisible
    on the other (and #1007: can't even file on QA). FIX: share the whole overlay (triage+added) across QA+prod like the
    item list, newest-wins. **Route:** infra/architecture.
494. 🧪 **New "Road map" STATUS = future work to review later (JM 2026-07-12 picked: Backlog tab + Road map status).**
    A PARKING bucket distinct from To-do — items to assess/consider/approve LATER, kept OUT of the active "Open" count.
    BUILT: `BacklogStatus` +'roadmap' (api.ts + server `BACKLOG_STATUSES`); AdminBacklog S_LABEL/S_DOT (violet #b98cff)/
    S_RANK/STATUS_ENV/STATUS_OPTS/counts (excluded from Open)/status chip by "To do"; `build-backlog statusOf` (🗺️→
    roadmap); Admin tab reverted "Road map" → **"Backlog"**. **Route:** admin/backlog. 🧪 Test (QA): Admin → the tab reads
    "Backlog"; a new "Road map" chip sits next to "To do"; set an item to Road map → it leaves Open + shows a violet dot.
493. ✅ **Plan default-view preference (Settings).** ALREADY BUILT + works (JM confirmed 2026-07-11). Settings → "Calendar
    starts on" (Day / Week / Month / Schedule) persists `calView`; Calendar reads it on mount (localStorage + setSetting,
    `?view=` overrides). On prod. **Route:** UI.
492. 🧪 **Rename "Backlog" → "Road map" (= future to assess / consider / approve).** JM 2026-07-11. Done in nav +
    Admin header (commit 67af627). Same commit also removed the **Mind card from Stats** (JM: "mind is still under stats
    too, remove"). **Route:** UI. 🧪 the tab/label reads "Road map" everywhere; no "Mind" card left on /stats.
491. 🧪 **Deactivate Eat + Mind app-wide (keep Recovery); day dot = ACTIVITIES only.** JM 2026-07-11: "to simplify the
    app for now, deactivate Mind and Eat; Recovery can stay; a green day-dot is only for activities (run/ride/yoga/
    pilates), not food/meditation/recovery." UI DONE — nav tabs removed, routes kept (commits 96ee927/d0c842b/67af627).
    ⚠️ **NOT propagated to the COACH: the daily-adapt ROUND-OUT pass (server.js ~2824) + MCP `schedule_meal`/`schedule_mind`
    still auto-schedule meals + mind onto the calendar every day** (the #478 "meal on calendar = no-no" still fires). FIX =
    a reversible server gate — round-out → recovery-only, MCP meal/mind guarded, coach told they're off, engine/openapi/
    memory updated. **Route:** propagate-all-layers. 🔨 COACH GATE BUILT: `EAT_MIND_OFF=true` const (server.js, reversible);
    `upsertItem` HARD-REJECTS meal/mind/supplement (409); `roundOutMsg` → recovery-only; system prompt emits a "# EAT &
    MIND ARE DEACTIVATED" block + skips DIET/FUEL-TARGET blocks; MCP `schedule_meal`/`schedule_mind`/`search_recipes`/
    `search_sessions` descriptions prefixed "[DEACTIVATED]"; openapi 409 noted. 🧪 **Manual test (prod after promote):** ask
    the coach "plan me some meals this week" → it must DECLINE + plan training/recovery only (no meal/mind item appears on
    any day); the daily-adapt round-out adds recovery only. Reversible: flip `EAT_MIND_OFF=false` to bring Eat/Mind back.
    ↺ **REWORK 2026-07-11 (JM failed: "meditation is in sports you do"):** Meditation (Mind) was still selectable in
    Profile → "Sports you do" — removed it there + from MCP `set_sports` allowed list + fixed the stale coach-prompt nav
    (Today/Train/Eat/Mind → Plan/Stats). Yoga/Pilates STAY (logged activities). Re-test the Profile sports chips on QA.
490. ⬜ **Recovery library is too small — build a MUCH larger one (LOW priority).** JM 2026-07-11: "for recovery we'll
    need a much larger library, it's not near enough." More sauna/cold/massage/mobility/breath/sleep routines. **Route:** content.
489. ✅ **Add sheet = ride / run / gym / recovery / note ONLY (drop mind, meal, supplement).** JM 2026-07-11: "when we
    click add be sure to not have mind or meal or supplement — it's ride, run, gym, recovery, note." (Eat+Mind are
    deactivated.) `AddSheet` in Today (+ Plan). **Route:** UI.
488. ✅ **Merge Today INTO Plan — Plan's Day view IS the full Today screen; Week/Month/Schedule each carry the day's own check-in; default-view pref.** JM 2026-07-11 approved ("I like 488") → promoted to prod. Ask: "Today and Plan should
    merge (keep name Plan). Today becomes part of Plan — replace what we have as 'Day' in Plan with ALL the Today
    features (keep the label Day). In Preferences a user picks the default view." DONE: Today tab removed; its content
    (check-in · verdict · plan · recovery) is Plan's Day view; Week + Schedule show each day's check-in STRIP, Month a
    verdict DOT — past = "didn't check in" / today = "check in today" / future = nothing. Mocked (options-first, JM
    picked C, refined to per-day). Default-view Settings pref = #493 (also already built — "Calendar starts on"). **Route:** UX.
487. 🧪 **Remove the Train tab — add a workout via the Add button.** JM 2026-07-11: "remove Train tab; if a user wants
    to add a workout they have the Add button." Drop the nav tab (keep the /train route). **Route:** UI.
486. ⬜ **Coach task must survive switching screens (leaving the chat → "network error" on return).** JM 2026-07-11:
    "once we give a task to the coach, we should be able to switch screen without the coach interrupting; when we come
    back it says network error." ROOT: leaving the chat closes the SSE stream → the chat-helper's `res.on('close')`
    SIGKILLs the coach mid-task → nothing saved → "network error". FIX: don't kill on client disconnect; let the coach
    FINISH and PERSIST its answer to the thread (it's multi-thread + synced #363), so returning shows the completed
    reply. Needs the app `/auth/chat` proxy + thread-save to survive a dropped client. **Route:** coach robustness.
485. ⬜ **QA = PROD for backlog items, ALWAYS (JM directive 2026-07-11).** Today the item LIST is the BUNDLED
    `src/data/generated/backlog.json` (AdminBacklog.tsx:96 `import()`), baked per build → QA (dev) build has more items
    than prod (main) build; only the shared triage (#466) matches. FIX for "always identical": serve the generated item
    list from a SHARED source — (a) deploy publishes the freshly-built list to the shared mount (newest-wins by max #),
    (b) server serves it (`GET /auth/admin/backlog-items` from `/srv/backlog/items.json`), (c) frontend FETCHES it with
    the bundle as fallback. All 3 needed together. Immediate sync = promote prod to current dev. **Route:** infra/architecture.
484. 🔨 **Coach hung on "reviewing your wellness data…" then nothing (extremely slow) — on PROD.** JM 2026-07-11
    (asked a simple task; got the preamble + tool indicator, no answer; "note but nothing"). Prod app+db+claude were
    all HEALTHY, so it was a SLOW tool chain (get_wellness/get_checkins → intervals reads) that ran past the
    chat-helper's **180s SIGKILL** — and `proc.on('close')` then ended SILENTLY (`{done:true}`, no error), leaving the
    partial preamble with no answer. FIXED (`chat-helper/server.mjs`, hand-synced + both coach services restarted):
    (a) NEVER end silently — on timeout → "that took too long, try again"; on empty → "couldn't finish, try again";
    (b) 180s→**240s** headroom for slow intervals days; (c) **per-request logging** (`[chat] req/outcome/duration`) so
    it's diagnosable next time (the services logged nothing before). **Verify:** retry the coach on prod — a slow one
    now shows a clear message instead of blank. Also fixed SEPARATELY: QA (staging) was DOWN (db stopped + app exited
    137 from rapid overlapping redeploys) — brought back up. PREVENT recurrence: a `concurrency` guard on
    `deploy-staging.yml`. **Route:** coach robustness (done) + a deploy-workflow guard (todo).
483. ⬜ **Graph titles have no padding — they almost overlap the chart.** JM 2026-07-10. Chart standard: add top
    padding/margin between a graph's title and the plot so they never collide. Shared chart component. **Route:** bug (worker).
482. ⬜ **Graph lines are too thick on phone.** JM 2026-07-10. The chart stroke width reads heavy on mobile — thin it
    (or make it responsive). Shared chart. Relates the chart standard. **Route:** bug (worker).
481. ⬜ **Activity title + description too complex — keep it SIMPLE (JM set an example).** JM 2026-07-10: "description
    and title of activity is annoying so I changed it to something simple you can use for future as example." → CHECK the
    activity JM re-titled today, use it as the template, and simplify the coach's `set_activity_text` voice
    ([[platyplus-coach-public-text-voice]] #425). **Route:** coach voice (this chat / coach-engine).
480. ⬜ **Post-workout insights PER GRAPH are poor.** JM 2026-07-10: "post workout insights per graph is poor and not
    great." The per-chart insight line (chart standard "insight line") needs to be genuinely useful, not filler.
    **Route:** feature/quality (this chat).
479. ⬜ **Target RANGES must be correct — show a range (not a flat value), and read smallest-first.** Two facets, combined
    per JM 2026-07-14: **(a) Garmin/trainer target — RANGE outdoor, SPECIFIC value indoor (worker, OPEN):** JM 2026-07-10
    "today on my garmin I did not have a range but just 171 watts which is wrong." ⚠️ **INDOOR vs OUTDOOR (JM 2026-07-14):
    an INDOOR workout SHOULD be a specific value — a smart trainer holds that exact power in ERG mode, exactly how
    TrainerRoad & JOIN work. OUTDOOR should be a RANGE (you self-regulate to a band).** So the flat 171 W is correct IF it
    was indoor, and a bug only OUTDOOR. The worker must emit: **outdoor → a min–max RANGE (smallest first); indoor → the
    specific ERG target.** Regression vs #219 (true-shape) applies to the OUTDOOR case. Trace `planToIcuEvent`/workout_doc
    targets + the indoor/outdoor flag (`VirtualRide`/trainer vs `Ride`).
    **(b) Range ORDER — smallest number FIRST (client, ✅ FIXED in chat 2026-07-14):** JM saw the Daniels zone table read
    "6:53–6:13/km" (Easy) — reversed. `RunningStats.tsx` `zStr` now renders `min–max` (6:13–6:53) via Math.min/max, robust
    to the `paceZones` tuple order (easy is stored [fast, slow]). Audited every other range render: workout/interval
    targets are single values; marathon (potential→realistic) + segment time (start→end) already read ascending — no other
    reversals. **The worker must apply BOTH rules to the Garmin/intervals push (a): a real min–max RANGE, smallest first.**
    **Route:** bug (worker owns (a); (b) done client-side).
478. ⬜ **Eat & Mind must stay SUGGESTIONS — never auto-imposed into the calendar.** JM 2026-07-10 (3 msgs +
    screenshots): "I prefer to keep suggestions for eat and mind; 8 and 9 imposed in my calendar is a no-no…
    this is suggestions I want to keep… not just dinner like this, this is wrong and never asked." The coach's
    daily-adapt is SCHEDULING a single meal (Dinner) + a Mind session INTO the day instead of leaving the Eat/Mind
    **suggestion cards** (4 meal picks + mind picks) alone. Also the **+ button differs between Eat and Mind**
    (visual inconsistency). Fix: coach must NOT `schedule_meal`/`schedule_mind` into the calendar by default —
    Eat/Mind stay suggestions the user opts into via +. **Route:** bug → coach behavior (Claude to trace, not auto-worker).
477. ⬜ **Intervals sync: event still in intervals but removed from Platyplus (delete didn't propagate).** JM
    2026-07-10 (screenshot): "still in intervals but not in Platyplus (coach removed it, which I agree) but sync
    issues AGAIN with intervals." Orphaned planned strength workouts ("Load 0", 0%) linger in intervals after
    Platyplus drops them. Reconcile/orphan-GC (#414) should delete the intervals event when its plan is removed.
    **Route:** bug → intervals sync (Claude to trace carefully — shared athlete i28814).
476. ⬜ **Daily reminder: only push if data is MISSING from Platyplus.** JM 2026-07-10: "daily reminder to send a
    push if data is not in Platyplus (Garmin/Coros didn't sync, or entered manually) — check if there's data and
    notify only if needed." Add to the "A morning nudge to check in + see today's plan" reminder: gate the nudge on
    missing wellness/activity data. **Route:** feature (this chat) → design.
475. ✅ **XPS bug-worker LIVE + autonomous — bugs run on the box, not this chat.** JM 2026-07-10: "bugs must be run
    through the XPS CLI Claude Code, not this chat… you work on it automatically and set it to test." Built:
    `scripts/bug-worker.sh` (runs as jmf on jmf's Claude subscription; assess→fix→test→totest→push dev; NEVER prod),
    `worker-system.md` rules, box-aware `backlog.mjs` (`next`/`ready`), systemd service+timer (autonomous). Proven:
    #326 fixed+pushed to QA, #251 parked with options-first judgment. **Verify:** Admin → Claude card = live XPS worker.
474. 🔨 **Promote ONE-BY-ONE — as soon as an item passes, promote it; don't wait for 10.** JM 2026-07-10: "once one
    is tested successfully, you can promote, don't wait for 10 items, go one by one." Worker gate changed from
    batch-of-10 to a rolling buffer (cap 5, `ready`=totest<cap) so totest stays topped with a few bugs to test +
    promote individually. Pipeline rule → promote per pass → done (not batched at 10). **Route:** worker/process.
473. 🔨 **Review flow: after saving feedback, back to the review list (keep going); the LAST one → Today.** JM
    2026-07-10 (screenshot of "To review · 24"): "when I click a review I need to see the whole activity; once I
    save, bring me back to this review screen unless we're done, then back to Today." Tap → the full activity was
    already right. Fixed `afterSave` in `ActivityDetail.tsx`: re-check remaining feedback gaps (excluding the just-
    saved one, whose feedback may not have synced) → more left = `/review`, none left = `/` (Today). **Verify:**
    open a review, Save → next lands back on the review list; save the last → Today.
472. 🔨 **Tailscale auto-reconnect (stop the ~daily browser re-auth for box ops).** JM 2026-07-10. Node key already
    non-expiring — the env just doesn't persist the TS login across restarts. Fix: reusable auth key in
    `.secrets/tailscale.env` (gitignored, 600); `scripts/ts-up.sh` brings TS up non-interactively; throttled
    `~/.zprofile` hook self-heals. `.env.example` holds a placeholder only (token was NEVER committed). Ops/infra.
471. 🔨 **Backlog: Claude's comments show "Claude" (not "You") + "What to test" is human-readable.** JM 2026-07-10:
    my comments were mislabeled "YOU" and "What to test" showed the raw feedback (gibberish). `AdminBacklog.tsx`:
    comment byline reflects `by`; "What to test" = `it.test` or Claude's latest note (plain), never the raw summary.
470. 🔨 **Tapping a push notification must open the ACTIVITY/plan, not just Today.** JM 2026-07-10: "a notification
    works great but when i click on it, it opens the today app and thats it — bring me to the notification in the
    app." Links were already correct (reviews → `/activity/:id`); the issue is an installed PWA cold-launched by a
    notification lands on `start_url` (Today), ignoring the deep link. Fix: the sw (`public/push-sw.js`) stashes the
    link in a `caches` entry; the app (`App.tsx`) consumes it on startup + navigates (kept the postMessage path for
    an already-open app). **Verify:** tap a coach-review push → lands on that activity, not Today.
469. 🔨 **Coach adapts ONCE, AFTER the check-in — drop the everyday morning pass.** JM 2026-07-10: "for the coach
    triggers I have one in the morning and one after check-in; remove the everyday one, keep only after a check-in
    to make sense." The ~4am morning pass had no readiness context. Now `dailyAdaptTick` runs ONE adapt/day, gated
    on the athlete having checked in today (`user.dailyAdapt.done`). No check-in ⇒ no adapt (next check-in catches
    up the horizon). CLAUDE.md + memory updated. **Verify:** no pre-check-in re-plan; adapt happens after you check in.
468. 🔨 **"What is Claude working on" panel in Admin (live progress).** JM 2026-07-09: "add a dialog box in admin
    page so i can see if claude is working on a fix, at least a progress bar." Built: a 🤖 **Claude** card at the top
    of Admin — WORKING/idle badge, current **batch + note**, a **progress bar** toward the 10-item to-test bucket,
    and **"N bugs left → 0"**. Claude writes a SHARED status file (`/srv/backlog/claude-status.json`, both envs) as
    it runs the pipeline; the panel polls `GET /auth/admin/claude-status` every 8 s. `ClaudePanel` in `Admin.tsx`,
    `authApi.claudeStatus`, server endpoint + `readClaudeStatus`. **Verify:** open Admin — the Claude card shows the
    current batch + a moving progress bar while I work, "idle" when it's your turn.
466. 🔨 **ONE shared backlog — items in prod = items in QA AT ALL TIMES.** JM 2026-07-09: "backlog in QA and prod
    don't have the same items… no reason to have it different" → picked **A (one shared store)**. Root cause: the
    backlog triage lived per-env (each Postgres `app_meta.backlog`); JM triages on QA so prod stayed untriaged (313
    open vs QA 155; 8 review vs 2). **Built:** the backlog (triage + added + reports) now lives in ONE **shared file**
    `/srv/backlog/backlog.json`, bind-mounted into BOTH containers (they run on the same box) — `readBacklog`/
    `writeBacklog` (atomic temp+rename) in `server/server.js` replace the per-env `store.backlog`; compose (prod +
    staging) both mount `/home/jmf/backlog-shared`. Seeded from QA's authoritative board (11 added, 365 triage; all 8
    prod reports were already present by title). **Removed** the now-redundant `report-bridge` cron. So a report on
    prod is instantly on QA and vice-versa; JM's triage shows identically on both. Verified: both containers read the
    same file (md5 match). **Verify:** open Admin → Backlog on QA and on prod — the items, numbers and counts match;
    report a bug on one env and it shows on the other after a refresh. On prod + QA.
467. ⬜ **Backlog: filter by REPORTER + push the reporter when their bug is fixed.** JM 2026-07-09: "have a filter to
    who reported it so my wife sees if her bug report was fixed (only show hers); if admin I see all. Once a bug report
    is fixed, send the user a push to inform it's done." → (a) admin backlog gets a **reporter** multi-select filter;
    (b) a NON-admin (Xenia) sees a **My reports** view auto-scoped to her own reports + status; (c) on a report → `done`,
    **push the reporter** ("✅ Your report '…' is fixed"). Uses the shared backlog (#466) + existing Web Push (#457).
    **Verify:** (1) tap 📣 top-bar → under the form, "Your reports" lists your reports with a status badge (Under
    review / In testing / Fixed ✓). (2) Admin → Backlog → a "Reporter" filter row → tap a name → the board scopes to
    that person's reports. (3) mark one of your reports `done` → the reporter gets a "Your report is fixed" push. On QA.
348. 🧪 **Capture LOCATION (weather + local time) in onboarding + Profile, bi-directionally synced with intervals.** JM
    2026-07-04 (from #341/#347: "you have the location for weather right? if you need it, put it in onboarding" + "sync it
    with intervals bi-directional"). Mocked C/B/A → JM picked **C (detected + confirm)**. Done: `GET/POST /auth/location` —
    GET resolves saved → the intervals athlete **city** (geocoded, Open-Meteo) → null; POST takes a city, geocodes it
    (weather lat/lon kept Platyplus-side), and **WRITES the city back to the intervals athlete profile** (verified intervals
    persists `city` via PUT but IGNORES lat/lng). Profile **LocationField** (option C: "📍 Montreal, Quebec · from intervals"
    + Use this ✓ / Change → city field) at `#ob-location`; new **onboarding step** "Your location". Feeds weather (#341) +
    the local-today tz fix (#347). openapi + audit. Self-validated vs mock C. On QA. gymapp-only.
349. 🧪 **Sleep "why" was too shallow — "tracker scored 75/100" with no hours-vs-need.** JM 2026-07-04 (screenshot, Sleep 4). Fixed: `server/readiness.js` `sleep()` now ALWAYS carries `sleepHours` + `sleepNeed` (even when a device sleep SCORE drives the number, which previously dropped them); the Today "why" now leads with the actionable basis — e.g. "6.2h slept vs your ~8h need · tracker sleep score 75/100" — not just the bare score. 313 tests. **On QA + prod.** gymapp-only.
350. ✅🔁 **Propagate every improvement to ALL impacted layers.** JM 2026-07-04: "when we improve, you need to remember to
    update APIs, MCP, instructions, skill, memory, agent and other key elements impacted." Prompted by the #168 discovery
    that the **coach's host MCP was ~1 week stale** — #313/#341/#343/#332 tools never reached the coach because **nothing
    syncs `mcp/` to `xps:/home/jmf/platyplus-chat/mcp/`**. Captured durably: CLAUDE.md "change X → update Y" table now has an
    MCP-sync row + a propagation banner; memory `platyplus-propagate-all-layers`. Host MCP synced current (all stale tools
    now live). **✅ Automated:** `scripts/deploy.sh` now rsyncs `mcp/` → `/home/jmf/platyplus-chat/mcp/` on every PROD
    deploy (best-effort, AFTER the app is healthy so it never fails the app deploy; chowns jmf; gated on promote since
    the host mcp dir is shared QA+prod). DEPLOY.md documents it. Takes effect next promote (already manually synced now).
351. 🔨 **Reprocess JM's activities after every change (past · present · future) so he SEES it on real data.** JM 2026-07-04:
    "after a change or improvements, you need to reprocess my activities so I can see changes, it's a must… so I can see how it
    will look once launched." Standing definition-of-done step — after shipping any activity-affecting change, run a reprocess
    for JM's account over a wide window. Mechanisms exist: `reconcileFromIcu` (safe read-sync of plans), `handle-missed`
    (re-pair done↔planned), `POST /api/coach/run` (coach re-review — OUTWARD: writes coach notes + notifications). Plan: build
    a one-command `scripts/reprocess-user.mjs` (reconcile + re-pair + optional coach re-review) + run it post-change. Scope of
    the coach re-review confirmed with JM before mass-running (outward-facing). Memory `platyplus-reprocess-after-change`.
352. ✅ **PROD COACH OUTAGE (caused + fixed) — `E2BIG` spawning the coach.** 2026-07-04, surfaced running #351's reprocess:
    the coach `systemPrompt` (base engine 51KB + cycling engine 63KB + running + profile ≈ 128 KB) exceeds Linux
    `MAX_ARG_STRLEN` (128 KiB per single argv) → `spawn E2BIG`, which crash-looped `platyplus-chat-prod` (coach chat down).
    My #168 coach-engine.md growth tipped it over. **Fixed:** write the prompt to a temp file + pass `--append-system-prompt-file`
    (verified the flag end-to-end) — in the host chat-helper (prod path) AND `server.js` runCoachTask + /auth/chat (dev);
    temp file cleaned up. Deployed to host (`chat-helper/server.mjs` rsync + `systemctl restart`), services active, reprocess
    re-ran cleanly (claude spawned, no E2BIG). **Also:** the chat-helper is ANOTHER host-only component nothing synced — folded
    it into `scripts/deploy.sh` (syncs `chat-helper/server.mjs` + restarts coach services on change) + the propagate discipline.
353. 🔨 **Coach chat needs a "reviewing/thinking" indicator.** JM 2026-07-05 (screenshot): asked the coach to readjust the
    plan; it replied one line then went silent for a while (using MCP tools) with NOTHING showing it's still working —
    "need something to show it's reviewing." The chat-helper streams only text deltas, not tool-use, so during tool calls the
    UI looks frozen. Fix: surface coach activity (a "reviewing your plan/wellness…" typing indicator, ideally naming the tool).
    BUILT: chat-helper + server.js forward tool_use `content_block_start` as `{tool: friendlyTool(name)}`; `Chat.tsx` shows
    "reviewing your <thing>…". **On QA (client+server).** ⚠️ The host `chat-helper/server.mjs` emit-side sync was BLOCKED
    (Tailscale SSH re-auth needed mid-session) — it auto-deploys on the next PROD PROMOTE (deploy.sh runner sync, #352), or
    re-sync manually when SSH is back. Until then the client shows the generic "thinking…/still working…" (already improved).
354. ✅ **Jul 3 (prod, JM) shows NO Energy/Sleep/Freshness despite a check-in done (incl. in intervals).** JM 2026-07-05
    (screenshot: the check-in scales are all unselected on Fri Jul 3). Coach claimed "it's there" but it isn't shown. The
    check-in feedback was entered in INTERVALS too → Platyplus + the coach must READ the intervals check-in/wellness for the
    day. Diagnose: is it a display bug (logged but not rendered), a missing-wellness auto-derive gap, or Platyplus not reading
    the intervals wellness/feedback for Jul 3? Adjust the coach to see the intervals-side feedback.
    ✅ DIAGNOSED + FIXED (2026-07-08): NOT a bug. Reproduced readiness for Jul 3 on JM's real 60-day wellness → it computes fine now
    (Sleep 3.8 · Freshness 4.2 · Energy 2.7, HRV baseline n=52, not cold-start). ROOT CAUSE = LATE WATCH SYNC: the Jul-3-night HRV/sleep
    only reached intervals at `updated=2026-07-05 22:56` (2 days late), and there was no Platyplus check-in and NO intervals *subjective*
    check-in to fall back on, so when JM looked the data genuinely wasn't there → blank scales. The coach "it's there" = it ran after the
    sync. FIX: the wellness-source chip row was `isToday`-only, so a blank PAST day showed no explanation. Now shows for any day with
    day-aware copy ("No HRV/sleep for this day, scores are your own read") so an empty check-in explains itself instead of looking broken.
    (Follow-up idea if wanted: read intervals' SUBJECTIVE check-in fields — mood/motivation/fatigue/soreness — for athletes who log them
    natively in intervals; Jul 3 had none, so not needed here.) gymapp-only.
355. 🧪 **POWER CURVE line stops ~1m instead of running to 1h (prod).** JM 2026-07-05 (screenshot, ride detail → Power tab).
    The "best avg by duration" curve draws a crisp line 1s→~1m then flattens into just the fill with no visible line to
    5m/20m/1h — "be sure the graph line goes all the way." Same family as #344/#292/#334 chart bugs. Diagnose: does the curve
    DATA extend past 1m (best-20min 154W is mentioned, so data exists) or does the line path/points stop? Make the line span
    the full x-range. ROOT: `CURVE_DURATIONS` jumped 60→300 (nothing 1m–5m) so the tail was 5 sparse points = flat floor →
    looked stopped. Fixed: densified to ~25 durations (`src/pages/ActivityDetail.tsx`). gymapp-only.
356. ✅ **Coach chat must SYNC across devices + ChatGPT-style threads (new chat, search, history).** JM 2026-07-05: asked
    the coach on desktop, couldn't see it on his phone. Root: Platyplus stores only a single `chatSession` id (the claude
    session lives on the host); the actual MESSAGES aren't persisted in the DB — the client holds them in memory, lost on
    reload/device-switch. Reco: persist messages server-side per THREAD (DB), load on any device (sync), + thread list /
    new-chat / search. Big feature — sync first (the real pain), threads/search next.
357. 🔨 **Cycling PLANNED-POWER chart → zone COLUMNS like intervals.icu (no ramp).** JM 2026-07-05 (screenshots: Platyplus
    ramp/"target shape" line vs intervals' blocky zone-coloured bars). "That's the standard, no ramp thing." Reverses the
    #219 true-shape ramps for the PLANNED view — render each segment as a solid bar at its target watts, coloured by zone
    (Z1..Z4/SS), matching intervals. gymapp-only.
358. 🧪 **Chat needs timestamps (UX best practice).** JM 2026-07-05. Added a subtle time separator only on a real gap
    (>15 min) — same-day = time, else dated ("Yesterday · 2:30 PM"). `Chat.tsx` `fmtChatTime` + `.chat-time-sep`. On QA.
359. 🧪 **Coach-note URLs weren't clickable** (e.g. "Full plan → https://platyplus…/coach/mcp-…"). JM 2026-07-05 (QA).
    New `src/linkify.tsx` — internal Platyplus links become in-app `<Link>`, external open a tab; applied to the plan-notes
    render (`CoachPlanDetail`). `.linkified` accent+underline. On QA.
360. 🧪 **Notification timestamps show DATE only — need time of day.** JM 2026-07-05 (QA, bell). `ReleaseBell` `whenLine`
    now shows date + time from the notif `at`. On QA.
361. 🧪 **Coach-review notifications don't link the activity / hard to follow which session.** JM 2026-07-05 (QA): a stack
    of "Coach reviewed your ride" all dated today, no context. Fixed: the review notif now carries the SESSION date
    (`pushNotification` accepts `date`; review passes `review.date`) → bell shows "Sun Jul 5 · reviewed 2:34 PM"; links to
    the activity (`/activity/:id`) when the review has an activityId (else the plan). On QA. (Older reprocessed reviews that
    lacked an activityId won't link retroactively; new ones will.)
362. 🧪 **Learned stats need a clear "when will Computed be ready?" ETA — consistently, everywhere.** JM 2026-07-05 (QA,
    Stats benchmarks): threshold pace shows a specific ETA ("~1 more run — needs ≥4 runs + ~25 km in 6 weeks") but FTP just
    said "lands automatically… as intervals sees hard efforts" (no timeframe), and Max HR / Sleep need / VO₂max vary. Fixed
    (`src/Benchmarks.tsx`): every gate now answers "when" the SAME way — a COUNT where countable ("~N more runs/nights"), else
    the exact trigger event. FTP → "after your next hard ride — a ~5–20 min near-max effort (no formal test)"; Max HR →
    "after your next all-out effort with a HR strap"; VO₂max cycling → "after your next hard ~5-min effort", running →
    count-based like pace. Modal Computed box shows the same ⏳ ETA as the card. 321 tests. On QA.
363. ✅ **Coach chat — CONVERSATIONS (threads) + search (ChatGPT/Claude-style).** JM 2026-07-05 (QA): "how will I see previous
    conversation + search a conversation?" The #356 sync was ONE continuous thread. Built the full model (mock
    `mockups/chat-threads.html`, JM picked the drawer): server `chatThreads` (each with its own claude `--resume` session =
    per-conversation memory), migrates the legacy single convo into thread 1. New endpoints: `GET/POST /auth/chat/threads`,
    `GET/DELETE /auth/chat/threads/:id`, `GET /auth/chat/search`. Client (`Chat.tsx`): top-bar 🕘 opens a **Conversations**
    drawer (search + ＋New + day-grouped list w/ preview + delete); search highlights matches across chats; tap → open that
    thread. `/auth/chat` now targets the ACTIVE thread's session. tsc + 321 tests + build green. **On QA — big chat change,
    test before promote.** gymapp-only. **✅ Promoted to prod (JM 2026-07-05).** ⚠️ JM's prod `chatMsgs`/`chatThreads` = 0
    server-side — today's prod convo is only in his DESKTOP cache; to save it he must open the coach on that desktop (client
    seeds localStorage→server thread 1). Guidance given.
364. 🧪 **After submitting post-workout feedback, show "coach is reviewing" + WHERE the review lands.** JM 2026-07-05: wants a
    note/section after entering feedback that the coach is currently reviewing, and where the takeaways will appear. Built in
    `src/ActivityFeedback.tsx` (the shared feedback form): after Save it shows a "🔎 Your coach is reviewing this session…"
    block (pulses) that names where it'll land (here + Progress + 🔔 notification), and POLLS `coach-reviews` so the real
    verdict + takeaways (+ score) appear inline the moment they land (~1–3 min) — with a "See all coach takeaways on Progress →"
    link. Also shows an existing review on mount. `.pw-fbrev` styles. 321 tests. On QA.
365. 🧪 **Forecast "Expected" wrongly says "likely wrecked tomorrow, Form −29.8" when it's not true.** JM 2026-07-05.
    ROOT: `/auth/readiness-forecast` projected planned load `today+1 .. target` **INCLUSIVE** — so a hard planned session
    ON the target day projected its OWN post-session fatigue (Form crashes to −29.8 → freshness <1.6 → "Likely wrecked").
    But the forecast is meant to show how recovered you'll be GOING INTO the day (morning readiness). Fix: project only the
    days BEFORE the target (`today+1 .. target-1`, exclusive of the target's own session) — `server/server.js` loop `< date`
    + filter `d >= date`. Now a fresh athlete going into a hard day reads fresh, and it still accumulates fatigue from the
    intervening days. +3 readiness tests (#365), 324 total. gymapp-only.
366. 🧪 **#365 fixed tomorrow but Jul 7 still reads "wrecked" — REAL root found.** JM 2026-07-05. Pulled JM's live intervals
    data (scratchpad/fc.mjs): the "250 TSS on Jul 6" driving the crash is an event **"ATP W06 - Recovery consolidation",
    category `TARGET`** = an intervals Annual-Training-Plan **WEEKLY** target (~250 TSS for the whole week), NOT a single-day
    session. The forecast summed it as one day's load → ATL spike → false "wrecked". (His actual planned workouts that day
    have `icu_training_load: null`.) Fix: both `/auth/readiness-forecast` + `/auth/readiness-projection` now **skip
    `category === 'TARGET' | 'NOTE'` + `/^ATP/` events** (matches the app's existing ATP filter, `cleanEvents`/`isAtp`).
    324 tests + build. gymapp-only. FOLLOW-UP idea: planned WORKOUTs lack a load field → the forecast can't project their
    real load yet (shows fresh); estimating it from the workout doc is a later enhancement.
367. ⬜ **DAILY auto-adapt: coach re-plans every morning (~4am) from energy/sleep/HRV, no need to ask.** JM 2026-07-05: a
    scheduled trigger that, once the morning wellness (energy/sleep/HRV) is in (~4am), has the coach ADAPT the plan
    automatically + frequently — JM shouldn't have to ask daily. Define the planning HORIZON (JM suggests ~2 weeks ahead).
    Coach adapts the full plan proactively; if unsure, it can ASK. (Extends the check-in trigger #65 into a scheduled cron.)
    **JM picks (2026-07-05): "4am + re-check later", horizon = 2 weeks.** BUILT (`server/server.js`): an in-process daily
    scheduler (ticks every 30 min, QA/prod only) fires per athlete in their LOCAL tz — an **EARLY pass ~4am** (decides from
    Form/freshness, always available) + a **REFINE pass** once today's HRV/sleep/RHR actually lands in intervals. Each pass
    runs the locked-down coach with a "proactively adapt the rolling 14-day plan to readiness + goals/frequency/availability,
    notify what changed, and ASK via notify only if a material call is uncertain" instruction. Guarded once-per-pass-per-day
    (`user.dailyAdapt`). Manual trigger `POST /api/coach/daily-adapt` (+openapi) for testing. Kept OUT of coach-engine.md
    (E2BIG prompt-size risk, #352) — the instruction is self-contained. 324 tests. On QA.
368. 🔎 **Availability page (Profile) — great in PROD, worse in QA; KEEP prod's version.** JM 2026-07-05. INVESTIGATED: `dev`
    == `main` (empty `git log origin/main..dev`) and `src/Availability.tsx` uses dedicated `avail-*` classes I never touched
    this session — so QA + prod run IDENTICAL availability code + CSS. ⇒ almost certainly a **stale QA PWA bundle** (#200):
    hard-refresh QA and it should match prod. If it still differs after a hard refresh, need a screenshot of both (could be
    data-driven — QA vs prod are separate DBs). No code change made. gymapp-only.
369. 🧪 **Chip/"Completed" badge overlaps the activity TITLE on mobile (Android).** JM 2026-07-05. CSS layout bug — the status
    chip sits over the title on narrow screens. Fixed: `.card--done .eyebrow, .card--done h3 { padding-right: 112px }` so the
    absolute corner badge never overlaps. On prod. gymapp-only.
370. 🧪 **Desktop needs a REFRESH button (installed PWA, no address bar).** JM 2026-07-06: installed the PWA in Chrome, no way
    to refresh; mobile is fine (pull-to-refresh). Added a ↻ Refresh button in the header status cluster (`App.tsx`) — calls
    the exposed `updateSW(true)` (activates a newer bundle if one's waiting → picks up post-deploy changes, #200) then reloads
    (1.5s fallback reload if no new SW). Shown on DESKTOP only (`@media (hover:hover) and (pointer:fine)`) since mobile
    swipes. gymapp-only.
371. 🧪 **Coach double-booked days (2 same-sport rides/day) despite max 1/day.** JM 2026-07-06 (intervals screenshot: Wed 8
    = "Sweet Spot 2×15 — FTP Builder" + "Sweet Spot 2×15"; Fri 10 + Sat 11 similar). The one-per-day rule IS in the coach
    prompt (server.js:1113) + the #367 daily-adapt msg, but instruction drifted (same lesson as #168). ENFORCED server-side:
    `upsertPlan` now REJECTS (409) a NEW **coach**-created session (`actor==='coach'`, `i<0`) on a day already at the athlete's
    `maxPerDay` — message tells the coach to COMBINE into that day's session (same id) or move it; two short same-sport rides
    should be ONE. UI path (`actor==='you'`) exempt. Also: 2 sessions of the same sport ≠ one long ride (JM). Existing doubles
    on his prod calendar cleaned via a coach dedup run. 324 tests. On QA→prod.
372. ✅ **Form barely drops despite a hard week — planned rides carry NO load.** JM 2026-07-06 (intervals screenshot: an
    intense week, yet Form sits ~-3/-4 into Sat; "no way after a 2h ride my form stays at -3"). DIAGNOSIS via /tmp/audit.mjs
    against his intervals: Ride FTP=260 is set, every planned ride has a valid `%ftp` `workout_doc`, but **`icu_training_load`
    is `null` on all of them** → **intervals does NOT compute planned load for EXTERNALLY-created (API) workouts** — only for
    ones built in its own planner. No per-day load → CTL/ATL/Form projection stays flat. FIX (uses intervals OUT-OF-THE-BOX,
    per JM: we supply the number, intervals does the Form math): new pure `plannedTss(segments)` in `server/icu-steps.js`
    (standard Coggan TSS = duration·IF²/3600·100, IF = NP%/100; **FTP-independent** — the % IS the IF, mirrors client
    `plannedLoad`), set as `ev.icu_training_load` in `planToIcuEvent`. New `POST /api/plans/resync` re-mirrors all FUTURE
    plans so his EXISTING ones pick up the load (no content change). 328 tests (4 new for plannedTss). **On prod — VERIFIED
    end-to-end:** resynced his 13 plans, `icu_training_load` now 41/64/40/73/112/111, and his Form projection went from
    FLAT (-3.2 Sun) to a truthful **-22.2 Sun**. Round-trip on a throwaway event confirmed intervals stores + models it.
373. 🧪 **Energy (i) should show the ACTUAL numbers — current HRV vs known min/max.** JM 2026-07-06: the Energy readiness
    ⓘ currently reads "HRV +0.4 vs your baseline" (a z-score sign) — JM wants the concrete range: his current HRV vs the
    min/max he's known. Plan: `server/readiness.js` `baselines()` also returns `hrvMin`/`hrvMax` (raw ms) from history;
    expose in the readiness response; Today.tsx energy `why` renders "HRV 42 ms (your range 28–58)". Same treatment fits
    resting HR. gymapp-only. **On prod** (Energy ⓘ now reads "HRV NN ms (your range lo–hi) … resting HR NN (range lo–hi)").
374. 🧪 **Learned-stat cards: COMPACT summary, details on SELECT + always say WHEN/how-often/based-on-what.** JM 2026-07-06
    (Global benchmarks screenshot): the "Your benchmarks" cards (VO₂max, FTP, Threshold Pace, Max HR, Sleep Need) — the
    inline explanation should be COMPACT; the full detail belongs in a tap-to-open view. AND not all cards say how long
    until it's estimated (how many days/workouts), how often it updates, and on what. **VO₂max is the worst example** —
    just "51.1 · tap to switch", no word on HOW it's computed, WHEN, BASED ON WHAT, how FREQUENT, or when it'll next
    compute. FTP + Threshold already have a good ⏳ "after your next hard ride / after ~1 more run" line — bring that
    clarity to ALL of them, but move the long copy into the detail view. Needs a MOCK (options-first). gymapp-only.
    **JM REFINED (2026-07-06, on mock v1):** (1) CONTRAST BUG — the big value numbers are dark on grey, "barely see them"
    (the `.bm-cell__v` / `.cv` needs a bright color). (2) He LOVES the sleep "learning · 18/21 nights" colorful bar → wants
    that **confidence/learning bar on EVERY benchmark** (VO₂max, FTP, threshold, HR), each showing data-sufficiency toward a
    reliable estimate. (3) "Vo2Max the only way to update it? … there must be more SCIENCE" — wants MULTIPLE/advanced compute
    methods surfaced, not one. NOTE: the app ALREADY multi-estimates VO₂max (cyclingVo2max MAP + runningVo2max VDOT +
    hrRatioVo2max 15.3×HRmax/HRrest → `headlineVo2max` blends w/ confidence) — just shows one number. Plan: detail sheet
    shows each method's estimate + which drives + confidence + "to sharpen: <trigger>"; add more estimators where thin (FTP:
    eFTP + 20-min×0.95 + CP; pace: Critical Speed + VDOT; HR: observed + intervals ceiling). Mock v2 → confirm.
    **BUILT (Option B, JM approved):** `Benchmarks.tsx` + `styles.css` + new pure `benchmark-confidence.ts` (per-stat
    {pct,cls,label}, 17 tests). Every card: bright value (2-col grid), a method chip, + a colorful confidence/learning bar
    (learn=blue-green / strong=green / need=amber). Detail sheet: confidence bar + plain-language + "The science · N methods"
    (VO2max computes MAP + HR-ratio + VDOT live, marks IN USE) + "Sharpen it" callout. 352 tests green. On QA-prod.
375. ✅ **Coach OVER-PLANNED the week — ~2× sustainable load, no overload framing (root cause = #372 null loads).** JM
    2026-07-06 ("too many crazy workouts this week? normal?"). AUDIT of his real prod week (Mon Jul6–Sun Jul12): 6 rides +
    1 gym, planned **441 TSS** vs ~**225 sustainable** at his CTL≈32 (CTL×7) — a ~1.9 ramp, with **two back-to-back
    110-TSS days** (Sat 112 + Sun 111). Projected Form once #372 loads flow in ≈ **-25 by Sunday** (not the -3 intervals
    shows now with null loads). WHY the coach over-cooked it: planned loads were **null** (#372), so the coach had NO TSS
    signal that the week was 2× — it couldn't see its own ramp. FIX: (a) #372 gives the coach load visibility; (b) add a
    coach guardrail — cap weekly ramp vs CTL (≤ ~1.3× / weekly TSS ≲ CTL×7–8) UNLESS a deliberate, communicated overload
    block + a following recovery week; avoid back-to-back long-hard days for a CTL-32 athlete. Coach-engine + planning logic.
    **DONE + on prod:** pure `weeklyLoadBudget(ctl)` (CTL×7 flat / ×8 build / ×9 cap, unit-tested), CTL stashed in
    `/auth/readiness`, `buildSystemPrompt` injects a `# WEEKLY LOAD BUDGET` section (concrete numbers when CTL known),
    cycling engine "verify the week TOTAL" line. THEN JM chose "rebalance now" → ran a targeted `/api/coach/run`: coach cut
    the week **441→~250 TSS**, dropped Sunday's threshold (no back-to-back), long ride 120→90min endurance, Fri tempo→easy,
    kept ONE quality day; Form peak now **-7.7** (was -22). Coach notified JM in-app. 332 tests.
376. ✅ **Load & Form charts have a GAP — the line stops ~Jun 24 and a disconnected segment restarts Jun 24→Jul 20.** JM
    2026-07-06 (Fitness/Fatigue + Form screenshots): the historical (solid) line ends ~Jun 24, then the projected (dashed)
    line starts later with a visible break — not continuous. Today is Jul 6, so it's odd the ACTUAL line stops Jun 24 AND
    the projection doesn't start at today. Likely: historical + projected series are two arrays that don't share the join
    point (projection should begin exactly at history's last real point), and/or a date-range mismatch leaves Jun 24–today
    uncovered. REVIEW ALL the Stats graphs for the same discontinuity. gymapp-only.
    UPDATE (diag): pulled JM's real data — history is COMPLETE to today (Jul 6), projection is contiguous (Jul 7-20),
    and the merge join is provably at the same index. So the on-screen gap is NOT data — likely a STALE PWA bundle
    (projection code unchanged since #248; I shipped ~5 bundles today). Ask JM to hard-refresh / use the Refresh button;
    if it persists, dig into the live render. Also harden: only append projection when viewing up-to-today.
    UPDATE 2 (JM refreshed, gap PERSISTS → not stale bundle): traced JM's EXACT client responses (minted his session on
    the box): projection = clean 14d Jul7-20 (dates/ctl/atl/form all len 14); wellness = 91 contiguous rows to today, ZERO
    trailing nulls. A render repro proved the current merge draws THAT continuously (history-end + projection-start both at
    index 90, connected). So a BLANK gap is only possible from **trailing null-CTL tail rows** in the RENDERED range (a range
    tail intervals hasn't finalised) sitting BETWEEN the solid history and the dashed projection. FIX: `Fitness.tsx` now
    TRIMS trailing dataless days (`fitness==null && fatigue==null`) so history ends at its last REAL point → projection
    joins seamlessly. If it STILL shows after this + a refresh, it's the PWA cache (instrument the live client next).
    ✅ ROOT CAUSE (2026-07-06, JM: "worked for fitness & fatigue, not form"): I RENDERED the real `TrendChart` with JM's
    real data (esbuild+react-dom/server → PNG) and PROVED all 4 lines are continuous to the projection end — NO gap in any.
    The Form line only *looked* broken because its colour was `fz.color` (the current zone → **grey #9aa3b2**), and in the
    projected region a grey line sits over the grey neutral band + the grey "today" shading = invisible. Fitness/Fatigue are
    vivid blue/purple so they read fine. FIX: Form line is now **`var(--text)` (bright white)** — stands out over every band +
    the shading, so the projection is unmistakable. Verified via faithful render (grey vs white side-by-side). Lesson: don't
    colour a trend LINE the same neutral as its background bands; the bands carry the zone, the line carries the trajectory.
    ✅ ROOT CAUSE 2 — the DESKTOP "lines stop at different points" (JM on QA 2026-07-06: "some lines go further than others,
    load goes to Jul 14 but not the others"). Rendered the real charts at DESKTOP width (1480px) and REPRODUCED it: Fatigue
    stopped ~Jun 12, Form ~Jun 5, Fitness reached Aug 3 — impossible from data (119 continuous pts). Cause: the `.trend-line`
    **draw-in animation** (`stroke-dasharray:1; stroke-dashoffset:1; pathLength=1; animation:trend-draw`) — a dash reveal
    that, under the non-uniform SVG stretch (`preserveAspectRatio=none`) at WIDE width, strands each line mid-draw at a
    different x. Same bug class as #355 (already removed from the power/pace CURVES). FIX: trend lines render **STATIC** now
    (removed class + `pathLength` + the CSS animation/keyframes). Re-render with anim off → all 4 lines continuous to Aug 3.
    Why mobile hid it: the narrow chart completed the reveal before the screenshot. Don't re-add a dash-reveal to trend lines.
    (Separate, STILL OPEN → see #393: weeks 3–4 are a FLAT held-load tail, not a real coach plan.)
377. 🔨 **Gym workout doesn't render its exercises in Platyplus (coach plan detail shows title + blurb, then BLANK).** JM
    2026-07-06 (prod screenshot): the "Upper-Body & Trunk Strength" gym session opens to the title + one-line coach note,
    then nothing — the exercise list (DB Bench, Lat Pulldown, Face Pull, Pallof, Dead Bug…) is missing, even though it IS
    in the intervals description. The exercises are either not saved as structured `exercises` (coach put them in notes) or
    the `/coach/:id` / `/plan/:id` render drops them for gym. gymapp-only.
378. 🔨 **Intervals event has the "Open in Platyplus" link TWICE — prod AND QA (shared athlete i28814).** JM 2026-07-06
    (intervals screenshot): the gym event description shows two "Open workout in Platyplus →" links, one
    `platyplus.duckdns.org/coach/…` (prod) + one `platyplus-qa.duckdns.org/coach/…` (QA). Root cause: QA + prod share the
    same real intervals athlete, and BOTH environments annotate the same event with their OWN base URL. Fix: QA must NOT
    write the Platyplus deep-link into the shared athlete's events (only prod annotates), or de-dupe/strip prior links
    before writing, or gate the link on the prod base URL. Also the gym "workout" renders an empty 0w power chart in
    intervals (gym has no power) — consider not pushing a workout_doc/power for gym. gymapp + infra.
    **CODE FIX (both #377+#378):** pure `stripPlatyplusLinks()` in `icu-steps.js` (unit-tested) applied wherever notes
    are composed (`planToIcuEvent` ride+gym) or imported (`icuEventToPlan`) → link can't accumulate; and reconcile now
    SKIPS importing a gym event carrying the Platyplus link (it's ours; intervals has no exercises → empty shell). Still
    TODO: clean the 3 already-corrupted plans' stored notes + have the coach re-author their exercises. 25 icu-steps tests.
379. 🧪 **Move a planned activity from one day to another (drag & drop?).** JM 2026-07-06: wants to reschedule a session by
    dragging it to a different day on the calendar. Needs a MOCK (options-first): drag-drop on the Plan/calendar grid vs a
    "move to…" date picker on the session (mobile-friendly — DnD is fiddly on touch, so likely BOTH: long-press drag on
    desktop + a "Move" action with a day picker on mobile). Server already supports date change via `upsertPlan` (same id,
    new date → re-pushes the intervals event); this is the UI. Respect one-session/day (offer to combine/bump if target full). gymapp-only.
    **BUILT — JM picked the QUICK PICKER (mobile-first, not drag):** `MovePicker.tsx` + pure `move-dates.ts` (13 tests). Tap a
    session → "Move to another day…" → one-tap shortcuts (Tomorrow / In 2 days / This weekend / Next week, each showing the
    date) + This-week/Next-week day strip (current day purple, FULL days amber dot). Full day → inline "combine or move it"
    confirm. Move = `savePlan/saveItem` (same id + new date → re-push). **Undo bar** after each move. icu-origin events show a
    disabled "edit in intervals" row. 365 tests. On QA→prod. (Drag on desktop week-view = possible later enhancement.)
380. 🧪 **Moves made IN intervals (swap gym↔ride across days) must mirror back to Platyplus on "update".** JM 2026-07-06:
    moved his gym to tomorrow + tomorrow's ride to today IN intervals, expects the Update/Refresh button to pull that into
    Platyplus. TENSION: the model is **Platyplus-WINS** (`reconcileFromIcu` refreshes only icu-origin plans' title/notes/
    segments — NOT date; Platyplus-origin plans are never overwritten → a Platyplus push would move it BACK). And #377 now
    SKIPS importing gym events carrying our link → a gym MOVE in intervals wouldn't be detected. FIX (bidirectional SCHEDULE
    sync): when an OWNED event's DATE changed in intervals, update the plan's date (mirror the move) for ALL origins, and
    still allow a gym owned-plan's date to update despite the #377 skip (skip only NEW-shell imports, not date-refresh of an
    already-owned plan). Also: what does the "update button" trigger today? Wire it to call `reconcileFromIcu`. Needs a small
    design decision (which side wins on a same-session conflict) — likely "last edited wins" or "intervals move wins for date". gymapp.
    **JM PICKED "intervals move wins for the DAY".** DONE: `reconcileFromIcu` owned-event block now adopts the intervals
    `start_date_local` for the plan's date on EVERY origin (content stays Platyplus-owned unless icu-origin); `refreshed++`
    → saves. Runs on every Today/Calendar load (so Refresh mirrors it). 335 tests.
381. 🧪 **Gym session is DUPLICATED across days (Mon 06 + Tue 07, both empty).** JM 2026-07-06 (intervals screenshot):
    "Upper-Body & Trunk Strength" shows on TWO days. Chain: JM moved the gym to Tue in intervals (#380) → but a coach
    re-run / Platyplus push re-created it on Mon → 2 empty shells. This + #377/#378 all trace to ONE root: **QA + prod
    share the real intervals athlete i28814**, and BOTH run the #367 scheduler + push to it, so they duplicate/collide on
    the shared calendar. DIG (JM's pick): (a) de-dupe the existing gym now; (b) fix the create/dedup path (the max-per-day
    409 keys on date only — a cross-env or moved dup slips through; reconcile should collapse same-id/same-session dups);
    (c) **the real fix = ENV ISOLATION — QA must not write to the shared athlete** (separate test athlete, or gate the
    push + scheduler off on staging). Needs a decision. gymapp + infra.
    **DONE (a)+(b):** deleted the orphan Jul-7 event (the gym is now single, Mon Jul 6, with its 11 exercises — #377 also
    resolved). ROOT of the dup: `findIcuEventsForPlan` only searched `plan.date`, so a moved event wasn't found → push
    CREATED a duplicate. Fixed `pushPlanToIcu` to also fetch our known event by `icuEventId` (any date) → it UPDATES+moves
    the existing one instead of duplicating. 335 tests. **(c) DONE — JM picked "gate QA off intervals":** `IS_STAGING`
    (from the QA `RP_ID`/`ORIGIN`, verified prod=false/QA=true) makes staging READ-ONLY toward intervals — `pushPlanToIcu`
    skips + `dailyAdaptTick` (scheduler) returns early on QA. Only PROD writes to the shared athlete now; QA still reconciles
    IN. This kills the cross-env collision class at the root. ⚠️ verify prod still mirrors after deploy (IS_STAGING must be false).
382. ⬜ **Progress page is EMPTY / gym-only — irrelevant for a cyclist.** JM 2026-07-06 (screenshot): the Progress page shows
    "0 VOLUME · THIS WEEK", "🔥 0 DAY STREAK", "1 session · 11 min · 0 this week", an empty "Weekly volume · 9 wk" chart, and
    a nonsensical "Peak 1 kg". It's built around STRENGTH/gym volume (kg), but JM trains mostly on the bike → nothing to show.
    FYI/future (JM: "we will have to work on the progress page"). Rework to surface progress for the athlete's ACTUAL sports:
    cycling/running (eFTP trend, weekly TSS/hours, Form/CTL climb, PRs / power curve, VO₂max trend) + adapt the headline
    stats + streak to endurance, not just gym reps×kg. Adaptive per `user.sports`. gymapp-only. Needs a mock (options-first).
383. 🔨 **Check-in chart: break out Sleep · Energy · Form as separate lines (same graph) + each with min/max/avg.** JM
    2026-07-06 (Wellness "📝 Check-in (your 1–5)" screenshot): today it plots the MEAN of energy/sleep/soreness (one purple
    daily + 7-day-avg line). JM wants the overall average KEPT, PLUS Sleep, Energy, and Form(=6−soreness / readiness Freshness)
    as their OWN lines in the same graph, each showing its avg · min · max. Data's already there (`checkins` → energy/sleep/
    soreness per day). Plan: a multi-series variant of `WTrend`/`MetricCard` in `Wellness.tsx` — 3 component lines (7-day avg,
    distinct colors) + overall avg (faint), legend with per-metric avg/min/max. Readability trade-off (3-4 lines on a 1–5
    scale) → mock overlay-all vs segmented-focus. gymapp-only. Needs a mock (options-first). **JM PICKED B (overlay + tap-to-focus).** Building.
384. 🧪 **Coach authored an INVALID range — cool-down "143-117" (high number first) + a "rest" interval with no range.** JM
    2026-07-06 (for-after): a range must read low→high (or be a proper ramp-down, not "143-117" backwards); a "rest" interval
    came through with no range at all. Fix the COACH + MCP validation: (a) normalize/reject descending numeric ranges (swap
    or flag), (b) require a valid target on every non-rest step + a proper form for REST (e.g. explicit 0/recovery, not a bad
    range), (c) add more format-validation mechanisms so bad shapes can't reach intervals. Likely in `validateGymWorkout` /
    the SEGMENTS schema (`mcp/server.js`) + `icu-steps.js` encode + the coach-engine workout-format rules. Trace the real
    round-trip. gymapp coach + MCP + server. Needs its own pass.
    ✅ RECURRED + FIXED (JM 2026-07-08, screenshot: cool-down "10m 150-117w (58-45%)"): it was his COOL-DOWN ramping DOWN 58→45%,
    which intervals renders start→end so it reads "150-117" like a backwards range. JM's pick = **flat easy spin** for cool-downs.
    Added `normalizeRamps(segments)` in `icu-steps.js` (cool-down → single value at the eased-down power; warm-up always ramps UP;
    WORK segments left as authored so real over-unders/progressive ramps survive), applied at BOTH persist (`upsertPlan` guard, so the
    DB + app view match) AND push (`planToIcuEvent`, covers existing plans on re-sync). 4 unit tests green. Reprocess JM's plans
    (`/api/plans/resync`) so his already-pushed cool-downs flatten in intervals. (Deferred: the "rest interval with no range" +
    generic descending-WORK-range rejection — revisit if it recurs.)
385. 🔨 **Make per-sport benchmark displays CONSISTENT with the polished Global "Your benchmarks" (#374).** JM 2026-07-06:
    "I love the global section" — wants the SAME treatment on the per-sport pages. Global (`BenchmarksCard`) now has method
    chips + colorful confidence bars + tap-for-science (#374); but the **Cycling** page shows plain "VO₂max (est.) / eFTP —
    No data yet" cards and the **Running** page shows plain Threshold/VDOT/VO₂max cards — inconsistent + less informative.
    Reuse `BenchmarksCard` (or its card style) on `CyclingStats`/`RunningStats`, filtered to that sport's benchmarks, so
    they match Global. Also the "No data yet" for a 3-mo range is confusing (the value exists in Stats). gymapp-only. Likely
    direct reuse of the #374 component — small mock/confirm.
386. 🔨 **History page: the "Activity · Sat" entry is vague + filters/sorting unclear.** JM 2026-07-06 (History screenshot):
    a session needing feedback shows only "Activity · Sat" (no sport name/title/date) → confusing what it is. JM also asked
    "no filters (sports type?), sorting (by date?)" — the page DOES have All/Ride/Run/Gym/Mind filters + a Newest sort +
    date range, so either they're not discoverable or the top "needs feedback" card ignores them. FIX: label the entry with
    its real sport + title + full date (not bare "Activity · Sat"); make the filters/sort obviously apply to everything incl.
    the feedback card; confirm sort-by-date works. gymapp-only.
387. 🧪 **"Missing feedback" should be a HEADLINE, not buried in History.** JM 2026-07-06: the "N session(s) still need your
    feedback" banner lives inside History/Logs — but post-workout feedback drives the coach's review + plan adaptation, so it
    should be surfaced prominently (a headline on Today, and/or a badge/nudge on the Coach FAB or the top bar), not hidden a
    tab away. Plan: show a compact "N to review → " card near the top of Today (links to the oldest one), reusing
    `incompleteFeedback(acts)`; keep the History list too. Consider a count badge on the nav. gymapp-only. Small mock/confirm.
    ✅ BUILT (JM picked Option A from mockups/today-to-review.html): a compact amber `ToReviewCard` on Today (right under the check-in,
    only when `incompleteFeedback(activities).length > 0`) — "N sessions need your feedback · Review →", taps through to the full
    per-session list on Logs (`/logs`). Reuses the existing `.fbban` styling + a new `.fbban__cta`. tsc clean. gymapp-only.
388. ✅ **Pushed workout is DOUBLED in intervals — 1h1m in Platyplus renders as ~2h (steps repeated).** JM 2026-07-06
    (Platyplus vs intervals screenshots of "Sweet Spot 2×15 — FTP Builder", Wed Jul 8): Platyplus = 61 min / 64 TSS / IF .79;
    intervals shows the SAME event but the workout_doc steps are DUPLICATED — Warmup·Opener·Easy·SS·Recovery·SS·Cooldown then
    Warmup again… graph runs to ~1:56 (≈2×). `icu_training_load` (64) is right, but the `workout_doc.steps` got doubled on
    push. Trace `planToIcuEvent`/`pushPlanToIcu` (`server/icu-steps.js` + server) — likely a re-push APPENDING steps, or the
    native text + workout_doc both counting, or encodeStep double-run. **Applies to ALL sports/activities** (JM directive:
    every fix covers all impacted activities). Fix + reprocess his existing plans so none stay doubled. Coach/MCP/API/server.
    **ROOT + FIX (verified on prod):** the native TEXT leaked into `plan.notes` via reconcile (icuEventToPlan imported
    `ev.description` → notes), then re-doubled on push. `stripDerivedWorkout()` (pure, icu-steps.js, 4 tests) now strips it on
    compose (`planToIcuEvent`, ride+run) + import (`icuEventToPlan`). Resynced → Jul 8 ride back to a SINGLE Warmup (1h, was
    ~2h); stored notes self-heal on next reconcile. Propagated to memory + CLAUDE.md. 29 icu-steps tests. Coach needs no
    change (doubling was server-side reconcile, not authoring). Applies to ride+run (gym has no native text).
    389. ⬜ **#384 + #382 (and every fix) must apply to ALL SPORTS, all activities, all the time.** JM directive 2026-07-06:
    "ensure 384 and 382 are done for all sports at all time; all fix is for all activities impacted by it." Standing rule —
    a fix isn't done until it covers ride + run + gym + mind + swim etc. and past/present/future activities. See [[platyplus-propagate-all-layers]] + [[platyplus-reprocess-after-change]].
390. ⬜ **(FUTURE / idea) Collect recipes into the Eat library — Make Good Food + HelloFresh.** JM 2026-07-06: scrape/import
    ALL recipes from **www.makegoodfood.ca/recipes** AND **www.hellofresh.ca/recipes** into our recipe catalog "with tags and
    all" + **pictures**. Follow `CONTENT.md` runbook: importer → `build-catalog.mjs` (free-first de-dup + the media
    independence gate — HOST the images on the XPS, NEVER hotlink 3rd-party per the invariant) → `npm run sync:catalog` →
    content-manifest (license/commercial flags — check ToS before scraping) → deploy. Tag by meal type / cuisine / diet /
    macros / time so the coach's `search_recipes` can pick well. Parked until JM prioritizes. gymapp content.
391. 🧪 **Forecast/projection only goes 14 days — extend it (+ the To filter caps at today).** JM 2026-07-06 (Load & Form):
    "wish the coach would project more than that." The projection = 14d (`readinessProjection(14)`, endpoint caps at 28);
    the To date-picker `max=today`. TRADE-OFF: the forecast is driven by PLANNED load, and the coach only keeps ~14 days
    populated (#367 DAILY_HORIZON=14) — naively extending to 6 wk shows Form RISING (falsely fresh) because there's no
    planned load past day 14 (→ CTL/ATL decay to 0). So a longer forecast needs unplanned future days to assume a HELD load
    (recent avg daily TSS or a maintenance target), else it lies. Plan: (a) raise the endpoint cap + `readinessProjection(N)`;
    (b) fill days past the planned horizon with the athlete's rolling avg load (a "if you hold this" projection), clearly
    labelled; optionally (c) bump the coach's planning horizon. The To filter caps history at today (correct — no wellness
    past today); a longer PROJECTION auto-extends the axis, so the filter needn't change. Ask JM the horizon (4/6 wk / to a race). gymapp.
    ✅ SHIPPED as **4 weeks** (JM's pick): `readinessProjection(28)`; endpoint fills days past the last PLANNED event with a
    HELD load (`heldLoad = round(latest.ctl)`) → an "if you keep training like this" tail, labelled via an ⓘ on the Form note.
392. 🧪 **Expanded-chart modal (⤢ Load/Form) — the ✕ won't close it; you get stuck in the fullscreen chart.** JM 2026-07-06
    (Form modal screenshot: "once a graph is open, cannot click on the X to close it"). On mobile the panel is near-fullscreen
    so there's barely any backdrop to tap as a fallback, and the ✕ tap wasn't landing reliably. FIX (`charts.tsx` `ChartModal`
    + `styles.css`): closes **3 ways now — ✕, tap-outside, and Escape**; the head is `position:sticky; z-index:3` (its own
    stacking layer, always above the chart's scrub/pointer area so the chart can never intercept the close tap) with
    `touch-action:manipulation` on the ✕ (no 300ms tap delay / double-tap zoom); body scroll locked while open. gymapp-only.
393. ✅ **Make the 4-week forecast REAL, not a flat held-load tail — "adjust the coach to forecast that."** JM 2026-07-06
    (QA, after the #376 animation fix): the axis runs 4 wks but weeks 3–4 are a FLAT held-load line (`heldLoad = round(CTL)`
    ≈ 32 TSS EVERY day past the coach's ~14-day plan, server.js:728/730) → CTL holds flat, ATL→32, Form→0. It reaches Aug 3
    now but looks lifeless/pointless ("what's the point of the graph going further than the lines"). JM wants the COACH to
    actually forecast 4 weeks. DESIGN (needs JM's pick, mock first): (A) bump `DAILY_HORIZON` 14→28 so the coach plans real
    sessions 4 wks out (real forecast, but +churn — daily-adapt re-plans them, plans that far are speculative); (B) periodized
    EXTRAPOLATION — past the plan, repeat the athlete's recent WEEKLY pattern (rest days + a gentle progressive ramp) instead
    of flat 32/day, labelled "projected" (realistic-looking, zero coach churn); (C) coach authors WEEKLY LOAD BLOCKS
    (build/build/peak/recover periodization) for 4 wks + the projection distributes each week's target across its days (real
    coach INTENT, less churn than daily planning) — the training-science-correct answer. Recommend C (or B as a quick win).
    Touches `readiness.js`/`server.js` projection + maybe coach horizon + `coach-engine-*.md`. gymapp + coach. See [[platyplus-readiness-model]].
    ✅ SHIPPED (JM picked "coach weekly blocks" + "mirrored"). KEY discovery: JM already has a 31-week intervals **ATP**
    (category=TARGET events, `load_target`, e.g. "ATP W08 - Threshold overload" 430). So the forecast READS his real
    periodization from the ATP instead of a made-up default — inherently "mirrored" (intervals IS the source). Built:
    pure `isoMonday`/`defaultLoadPlan`/`recentRestDows`/`periodizedLoads` in `readiness.js` (12 unit tests); the
    `/auth/readiness-projection` endpoint now, past the detailed ~2-wk plan, spreads each week's ATP `load_target` across
    the athlete's real training days (rest DOWs from recent history, weekend-weighted) — priority coach-authored
    (`user.info.loadPlan`) > ATP > CTL-sized default; returns `loadPlan`/`planSource`. Verified on JM's real data: W08/W09
    overload (430/460) → W10 recovery (260), Form dips to −24 through the overload block then freshens — actionable, not
    flat. Client InfoDot updated. ⬜ FOLLOW-UP (#394): let the COACH author/adjust the ATP blocks from chat (POST
    `/api/coach/load-plan` + write `load_target` back to the ATP TARGET events + MCP tool + coach-engine) — the forecast
    already reads them; this adds coach-side EDITING. Also: the coach should FLAG that JM's ATP overload weeks (×13–14 CTL)
    exceed the ×12 cap (Form → −24). gymapp + coach.
394. 🧪 **Let the coach EDIT the ATP weekly blocks from chat + flag over-cap overload weeks.** Split from #393: the 4-wk
    forecast now READS the intervals ATP weekly TARGETs, but the coach can't yet author/adjust them. Build: `POST /api/coach/load-plan`
    (store `user.info.loadPlan` + write `load_target` back to the ATP TARGET events, prod-only via IS_STAGING) + an MCP tool +
    `coach-engine-*.md` guidance. Also: coach should FLAG when a week's target exceeds `weeklyLoadBudget().cap` (×12 CTL) — JM's
    ATP W08/W09 (430/460 on CTL 32 ≈ ×13–14) project Form to −24. Propagate to openapi + MCP + engine. gymapp + coach.
    ✅ BUILT (2026-07-08): `POST /api/coach/load-plan` stores `user.info.loadPlan` = `[{weekStart(Monday), target TSS, phase?, focus?}]`
    (normalised/deduped/snapped-to-Monday) — the TOP-priority source the #393 4-wk forecast already reads, so the projection reflects the
    coach's plan immediately. Returns the CTL band (sustainable ×7 / build ×9 / hard ×11 / cap ×12) + an **`overCap`** list of any week
    beyond ~CTL×12 (JM's ATP W08/W09 would flag). MCP tool **`set_load_plan`** (says: respect the band, a week over cap must be a NAMED
    overload) + the `# WEEKLY LOAD BUDGET` prompt block points at it + openapi documented. ⏳ DEFERRED: the intervals `load_target` write-back
    onto the athlete's ATP events — needs idempotent upsert (Platyplus tracks event ids to UPDATE; a plain POST duplicates) + IS_STAGING gate;
    the in-app forecast value lands without it. TEST: after deploy, `POST /api/coach/load-plan` w/ an over-cap week → response flags it + the
    Load&Form projection bends to the plan.
395. 🔨 **Wellness charts (HRV · Resting HR · Weight · Sleep) need the HOVER SCRUBBER + tooltip like Load & Form.** JM 2026-07-07
    (screenshot): "want those graphs to have a line that shows with hovering like the form/fitness graph, to see values in x & y —
    that's a standard feature. Be consistent with the coach insights so graphs follow the same standards too." Root: Wellness uses a
    bespoke `WTrend` (Wellness.tsx, `aria-hidden` SVG, NO pointer handlers/tooltip) while Load & Form uses the shared `TrendChart`
    (hover + tooltip + axes). FIX = switch `MetricCard` to the shared `TrendChart` (daily + 7-day-avg series, axes, hover tooltip
    showing date + value) + add a coach-voice insight line per metric (already have `wellness-insights.ts`). Enforces the ONE-shared-
    chart standard ([[platyplus-chart-standard]] — WTrend is exactly the hand-rolled polyline the standard says to retire). gymapp-only.
396. 🧪 **Running stats has NO pace curve (cycling has the power curve).** JM 2026-07-07: "cycling power curve looks good, but for
    running I don't see the pace curve. Add this too." `RunningStats.tsx` shows a pace TREND but not the mean-max pace CURVE.
    `PaceCurveChart` already exists in charts.tsx. Data source FOUND: intervals `/athlete/{id}/pace-curves?curves={days}d&type=Run`
    → `list[0].distance[]` (meters) + `values[]` (seconds to cover each) → pace sec/km = `values/distance*1000`, duration = `values`.
    Build `fetchPaceCurve(days)` in intervals.ts (returns {secs, pace}), add `PaceCurveChart` to RunningStats mirroring how
    CyclingStats uses PowerCurveChart (+ best-pace-at chips: 400 m / 1 k / 5 k / 10 k). JM has 10 runs → real data. gymapp-only.
    UPDATE 2026-07-07 (JM: "good in QA but you forgot the check-in breakdown one"): also converted `CheckinBreakdown`
    (Sleep/Energy/Form + overall) from its bespoke SVG to the shared `TrendChart` — hover + tooltip, tap-to-focus now via the
    `faint` series flag, overall dashed — + a coach insight (readiness trend + weakest lever). Pace curve got an insight too.
397. ⬜ **STANDING RULE — a coach insight on EVERY graph where there's added value.** JM 2026-07-07: "for every graph, every
    data, the coach should include insights if there's added value to learn and mostly improve (or to know what to keep doing)."
    NOT a one-off — a bar for all charts (reinforced in [[platyplus-insights-everywhere]] + [[platyplus-chart-standard]]). Done so
    far: Fitness/Fatigue/Form/Load, all Wellness metrics + CheckinBreakdown, pace trend + pace curve. ⬜ AUDIT the rest + add where
    valuable: cycling **power curve** + **eFTP trend** (CyclingStats), running race-predictions, benchmark cards, any Progress/Mind
    charts. Insight = one plain line: what it means + keep-doing / do-this-to-improve. Skip only when genuinely no signal. gymapp-wide.
398. 🧪 **Threshold pace shown TWICE on Running + pace-curve insight not appearing.** JM 2026-07-07 (screenshot): "threshold
    there 2 times; also no insights yet under pace graph." (1) `RunningStats` rendered BOTH the Threshold **benchmark card**
    (value + confidence + tap-to-edit sheet) AND a duplicate inline `ThresholdCell` — removed the ThresholdCell (+ its
    `saveRunPace`, unused `refresh`/`parsePace`/`setSetting`); the benchmark card's edit sheet (Benchmarks.tsx `Sheet`, an
    editable input + Manual/Computed toggle) is the single source and still drives zones/predictions via `user.runThresholdPace`.
    (2) The pace-curve insight required a 1 k AND 5 k bucket, but JM's curve maxes at 4 km (no 5 k) → silently null. Rewrote it
    threshold-anchored + robust: if the 1 k pace sits >30 s/km easier than threshold → "mostly base miles, add tempo/intervals"
    (true for JM: 1 k 6:08 vs 4:57 threshold); else the endurance fade over whatever longest distance exists. Chips now adaptive
    (400 m/1 k/5 k/10 k → only render distances with data, no "—"). Reinforces #397. gymapp-only.
399. 🧪 **Running layout polish — race predictions under the pace curve + colour-coded training zones.** JM 2026-07-07:
    "should we merge race predictions under the pace graph? can training paces reflect the UX more?" Mocked V1 (colour rows)
    vs V2 (pace ladder) → JM picked **colour rows**. Built: reordered `RunningStats` so **Race predictions sit right under the
    pace curve** (both = "what you can do"), then **Training pace zones** ("how to train") as a **cool→warm effort spectrum**
    (Easy blue → Marathon green → Threshold gold → Interval orange → Rep red) via `.zrow--pace` (left accent bar + pace in
    the zone colour). Chip decision (JM asked re 5 k/10 k/half/marathon): curve chips stay ACTUAL best efforts (400 m/1 k);
    5 k+ are PROJECTIONS shown in Race predictions right below — not mixed into the chips (his actual 1 k 6:08 next to a
    projected 5 k 4:43 would read as "faster at 5 k than 1 k"). Verified via render (real styles.css). gymapp-only.
400. 🔨 **intervals-style BEST-EFFORTS table under the power/pace curve + Coros-style separate race predictions.** JM
    2026-07-07 (intervals + Coros screenshots): "what I want is like intervals.icu for power curve & running pace under stats;
    keep race prediction separate like coros." + "keep benchmarks at top, only adjust graph & predictions, don't redo the whole
    thing." Mocked 3 layouts → JM picked **A (separate 'Best efforts' table card under the curve)**. Design: a table Distance/Time
    bucket × [This season · All time] (all-time in orange), time+/km for running, W+W/kg for cycling. Data VERIFIED buildable:
    intervals `power-curves`/`pace-curves` accept MULTIPLE `curves=` specs (this-season = `${daysSinceJan1}d`, all-time = `10000d`)
    → best at 5s/1m/5m/20m (power) or 1k/3k/5k/10k (pace). Sanity-filter pace buckets (all-time 1 k returned garbage 8 s → reject if
    pace <2:30 or >12:00/km). NO metrics strip (VO₂max/CS live in the benchmark cards — JM: "don't duplicate"). Race predictions →
    restyle to Coros table (Distance · Time · Avg pace), kept SEPARATE (undo the #399 under-curve move). Benchmarks untouched.
    Build: `fetchPowerBest()`/`fetchPaceBest()` (intervals.ts) + a shared `BestEffortsTable` (charts.tsx) + wire CyclingStats +
    RunningStats. gymapp-only.
401. 🔨 **TTE as a LEARNED benchmark, per sport (like VO₂max/sleep).** JM 2026-07-07: "TTE add it to benchmark for each sport if
    relevant and make sure we learn about it too like the rest." TTE (time-to-exhaustion at threshold) is NOT a stored intervals
    field — it's DERIVED from the CP/W′ power model (`powerModels` on the power-curve; cycling TTE ≈ W′/(eFTP−CP); running from the
    CS/D′ model). Build: a new benchmark `Key` `'tte'` per sport (cycling s · running s) in `Benchmarks.tsx` (`src/benchmark-confidence.ts`
    gets a `tteConfidence`), computed from the curve model, manual-override + auto/computed toggle like the rest, and surfaced in the
    coach (openapi + MCP + coach-engine — [[platyplus-propagate-all-layers]]). Add to the benchmark cards (top), NOT the best-efforts
    table. gymapp + coach.
402. 🧪 **TTE theory → coach knowledge base + card reframe.** JM 2026-07-07 shared https://trainright.com/…time-to-exhaustion-tte…
    ("good for the coach") after questioning why his cycling TTE showed 6:30 vs the textbook "30–70 min at FTP". Theory: TTE =
    max duration you hold FTP/threshold (normal 30–70 min; moderate 30–40, well-trained 45–75); FTP is a POWER-DURATION PAIR, not a
    bare watt; a short TTE is usually a TRAINING TARGET (extend with extensive threshold work — 3×15–20/3×24/4×15 min @ 90–95% FTP,
    6–10 min rec, total work ≈ current TTE), only flag FTP-too-high when TTE ≪ 30 min vs eFTP. Built: `docs/tte.md` (full theory +
    tables, cited) + a concise TTE section in `coach-engine-cycling.md` + reframed the TTE benchmark narr/sharpen (references the
    30–70 min norm + "extend via threshold work, not more watts"). ⚠️ verify coach-engine reaches the host coach on deploy. gymapp + coach.
403. 🧪 **"Beyond FTP" metrics — CP · W′ · Efficiency Factor (+ running equivalents) as benchmarks AND graphs + coach brain.** JM
    2026-07-07 shared 3 sources (mattbottrill "beyond FTP", joinvekta CP/W′, roadman EF/Joe-Friel). Wants the metrics that really
    drive performance, running equivalents where they exist, the COACH to reason with them, and GRAPHS to our chart standard. Plan:
    (a) **CP + W′** (cycling) and **CS + D′** (running) as learned benchmark cards — DATA ALREADY EXTRACTED (`PowerCurve.cp/wPrime`,
    `PaceCurve.cs/dPrime` from the curve models, #401) → quick. (b) **Efficiency Factor** EF = NP÷HR (ride) / pace÷HR i.e. NGP÷HR (run)
    per activity → a TREND graph (rising EF = aerobic engine improving even when FTP is flat; masters ~1.4–2.0; trend over noise; add
    aerobic decoupling Pw:HR if easy) — new compute from activities (intervals has `icu_weighted_avg_watts`, `average_heartrate`,
    `decoupling`). (c) coach KB: CP/W′/FRC + EF interpretation + "high FTP+short TTE=fragile · moderate FTP+long TTE=diesel" → docs/ +
    coach-engine. Present a plan + confirm scope (big feature). gymapp + coach. See [[platyplus-chart-standard]] · [[platyplus-insights-everywhere]].
    ✅ BUILT (JM: "build it all, don't forget mockups"). Mocked (mockups/beyond-ftp.html) → approved. Phase 1: CP·W′·CS·D′
    benchmark cards (modelFitConfidence, from the curve fit, no test). Phase 2: EF trend graph on both stats pages (fetchEfTrend
    reads intervals `icu_efficiency_factor`) + EF read in the profile. Phase 3: `src/athlete-profile.ts` synthesis card (pure+tested)
    — TYPE + per-metric coach read + no-test training focus, rendered by `BenchmarksCard profile=`. Phase 4 (propagate): docs/beyond-ftp-metrics.md
    (+ highnorth CP-calc cite) + coach-engine cycling & running sections + openapi (cp/wPrime/cs/dPrime) + memory [[platyplus-beyond-ftp-metrics]].
    JM's Qs answered inline: CP/W′/EF separate (not under TTE); improve without tests (the efforts ARE the data); profile = "Punchy threshold".
404. 🧪 **Expose the computed CP/W′/EF/TTE/PROFILE to the COACH (MCP read tool).** From #403: the coach-engine now has the THEORY,
    but no MCP tool returns the athlete's actual VALUES (CP 248, W′ 17.1, EF trend, TTE 12 min, profile type) — so the coach reasons
    from theory, not JM's numbers. Build: a server endpoint computing them (port `tte.js`/`athlete-profile` server-side or reuse the
    curve fetches) + an MCP `get_metrics`/extend `get_wellness` so daily-adapt + chat reason with the real profile. gymapp + coach.
    ✅ BUILT: `server/perf-metrics.js` (mirrors src/tte.ts + src/athlete-profile.ts — parity unit-tested, src/perf-metrics.test.ts,
    8 pass) + `GET /api/athlete-metrics` (apiAuth, per-sport ftp/eftp/cp/wPrimeKj/tteSec/ef/profile from the 365-d power/pace curves)
    + MCP `get_metrics` tool (mcp/server.js) + openapi + a "call get_metrics" pointer in BOTH coach-engine cycling & running.
    ✅ LIVE-VERIFIED on QA (HTTP 200): cycling {ftp 260, eftp 253, cp 248, W′ 17.1, TTE 12:00, EF 1.104↓, "Punchy threshold"} +
    running {4:57, CS 5:21, D′ 148m}; focus line renders. `mcp/` rsynced to /home/jmf/platyplus-chat (parses). Awaiting JM ✅ on QA.
405. 🧪 **Sleep-need "9" looked defaulted — surface the raw best-nights avg in the sheet.** JM 2026-07-07: "how do you know it's 9?
    what is the calculation? why not 8.97h or 9.2?" It IS computed (`estimateSleepNeed`, src/sleep.ts): over his 58 sleep+HRV nights,
    average the sleep on the **19 best-HRV (best-recovery) nights** = **8.94h raw** → snapped to the nearest ¼ h = **9:00** (an
    actionable target; his all-nights avg is only 8.75h so he runs a small deficit). The round "9" read as a hardcoded default.
    JM picked "show the raw in the sheet". Built: `estimateSleepNeed` now also returns `suggestedRaw` (unrounded) + `topNights`;
    the Sleep-need benchmark narr shows "Your N best-recovery nights averaged X h → rounded to a 9 h target", sci row says "avg of
    your N top-HRV nights". Unit test added (src/sleep.test.ts, 6 pass). gymapp-only.
406. 🧪 **VO₂max sheet said "bike power" even for a non-cyclist — key the prose to the method actually in use.** JM 2026-07-07:
    "this works for me (best 5-min bike power) but if another user doesn't bike, the VO₂max is based on… what? maybe remove the bike
    mention?" The narr was keyed to `doesCycle` (a sport flag), so a non-biker — or a biker whose current number came from HR — read
    a FALSE source. Fix (better than removing): the narr now follows `vo2head.source` (the same signal as the IN USE badge) with 3
    branches — **MAP** (bike power) / **VDOT** (run pace) / **HR-profile** (submax proxy) + a generic fallback. The subtitle already
    used the real source. tsc clean. gymapp-only.
407. ⬜ **Best-efforts SEASON-COMPARISON table (expands #400) — This season vs Last season vs … vs All time.** JM 2026-07-07
    (intervals screenshot of his own data): after #404 ("metrics look amazing"), wants the intervals-style best-efforts grid.
    Spec: (a) columns = **This season · Last season · [older] · All time** (best highlighted), each cell = **power (W) + W/kg**
    (cycling) / time + /km (running); (b) **cycling durations must go LONG — 1h,2h,3h,4h,5h,6h,8h — not stop at 20m** (plus 5s/60s/5m/20m);
    (c) **running is DISTANCE-based — 400m,1k,5k,10k** (not just 400m/1k); (d) integrate the METRIC rows too — **FTP·CP·W′·EF·MAP·TTE·VO₂max·CS**
    — with W/kg. THE design problem = **mobile**: his reference is a 9-col desktop table; the no-horizontal-scroll rule needs a plan
    (sticky-label scroll table / 2-col + season toggle / This-vs-All-time). MOCK 3 layouts first. Data: intervals power-curves/pace-curves
    accept multiple `curves=` specs (per-season date ranges) + per-curve `powerModels` (per-season CP/W′/FTP). Supersedes #400's 2-col design.
    gymapp-only (+ maybe a curve-fetch tweak). See [[platyplus-chart-standard]] · options-first. 🔨 MOCKED 3 layouts (mockups/best-efforts-table.html,
    real data 5s→8h + metric rows). **JM picked: "A for the list of metrics, B to compare"** + (new Q) **overlay 2 seasons on the power-curve
    CHART**. DECISION = combined section, one "Compare to" control drives all: (1) **curve chart overlays 2 season lines** (This + picked —
    intervals compare view; TrendChart multi-series); (2) **table has an [All seasons | Compare] toggle** — All = layout A full scroll table
    (every season × every metric, label col pinned, page never scrolls), Compare = layout B (This vs picked + Δ-to-PR). Data: garbage-filter
    pace buckets (all-time 400m/1k came back 0:02/0:08 → reject pace <2:30/km). Build after the combined mock is approved.
408. 🔨 **Drop the absolute "never demand a test" — allow an OCCASIONAL, TRIGGERED test.** JM 2026-07-07: "remove the never demand a
    test, I'll do it if really needed but not too frequent, and if there's a way to know [when to] do one then let's do that instead."
    #403/#404 baked a dogmatic "NEVER prescribe a test / no formal test needed" into the coach brain, athlete-profile, docs. Reframe (all
    layers): efforts are the PRIMARY data so a formal test is RARELY needed — but suggest a short, SPECIFIC test when a TRIGGER fires:
    model fit low-confidence/STALE (no near-max effort at that duration in ~6+ wks), observed TTE ≪ modelled (FTP/threshold anchor off),
    or a goal-block start. Give the coach that rule = the "way to know". Touch: `src/athlete-profile.ts` + `server/perf-metrics.js` (mirror,
    focus line) + coach-engine cycling & running + docs/beyond-ftp-metrics.md + the 2 unit tests + memory. Server-only → QA auto-deploy
    (no mcp rsync; mcp/server.js unchanged). gymapp + coach.
409. 🔨 **"Finish setting up" checklist keeps REAPPEARING though setup was done long ago.** JM 2026-07-07 (QA, screenshot 3/6).
    ROOT CAUSE (diagnosed, NOT a detection bug): (a) **Strava step = localStorage ack** (`getAck('strava')`, SetupChecklist.tsx) —
    per-DOMAIN + per-device, so a prod ack never shows on the QA domain and any storage-clear resets it → the card can NEVER hit 6/6
    → nags forever (affects prod too on a new device). (b) **equipment + availability read `user.info.*` from the QA Postgres, which
    is SEPARATE from prod** — JM set them on prod (equip=5, full weekly avail) so QA's DB genuinely lacks them (info keys on QA:
    lat/lon/sex/sports/coachName/sleepNeed only). FIX: persist the Strava ack SERVER-side (`info.stravaAcked` via saveProfile, like
    Availability does) + copy JM's prod equip/avail → QA (one-time). Then 6/6 → hides durably. (Optional: a server-persisted dismiss.) gymapp-only.
410. 🔨 **Best-efforts mock rework (JM critiques the combined mock).** JM 2026-07-07: "why does Compare REMOVE metrics like CP? why 2
    tabs when the first tab already shows the other seasons? doesn't fit; and the graph Compare-to pills (All time / Last season) show
    both curves but clicking does nothing." Valid: (1) the Compare (B) table dropped the metric rows — KEEP metrics always; (2) the
    [All seasons | Compare] 2-tab is redundant — the full table already shows all seasons → DROP the tabs, ONE full table (all seasons ×
    all metrics, A-style scroll); (3) the graph "Compare to" pills must ACTUALLY switch the overlaid 2nd curve (mock hardcoded All-time).
    Rework mockups/best-efforts-full.html + fetch a real last-season curve so the pills do something. gymapp-only.
    🔨 BUILDING (JM: "pick that up"). Mocks approved: v2 (This vs picked + Δ, mockups/best-efforts-compare.html) → v3 flexible picker
    (any season / custom range, mockups/best-efforts-picker.html). JM: year labels EXCEPT "This season". ⚠️ DATA CONSTRAINT: intervals'
    power/pace-curve API only returns TRAILING windows (`curves=Nd`) or all-time — it CANNOT return a bounded calendar year (curves=2024
    → 422; start/end + oldest/newest are ignored → all-time), and activities carry no per-duration peaks. So JM chose **trailing windows
    now** (This=YTD `${daysSinceJan1}d` · Last=365d · 2-seasons=730d · All=10000d — real, instant, matches intervals' own season columns)
    + a curve OVERLAY (This + picked) + the compare table (This | picked | Δ + metrics). See #415 for the exact-year + custom-range follow-up.
415. ⬜ **(FOLLOW-UP of #407) EXACT-YEAR season labels (2025/2024) + custom DATE-RANGE, server-computed.** Because the intervals curve API
    can't do bounded periods, true per-year / arbitrary-range best-efforts must be computed from each activity's POWER STREAM (heavy:
    ~100+ stream fetches/yr). Build a SERVER endpoint that, for a [from,to], fetches the range's activities + their mean-max curves,
    aggregates the best power/pace at each duration, caches per (athlete,range), and returns the curve + best-efforts + models. Then the
    v3 picker's exact-year pills + "＋ Custom range" light up. Deferred by JM ("exact years later"). gymapp + server (+ cache).
416. 🔨 **Gym exercises show no VIDEO/description — the coach picks image-only free-exercise-db demos.** JM 2026-07-07 (prod, his gym):
    "empty exercises (no video, photo, description) — update the coach again?" DIAGNOSED (NOT the orphan-GC — innocent, no GC log lines).
    His gym plan's exIds are mostly **`fedb-*` (free_exercise_db)**: the IMAGES exist on disk (img OK) but those entries have **NO video**,
    and the catalog carries **no descriptions at all**. Video demos DO exist for the same moves in Centr (`e-`) / MuscleWiki (`mw-`).
    ROOT CAUSE: `searchExercises` (server.js:1883) filters by name+equipment then `slice(limit)` with **NO ranking** → the coach grabs
    whatever's first (often the image-only fedb entry). So re-running the coach alone WON'T fix it. FIX: rank search results **video-first**
    + closest-name so the coach picks demos WITH video; then re-run the coach for JM (+ Xenia) to re-pick. Descriptions = a separate catalog
    enrichment (lower priority). Propagate: MCP search_exercises desc can note "prefer video". gymapp server + coach re-run (outward → confirm).
417. ⬜ **Android: opening "full exercise" — the hardware BACK button overlays / doesn't always return.** JM 2026-07-07 (prod, Android):
    "when clicking full exercise on android, the back button seems to overlay with something and not every press works to return back." The
    exercise-detail (video) view/modal + Android hardware back don't cooperate — likely a history/overlay state issue (the modal doesn't push
    a history entry, or a stray overlay swallows the back). Investigate the full-exercise view's routing/modal + Android back handling. gymapp-only.
418. 🧪 **Fuel "why" behind a chip (do like Mind) + an empty gym on QA.** JM 2026-07-07 (QA): "the why for fuel still weird, put it
    straight in fuel section"; also "this one is empty" (a "Full-Body Strength — Rain Day" gym opens with no exercises). (a) FIXED — the
    Fuel section now shows `p.fuel.why` (the fueling strategy) INLINE like Mind #411 / Recovery, chip dropped (CoachPlanDetail.tsx). tsc clean.
    (b) The empty "Rain Day" gym is **NOT in the QA DB** — it's a PROD plan's intervals event surfacing on QA through the SHARED i28814
    athlete (a known QA/prod-shared artifact; can't be GC'd on QA since staging is read-only). Not a new render bug. gymapp-only.
419. 🧪 **Coach names workouts after the WEATHER ("Rain Day") — stop it; title by the training.** JM 2026-07-07: "for any activity titles,
    don't mention weather, why do it? focus on the activity done for title and description." No rule existed → the coach invented "Full-Body
    Strength — Rain Day" from a rainy forecast. FIXED (2 layers): the **coach identity** (`coachIdentity`, server.js) + the **get_weather MCP
    tool desc** (mcp/server.js) now say: TITLE + describe every workout by its TRAINING content/purpose, NEVER the weather/theme ("Rain Day",
    "Hot Day"); weather only informs indoor/outdoor + intensity + fuel. ⚠️ MCP change → rsync `mcp/` to the host. gymapp + coach.
420. 🔨 **Season-compare polish (QA review of #407).** JM 2026-07-07, per-point: (1) `.sc-card` (power curve + best-efforts) **lacks
    padding** — title flush to the edge; add card padding. (2) the **"TIME"/"Dist" header is misaligned** — left-align the label column
    header. (3) **TWO power-curve graphs now (old single-range + new overlay) = BAD** → REMOVE the old single-range curve card; the
    2-season overlay IS the power curve. Same for Running's pace curve. (4) **metrics MISSING (e.g. VO₂max)** in the compare table — add
    per-season VO₂max (from the season's best 5-min MAP + weight) alongside eFTP/CP/W′. (5) **EF trend is buried at the very bottom after
    best-efforts** → reorder: trends (eFTP, EF) together, season-compare last (or EF above it). (6) **eFTP-trend MiniCard renders a
    partial/empty square though data exists** — investigate. (7) apply ALL of the above to the **Running** section too. (8) SEPARATE: the
    **Fitness page Form/Load charts have a "Wellness →" link — remove it.** gymapp-only.
421. ⬜ **TTE differs between the season best-efforts table and the benchmark card — make them consistent.** JM 2026-07-08 (prod, his
    profile): "my TTE in best-efforts ≠ my TTE under benchmarks." Root: the benchmark `tteRide` = `tteFromPower(all-time-ish curve, ftpManual ?? eftp)`
    while the season-compare uses PER-SEASON `tteFromPower(season curve, season eFTP)` — different FTP anchor + different window. FIX: one
    canonical TTE — pass the athlete's SET FTP to SeasonCompare + anchor cycling TTE on it (like the benchmark); align the window so at least
    one column matches the card, or clarify labels. Also running TTE. gymapp-only.
422. 🧪 **Xenia: had to enter her menstrual-cycle date manually though it's already in intervals wellness (logged the 3rd).** JM 2026-07-08.
    The cycle/period date is in intervals wellness — Platyplus should READ it (like HRV/sleep/CTL) and prefill the coach's cycle-phase, not
    ask her to re-enter. Investigate the intervals wellness cycle field + wire it into the cycle-phase (coach-engine-female uses cyclePhase). gymapp + coach.
    ✅ ROOT CAUSE: intervals only stamps `menstrualPhase="PERIOD"` on the period-START day (Xenia: 07-03); EVERY other day is null AND
    `menstrualPhasePredicted` is null too (it does NOT project forward). Our code read only TODAY's phase → null → fell back to asking. FIX:
    new `phaseFromHistory(rows, date, len)` in server/cycle.js scans the 60-day wellness for the most recent PERIOD marker = cycle day 1, then
    projects with phaseFromDay (Xenia 07-03 → viewing 07-08 = day 6 = FOLLICULAR), with a stale-guard (last period >cycle+10d ago → null, no
    phantom phase). Wired into `/auth/readiness` cyclePhase as the middle step (intervals-today → derived-from-history → manual cycleStart).
    Exposed `cyclePhase`/`cyclePhaseAt` on the user (pub) + client User type; Profile now SHOWS "Read from intervals.icu: currently follicular"
    instead of prompting her. 6 new unit tests (src/cycle.test.ts, incl. her exact case) green, tsc clean. Ships to prod for her real data.
423. 🧪 **Xenia: no longer getting 4 workouts/week — audit the coach's frequency.** JM 2026-07-08. Her target is ~4 days/week (info.freq)
    but the plan has fewer. Coach issue? Check `# TRAINING FREQUENCY` (buildSystemPrompt) vs what daily-adapt actually schedules; audit her
    upcoming 2 weeks vs freq. gymapp + coach.
    ✅ AUDITED: her config is CORRECT — `info.trainingDays=4`, availability all 7 days @0.75, sports=[running,strength], solid pregnancy
    profile. So NOT a coach-frequency bug. The empty week was collateral of the **#414 orphan-GC regression** (my GC deleted her legit
    intervals events → the deletion-mirror dropped the plans). ROOT fixed (GC now log-only, prod). Triggered `POST /api/coach/daily-adapt`
    → it REBUILT her 2 weeks: **W28 & W29 both = 4 sessions (Mon run · Wed gym · Fri run · Sat gym)**, fresh intervals IDs (121282xxx)
    pushed. NB the coach LLM takes several min to finish creating — don't judge "empty" from a <2-min poll. Awaiting JM ✅ on her login.
424. 🧪 **Xenia: the HEIGHT field in her profile is BUGGY — can't enter a value.** JM 2026-07-08. ✅ FIXED: the input clamped to
    min 100 on EVERY keystroke, so typing "1" jumped to 100 → impossible to build 175. Now types freely + clamps [100,230] + saves on blur. gymapp-only.
425. 🧪 **Coach activity descriptions/titles too casual/cocky — make them scientific, no em-dashes.** JM 2026-07-08 (example: "Another
    Local Legend, Relaxed Miles / … Snagged a Local Legend … proof you don't have to go hard … Classic relaxing spin."). Rules: (1) NO
    casual "easy/hard/whatnot/snagged/classic relaxing spin" — use ZONE terms (Z1/Z2/Z3…); (2) NEVER an em-dash "—", use commas; (3) be
    SCIENTIFIC — name the adaptation (aerobic base/foundations, W′, threshold), not vibes.
    ✅ BUILT across all layers: `coach-engine.md` new "Center the WORKOUT physiologically: scientific, not cocky" section (zones + adaptation
    + a BANNED-words list + explicit no-em-dash rule), the KOM/segment line reworded to "factual, never a brag", and the OUTPUT-ROUTING intro
    (base + cycling + female copies); the `set_activity_text` MCP desc (scientific voice, Z1-Z5, no em-dash, factual examples); and the
    hardcoded intro in `scripts/sync-coach-engine.mjs` so a future sync keeps it. ⚠️ SOURCE-REPO TODO: the DETAILED "Writing TEXT" body is
    sourced from `../coach-engine-src/codex_coach/instructions_public_text.md` (NOT in this workspace) — apply the same edit there before the
    next manual `sync-coach-engine` run or it regresses. Ships on the next prod deploy (coach-engine baked in the server image + MCP
    auto-rsynced by deploy.sh); THEN re-run JM's recent activities to rewrite public titles/descriptions in the new voice. gymapp + coach.
    ✅ SHIPPED + VERIFIED on real prod data (2026-07-08): coach-engine + host MCP live on prod; drove a rewrite of JM's 2 worst titles —
    "Another Local Legend, Relaxed Miles" → "Z2 Aerobic Base, 71 min" ("…153 W avg, IF 0.61, aerobic base development, mitochondrial
    density…") and "Local Legend on the South Shore" → "Z1 to Z2 Endurance, 62 min". Perfect voice: zones + adaptation, no vibe words, no
    em-dash, public-safe. ⚠️ LEARNED: the coach re-run (`/api/coach/run`) struggles to SELF-RESOLVE which activity to edit from a vague
    "rewrite my recent activities" ask (it drafts the text then asks for the id); it writes reliably when handed the exact activityId. The
    normal daily activity-review path already passes the activityId, so that flow is fine; only ad-hoc batch "rewrite recent" needs ids.
    Remaining older JM titles (KOM on the Backroads, Backroad Segment Hunt, St-Lambert Road Cycling) left as-is pending JM's read on the voice.
    🔧 CORRECTION (JM 2026-07-08: "titles are fine, just the description"): I over-scoped — the scientific voice is DESCRIPTION-ONLY; TITLES
    stay HUMAN + creative (Strava style, KOM/Local Legend OK). Re-split all layers into TWO voices (coach-engine "TITLE stays human,
    DESCRIPTION goes scientific" section + KOM line + the 3 intro copies + MCP set_activity_text + sync script), and RESTORED the 2 titles I
    changed back to "Another Local Legend, Relaxed Miles" / "Local Legend on the South Shore" while KEEPING their scientific descriptions.
    Em-dash ban stays on BOTH fields. Re-promoting.
    🔧 CORRECTION 2 (JM 2026-07-08: "ease up on the science, my audience are no scientifics"): the first scientific pass went TOO far —
    "targeting mitochondrial density, fat oxidation, no Z4 or Z5 excursions" reads like a physiology lecture. Re-calibrate the DESCRIPTION to
    scientific-but-ACCESSIBLE plain language: name the zone (Z2) + what the session was FOR in everyday words (base fitness, your engine,
    comfortably hard), NOT jargon. BAN jargon-dense terms in output (mitochondrial density, fat oxidation, glycolytic, lactate, "excursions").
    Target: "Steady Z2 endurance ride, 71 min at 153 W, easy aerobic pace building your base." Update coach-engine.md DESCRIPTION section +
    MCP desc; rewrite the 2 descriptions I already over-scienced. Still: no cocky/vibe words, no em-dash. Titles still human.
    🔧 CORRECTION 3 (JM 2026-07-08: "write it like I'm writing it … now it's so boring, dont repeat the 153w, how can we find a balance?"):
    the plain pass went too FLAT (dry data line that repeats the watts already on Strava). The BALANCE = write it like the ATHLETE would,
    a natural sentence or two with a little personality, between a data line, a lecture, and a brag. Two new rules: (a) write with FLOW/voice
    ("Relaxed Z2 miles on the backroads, kept it easy start to finish, quiet base work banking fitness for when it counts"); (b) do NOT restate
    numbers already shown on the activity (avg power, duration) — redundant + boring; describe the FEEL + the WHY. coach-engine.md DESCRIPTION +
    MCP desc updated; JM's 2 rides rewritten to the balanced voice. On dev, awaiting JM's read on the balance before promoting.
426. 🔨 **"Gym exercises have no video/pictures/thumbnails" — REGRESSION triage: server-side is 100% correct → stale PWA cache.** JM
    2026-07-08 (repeated, frustrated: glute bridge, dumbbell goblet squat, romanian deadlift). AUDITED exhaustively: JM's Jul-9 gym = 15/15
    valid exIds; every video+image FILE exists on `/srv/media` (0 missing across the whole 4530 catalog); media serves **200** over HTTPS;
    the DEPLOYED bundle (index-DMCF41TO.js, 01:20) CONTAINS the catalog+exIds; resolveDemo + searchExercises (video-only) correct. So the data
    is present → JM sees a STALE cached app (PWA SW). Asked for a clean reload + a screenshot if it persists. SYSTEMIC follow-up: add a
    visible build-version + "update available" prompt so staleness is obvious; verify the SW autoUpdate/skipWaiting actually flips for him.
    ⚠️ **CAUSE of the churn = #423**: my re-map persisted only via SIGKILL (a graceful restart's shutdown-save reverted it once) — the DB
    write path needs to go THROUGH the app, not direct. gymapp (PWA/SW + ops).
    "don't get the Mind — the section is empty but the why is a chip to click." Fuel shows its text inline (+ a why chip); Mind shows only
    a "why ⓘ" chip with no body, so it reads as broken/empty (the real "Mental focus — Restraint…" is buried in the why sheet). FIX: if a
    section has no inline body, show its content in the body (not only behind "why"), OR hide the empty section header. gymapp-only.
427. 🧪 **PREGNANCY MODE — Xenia is pregnant (confirmed 2026-07-07); no structured state + the cycle logic CONFLICTS.** JM 2026-07-08
    ("how will this handle pregnancy, my wife just got pregnant" + "update coach engines for pregnancy, deep research if needed"). FOUND:
    pregnancy is captured ONLY in her coachProfile prose ("PREGNANT — maintain, not build" + full guardrails); there is NO `info.pregnant`/
    dueDate flag, and the #329/#422 CYCLE-PHASE logic is NOT suppressed — her `cyclePhase=menstrual` is LIVE, so buildSystemPrompt injects
    "# CYCLE PHASE — currently menstrual … push intensity in the follicular/ovulatory green window", contradicting pregnancy guidance
    (maintain/ease/no PRs). FIX (pregnancy mode): (1) structured `info.pregnant` + `info.dueDate` (→ gestational week + trimester);
    (2) GATE OFF cycle-phase coaching + readiness cycle-adjust when pregnant (no menstrual model during pregnancy); (3) inject a
    `# PREGNANCY — week N / trimester T` block with trimester-appropriate guardrails; (4) DEEP-RESEARCH + expand coach-engine-female §6
    (currently postpartum-thin) into evidence-based ACTIVE-pregnancy trimester coaching (ACOG 804 / 2019 Canadian guideline: RPE+talk-test
    not HR, no supine T2+, no Valsalva, thermoregulation, pelvic floor, contraindications + STOP signs, safe strength/impact) + a
    `docs/pregnancy-coaching.md` KB; (5) Profile UI: Pregnant toggle + due date, hide cycle fields, show week/trimester (mock-first, later).
    Medical: DEFER to her clinician, health/function framing, never PRs. Set Xenia's flag on prod. gymapp + coach.
    ✅ BUILT + LIVE (2026-07-08): pregnancyStage + gate + `# PREGNANCY` runtime block + coach-engine-female §6 rewrite + docs KB; Xenia's
    flag set on prod (pregnant=true, stale cyclePhase cleared), verified deployed phaseFromHistory gated OFF. No EDD yet (JM: "we just learnt
    about it, no info yet") → block says trimester unknown, assume T1. 🔒 PRIVACY (JM: "for Xenia workouts title and description, NO mention of
    pregnancy, it's private, no mention anywhere whatsoever"): added an ABSOLUTE rule in the `# PREGNANCY` block + coach-engine.md privacy
    section + female §6 + `set_activity_text` MCP desc — NEVER write pregnancy/trimester/prenatal/expecting/bump in any title, description, or
    plan name; coach sessions by normal training content, apply adjustments silently. Scrubbed: 0 existing mentions in her 21 activities/plans.
    ✅ TOGGLE BUILT (JM: "yes for toggle thanks"): Profile "Cycle & pregnancy" section now has a **Pregnant** checkbox — ON switches the
    coach to pregnancy mode + pauses cycle tracking + hides the cycle fields + shows a private-note line ("never shown on your workouts"); OFF
    = the normal cycle UI. Saves `info.pregnant` via `/auth/profile` (which also clears any stale cyclePhase). No due-date field yet (JM: no
    info). tsc clean, mock at mockups/pregnancy-toggle.html. #427 now COMPLETE end-to-end (state + gate + engine + privacy + UI); awaiting JM ✅.
428. 🧪 **Coach chat SLOW on mobile + a "no result" after navigating away.** JM 2026-07-08: "asked something to my coach, took forever on
    mobile, then I backed out and came back to the chat and there was NO result. Optimize the coach speed + clarify what happened." Two
    problems: (1) LATENCY — the coach runs a full agentic turn (~128 KB systemPrompt + tool calls) via the host chat-helper; first token can
    take many seconds. (2) DURABILITY — if the user navigates away mid-stream on mobile, the in-flight response may not persist/resume, so
    returning shows nothing. Investigate: does the chat-helper persist the assistant turn server-side even if the client disconnects (threads
    are #363-synced)? Does Chat.tsx resume an in-flight request on remount, or at least show a "still thinking" state that survives nav?
    Optimize: stream first token sooner + a persistent thinking indicator + PERSIST the completed turn even if the client dropped. gymapp + coach infra.
    ✅ ROOT CAUSE of "no result" FOUND + FIXED (2026-07-08): `/auth/chat` had `res.on('close', () => reader.cancel())` — navigating away
    (mobile back) closed the socket → the server CANCELLED reading the coach's stream → `pend()` persisted only the PARTIAL reply (or NOTHING,
    since `persistChat` skips an empty reply → the question itself was lost). FIX: a client disconnect no longer cancels; the server keeps
    reading the coach to COMPLETION and persists the FULL turn to the thread (200s safety-net timeout for a truly hung coach; writes to the
    dead socket are guarded by `clientGone`). So back-out-then-return now shows the finished answer via the #363 thread sync. node --check OK.
    ⏳ LATENCY: still inherent (the coach runs a full agentic turn on a ~128 KB systemPrompt); the client already shows a "reviewing…" tool
    indicator + a "waited long" note at 8s. FOLLOW-UP (optional): client optimistic-merge / poll so a turn finished-while-away appears WITHOUT
    a manual refresh (today: reopen/refresh the chat); and shrinking the systemPrompt would cut first-token time. gymapp + coach infra.
429. 🔨 **Two ADMIN pages: (1) Activities & system info (actions done), (2) System logs (success + errors) for debugging.** JM 2026-07-08.
    Best practices: absolute + relative timestamps, actor, action, target, LEVEL, context, filter + search. (1) = the activity/audit feed
    (`audit()` exists per-user + AuditLog.tsx) → make it an ADMIN cross-user view of actions done (coach/user/system). (2) = NEW: capture app
    success/error logs (console + thrown errors) into a queryable store surfaced under admin, with level (info/warn/error), ts, source/route,
    message, stack, user. Mock-first (options). gymapp (admin UI + a log-capture layer). ⬜ pending mock.
430. ✅ **Coach LEARNS per-user from every interaction + STRICT confidentiality/isolation between users.** JM 2026-07-08: "for every
    interaction between a user and the coach, update his skills/memory so the coach learns + tailors insights/feedback/plan to THAT user. This
    knowledge must NOT affect another user (if my wife does cardio-poussette/stroller, don't bring it up to me). A user's info + interactions
    with the coach are STRICTLY CONFIDENTIAL between them." STATUS: the infra already exists + is isolated — per-user `user.coachMemory`
    (buildSystemPrompt injects ONLY this athlete's, server.js:1225; save_coach_memory MCP tool; the coach runs with ONLY their token, no
    cross-user data path). REMAINING: (a) add an EXPLICIT confidentiality/no-leak rule to coachIdentity + coach-engine (never reference or
    compare to any other person; strictly private); (b) strengthen the "learn from EVERY interaction" instruction on the coachMemory block.
    gymapp + coach engine.
431. 🔨 **DUPLICATE rides on future days — "I have multiple rides again, this bi-directional sync is buggy."** JM 2026-07-08 (prod,
    screenshots Fri 10 + Sat 11: each day shows a plain RIDE + a RIDE·IN-APP). DIAGNOSED: NOT double-import. Each day had the real IN-APP
    plan (new event, e.g. "Easy Aerobic Base" 121354231) AND an ORPHANED old event from a prior plan ("Easy Endurance Spin" 120867616) that
    the coach's daily-adapt re-plan superseded but never deleted → both render. Found 4 orphans (07-09/10/11/14), all Platyplus-pushed, none
    claimed by a plan → DELETED them (JM's calendar now clean, one session/day). SYSTEMIC: refined the reconcile orphan-GC (#429) — my first
    pass only swept PAST + no-plan days, which MISSED these (future, plan-owns-slot, orphan=duplicate). New rule deletes an orphan when NO
    plan owns its day+sport (leftover) OR a plan owns it but is linked to a DIFFERENT LIVE event (duplicate); SKIPS when a plan exists but
    isn't linked to a live different event (the mid-re-push Xenia case); cap 8, prod-only. ⏳ SOURCE follow-up: the daily-adapt re-plan
    CREATES new events but doesn't always DELETE the superseded old one — the GC is the net; the deterministic source (delete-on-replace)
    is worth a pass. gymapp (reconcile + coach re-plan).
    🔧 CORRECTION (JM 2026-07-08: "lost my tomorrow's gym, normal?"): my "no-plan orphan → delete" rule was UNSAFE — JM's 07-09 gym was a
    LEGIT coach-created session (audit: 07-07 20:25 coach Created "Full-Body Strength — Rain Day") whose PLAN link got lost (a sync bug), so
    it looked orphaned and I deleted it. A no-plan event can be a lost-plan legit session, NOT just a leftover — indistinguishable. FIX: GC is
    now **DUPLICATE-ONLY** (auto-deletes an orphan ONLY when a plan owns the exact day+sport via a DIFFERENT LIVE event); never deletes a
    no-plan orphan. Restoring JM's 07-09 gym. ⚠️ ROOT still open (JM: "audit and fix all #431"): WHY did the 07-09 gym PLAN disappear while
    its event survived? The reconcile/deletion-mirror is dropping plans and/or the coach re-plan orphans events — needs a full sync audit.
432. 🧪 **Fuel section overflows the screen to the right — fit it.** JM 2026-07-08 (screenshot: the Dinner meal card is cut off past the
    right edge). ✅ FIXED: `.fuel-grid` grid children lacked `min-width:0`, so a long meal title (`white-space:nowrap`) forced the cell (and
    the page) wider than the viewport instead of truncating. Added `.fuel-grid{max-width:100%}` + `.fuel-grid>.mealchip{min-width:0;display:block}`
    (the `display:block` also overrides a colliding later `.mealchip{display:flex}` rule leaking from another component). gymapp-only (CSS).
433. 🧪 **Make Fuel SUGGESTIONS + Mind coach-driven (personalised), not algorithmic.** JM 2026-07-08: "be sure fuel suggested and mind are
    done with coach logic, is there one?" AUDIT: the plumbing already existed — Today shows coach-SCHEDULED meals/mind/recovery (with the
    coach's "why") and only falls back to the ALGORITHMIC `suggestMeal`/`pickByDate` (Today.tsx:495/506) when the coach scheduled nothing. The
    real gap: the **daily-adapt pass only adapted TRAINING** (`dailyAdaptMsg`), never fuel/mind/recovery — so the coach never proactively filled
    them → the static fallback showed. BUILT: `dailyAdaptMsg` (server.js:2576) now tells the coach to also FUEL demanding days (schedule_meal,
    diet + fuel-target aware), add a MIND session where it earns its place, and RECOVERY after the hardest days — *only where it adds value*, no
    spamming every slot. 439 tests green. Coach behavior (not pure) → manual test-guide row. Verify: run a daily-adapt pass, a hard day shows a
    coach-scheduled meal/recovery (with a why), not the generic pick. Needs the coach running live (Tailscale).
434. 🧪 **Gym LOAD not synced to intervals — 12 in Platyplus, 0 in intervals (bi-directional).** JM 2026-07-08 (Jun-19 "Afternoon
    Weight Training"). ROOT: `planToIcuEvent` set `ev.icu_training_load` from `plannedTss(segs)` — SEGMENT-based, so ride/run only. GYM has no
    segments → no load pushed → intervals showed 0. BUILT+DEPLOYED (commit 0582959): `plannedGymTss`/`estimateGymSeconds`/`gymTempoSec` in
    server/icu-steps.js (mirror src/plan.ts estimateGymMinutes × 45 TSS/h, KB Friel); `planToIcuEvent` gym branch now sets `icu_training_load` +
    `moving_time`/`time_target`; `POST /api/plans/resync` backfills existing plans. 41 icu-steps tests (incl. plannedGymTss). Verify on intervals
    (a gym event shows a non-zero load) — BLOCKED on Tailscale re-auth for the live check.
435. 🧪 **Activity detail page shows NO date.** JM 2026-07-08 (screenshot: "WORKOUT · INDOOR / Afternoon Weight Training" — no date).
    BUILT+DEPLOYED (commit 0582959): ActivityDetail eyebrow (ActivityDetail.tsx:307) now appends the session date (weekday, month, day) from
    `start_date_local`. gymapp-only. Verify: open any activity → the eyebrow shows the date.
436. ✅ **Coach "✓" review checkbox on the intervals activity no longer gets checked.** JM 2026-07-08 (screenshot: Compliance ✓ 83% but
    "Coach ☐" unchecked; "coach used to check this box"). ROOT CAUSE (found live): the "Coach ✓" is intervals' native **`coach_tick`** field — an
    INTEGER 1-5 rating (the coach's 5-point tick), NOT a boolean. Platyplus posted the coach NOTE to the activity thread (`postCoachNote`) but
    NEVER set `coach_tick`, so the box stayed empty even on reviewed activities (confirmed: activity i158721911 had 2 coach-note messages but
    `coach_tick=null`). `{coach_tick:true}` is rejected (Jackson can't parse a bool into the int field → generic "JSON parse error"); `{coach_tick:3}`
    → 200 and sticks. BUILT: `coachTick(score10)` in server/readiness.js (maps our /10 review score → 1-5, null → neutral 3; pure + unit-tested,
    440 tests green); `postCoachNote` now PUTs `coach_tick` on every review. Verified live by round-trip (i158721911 → 4, matches its 7/10 review).
    Note: still gated on the coach passing `activityId` to save_coach_review (the separate LLM-reliability thread) — but when a review DOES post,
    the box now ticks. DEPLOYED to prod (PR #138, commit 7fee142). JM CONFIRMED the tick works. BACKFILLED his history: 4 reviewed activities
    ticked (14 plan-only reviews had no device activity to tick). JM: it's the coach's reviewed/not-reviewed TRACKER → see #437 (coach should READ it).
437. 🧪 **Coach READS `coach_tick` to know what's reviewed vs still pending.** JM 2026-07-08 (framing #436): "it's the tracker for the
    coach to know what was reviewed or not." BUILT: (1) `/api/intervals/activities` (→ MCP get_recent_activities) now returns each activity's **`id`**
    (was MISSING — that's exactly why the coach couldn't reliably pass activityId to save_coach_review, the #436 caveat) + **`reviewed`**/`coachTick`
    (the tracker). (2) MCP tool description updated to explain id + reviewed. (3) daily-adapt now sweeps: for any completed activity in the last week
    with `reviewed:false`, review it with its exact id (→ ticks the box + posts the note) and set a public-safe title/desc; SKIP already-reviewed;
    cap the few most recent. (4) openapi updated. 440 tests green. Closes the #436 reliability loop (coach gets the id straight from the read). Prod-only
    behavior (daily-adapt off on QA); MCP auto-syncs on prod deploy. Verify: get_recent_activities shows `reviewed:true` on ticked activities + the
    coach reviews the un-ticked ones on a daily-adapt pass.
438. 🧪 **In-app ADMIN BACKLOG manager — track this list from inside the app, add comments / discard / change priority.** JM 2026-07-08:
    "put the backlog page under admin in the app so I can keep track of it at all time, add more comments or discard or change priority."
    Replaces the throwaway scratchpad Artifact with a real, always-available admin page. Mocked 2 layouts (options-first) → JM picked **A · Triage
    list** (filter-first, tap-to-expand inline triage). BUILT: (1) `scripts/build-backlog.mjs` parses FEEDBACK-LOG.md → lean
    `src/data/generated/backlog.json` (`{n,status,title,summary}`, 328 items) — wired into `build:app`, lazy-loaded (own 126KB chunk, out of the
    main bundle). (2) Admin-gated triage overlay on the admin record (`user.backlogTriage[n]` = `{priority:hi|med|lo, comments:[{text,at}], discarded}`)
    via `GET /auth/admin/backlog` + `PUT /auth/admin/backlog/:n` (+ openapi). (3) `src/auth/api.ts` getBacklogTriage/updateBacklog. (4) `Admin.tsx`
    now has **Backlog** (default) + Users tabs; `AdminBacklog.tsx` = filter-first list (status + priority chips w/ counts + search + sort), tap a row
    → summary + comment thread (add/delete) + priority buttons + discard/restore. Claude READS the overlay each session + folds it into the .md
    (CLAUDE.md work-queue note + memory `platyplus-admin-backlog`). tsc + 440 tests + full build green. Admin-only.
    JM verified on QA 2026-07-08 ("looks good") → asked for **bidirectional sort**: added a ↑/↓ direction toggle (any sort — priority/#/status/
    comments — flips asc↔desc). On QA.
    JM 2026-07-08 round 2 (3 asks): (a) "a button that says done, discard is more cancel, not sure how to change status" → **STATUS is now a
    4-way control** (To do · Building · Done · Discarded) that JM sets directly and **OVERRIDES the .md-derived status** (`triage[n].status`);
    the old standalone Discard button is gone (Discarded is a status). (b) "same for unset with priority" → priority row now has an explicit
    **None** button (not just tap-to-clear). (c) "add in this window + define bug / ideation / feature / whatnot" → added a **+ New item** form
    (title + type + optional notes → app-added items in `user.backlogAdded`, numbered max+1, merged into the list; Claude folds into the .md) and a
    **TYPE** field (Bug/Feature/Idea/Chore, in the overlay, shown as a row chip). Server: PUT takes status/type, new POST creates items, GET returns
    `{triage, added}` (+ openapi). tsc + build + tests green. On QA.
    JM 2026-07-08 round 3: **testing workflow + more.** (a) added statuses **To test → Tested ✓ / Tested ✗** (7-status flow: todo/build/totest/
    pass/fail/done/discarded) + a **"What to test"** callout (build-backlog extracts the "Verify:" clause from the entry) shown in a test status;
    tested notes go in the comment thread. (b) **dev/qa/prod** badge (derived from the entry text). (c) **Type + Priority both REQUIRED** — removed the
    None options; add-form needs both. (d) chore = behind-the-scenes work (refactor/CI/infra); Idea can spawn multiple Features. (e) **reporter +
    timestamp** on each item (added/reported carry reporter+at; .md items get a date from the entry). Migrated the whole board to the **SHARED
    global store** (`app_meta.backlog`, `store.backlog`) so it's not per-admin — needed for #440. On QA.
439. 🧪 **Coach must ALWAYS keep ~2 weeks of planning ahead (horizon not being held).** JM 2026-07-08: "I currently have workouts until
    ~Jul 12, that's not 2 weeks. Since we have a trigger every day with the coach (after check-in), the coach should always have 2 weeks ahead
    of planning as per our agreement." DIAGNOSIS (prod): the daily-adapt tick IS firing (JM's `dailyAdapt` = early+refine both ran today) — but the
    coach only planned the current week (through Jul 13, 5 days) and left the back half of the 14-day horizon EMPTY. The soft "keep ~14 days ahead"
    line wasn't enough. FIX: compute the EXACT gap server-side (`horizonCoverage` in readiness.js — pure + unit-tested: covered/empty/last/firstEmpty
    over [today..today+14]) and hand the coach a non-negotiable lead directive in `dailyAdaptMsg`: "only N/15 days through {end} have anything; EXTEND
    the plan ALL THE WAY to {end} in THIS pass" (only when empty≥3). `runDailyAdapt` passes it. 441 tests. Prod-only (daily-adapt off on QA) → verify
    by triggering `POST /api/coach/daily-adapt` on prod after promote + confirm JM's plan fills to ~Jul 22. Ties #367/#433.
    ⚠️ **RE-FAILED 2026-07-09 (JM, QA)** — still ~1 week (VALIDATED: prod plans only through Jul 15, NOT 2 weeks; the mirror DOES work, QA had
    them too — so my "QA artifact" dismissal was WRONG). The gap directive alone didn't land: the daily-adapt asks the coach for a LOT in one
    pass (horizon + adapt + fuel/mind/recovery + reviews) so it fills the near term + reviews and runs out. **NEW FIX:** `runDailyAdapt` now
    LOOPS — after the adapt it re-checks `horizonCoverage` and runs up to 2 FOCUSED `horizonFillMsg` passes (FILL-ONLY, no reviews/fuel/mind)
    until `cov.empty < 3` (only rest days left blank). Deterministic control around the LLM. On QA; prod on promote → trigger a daily-adapt to
    fill JM's horizon to ~Jul 23 + verify.
    **+ JM's idea (2026-07-09): DECOMPOSE into a SEPARATE focused pass per topic** instead of one giant prompt — the coach gave each partial
    attention + ran out. `runDailyAdapt` now runs: (1) `dailyAdaptMsg` = adapt the WORKOUT plan + fill horizon (looped, readiness-sensitive →
    every pass); (2) `reviewMsg` = reviews ONLY; (3) `roundOutMsg` = fuel/mind/recovery ONLY. Reviews + round-out gated ONCE/day
    (`dailyAdapt.extras`) so they don't re-spawn on both early+refine. Each pass gets the coach's full attention. On QA.
440. 🧪 **"Report a bug or idea" for any (non-admin) user — top bar, → backlog as "under review".** JM 2026-07-08: "for a user who is not
    admin, add a button to report bug or idea, to the left of the notification icon… added to the backlog as under review, put a reporter + a
    timestamp on each item." BUILT: `ReportButton.tsx` (top bar, left of the bell, non-admins only) → a Bug/Idea form → `POST /auth/report` (any
    authed user) → lands in the SHARED backlog (`store.backlog`) as status **review** with reporter + time, and pings the (other) admins (bell). Admin
    sees it in Admin → Backlog under the **Under review** filter. authApi.reportBug. JM 2026-07-08: show it for **ALL users incl. admins** (was
    non-admin-only; simpler + lets JM test it directly + anyone can quick-report). On QA.
441. 🧪 **Mirror PROD data → QA so QA has real-life stuff to test.** JM 2026-07-08. BUILT: `scripts/mirror-prod-to-qa.sh` (run on XPS) copies
    each real user's child rows (plans/logs/coach_reviews/checkins/calendar_items) + coach doc fields prod→QA, keyed by email (ids differ),
    PRESERVING QA auth + keeping QA read-only toward intervals. QA already READS real intervals activities (shares i28814). RAN 2026-07-08 (JM
    asked, before a testing pass): JM's QA data now MATCHES prod (plans 36, logs 1, coach_reviews 1→18, checkins 18) + Xenia's; QA login preserved,
    coachProfile merged, QA healthy (200). Fix during run: the doc-merge `\copy`-into-temp-table failed (can't mix a meta-command with SQL in one
    `-c`) → switched to **base64** (`encode`→shell→`decode`), which safely carries the multi-line coachProfile. Re-runnable on demand; could wire
    into the staging deploy later. (Child copy is idempotent delete+copy; SIGKILL-restart reload means a brief boot 502 right after — normal.)
442. ⬜ **Review flow: get it OFF History + return-to-list after saving.** JM 2026-07-08 (screenshots): (a) feedback rows need enough activity
    info to remember it (BUILT on the History banner: duration/distance/effort/load line + a working "Show all N" expand — but per (b) this MOVES);
    (b) "I don't want the review banner in History" → build a DEDICATED review view (reached from the Today #387 card, not `/logs`); (c) tapping a
    session opens the activity normally (feedback form) = already how it works; (d) after SAVING feedback, return to the review list to knock out the
    next one. Needs a `/review` route + return-after-save nav. Mock the dedicated view first. → mocked 2 (own page vs inline), JM picked **A (own
    review page)**. BUILT (#442b, closes the #387/#340 failures): new **`/review` `ReviewPage`** (knock-out list, oldest first, rows show activity
    stats + missing chips, each → `/activity/:id` with `state={from:'/review'}`); the Today **`ToReviewCard` headline now links to `/review`** (not
    `/logs`); the **IncompleteFeedbackBanner is REMOVED from History** (Logs); **`ActivityFeedback` gained `onSaved`** → after Save it returns to
    `/review` (brief "saved" then back to the list), and the back button already returns there via history. 447 tests, tsc + build clean. On QA.
443. 🧪 **Tempo tooltip was cut off + unclear.** JM 2026-07-08: "what is 3? lift 3s? the 1 wait? 0 restart?" ROOT: the exercise `.card` had
    `overflow:hidden` → clipped the InfoDot popover to one line. FIX (CoachPlanDetail.tsx): card `overflow` is `visible` when collapsed (thumbnail
    self-rounds so it's safe); tooltip text rewritten to number each phase explicitly (LOWER first: 3-1-1-0 = lower 3s · hold 1s · lift 1s · 0s top). On QA.
444. ⬜ **intervals coach-note text is a wall — format with sections / titles / bullets.** JM 2026-07-08 (Sweet-Spot screenshot): the "coach notes"
    block (Objective / Fuel / Cues / Full plan link) runs together as one paragraph. Format it into clear sections with headers + bullets. Source:
    the description composer in `planToIcuEvent` / the coach-note render (server/icu-steps.js + server.js). Keep it readable in intervals' plain-text description.
445. ⬜ **Planned GYM shows no LOAD in the APP.** JM 2026-07-08. NOTE: the intervals gym EVENTS do carry load (Full-Body 48, Upper-Body 53 —
    #434 holds server-side, verified). So this is a CLIENT display gap — the Platyplus gym plan view isn't showing the planned load like rides do.
    Confirm which screen (plan detail / card) + wire the client gym `plannedLoad` display. gymapp-client.
446. 🔨→⬜ **DUPLICATE gyms RECURRED (#431 not fully fixed) — "why 2 gyms Thu suddenly + copied to Mon? thought this was fixed."** JM
    2026-07-08 (prod screenshot). Thu Jul 9 had Full-Body Strength + an ORPHAN Upper-Body & Trunk (event 121417361, ext mcp-p22pqmo5, NO plan),
    which also made Upper-Body appear on Mon Jul 13 (its real home). Same move-orphan class as #431: a re-plan/move created a NEW plan+event and
    orphaned the old, and the duplicate-only GC didn't clean it. IMMEDIATE: deleted the orphan (Jul 9 clean, full scan = no other orphans). ROOT
    DIAGNOSIS (subagent, evidence in scratchpad/gc-sim*.mjs): the old inline GC rule WAS correct for the Thu-9 case (Full-Body owns the slot) but
    a plan whose `icuEventId` was stored as a **STRING silently defeated `Set<number>.has()`** → the duplicate went undetected; also the GC only
    runs on client `/auth/plans/sync`. FIXED (Fix A, the safe net): extracted `orphanIsMoveLeftover` + `liveHas` (string/number-tolerant) into
    server/icu-match.js — delete an orphan ONLY when a DIFFERENT **live-backed** plan owns its exact day+sport; a unique-title / unowned-slot orphan
    is KEPT (never re-delete a legit lost-link session, #431/#377). Wired into `reconcileFromIcu`. 447 tests (6 new in icu-dedup.test.ts incl. the
    string-link regression + the keep-legit case). Server-only. DELIBERATELY DEFERRED as too risky for JM's "never lose a session": the fuzzy
    same-title-elsewhere signal + a source-side title-merge (would over-merge recurring titles). STILL OPEN (follow-ups): (1) a deterministic
    delete-on-plan-removal so a "move to an EMPTY day" leaves no phantom; (2) **Jul 7 ride plan never PUSHED** (PAST-guard skips plans dated before
    today, so a coach back-fill never pushes → completed ride can't pair). Prod-only GC → verify next time an orphan appears (or inject-and-reconcile).
447. ⬜ **STREAMLINE the backlog status model — 8 statuses is confusing.** JM 2026-07-08: "got the concept of open… but it should be streamline,
    it's confusing." The review/todo/build/totest/pass/fail/done/discarded set + the "Open = not done/discarded (still includes pass/fail)" semantics
    are too much. Propose a simpler flow (e.g. Review → To do → Building → To test → Done, with a fail looping back to Building + a comment; drop
    separate pass/fail) — MOCK 2 options first (options-first). #438 backlog page. Low-risk polish; after #431.
448. 🧪 **STRENGTH Progress + Stats rework — make it as advanced as running/cycling.** JM 2026-07-08, batch-tested the backlog on QA
    (35 pass, 4 fail). 3 of the 4 failures are the SAME theme (gym/strength analytics are underbuilt) — umbrella here, reopening the individual
    items: **#227** (Jun-19 gym shows GENERIC exercises; can't tap an exercise to see its progress/stats) · **#251** (session shows "1 session ·
    11 min" — WRONG, the real session was longer; "Volume this week" is disconnected from the top filter — it should be a count + total time +
    total kg from the SELECTED filters) · **#252** (the Progress date/domain filter works but there's no gym exercise data or graphs under it).
    JM verbatim: "will need to rework a lot of progress for strength training + stats to make it as advanced as running and cycling." SCOPE + MOCK
    first (options-first) — per-exercise progress + tappable exercises + filter-driven volume/time/tonnage + strength graphs. Big effort. (Separate:
    **#148** empty "Search gym…" list in the Add sheet — a discrete picker bug, ties #412.)
    **🔨 BUILT (2026-07-15, mock `mockups/strength-stats-v2.html`, JM picked Ⓐ main-lift-led + Ⓔ exercise page + "use science/books").** Grounded in the
    literature (Epley/Brzycki 1RM, RIR/RTS, Schoenfeld volume dose-response 10–20 sets/muscle/wk, MEV/MAV/MRV, progressive
    overload) — KB `docs/strength-analytics.md`. Pure engine `src/strength.ts` (`rangeSummary`, `weeklySetsPerMuscle`,
    `mainLifts`, `strengthDigest`, `exerciseHistory`, `nextTarget`) + 9 tests. Strength page (`Progress.tsx`) reworked to Option Ⓐ
    (main-lift-led: summary → compact action cluster → sets/muscle → main-lift cards → weekly volume → all-exercises → bottom insight):
    **#251** the summary now follows the date filter (sessions · time on the bar · consistency/wk — dropped vanity total-kg per JM);
    **Needs attention / Wins** actionable feed (stalls, low-volume muscles, gaps, PRs, movers); **weekly sets per muscle vs the
    10–20 target** (low/ok/high); bounded **Main lift cards** (working-1RM + honest confidence dots) that scale (only your 4
    most-trained); **All exercises** searchable/faceted (Needs-attention default) so it scales to hundreds. **#227** a real
    per-exercise **page** (`src/pages/ExerciseProgress.tsx`, route `/exercise/:name`): est-1RM trend, best-set-by-rep-range table,
    volume trend, next progressive-overload target — reached by tapping a main-lift/list row AND a History session's exercise. **#252**
    all of it lives under the working date filter. **Test (QA):** open Stats → Strength; the summary changes with the date filter (no more
    "1 session · 11 min"); Needs-attention shows stalled/low-volume items; sets-per-muscle flags low/ok/high vs 10–20; tap a main lift
    or a History exercise → its progress page with trend + rep-range + next target. **Route:** UI (strength stats) + engine + coach KB.
449. 🧪 **Backlog: show dev→qa→prod PROGRESSION per item + full status CYCLE.** JM 2026-07-08: "not all items show where (prod/qa/dev)…
    ideally always dev to qa to prod" + "if you work an item that failed, change it to building? we need a full cycle flow." BUILT: (a) every
    built item shows a **DEV·QA·PROD track** (`EnvTrack`) derived from the lifecycle — building=dev · to-test/tested=qa · done=prod (a text
    heuristic under-counted prod badly, so it's status-derived + reflects JM's in-app overrides). (b) The **status CYCLE** is now a documented
    process I DRIVE: ⬜→🔨(I start)→🧪(I ship to QA)→JM tests→✅done/✗fail, and **fail→🔨 building when I rework it**, updating BOTH the .md AND
    the in-app status (skill `options-first` + memory `platyplus-admin-backlog`). Also RECLASSIFIED the stale 🔨 pile (agent review): 209 building
    → 80 building + 153 to-test + 42 done, so the board reflects reality. On QA (rebuild + deploy). Ties #447 (this cycle IS the clarified model).
450. 🧪 **Onboarding: AUTO-detect activities syncing to intervals (drop the manual Strava ack).** JM 2026-07-08: "why don't you check if
    Strava is connected in intervals yourself? is it possible?" YES — the connections endpoint already pulls `recentActivities` (last 3 wks) +
    `deviceSources` (Garmin/Strava/…) live from intervals. FIX: (a) refactored `/api/connections` → `connectionsFor(user)` + added session
    `GET /auth/connections` (+ openapi + authApi.connections). (b) `SetupChecklist` now AUTO-detects the step — relabeled "Connect Strava" →
    **"Rides & runs syncing to intervals"** (source-agnostic: JM uses Garmin, so "Strava" was misleading), `done` when `recentActivities>0`, and on
    first detection it PERSISTS the ack (`info.stravaAcked`) so it's a one-time check, not an intervals call every Today load. Manual "Done" stays as
    a fallback for a brand-new athlete with no activities yet. On QA. (This was the last stuck onboarding step that nagged forever.)
451. 🧪 **Recovery/rest item on Today was a DEAD card — couldn't open it to read the how/why/execution.** JM 2026-07-08 (prod): "lost the
    rest item… could not open the rest item so could not read description, insights or anything for execution." The item's data was fine (its
    `why` field holds the FULL guidance — the readiness insight AND the routine, e.g. "Form −8, HRV 26… absorb it. Full-body mobility + foam roll,
    left-calf routine: roller 60-90s/side, straight-knee + soleus 2×30s, eccentric raises 2×8-10. Sleep ~9h."), but the Today Recovery card was a
    plain non-tappable `<div>` (unlike workouts/mind), so the `why` never showed. v1 was an inline `<details>` expand → JM: "not good, recovery is
    an activity in itself, treat it that way; the why is a wall of text drowning the fish." → mocked 2 options, JM picked **A (own activity view)**.
    BUILT: recovery is now a FIRST-CLASS activity — Today card is a Link → **`/recovery/:id` `RecoveryDetail`** (hero + 💡 Why today insight + 🧘 the
    routine as NUMBERED STEPS with doses + 😴 sleep note). Structured data: `CalItem` gains `insight`/`steps[{name,dose,cue}]`/`sleep` (upsertItem
    persists them); **MCP `schedule_recovery`** now takes insight/steps/sleep (+ tool desc says split it, don't blob); **coach brain** (daily-adapt
    msg) says give recovery STRUCTURED. Old items (only `why`) fall back to showing the text. tsc + build. On QA. (Also: my SIGKILL prod restart for
    a backlog cosmetic caused the transient "lost" — MISTAKE, won't bounce prod for cosmetics; item persisted fine.)
    NOTE — earlier orphan text below belongs to #446; keeping for history.
    "tried to move a session Thu→Tue: didn't work — said there's an activity, still SAVED, then nothing. Then moved the Tue one to
    Thu and it CREATED A COPY, so now I have it twice." Two defects: (1) the move/reschedule path is inconsistent — a conflict/'activity
    exists' error still persists a partial save AND, on the reverse move, DUPLICATES instead of moving (should update the same event by
    icuEventId, not create — ties [[platyplus-integrations]] sync #380 planToIcuEvent/reconcile "intervals-move-wins for the DAY";
    also the past-day/paired-activity guard). (2) the "Substitute on Jul 9" modal (screenshot) shows a "Search ride…" field over a wall
    of EMPTY skeleton rows that never populate — the ride list isn't loading. Repro on QA. Investigate the move/upsert dedup + the
    substitute picker's data fetch. gymapp (+ maybe intervals sync). JM: FOR LATER.
452. ✅ **COACH's "today" was a day AHEAD — wrong-day plan edits (Xenia, live).** JM 2026-07-08: wife asked to replan (not available
    **today**); coach replied "you're not available today AND Wednesday" — but it WAS Wednesday — and did NOT remove today's workout
    until she re-asked. **Root cause:** `buildSystemPrompt` never stamped an explicit date, so the coach inferred "today" from the
    `claude` CLI's own runtime clock = **UTC**, which rolls to tomorrow every evening in the Americas (21h EDT = next-day 01h UTC),
    while the server's scheduling tools compute LOCAL (Toronto) today. That split made "today" (its UTC Thu) ≠ her real Wednesday →
    it listed them as two days and deleted the wrong one. **Fixed (3 layers):** (a) `buildSystemPrompt` now stamps an AUTHORITATIVE
    `# TODAY — it is <Weekday>, <YYYY-MM-DD> in the athlete's local time` block at the top + "this is the ONE source of truth, ignore
    any other clock; confirm the date before moving/deleting a day"; (b) `localTodayInTz` falls back to **COACH_TZ (America/Toronto)**,
    not UTC, closing the latent day-ahead bug for any tz-less path; (c) the host **chat-helper spawns `claude` with `TZ=America/Toronto`**
    so the CLI's own injected date matches. pregnancyStage date also switched to local today. **On QA** (server + host chat-helper on
    next promote/sync). Test: as Xenia in the evening, ask the coach "what's today?" → it names the correct local weekday/date; "I'm not
    available today, replan" → it removes/moves **today's** session (the correct date), first try. gymapp + coach.
453. ✅ **Xenia's Jul-7 strength workout didn't show in Platyplus — she was seeing JM's data.** JM 2026-07-08 (live). Her
    WeightTraining "Strength" (intervals `i163669580`) IS in her athlete (i628280), but Platyplus showed nothing. **Root cause:**
    the client picks the intervals athlete from a **device-local setting** (`icu_athlete_id`) that DEFAULTS to the seed athlete
    (JM's **i28814**), and the login sync only set it `if (u.icuAthlete)` — so on a shared / not-yet-resynced browser Xenia's client
    fetched **JM's** activities (i28814) and never her own (i628280). A cross-user data leak, not a display filter. **Fixed 2 ways:**
    (a) **server `/icu` proxy now FORCES** the `/athlete/<id>` path segment to the AUTHENTICATED user's own athlete — authoritative,
    immune to any stale/shared client state (personal app: each user only reads their own athlete); (b) client `syncIcu` now ALWAYS
    writes the current user's athlete on every load (even empty), so a previous user's / the default id can never linger. On QA
    (server+client); prod on promote. Test: as Xenia, open History → her Jul-7 Strength session shows; JM's data never appears.
454. ✅ **Coach must respect a HARD weekly max training-days (was soft).** JM 2026-07-08: "respect the maximum number of workouts in a
    week that is setup under the profile — it's a HARD limit." The profile field (`info.trainingDays`, "days/week") was SOFT — the prompt
    said "plan exactly N + offer extras as OPTIONAL bonus", so the coach could exceed it. Now a HARD CAP, enforced the same 3 ways as
    maxPerDay (#371) + propagated: (1) dynamic prompt `# WEEKLY TRAINING DAYS — HARD CAP of N/week` (never exceed, move/combine, tell them
    to raise it in profile if they want more); (2) **server 409 guard** in `upsertPlan` — rejects a session on a NEW day once the Mon–Sun
    week already has N training days; (3) daily-adapt runtime msg (fill up to, never beyond, the cap); (4) MCP `create_ride/run/workout`
    descriptions; (5) Profile copy reframed ("A hard cap — your coach plans up to this many days, never more", dropped "optional extras").
    On QA (prompt+guard); prod + host-MCP on promote. Test: set days/week=N, ask the coach to add an N+1th training day → it refuses /
    moves instead (409), never books past N.
455. ✅ **A day she TRAINED (unplanned) read "Nothing scheduled — enjoy a rest day".** JM 2026-07-08 (on Xenia's account,
    screenshot): Jul 7 had a week-strip DOT — her completed strength activity now LOADS (#453 working) — but the day content
    said "Nothing scheduled". Root: Today's day content rendered only PLANS + planned EVENTS; a completed intervals activity
    showed ONLY if it MATCHED a plan by day+sport (`actFor`). Xenia's strength was UNPLANNED (no plan to attach to) → invisible
    in the day view, dot only. **Fixed:** Today now computes `orphanActs` (completed activities on the day with NO matching
    plan/event) and renders each as a read-only **"✓ Completed" ActivityCard** (sport thumb + DoneStats, taps to `/activity/:id`),
    and counts them in `hasWorkout` so a day she trained never reads "rest day". Already visible in History; now on Today too.
    On QA. Test: open a day with a completed intervals workout but no plan → the completed card shows, not "Nothing scheduled".
    ✅ CONFIRMED by JM 2026-07-08 — "i can see her gym now on the 7th, on my side im all good too".
456. ✅ **Never fall back to the seed athlete (i28814) — BLOCK + report when a user has no athlete (JM directive).** Found during #453;
    JM: "for any missing athlete, you block and report an error" (sync integrity — "we had a lot of issues with dupes and bad sync").
    There were **32 server paths** doing `user.icuAthlete || 'i28814'` — incl the coach's intervals **push, event-DELETE, reconcile,
    findIcuEventsForPlan** — so a user with no athlete would silently READ or WRITE **JM's i28814** calendar → cross-user dupes/corruption.
    **Fixed:** removed the `|| 'i28814'` default from ALL per-user paths (kept it ONLY on the admin SEED, `server.js` 67/80). Added clean
    BLOCK guards: `pushPlanToIcu` / `reconcileFromIcu` return `{skipped:'no intervals athlete'}` + log a warning; `deleteIcuEvent` +
    `findIcuEventsForPlan` bail; the shared `if (!icuKey)` endpoint guards now also require an athlete; and the **`/icu` proxy returns 409**
    for an athlete-scoped call with no athlete (never proxies the seed). Connected users (JM, Xenia — athlete set) are byte-for-byte
    unaffected. 447 tests, tsc clean. On QA. Test: a user with a key but no athlete → intervals reads 409, coach plan-push logs "blocked …
    no intervals athlete" and never appears on JM's calendar.
457. 🔨 **PHONE push notifications (Web Push) — buzz the phone when the coach changes the plan.** JM 2026-07-09: "can a PWA do push
    notifications to a phone when there is a plan change? build it." Today `pushNotification()` only writes the in-app 🔔 bell — the
    phone stays silent until you open the app. Add real **Web Push** (works with the app CLOSED): VAPID keys, a permission + `PushManager`
    subscribe flow (stored per device), a `push` + `notificationclick` handler in the service worker, and fan the EXISTING
    `pushNotification` (already fires on every coach plan-change / review) out via the `web-push` lib. ⚠️ **iOS caveat:** Web Push works
    ONLY for a PWA **installed to the Home Screen** (iOS 16.4+) — a Safari tab gets nothing; Android works in-browser. So the opt-in UX
    needs an "install to Home Screen" hint on iPhone. Mock the opt-in/permission UX first (options-first), then wire the plumbing.
    Layers: `server/server.js` (VAPID + subscribe endpoints + web-push send in pushNotification) · service worker (`vite.config`/`public`) ·
    client Settings toggle + subscribe · openapi. Test: change a plan from the coach → the phone shows a system notification, tap → opens the plan.
    BUILT + on QA (degraded-off). ⚠️ Needs the **`VAPID_ENV` GitHub secret** set to enable (deploy scripts append it to auth.env).
    ✅ VAPID secret set + LIVE on prod 2026-07-09; demo coach-review push landed on JM's phone. **Follow-up fix (tap→deep-link):** tapping the
    notification wasn't opening the page — `client.navigate()` throws on an uncontrolled window (left the user put). Now the SW FOCUSES an open
    app + posts `{notif-nav, link}` → App client-side routes there; if closed, `openWindow` an ABSOLUTE deep link. push-sw.js served no-cache
    (ends "sw.js") so the new SW picks it up. On QA.
458. ✅ **Location: intervals HAS it but the Platyplus profile showed blank.** JM 2026-07-09 (QA). His saved COORDS (lat/lon) were there but
    `info.locationName` was empty → `GET /auth/location` returned `name:null`, so Profile showed no place. Fixed: when coords are saved but the
    NAME is blank, adopt intervals' city name (keep the saved coords) + PERSIST it. On QA. Test: Profile → Location shows the city.
459. ✅ **DONE (shipped prod, JM verified 2026-07-14) — Profile height/birthdate now TWO-WAY synced with intervals.** Read side (`syncAthleteProfile` fill-if-empty) populates height/DOB/sex/weight (verified prod+QA: 175 cm / 1985-08-16); write side (`athleteBasicsPatch` → `PUT /athlete/{id}`, PROD-only) pushes Platyplus edits back to intervals — JM confirmed a height change lands on intervals. (Diet field dropped — Eat is off.) Combined with #268/#1003. Original: **Profile: diet / height / birthdate empty ("never changed my diet").** JM 2026-07-09 (QA). His `user.info` has lat/lon/sex/sports/
    coachName/equipment/sleepNeed/availability/trainingDays but NOT diet/heightCm/dob/locationName — on BOTH QA and PROD (so not QA-only; the UI
    defaults diet→"no preference" when unset, which read as "changed"). Root TBD: never set on prod, OR wiped. LIKELY the QA **mirror clobbers
    QA-only info edits** (it copies prod.info wholesale). Fix: (a) mirror PRESERVES user-entered info; (b) JM re-sets on PROD (persists). Confirm
    with JM whether he set them on prod recently (→ hunt a wipe) or sets them now + watch.
460. 🔨 **Notifications section shows but nothing to toggle.** JM 2026-07-09 (QA). The per-type toggles only render once the master is ON
    (subscribed) — but push is DISABLED on QA (no VAPID yet, #457), so there's nothing actionable. Tied to #457: once VAPID is set + master on,
    the toggles appear. Also improve the empty/disabled state (show the types greyed when push isn't on) so it's not confusing.
461. ✅ **Estimated FTP (+ VO₂max) shown with decimals — round it.** JM 2026-07-09. `Benchmarks.tsx` FTP `computed:eftp` (intervals eFTP, a
    decimal) used `fmt:String` → unrounded; same for VO₂max. Fixed: `fmt` now `Math.round`s (the value + the eFTP "science" row). On QA.
462. ⬜ **Coach/benchmark should EXPLAIN computed-FTP vs CP vs manual (idea).** JM 2026-07-09: "strange the computed FTP dropped to 240, CP is 248,
    but I trained at FTP 260 — how do you support this?" The reasoning (not a bug): **CP ≥ FTP is textbook** (CP = 30–50 min asymptote, FTP = 60 min),
    so 248 > 240 AGREES; and **eFTP is evidence-based** — it drifts DOWN without a recent ~5–20 min near-max effort, so 240 ≠ "can't do 260", it means
    "no fresh proof." App idea: (a) a benchmark insight line reconciling computed vs manual ("your eFTP reads 240 because your recent efforts show that;
    a hard 20-min effort will refresh it — you may still be ~260"); (b) explain CP≥FTP where both show; (c) coach reasons off the honest number (~248),
    not a stale manual 260, and PROMPTS a threshold test to resolve it. Ties [[platyplus-beyond-ftp-metrics]] + benchmarks manual-vs-computed.
463. 🧪 **Daily-reminder notification toggle was a dead switch — made it real.** JM 2026-07-09: "daily reminder not togglable yet." The
    "Daily reminder" per-type toggle was marked `soon` (disabled). Built it: (a) toggle now works + persists (`pushPrefs.reminders`,
    default OFF/opt-in); (b) `sendWebPush` maps subkind→pref (`review`→reviews, `reminder`→reminders, else planChanges); (c) **sender**
    `dailyReminderPush` in the morning scheduler (`dailyAdaptTick`) — once/day in the athlete's LOCAL 7–11am window, IF opted-in +
    subscribed + NOT already checked in today → "⏰ Ready to train? Check in + see today's plan". Runs for any subscribed user on QA + prod
    (only sends a push, never touches intervals). On QA. Test: toggle Daily reminder on → next local morning (no check-in yet) → phone buzzes.
    (update 2026-07-09) INVESTIGATED — inconclusive. diet/heightCm/dob ARE capturable (diet chips + `FuelFields` render + save via
    saveProfile) and the save path MERGES (can't wipe); the Jun-23 pre-migration backup had JM's `info={}` (empty); no audit trail; NO
    full `user.info=` replace anywhere server-side. So no wipe vector found. Best guess: an early save didn't persist, or a reset I can't
    see. ACTION: JM re-sets them on PROD (save path verified → they WILL stick); if they vanish AGAIN that's a live repro I trace instantly.
464. 🧪 **FTP discrepancy — the card said 241 (computed) but the insight said 260 (manual), same page.** JM 2026-07-09 (QA, screenshot).
    The FTP benchmark card shows the CHOSEN value (eFTP 241, since pref = AUTO·COMPUTED), but the "Punchy threshold" athlete-profile
    insight anchored on the raw MANUAL FTP (260) → two FTP numbers on one screen. Root: `Benchmarks.tsx` passed `threshold: ftpManual` to
    `athleteProfile`, ignoring the pref. Fixed: it now passes the CHOSEN value (`chosenFtp`, same `inUse` logic as the card — computed/auto →
    eFTP, manual → set value); same for running threshold pace. Card + insight now always agree. On QA. Test: FTP card + insight match;
    switching the FTP pref manual↔computed moves both together.
413. 🧪 **FTP + threshold pace still in the GLOBAL benchmarks grid — they're SPORT-specific.** JM 2026-07-07 (screenshot): "ftp still
    in global …" + "threshold pace is also in global, it's sport specific." The earlier ADVANCED exclusion only dropped CP/W′/CS/D′/TTE;
    FTP (cycling) + threshold pace (running) stayed. Fixed: renamed `ADVANCED`→`SPORT_ONLY` and added `ftp`+`thresholdPace`, so the GLOBAL
    grid now shows ONLY cross-sport benchmarks — **VO₂max · Max HR · Sleep**. FTP stays on the Cycling stats page, threshold pace on Running
    (both already via `only=[…]`). tsc clean. gymapp-only.
414. ⬜ **Xenia's (wife) "gym workout for today" shows EMPTY.** JM 2026-07-07. INVESTIGATED: Xenia has **no plan at all for 2026-07-07**
    on prod (5U3WYwwwkI6X — only a run Jul 6, then gym Jul 11) NOR staging (DYo0FuzIvn6w — 0 plans, no icu_key, no sports, icu_athlete
    inherited as i28814). Her OTHER gym plans DO populate (Jul 11/15/18 = 12 exercises each), so it's NOT an empty-exercises generation bug.
    So the empty card is either (a) the Today page renders a gym-workout card when there is NO plan for that day, or (b) on QA an
    intervals SHELL surfaces from the shared i28814 athlete (she has no key). NEED from JM to pinpoint: which ENV (QA vs prod) + a
    screenshot of the empty card + confirm it's on HER login. gymapp (Today.tsx render / intervals shell).
    ✅ ROOT CAUSE FOUND (prod, her login): Xenia's OWN athlete **i628280** has a Jul-7 event "Full-Body Dumbbell + Band Strength"
    (WeightTraining, **platyLink=true** — Platyplus pushed it) but there is **NO Platyplus plan for Jul 7** in the DB (her plans: Jul
    3·11·15·18). So it's an **ORPHANED intervals event** — the plan was moved/removed but its intervals event wasn't deleted → Today
    surfaces the shell with no exercises = empty gym. SAME root cause as #412 (a move/reschedule doesn't clean up the old intervals
    event). IMMEDIATE FIX: delete the orphaned Jul-7 event from i628280 (awaiting JM OK — outward write to her intervals). SYSTEMIC FIX
    (=#412): on move/delete, remove the prior intervals event by icuEventId; and reconcile must not surface a platyLink gym event that
    has no plan. Ties [[platyplus-integrations]] #377/#380.
    ✅ CONFIRMED coach-side (JM: "my wife asked the coach to update, so a bug on the coach side?"). Cross-ref of Xenia's plan
    `icuEventId`s vs her i628280 events found **TWO ORPHANS** referenced by NO plan: Jul-7 gym `120157324` + Jul-10 run `120872923`.
    The coach's re-plan created new events (12089xxx/12087xxx) but removed the old plans WITHOUT `deleteIcuEvent` firing (so the old
    events lingered). REAL FIX = a **reconcile-time orphan GC**: when reconciling, any intervals event that carries our platyLink but
    matches NO current plan by `icuEventId` gets DELETED (self-heals regardless of how the orphan arose) — PROD-only (IS_STAGING read-only).
    Plus harden the re-plan/move path to always `deleteIcuEvent` on plan removal.
    ✅ DONE: (1) IMMEDIATE — deleted the 2 orphans from i628280 (platyLink-guarded so an athlete-created event is never
    touched); Xenia's Jul-7 empty gym is gone. (2) SYSTEMIC — orphan-GC added to `reconcileFromIcu`: `isPlatyplusPushedEvent(ev)`
    (server/icu-steps.js — external_id set OR gym deep-link; unit-tested, 33 pass incl. FALSE-for-athlete-event) marks our pushes; one
    that no plan claims (by icuEventId/external_id/day+sport+title) is collected + DELETED after the loop. ⚠️ **FAIL-SAFE per JM's warning
    ("Xenia never created any workout herself — all coach-made, be careful"):** since the gate then matches ALL her events, the GC (a)
    does NOTHING if `user.plans` is empty, and (b) CAPS at 4 deletions/run — a bigger batch = stale plan state → skip + `console.warn`,
    never mass-delete. PROD-only (IS_STAGING skips). Deploys to prod on the next promote; QA won't act (read-only). gymapp + coach-sync.
    message for a `future:false` response (Today.tsx:179 checks `!f.available`, which is undefined). FIX options: (1) client
    passes its LOCAL today; server uses it for the future-check (+ fix the client message so future:false ≠ "no data");
    (2) server derives local today from the athlete's intervals timezone; (3) client-only message fix. Note: the readiness
    endpoint uses UTC "today" too — same class of bug. gymapp-only.
346. ✅ **A completed workout shows as TWO entries in intervals (ghost PLANNED event + the DONE activity).** JM 2026-07-04
    (screenshot, xenia Fri 03 Jul). VERIFIED in her data: a planned event "Upper Body + Core" (WeightTraining, our push
    id 120381637) AND a completed activity "Strength" (WeightTraining, id i162487273, **paired_event_id=None**) both on
    2026-07-03. They didn't merge because (a) her WATCH names the activity generically "Strength" ≠ the plan title, and gym
    has no structured link → intervals left it unpaired; (b) Platyplus only deletes a past planned event on RE-PUSH (never
    happened) so the ghost lingers. JM chose: **pair if it corresponds; if not (missed), remove the planned one eventually.**
    Done: `/auth/plans/handle-missed` (runs on app load) now, for each recent past plan (last 6 days), PAIRs the completed
    activity to our planned event (`pairActivityToPlan` → PUT `paired_event_id`, idempotent) when a matching activity exists;
    MISSED plans still get the coach reshape+remove (#156). Pairing API round-trip VERIFIED (her Jul-3 dup manually paired as
    the test: activity i162487273 → event 120381637). Also uses local today (#347). ✅ CONFIRMED by JM 2026-07-04: after
    pairing, intervals now shows **ONE** entry (the dup collapsed) — the activity-side `paired_event_id` is enough.
    Ties #150/#185/#160/#156. gymapp-only.

> 🎯 **FOCUS (JM 2026-07-03):** prioritise **OUTDOOR activities + GYM**. **Indoor-ride** features are LATER — #174 (Bluetooth HR on the bike), #106 (pedaling metrics), and the indoor bits of the ride player / #62 ref. Cut by JM: #173, #163, #149, #61 (marked ❌ below).

345. 🧪 **"Max workouts per DAY" preference (default 1) — next to preferred workouts/week.** JM 2026-07-03: the coach
    pushed a gym AND a run the same day; unless the athlete SAYS they can double (time/capacity), expect ONE session/day.
    Done: `maxPerDay` field (default 1) beside days/week in Availability; persisted to `info.maxPerDay`; coach prompt now
    hard-caps sessions/day ("do NOT schedule two workouts same day unless opted in"). Directly resolves #339. On QA.
344. 🔨 **Planned-workout chart "looks weird" — line stops at 20m, needle at 5m, degenerate Y-axis; review ALL graph
    rendering.** JM 2026-07-03 (screenshot, Recovery Shakeout Run): the pace "target shape" line ends at ~20m (of 25),
    a downward needle at the 5m segment boundary, and the Y-axis shows 8 near-identical labels (6:18–6:20) for a nearly-
    flat run. Root: a piecewise-constant workout target is rendered by Catmull-Rom smoothing of a densely-sampled array
    (bezier overshoot = needle; index/tick math = the gap) + no minimum Y-range (flat workout ⇒ collapsed axis). Fix:
    render the planned target as a proper STEP/RAMP profile from the segments (time-proportional, run + ride consistent),
    add a Y-axis min-range, and AUDIT every chart (TrendChart trends, BarChart, PowerCurveChart) for the same classes of
    bug. Supersedes/extends #334 (y-axis crammed). Mock the profile shape first. gymapp-only.
343. 🧪 **Coach used cycling power-logic on RUNS — "Recovery Run" pushed at 94–95% = Z4 threshold in PROD.**
    JM 2026-07-03: her recovery run showed Z4 in intervals; her real endurance is ~6:15–6:45. Root cause: NO
    running engine — the coach had a cycling engine (FTP) but nothing for running, so it thought "95% = just
    below threshold = easy." **95% is NEVER easy, any sport.** JM: "have an engine per sport/activity … running
    is different, he has books … those are the foundations, follow them — don't hard-code 95% scolds." Done:
    (a) **per-sport engine map** `SPORT_ENGINES` in server.js + new `server/coach-engine-running.md` = Daniels
    E/M/T/I/R FOUNDATIONS (physiology/%VO₂max, 80/20); (b) `PACE_ANCHORS` (icu-steps.js + running-paces.ts,
    in sync) **re-derived from the Daniels oxygen-cost curves** — recovery 73%T, easy 81–84, marathon 93,
    threshold 100, interval 111, rep 119; (c) `clampEasyEfforts` HARD guard (both sports) caps easy/recovery-
    labelled segments prescribed >80% → wired into upsertPlan + planToIcuEvent; (d) MCP `create_run` schema
    teaches the zones from the science. **Fixed her prod run** (94→Z1 7:13–7:25). 15 icu-steps tests. Coach
    memory + skill + CLAUDE.md updated. [[platyplus-coach-engine]] [[platyplus-intervals-workout-steps]]
342. 🧪 **Max HR IS computable — stop saying "no safe way to guess it".** JM 2026-07-03: the card claimed Max HR can
    only be set manually. Wrong: the honest computed source is the **observed peak** — the highest per-activity max HR
    over the last 180 days (what Garmin/Coros/intervals use). Age formulas are the unsafe guess; observed peak is real.
    Done: `/auth/intervals/power-benchmarks` returns `observedMaxHr` + `maxHrSamples` (guarded 120–230 bpm); Benchmarks
    Max HR card now has a Computed value + honest source ("observed peak — hit N×"); pending copy = "lands the first
    time you go all-out with a strap/watch". Same Manual/Auto/Computed picker as the rest.
341. 🧪 **Local WEATHER in the coach brain (heat/cold/wind → adjust intensity).** JM 2026-07-03. Done: `server/weather.js`
    turns a day's forecast into coaching guidance (heat derating + hydration, cold layers, wind→effort, rain→indoor; pure,
    6 tests). `/api/weather?date=` (Open-Meteo, FREE/no-key) + MCP `get_weather` tool; athlete location auto-derived from
    recent GPS activities (no new UI; `needsLocation` → coach asks their city). Coach prompt: call get_weather before an
    outdoor session + DERATE in heat, fold into the plan/notes. Verified live (Montreal feels-like 32°C → heat:high). On QA.
340. 🧪 **Banner for activities that haven't received full feedback (option A).** JM 2026-07-03 (mock A picked). Done:
    History page shows an amber roll-up banner ("N sessions still need your feedback") + a knock-out list (oldest first),
    each row = sport emoji, title·day, missing chips + a richness progress bar, deep-linking to the activity's feedback.
    Nag only on the CORE (feel + RPE) so it's not spammy — custom fields drive the % but not the flag. `feedbackGaps.ts`
    (5 tests) + `IncompleteFeedbackBanner` in Logs.tsx. Self-validated vs mock A. On QA.
339. 🧪 **Coach scheduled a GYM and a RUN the SAME day — "crazy".** JM 2026-07-03. Respect training frequency (#316) +
    availability; don't double-book a day unless the athlete explicitly wants a double. **Fixed by #345** (maxPerDay cap,
    default 1, in the coach prompt). On QA.
338. 🧪 **Coach CHAT on the app = wall of text, no titles.** JM 2026-07-03. Root: the chat rendered coach text as PLAIN
    text (markdown showed literally). Done: (a) a tiny dependency-free, CSP-safe markdown-lite renderer — `chatFormat.ts`
    (parse **bold** / "- " bullets / "## "+bold-line headers → blocks; 7 tests) → `ChatBody` renders React nodes (no HTML
    injection) with `.chat-h/.chat-p/.chat-ul` styles; (b) coach prompt now says "format for a phone — lead with the
    answer, bold mini-headers + hyphen bullets, never a wall." Short replies stay plain bubbles. On QA.
337b. 🔨 **Streamline: benchmarks live in ONE place (Stats), Profile = preferences only.** JM 2026-07-03: VO₂max/zones
    showed in BOTH Profile (52.1) and Stats — "confusing, streamline." Done: removed BenchmarksCard + all per-sport stat
    cards/SleepNeed/zones from Profile; Profile now links to Stats for data. Profile = preferences (coach, sports, sex,
    goals, availability, equipment, diet, learn-readiness). 274 tests green. On QA — awaiting JM ✅.
337. 🧪 **Learned-stats system: Manual/Auto/Computed picker for every benchmark + "when computed lands".** JM 2026-07-03:
    VO₂max was terrible (used sparse running). Done: cycling VO₂max from **5-min MAP power** (`10.8·W/kg+7`), not FTP;
    running VO₂max suppressed when <4 recent runs; headline uses the athlete's PRIMARY sport; sleep-need joins the picker;
    each stat shows its theory GATE when computed isn't ready ("after a hard ~5-min bike effort", "in ~N more nights —
    needs 21 nights"). `vo2max-submax.ts` (17 tests). Verified her number is realistic (Coros 49). On QA — awaiting JM ✅.
335. 🧪 **Training frequency = free NUMBER field, not fixed 3/4/5/6 chips (#316b).** JM 2026-07-02: chips "stupid", just a field. Done: number input 0-14 days/week.
334. 🧪 **Chart y-axis crammed + too close to the "PLANNED PACE" title.** JM 2026-07-02: the pace chart's y labels
    (5:59/6:03/6:07…) crowd the title and are too dense/non-linear. **Folded into #344** (min axis span spreads the
    labels; step profile removes the near-vertical clutter). On QA — verify the title spacing reads OK too.
333. 🧪 **COMPLETED run activity renders POWER (avg 220 W, POWER CURVE, TIME-IN-ZONE by FTP) — SHE WAS RUNNING.** JM
    2026-07-02 (screenshots, Garmin FR255). Done: ActivityDetail now branches on sport — a RUN shows PACE everywhere:
    hero/chips are pace-based (distance, avg pace, load, HR — no watts/NP/VI/eFTP); a **PACE timeline** (min/km from
    velocity_smooth, faster=up) + HR/altitude/cadence; a **Pace tab** with a **pace curve** (best avg pace by duration,
    inverted log axis) + **time-in-PACE-zone** (Daniels, off threshold pace). Added velocity_smooth/distance streams +
    `PaceCurveChart` + TrendChart `invert`. Pure maths in `run-analysis.ts` (7 tests). Run-gated → zero ride regression.
    Self-validated vs mock (mockups/run-analysis-check.html). On QA. NB: needs threshold pace set for the zone bar.
332. 🧪 **Gym warm-up/cool-down are COMBINED multi-move lines with no demo.** JM 2026-07-02 ("you combine 3?!"). Picked
    **option A** (individual demo'd moves under a header). Confirmed the library covers warm-up moves (99% w/ media: arm
    circles, leg swings, high knees, cat-cow, jogging in place…). Done: `create_workout` gains a `section`
    ('warmup'|'main'|'cooldown') field + guidance to author warm-up/cool-down as INDIVIDUAL library moves (each an exId),
    never a combined line. CoachPlanDetail groups exercises under 🔥 Warm-up / Main set / 🧊 Cool-down headers (each move
    its own demo row); the GymPlayer already plays them individually now. Mock A approved. On QA.
    **Test:** ask the coach for a gym session → the plan shows warm-up as separate demo'd rows under a "🔥 Warm-up" header,
    not one garbled line; each warm-up move opens a real demo video.
331. 🧪 **Platyplus renders a RUN as WATTS (117 W, "PLANNED POWER", Z3) + intervals shows empty/"% (0-0w)".** JM
    2026-07-02 (screenshots). The endurance detail (CoachPlanDetail) + charts are power-only; a run must show PACE
    (min/km) using threshold pace, never watts. **Done** (PLANNED view): CoachPlanDetail shows PLANNED PACE, native
    "% pace" text pushes to intervals, pacing corrected + calibrated (#343) + chart fixed (#344). On QA. NB: the
    COMPLETED/analysed run view is the sibling #333 (still open).
330. 🧪 **Post-workout feedback form PRE-FILLED with fake values (POOR + RPE 10) + WRONG SPORT (cycling fields on a run).**
    JM 2026-07-02 (St-Lambert run). Done: (a) **phantom guard** — `readIcuFeedback` returns null unless a custom field is
    present, so Strava/coach-imported feel/RPE no longer show as "already logged"; form starts blank (already shipped +
    tested). (b) **running fields** — new `RUN_FIELDS` (no "saddle"; Pain = knee/shin·calf/foot·ankle/hip/IT band/hamstring;
    running Fuel), `FIELDS.run` uses them, and BOTH the app read (`readIcuFeedback`, sport-aware) AND the server write
    (`ICU_FB_FIELDS_RUN`) map through the run options so the round-trip + coach message stay consistent. 6 read-feedback
    tests. On QA.
329. 🧪 **Factor the MENSTRUAL CYCLE into coaching + readiness — with a defined FORMULA.** JM 2026-07-02 (very important).
    Formula done earlier (server/cycle.js, 10 tests, on prod). NOW wired end-to-end: `/auth/readiness` derives the phase
    (intervals `menstrualPhase` → else stored cycle start+length via phaseFromDay), **passes cyclePhase to the readiness
    engine** (luteal RHR↑/HRV↓ no longer docks Energy) AND stashes it so **buildSystemPrompt injects the phase into the
    coach** — it now biases the PLAN by phase (green-light follicular/ovulatory; ease late-luteal if symptomatic), not just
    Energy; asks once if unknown. Minimal cycle UI on Profile (female only): last-period-start + length + a phase readout.
    308 tests. On QA. STILL OPEN: a richer in-app cycle tracker + writing the phase BACK to intervals.
    (orig ask ↓) If intervals exposes cycle wellness (and it's not private), the coach READS it;
    else it ASKS (cycle start date + typical length). DEFINE a formula: phase from cycle day → (a) LOAD modifier (push in
    follicular/ovulatory, ease late-luteal/menses if symptomatic) + (b) readiness interpretation (luteal naturally raises
    RHR / lowers HRV + core temp → don't dock Energy for it; adjust baseline by phase). Extends the female module
    (coach-engine-female.md) + docs/readiness-scores.md. Pure, tested module. gymapp-only.
328. 🔨 **Running pace + threshold must display in MIN/KM everywhere.** JM 2026-07-02. intervals threshold_pace is stored
    in m/s (converted); UI + coach must always SHOW running pace/threshold as m:ss/km, never watts/%/m/s. Verify every run
    surface (plan, player, stats, coach text). Ties #312/#313. gymapp-only.
327. 🧪 **VO₂max shown for wife looks too high (doubt 52.1).** JM 2026-07-02. Fixed in `vo2max-submax.ts` (#234/#337):
    running now PREFERS VDOT from real pace and no longer lets the HR-ratio method (inflated by an ASSUMED 220−age HRmax)
    win — and when VDOT vs HR-ratio diverge >6, the value is flagged **low confidence**; HR-ratio alone is 'low'; cycling
    comes from 5-min MAP power. The Benchmarks card shows the confidence + source. No more phantom 52 for a 6:45/km runner.
    JM to verify on prod. gymapp-only.
326. 🔨 **Completed workout opens the PLANNED view, not the ANALYSED one — terrible.** JM 2026-07-02: clicking a DONE
    workout lands on the planned page (only "flyby" gets you elsewhere); from there you can still hit Play/Analysis. Like
    intervals: a COMPLETED session must open its ANALYSED/result view by default, with an option to view the plan. Fix the
    routing: done → /activity/:id (analysed); planned → plan view. Remove Play from a completed session. gymapp-only.
325. 🔨 **Onboarding forgot to ask the COACH's NAME.** JM 2026-07-02: Option C flow dropped naming the coach (was in the
    old chat interview; stored as `coachName`, set on Profile "Your coach"). ADD a step (or fold into About/goals #323) to
    let the user name their coach — it personalises every chat + insight. Prefill "Coach". gymapp-only.
324. 🔨 **Stats page doesn't fit the screen — too "big", parts can't be seen (horizontal overflow).** JM 2026-07-02:
    content wider than the viewport → clipped, some parts unreachable. Violates the NO-horizontal-scroll mobile rule. FIND
    the overflow source on /stats (+ detail pages CyclingStats/RunningStats/Strength/MindStats): fixed widths, `nowrap`,
    wide numbers/tables (e.g. race-prediction range "3:45:00–4:03:00"), non-wrapping grids, oversized fonts. Fix so it
    fits ≤430px with padding, wraps, no clip. Check every stats subpage. gymapp-only.
323. 🔨 **Onboarding must capture the RICH profile + OBJECTIVES/identity, not just discrete values (like JM's own).** JM
    2026-07-02: "I don't think onboarding is good enough to capture a full profile + objectives like I did for myself." The
    structured pages (C, #310) get sport/sex/equipment/availability/numbers — but MISS the qualitative goal & identity that
    make coaching personal: e.g. **wife = "be fit, be consistent, NOT gain muscle"** vs **JM = "300 FTP, be a diesel
    engine."** "VERY important to capture this kind of thing." DIRECTION (hybrid, don't lose the coach's conversational
    strength): keep C's pages for values, ADD a SHORT, focused **goals conversation** step — primary goal, what success
    looks like, motivation/identity, hard limits, what they DON'T want — with guided prompts/quick-picks so it's not a wall
    of text, feeding `set_athlete_profile` (the markdown the coach plans from). The coach should also PROBE from intervals
    history ("you've been riding ~Xh/wk — aiming to build that?"). Mock-first (the goals step). Ties #310/#313. gymapp-only.
322. 🔨 **Availability page is TOO BULKY — make it dense.** JM 2026-07-02 (screenshot): 7 day-rows × 8 big circular chips
    (Rest/30m/…/3h+) eats the whole screen "bulky for nothing." Redesign denser — e.g. a compact per-day segmented
    control or a slider/stepper, fit the week in ~1 screen. Also add the frequency question (#316) without adding bulk.
    **Mock-first** (2-3 dense layouts). Ties #303/#316. gymapp-only.
321. 🔨 **"See trends" link is confusing — dumps you on the Stats HUB, not the trend.** JM 2026-07-02 (screenshot of the
    Stats hub: Wellness/History/Per-sport). Clicking Profile's "📈 See trends & race predictions in Stats ›" lands on a
    generic hub — unexpected/"I don't get it." FIX: either take them straight to the RELEVANT trend (the stat they came
    from), or make the destination obviously the trends page (clearer heading/why-am-I-here), or drop the confusing link.
    gymapp-only.
320. 🔨 **Equipment should live on PROFILE, not Settings.** JM 2026-07-02: "equipment is not a profile thing?" — right,
    it's a coaching input like sports/diet/availability (all on Profile), not app config. MOVE the equipment picker to
    Profile (near Sports/Availability); update the onboarding step (#310) + setup checklist (#307) to point at Profile;
    keep a redirect/or remove from Settings. Reverses #307's Settings target. gymapp-only.
319. 🔨 **Generalize "set a default, LEARN from data over time" to EVERY learned stat (not just sleep).** JM 2026-07-02
    (frustrated I scoped it to sleep): the #304 concept — we SET a starting value but LEARN the real one from data, showing
    "need ~X more days" while collecting + suggesting the data-driven value with a manual override — must apply to ALL
    learned stats: VO₂max, threshold pace, FTP, maxHR, LTHR, weight, etc. Each shows: current value + source (est/manual/
    intervals) + a learning state (collecting → "N more days", or "data suggests X — use it?"). Unifies with
    [[benchmarks-manual-vs-computed]] + readiness learning ([[platyplus-readiness-model]]). Systemic — one shared "learned
    stat" pattern reused everywhere. Mock-first for the card. gymapp-only.
318. 🔨 **Notification panel overflows off the LEFT edge — can't see it (going too far left).** JM 2026-07-02: the
    notifications dropdown/popover is positioned so it runs past the left screen edge, clipping content. FIX its CSS
    positioning — anchor within the viewport (right-align under the bell, `max-width`/`left` clamp, no negative offset /
    off-screen translate). Mobile-first: must fit ≤430px with padding, no horizontal clip. gymapp-only.
317. 🔨 **No TIME estimate on the gym workout in prod (for her).** JM 2026-07-02 (wife): her gym session shows no duration/
    time estimate. Gym plans should show an estimated duration (from sets × reps × tempo + rest, per exercise → total),
    like rides show time. Check why it's blank for her plan (missing tempo/rest? not computed on coach-authored plans?) +
    render a time estimate on the gym workout header/card. Add a test for the estimator. gymapp-only.
316. 🔨 **Ask desired training FREQUENCY (sessions/week) → drives base plan + OPTIONAL bonus workouts.** JM 2026-07-02:
    availability captures hours/day, but also ask how many times/week she WANTS to train. Add to the availability page
    (e.g. "How many days/week? 3·4·5·6"), store on profile. COACH BEHAVIOUR: plan exactly that many BASE sessions/week
    (she says 4 → show 4). If she then wants extra (a 5th on a free day), surface ONE **optional/bonus** suggested workout
    she can opt into — clearly marked optional, not part of the base load. So the week = N committed + on-demand bonus.
    Ties #303/#310; coach prompt + plan model needs an "optional" flag on bonus sessions. gymapp-only.
315. 🔨 **Wife's ENERGY (readiness) isn't being calculated despite HR/HRV present.** JM 2026-07-02: she has HR, HRV, etc.
    but Energy shows uncalculated. Readiness engine (server/readiness.js, #158/#159) auto-derives Sleep·Freshness·Energy
    1–5 from intervals wellness (CTL/ATL/Form, HRV, RHR, sleep) + check-in. DEBUG for xenia (i628280): is wellness
    actually flowing in (HRV/RHR/sleep present)? is the engine running on her account / gated on something she lacks
    (e.g. needs a baseline / N days)? Fix so Energy computes from the data we have; if it needs more history, show the
    "need ~X more days" state (#304) instead of blank. Verify on her account. gymapp-only.
314. 🔨 **Coach-authored RUN in intervals is TEXT-ONLY — won't push to her Garmin as a structured workout.** JM
    2026-07-02 (wife): the run event in intervals has only a text description, no structured steps → Garmin Connect won't
    get a real workout to follow. Runs (like rides, #293) must be authored as STRUCTURED intervals steps (warmup / reps /
    cooldown with PACE or HR targets, not watts — see #312) so intervals → Garmin sync gives a followable workout. Audit
    create_run / planToIcuEvent run branch: emit structured steps + pace targets. Test. Ties #312. gymapp-only.
313. 🔨 **User may not know their threshold pace/FTP — ESTIMATE + advise from intervals (Strava history).** JM 2026-07-02:
    don't force the number; after intervals connects there's ~3mo of Strava history — estimate threshold pace/FTP from it
    and tell the user (with a "use this" like Profile already does for pace via Critical Speed, #215/#271). ONBOARDING:
    the "your numbers" step is OPTIONAL (never blocks the build); the coach analyses intervals FIRST and proposes values.
    Extend the same estimate to FTP if not already. Folds into #310 numbers step + #306(f). gymapp-only.
312. 🔨 **A RUN shows WATTS instead of pace.** JM 2026-07-02 (wife): today's run displays power (W) — a run must show
    PACE (min/km), not watts. Likely the same class as #217 (power_zone steps mis-read) but for run activities/plan
    rendering, or a run planned/imported with a power target. FIND where run sessions pick their target metric + force
    pace for runs (watts only for ride). Add a test. gymapp-only.
311. 🔨 **Passkey registration is confusing on Samsung/Android — user got pushed to a Samsung-account/password flow she
    didn't know.** JM 2026-07-02 (wife): on Samsung the passkey prompt jumped to "connect to Samsung [Pass/account]" +
    asked for a password she doesn't know. IMPROVE registration: (a) make passkey OPTIONAL/skippable during onboarding —
    password login must be enough to finish; (b) clearer copy on what a passkey is + that she can use the phone's
    fingerprint/PIN (platform authenticator) instead of a Samsung account; (c) offer "not now" + let her add it later from
    Settings; (d) check `authenticatorSelection`/`residentKey` hints so Android offers the on-device passkey, not Samsung
    Pass. gymapp-only. Research WebAuthn UX on Samsung/Android first.
310. 🔨 **Onboarding is OVERWHELMING (wall of text, too much typing) — CHOSEN: Option C (coach opens the existing pages).**
    JM 2026-07-02 (watching wife onboard): "you ask too many questions + a wall of text… maybe the coach switches to a PAGE
    to let the user PICK the values, then comes back to chat — that chat flow is overwhelming." Picked C from the mock:
    "easier to maintain, not additional UX, we reuse what we have." BUILD: coach chats in-thread, hands off to the EXISTING
    page for each value (Profile: sport/sex/thresholds/body · Settings: equipment · Availability page), user sets it →
    "✓ Done, back to coach" → coach acks + advances → coach analyzes intervals FIRST + builds week. Client-driven scripted
    step order (NOT LLM-ordered) for reliability; coach LLM bookends (welcome + build). Absorbs #306(e-g) + #308 (sex is a
    visible step). Mock approved: mockups/onboarding-wizard.html?opt=C. gymapp-only.
309. 🔨 **An exercise STILL showed with no picture AND no video — hard rule violated.** JM 2026-07-02: "one exercise did
    not have picture or video, I was very clear not to use those." FIX: at RENDER, if an exercise resolves to no image AND
    no video (after female-variant + #300 backfill), never display it bare — drop it or swap to a matched media-having
    alternative same movement/muscle. Find the specific one (today's plan) + add a guard/test. Relates #300. gymapp-only.
308. 🔨 **Onboarding must VISIBLY capture/confirm biological SEX so the user trusts the plan is women-adjusted.** JM
    2026-07-02: "are we confident workouts are adjusted for women? I saw no sex input in onboarding — incomplete + not
    usable." STATUS (verified): machinery works — sex syncs from intervals → `coach-engine-female.md` (RED-S/fuelling/
    cycle-aware) injects when `user.sex==='female'`; xenia's sex IS female (i628280) so it DOES fire. GAP: it's invisible —
    nothing shows sex was captured or the plan is female-adjusted, and there's no manual set if intervals lacks it. FIX:
    surface sex as a confirmed step in the wizard (#310) + a visible "coaching adjusted for female physiology" signal +
    manual fallback. gymapp-only.
307. 🔨 **Setup checklist: equipment item links to /profile but equipment is set in Settings, + stays "not done" after
    setting it.** JM 2026-07-02 (wife). FIX: point the equipment item at the right place (Settings equipment) and read the
    same source it's saved to so it clears once set. Same for any other mis-targeted checklist item. gymapp-only.
306. 🔨 **Onboarding chat — wife's first real test surfaced blockers (CRITICAL for launch).** JM 2026-07-02:
    (a) **nav reset/lockout** — opened another screen (ADD) + back → Chat remounted, lost msgs, re-fired the opener → full
    onboarding RESET. FIX: persist chat msgs (sessionStorage) + only auto-kick with no prior msgs.
    (b) **send button unavailable / can't input** — `busy` got stuck (long/stalled coach stream, no timeout). FIX:
    AbortController timeout resets busy + shows an error; never lock permanently.
    (c) **"thinking for a long time, user couldn't know"** — obvious thinking indicator + "still working…" after a few s.
    (d) **voice stops too quickly** — SpeechRecognition wasn't continuous. FIX: continuous + interim results.
    (e) **too much typing → let her PRESS/select preferences** (quick-reply chips) instead of typing.
    (f) **analyze intervals FIRST before asking** (e.g. pace) — after Strava-in-intervals there's 3-month history.
    (g) **too many questions + wall of text** — ask few, be terse. (a-d client; e-g coach onboarding prompt.) gymapp-only.

305. 🧪 **Create the intervals custom fields for NEW users + TELL them.** JM 2026-07-02: important we create the fields AND
    inform the user. STATUS: creation handled (#288 on /auth/icu connect + onboarding-complete + feedback path, guarded).
    ADD: tell the user — `ensureIcuFields` now pushes a bell notification when it actually CREATES fields ("Added N private
    feedback fields to your intervals for coach analysis"). gymapp-only.
304. 🔨 **Sleep need (+ all learned stats): default→CONFIRM UX + learn from data over time + "X more days" mention.**
    JM 2026-07-02 (cramped "⚡ Unlock more…/Set your sleep need" gapcard). (a) UX — make clear there IS a default (8h) but
    the user should CONFIRM it; give it room. (b) LEARN over time — sleepNeed improves from data: correlate actual sleep vs
    recovery/HRV/load → suggest the real need (input 8h, data shows 9h esp. if training often + sleeping short); manual
    overrides. (c) TRANSPARENCY — for ANY learned value show "need ~X more days before the estimate is ready" while
    collecting; generalize to every auto/computed stat. Readiness engine + [[benchmarks-manual-vs-computed]]. Mock-first.

303. 🔨 **Profile → weekly AVAILABILITY page (hours per weekday).** JM 2026-07-02: input how many hours per weekday one
    can work out (Mon 1h, Tue 2h, …), make it nice. Feeds the coach's planning (respect availability when placing sessions).
    Store on the profile; coach reads it. Mock-first (nice weekly grid). gymapp-only.

302. 🔨 **Flag incomplete onboarding / minimal setup.** JM 2026-07-02: if onboarding is unfinished or config incomplete,
    flag it. MUST-HAVES: intervals.icu connected (account + key); Strava connected INSIDE intervals; coach set up
    (coachProfile); sport/FTP/equipment set. Show a setup checklist / banner with what's missing + how to fix. gymapp-only.

301. ⬜ **Bi-directional EXERCISE sync intervals ↔ Platyplus.** JM 2026-07-02: changes to an exercise in intervals should
    mirror to Platyplus, and coach/athlete changes in Platyplus should reflect in intervals — both ways. STATUS: rides now
    round-trip (segments, #293). Gym exercises live in the plan NOTES (markdown table) → text syncs both ways, but STRUCTURED
    gym fields (tempo/sets/reps as data) don't round-trip because intervals has no gym-exercise structure. Architecture
    decision needed (canonical structured store + reconcile). gymapp-only.
300. 🔨 **No-video exercises — remove from the library OR source free/open-source videos.** JM 2026-07-02. Library: 3102
    video · 1379 image-only (Centr .jpg) · 49 no-media. Matcher now PREFERS video (#296) so prescribed exercises resolve to
    video ~93%+. Options: (a) drop the 49 no-media + hide image-only from browse; (b) source video for image-only from OPEN/
    FREE libs (wger, free-exercise-db, exercisedb). JM prefers videos. Decision needed before deleting 1379 entries.
299. 🧪 **Auto-trigger coach review on activity completed + feedback — EXISTS, verify.** JM 2026-07-02. VERIFIED wired in
    code: `/auth/activity/:id/feedback` → `runCoachTask` (server.js:772-777) reviews the activity → `save_coach_review`
    (→ intervals Notes #290 + bell #233) + `set_activity_text` (#289). Gated on `coachProfile`. JM to verify end-to-end on prod.

298. 🧪 **Tag band exercises + make "Bands" a filter/equipment.** JM 2026-07-02: "identify and tag the ones with small
    band and make this available as a filter and equipment." FOUND: equipment "Bands" already exists (203 exercises) + the
    equipment filter is data-driven, so a Bands chip already showed — BUT ~25 band-ASSISTED moves (e.g. "Barbell Banded
    Squat", "Deadlift with Bands") were tagged by primary kit (Barbell/Dumbbell) so they were missed. FIXED: catalog.ts
    derives a `band` flag (equipment 'Bands' OR band in name) → 228 flagged; the "Bands" filter chip now matches the flag
    (catches band-assisted too); "Bands" always present in the equipment list. gymapp-only. **JM to verify on QA.**
297. 🧪 **Tempo chip (#284) not showing in dev.** JM 2026-07-02. VERIFIED in code: the tempo pill renders on the gym cards
    (CoachPlanDetail: `tempo {x.tempo}` on main-set reps; GymPlayer pre-start line shows `· tempo {ex.tempo}`), and
    `withDefaultTempo` defaults reps-mode exercises to `3-1-1-0` on save — so it always has a value. Likely an old build.
    JM to re-verify on prod. gymapp-only.
296. 🧪 **Some exercises still have no video — the free library should cover them.** JM 2026-07-02. Root: it was FUZZY
    NAME-matching (matchExercise), which misses when the authored name doesn't token-match. Confirmed the library is 99%
    media-covered — so the gap is matching, not missing clips. Fix: new `resolveDemo(exId, name)` prefers the catalog
    **exId** the coach sets (search_exercises always returns a real entry with media) and only falls back to name-match;
    CoachPlanDetail now uses it. Ties #332 (coach now sets exId per move). JM to verify on prod. gymapp-only.
295. 🧪 **Pre-workout GYM insights — show stats before starting.** JM 2026-07-02. VERIFIED implemented: GymPlayer pre-start
    (`!started && !done`) shows, per exercise, a **suggested working weight** (est 1RM × prescribed reps via weightForReps),
    **est 1RM**, and **last session's sets** — plus the demo thumb + tempo. JM to verify on prod. gymapp-only.
294. 🧪 **Lost the gym REORDERING page in dev.** JM 2026-07-02. VERIFIED present: GymPlayer pre-start renders the ↑/↓ reorder
    buttons per exercise; it shows for any FRESH gym session (only skipped when RESUMING saved mid-workout progress —
    correct). Likely an old build or a resumed session. JM to re-verify on prod. gymapp-only.
292. 🧪 **Power-curve chart missing the hover scrubber the timeline has — standardize.** JM 2026-07-02 (DEV): the timeline
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
288. 🧪 **New users won't have the custom feedback fields in intervals — create them on connect.** JM 2026-07-01:
    "a new user might not have the fields created (custom) so you'll have to create them in intervals in onboarding."
    Right — the 6 ACTIVITY_FIELDs (LegsBefore/LegsAfter/FuelGI/PainNiggles/LifeConstraint/MentalState) exist on JM's
    account but not a fresh one, so the 1-based values we write have nowhere to land. FIXED: `ensureIcuFields(user)` in
    server — GETs `/athlete/{id}/custom-item`, creates any missing field (POST custom-item, type select, options with
    1-based values matching icu-fields.ts), idempotent + best-effort. Called from `/auth/icu` whenever a key is set
    (covers onboarding connect + reconnect). gymapp-only. **JM to verify on a fresh QA account.**
287. 🧪 **Free-text comment doesn't sync to intervals (feel/RPE/fields do).** JM 2026-07-01 (QA): entered a comment on
    today's activity in Platyplus; the rest synced but the comment didn't appear in intervals. ROOT CAUSE: the comment
    isn't a field — it belongs in the intervals MESSAGE thread, and the write-back only PUT the custom fields. FIXED:
    `syncActivityNote(user, id, content)` POSTs the note to `/activity/{id}/messages` (deduped — skips if an identical
    comment already exists, so re-saving doesn't spam). Wired into `/auth/activity/:id/feedback`. Reads already surface it
    (#286 fetchActivityThread). gymapp-only. **JM to verify on QA.**
286. 🧪 **Monday post-workout round — bi-directional feedback + coach text + charts to standard (a #273 re-report).**
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
285. 🧪 **Gym COMPLETED view still the OLD form (PostWorkout /feedback/:id) — doesnt match #273 mock.** JM 2026-07-01
    ("not much like the mockups"). #273 rich view is on ActivityDetail (device rides/runs); coach-plan + GYM completions go
    through PostWorkout, which is the old feel/RPE form. Rework the completed-workout path (esp. gym) to the #273 mock:
    verdict + sets/PR + feedback collapse. Unify onto one component with ActivityDetail. gymapp-only.
    🔨 BUILT 2026-07-02 (mock `mockups/gym-completed.html`, approved): new shared `src/GymSummary.tsx` — coach verdict +
    hero/chips (Volume/Sets/Reps/Time + muscles + PR count) + computed coach insight + by-exercise sets/PR cards (est 1RM,
    volume bar, tap→/progress) + feedback. Used by BOTH the GymPlayer done screen (dropped the old inline totals/highlights)
    AND the revisit path PostWorkout `/feedback/:id` (loads the local log by `plan-<id>` + PR baseline + review) instead of the
    bare feel/RPE form. PR badge from bestE1rmByExercise. **JM to verify on QA.**

283. 🧪 **Remove direct Platyplus↔Strava connect (use intervals as the hub).** JM 2026-07-01: his wife hit Strava 403
    "limit of connected athletes exceeded" — Strava caps an API app at 1 athlete until reviewed, and it's redundant since
    intervals already aggregates Strava/Garmin/Coros/Wahoo. REMOVED: the "Connect with Strava" UI in AccountSection + the
    coach's Platyplus-Strava guidance; onboarding + APP_HELP now say connect Strava/device INSIDE intervals.icu. KEPT:
    "view on Strava ↗" activity deep-links (via strava_id intervals fills in). `/auth/strava/*` + server/strava.js left
    dormant (gated) — removable later. Updated memory (platyplus-integrations, MEMORY index) + skill (platyplus-ops). gymapp-only.

282. ⬜ **(POST-LAUNCH) i18n — French & English, switchable in Settings.** JM 2026-07-01: after launch, support FR + EN
    with a language toggle in preferences/settings (default to device locale). Externalize UI strings (a lightweight i18n
    layer / string catalog), translate app copy + coach-facing labels; the COACH itself can already reply in the user's
    language via the prompt. Sizeable (touches most components) — do it as one pass post-launch. gymapp-only.

281. 🧪 **Login by EMAIL (not just username).** JM 2026-07-01: allow email as the credential. Client already offered
    "Username or email"; server `findByLogin` compared the raw stored email so it broke on any uppercase. FIXED: normalize
    both sides to lowercase (+ trim). Email or username both work now. gymapp-only.

280. 🧪 **PRE-workout UX rework — KEEP THE SAME SPIRIT as the post-workout view (#286).** JM 2026-07-01: "let's keep the
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
279. 🧪 **Missing-data handling: graceful degrade + "unlock" nudge + label estimates (don't fabricate).** JM 2026-07-01
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
277. 🧪 **Manual/Computed flow: add AUTO (computed-when-ready, manual until then).** JM 2026-06-30: when computed isn't
    ready he has to remember to switch to computed later — wants to "select computed but use manual until we learn enough."
    BUILT: statPrefs gains `auto` (now the DEFAULT). Benchmarks sheet = 3-way Manual / Auto / Computed with a hint
    explaining auto; the tag shows "auto · computed" or "auto · manual" so it's clear what's driving. Resolution: auto/
    computed prefer the computed value when available, fall back to manual. Server buildSystemPrompt honours auto too
    (`wantsComputed` helper) so the coach uses the estimate once ready. gymapp-only.
276. 🧪 **Workout power shows % on dev but WATTS on QA — JM wants WATTS.** JM 2026-06-30: same workout rendered % of FTP on
    dev, watts on QA — `SegmentProfile` shows watts only when an `ftp` prop is passed, and the detail pages sourced it from
    the local `getSetting('ftp')` which the dev test user lacked. FIXED: PlanDetail + CoachPlanDetail now resolve
    `ftp = plan.ftp || localFtp || user.ftp || 200`, so the chart always renders watts (real FTP when known, 200 W
    fallback otherwise). gymapp-only.
275. 🧪 **Running "Threshold" stat cell was EMPTY + not editable there.** JM 2026-06-30: the Threshold MiniCard on the
    Running stats page was hardcoded `null` (showed "—") though a threshold pace exists, and he wanted to edit it there,
    not only in Profile. FIXED: RunningStats Threshold cell now shows the pace and is tap-to-edit inline (parses m:ss,
    saves via saveSportStat → syncs to intervals + updates VDOT). (Also confirms #269 VO₂max fix: now reads 50.5 from HR,
    not 43.9.) gymapp-only.
274. 🧪 **"Why a beaver?" — onboarding used 🦫 (beaver) but the brand is Platyplus (platypus).** JM 2026-06-30. Today card
    was fixed earlier; NOW the remaining 3 (OnboardReturnBar bar, Chat onboarding avatar + "Build my first week" button)
    also use the real Platyplus logo (favicon.svg), no beaver anywhere. `grep 🦫 src/` = 0. JM to verify on prod. gymapp-only.
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
272. 🧪 **Onboarding chat ERRORED: "No conversation found with session ID …".** JM 2026-06-30 (dev test of #257): tapping
    Set me up → coach chat died with a stale-session error. ROOT CAUSE: `/auth/chat` blindly passed `--resume
    <user.chatSession>`, but claude's local session store had been cleared (restart/deploy) → resume hard-fails. FIXED:
    dev path now retries ONCE with a fresh thread when resume fails ("no conversation found"); QA/prod helper path clears
    the stale id + asks the user to resend. So onboarding (and any chat) self-heals instead of dying. gymapp-only.
271. 🧪 **Running threshold suggestion: ASSESS confidence before suggesting (don't push a slower pace off thin data).**
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
269. 🧪 **VO₂max too LOW / wrong again (Profile + per-sport).** JM 2026-06-30: Profile showed VO₂max 43.9 = ONLY the
    cycling Coggan (10.8·FTP/wt+7 = 10.8·260/76+7) and ignored the HR-ratio method we built in #234 → under-rated. ROOT
    CAUSE: Profile used the old `estimateVo2max` (Coggan + VDOT only), not `headlineVo2max` (#234, incl. HR-ratio
    15.3·HRmax/HRrest, ranked by confidence). FIXED: Profile now fetches resting HR from wellness + uses
    `headlineVo2max([running, cycling])` with per-sport max HR; running (medium conf, incl. HR-ratio) beats the low-conf
    cycling Coggan, so a high HRmax/HRrest reads a believable higher value. Copy shows source + confidence; manual wins.
    Tests: vo2max-submax (12) still green. Manual test: Profile VO₂max ≈ HR-ratio value, not 43.9. gymapp-only.
268. ✅ **DONE (shipped prod, JM verified 2026-07-14) — basics are TWO-WAY synced.** height/DOB/sex read from intervals (fill-if-empty) AND written back on Profile edit (`athleteBasicsPatch` → `PUT /athlete/{id}`, PROD-only `!IS_STAGING`; city write-back also guarded). +8 unit tests. See #1003/#459 + CLAUDE.md "Change how profile BASICS sync". Original: **Two-way sync the intervals Basic Settings profile fields (don't re-enter them).** JM 2026-06-30 (screenshot of
    intervals → Settings → Basic Settings): instead of capturing profile data manually, **bi-directionally sync** the
    canonical fields from intervals.icu: **Sex, Weight, Height, Date of Birth (→ age), Resting HR** (+ units already there).
    intervals is the hub (architecture) — extend the athlete PULL (`/auth/intervals/athlete`, `fromIcuSportSettings` /
    the `/athlete/{id}` payload has `sex`, `height`, `weight`, `icu_resting_hr`, `date_of_birth`) to also read these into
    the Platyplus profile, and WRITE BACK on edit (mirror #210 ftp/maxHr two-way). This FEEDS #265 (BMR/TDEE/protein need
    sex+height+age+weight) — so #265's inputs come from intervals, edited in either place. Manual fallback for the few
    fields intervals lacks. gymapp-only. Pairs #265 + #257 (onboarding).
267. 🧪 **Intervals sync doesn't REMOVE upstream-deleted activities.** JM confirmed: the session was CREATED in
    intervals then DELETED there, but stayed in Platyplus → a device/intervals activity served from cache (the live fetch
    shouldn't return a deleted one). FIXED: intervals proxy now sends `Cache-Control: no-store` + client `fetchActivities`
    uses `cache:'no-store'`, so a deleted-upstream activity can't be served stale. Manual test: delete an activity in
    intervals → reopen History → it's gone. JM 2026-06-30 (QA): deleted/removed a session in
    intervals yesterday, ran an intervals sync in Platyplus, but the stale session still shows — deletions aren't
    reflected. Our sync likely only UPSERTS fetched activities and never prunes ones that vanished from intervals (or
    History merges a cached copy). FIX: on activity sync, reconcile = anything previously synced from intervals that's no
    longer in the fetched window should be removed/hidden (mirror the plan reconcile #150/#185, but for ACTIVITIES). Check
    where History merges intervals activities (`platyplus-activity-flow`) + any local cache. gymapp-only.
266. 🧪 **Passkey button does NOTHING on desktop (prod).** JM 2026-06-30: a fresh desktop has NO passkey, so the
    SIGN-IN button can't do anything useful + the only feedback was a tiny error line → "nothing happens". JM chose:
    A (suggest add after login) + C (clear error if you try passkey login with none). BUILT: (A) `PasskeyPrompt` modal —
    one-time, dismissible, shows after sign-in when WebAuthn is supported AND the account has 0 passkeys on this device →
    "Add a passkey" (registers via the existing authed flow). (C) Login passkey failure now shows a clear guide
    ("No passkey on this device yet — sign in with your password, then we'll offer to set one up.") instead of dying
    silently. Registration still also available in Settings → Passkeys. Manual test: fresh browser → password login →
    modal appears → Add → next sign-in uses Touch ID. gymapp-only.
265. 🧪 **Eat/Fuel: capture sex + compute BMR/TDEE & protein needs.** JM 2026-06-30. The math (`nutrition.ts`, 14 tests) was
    built but UNWIRED. Now wired: Profile → **FuelFields** captures the missing inputs (height + birth date; sex from
    About-you, weight from intervals) + a fuel-goal picker (lose/maintain/gain), and shows the athlete their **daily
    targets** (calories + protein/fat/carbs + BMR/TDEE). Weight is stashed server-side from wellness; **buildSystemPrompt
    injects the same fuel targets** so the coach picks meals/portions that hit the calorie + protein goal. Self-validated
    render. On QA. FOLLOW-UP: the full Eat "targets vs intake" tracking view + intervals daily-calories for a truer TDEE.
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
261. 🧪 **Admin: click a user → see + SET a specific password.** JM 2026-06-30: as admin, click a user to expand and set a
    chosen password (not just the random reset). BUILT: `POST /auth/users/:id/password` (admin, bcrypt, min 6) +
    `authApi.setUserPassword` + Admin.tsx expandable row (Set password / Random reset / delete). gymapp-only.
260. 🧪 **Admin: "No users loaded (sign in as an admin)" shown during load (misleading).** JM 2026-06-30: the empty-state
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
257. 🧪 **Onboarding flow for a new user → conversational, coach-led, generates first week.** JM 2026-06-30: chosen design —
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
255. 🧪 **Per-exercise INSIGHTS for gym.** 🔨 BUILT 2026-07-02: pure `exerciseInsight(pts, fmt)` in strength.ts →
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
238. ⬜ **Bottom nav bar sometimes disappears.** JM 2026-06-30. INVESTIGATED: `.tab-bar` is `position:fixed;bottom:0`
    (no scroll-hide), so it's the INTENTIONAL `isDetail` route-hiding in App.tsx — the nav (+ top bar + Coach FAB) is
    hidden on immersive pages: players (`/play`, ride/run-player), detail pages (`/{workouts|exercises|programs|recipes|
    trainers|mind|cycle|plan}/:id`), `/chat`, `/build`, `/admin`. That's by design; changing it risks breaking those.
    NEEDS A REPRO to fix safely: JM — which exact page/screen loses the bar when you DON'T expect it? (Also possible: iOS
    keyboard shrinking the visual viewport.) gymapp-only.
237. 🧪 **VDOT (from threshold pace) contradicts HR-ratio VO₂max → flag stale pace.** JM 2026-06-30 (QA). The ⚠️ stale-pace
    flag shipped; the reconcile path now exists too: the **#215** estimate-from-runs (`runEstimate`/Critical Speed) is a
    Computed threshold pace in the Manual/Auto/Computed picker (#236/#337b) → Auto/Computed drives VDOT/zones/predictions
    from real runs, and #327 flags the VO₂max low-confidence when VDOT vs HR-ratio diverge. JM to verify on prod. gymapp-only.
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
232. 🧪 **Activity + changes/audit log for investigation.** JM 2026-06-30 → mocked A/B/C, JM picked **A (feed)**, "mobile-
    first, in Settings" 2026-07-04. Done: an append-only per-user `audit` store (capped 500) with an `audit(user, {actor,
    action, target, detail, kind})` helper captured at the mutation points — plan Created/Updated/Removed (actor **you** via
    /auth/plans vs **coach** via /api/plan), **sync** import/remove (reconcile), **check-in**, **feedback**, coach **review**,
    coach **notify**. `GET /auth/audit` (recent-first, capped). Client: **AuditLog** page (day-grouped feed, time · icon ·
    actor chip · action · target · detail; mobile-first vertical list) at `/activity-log`, linked from **Settings → Data**.
    openapi updated. Self-validated render vs mock A. On QA. gymapp-only.
231. ⬜ **Benchmark clarity: eFTP vs FTP + VO₂max reads low vs Coros.** JM 2026-06-30: "FTP intervals but don't see
    eFTP? confusing. VO₂max so low — Coros much higher." The card shows the SET FTP (synced); eFTP (estimated) is only a
    trend on the Cycling page. VO₂max = Coggan `10.8·FTP÷weight+7` ≈ 44, conservative vs Coros's HR-based model. SHIPPED:
    a clarifying note + VO₂max is tap-to-edit (enter your watch's value → "you"). TODO: prefer a REAL device VO₂max if
    intervals carries one (investigate icu fields); consider showing eFTP alongside set-FTP. NOTE: JM's **Léger-Boucher
    test ≈ 52** (a direct maximal running test) — that's the true value, far better than our 43.9 cycling proxy; he should
    set it manually (and it confirms the cycling W/kg estimate reads low for runners). gymapp-only.
230. ✅ **Chart standard — retrofit all axis-less graphs (codified in skill `platyplus-charts` + memory).** JM 2026-06-30:
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

228. 🧪 **Profile vs Stats streamline — global athlete data buried in Profile; global belongs at TOP of Stats.** JM
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
208. 🧪 **Freshness recalibration — less conservative (DONE).** JM 2026-06-29: Form −1 reading 3/5 is too conservative
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
205. 🧪 **WeekStrip: select edge date on week change + "Today" shows whenever off-today.** JM 2026-06-29: changing
    week should move the selection — **next week → that week's Monday (first)**, **prev week → its Sunday (last)** — so
    it scrolls continuously; and the **Today** button should appear as soon as the selected date isn't today (even
    within this week), not only on a different week. BUILT (`src/ui.tsx`): `goWeek(delta)` sets the offset + selects the
    edge date; `away = offset!==0 || selected!==today` shows Today. tsc clean.
204. 🧪 **Override indicator in the check-in (keep the auto trace).** JM 2026-06-28: after editing a score the "· auto"
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
202. 🧪 **Today/home redesign — "your day" as a flexible typed-block stack (DESIGN LOCKED 2026-06-28, option C2).** JM
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
201. 🧪 **Score explanations: definition under the label, per-day WHY in the ⓘ.** JM 2026-06-28: the line under each
    score is the *definition*; the **ⓘ should explain WHY this day's score** is what it is. Now: dim one-liner under
    each row = definition (Energy "How ready your body is to train right now", Sleep "How well last night recovered
    you", Freshness "How recovered you are from training load"); the **ⓘ = the day's actual inputs** ("Why today: HRV
    +0.4σ vs your baseline, sleep 4/5, resting HR −0.2σ" / "Form 8, acute-vs-chronic 0.7") + the 1–5 scale — computed
    from the wellness data whether or not the row is answered, with a clear "no HRV/sleep synced yet" fallback. "· auto"
    shows only while the value still equals the data-derived one.
200. 🧪 **"Can't log in after a deploy" — PWA stale-bundle, FIXED once-and-for-all.** JM: dev/QA often won't let him log
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
197. 🧪 **Friday shows "2 completed workouts" incl. a phantom "Ride to Skov" (prod).** JM (2026-06-27) did ONE ride
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
157. 🧪 **The workout TEXT Platyplus pushes to intervals reads unlike a real planned workout.** JM 2026-06-26. Mocked
    current-vs-proposed (mockups/intervals-text.html); JM picked **A · native sections + brief below**. Done:
    `nativeWorkoutText(segs, isRun)` (icu-steps.js) renders **Warmup / Nx repeats / Cooldown** blocks instead of a flat
    "## Workout" list (peels labelled warm-up/cool-down + a leading ramp; `detectRepeat` collapses periodic work into an
    "Nx" block), and `shortCoachNote` trims the brief to Objective/Fuel/Cues below a divider + a link (full plan/meals/mind
    stay in Platyplus). Rides keep `workout_doc` (chart authority); runs parse the text — **round-trip VERIFIED on a real
    intervals run**: "2x" + "% pace" → 4 steps, pace targets [77,111,75,75]. 4 new unit tests (312 total). JM to verify on
    prod (open a pushed ride/run in intervals — reads native; chart still renders). gymapp-only.
156. 🧪 **Missed-workout UX.** JM 2026-06-26 → refined 2026-07-03. Mocked 3 options (mockups/missed-workout.html); JM picked
    **C, refined**: DON'T leave a red "Missed" card on the calendar — instead the coach reshapes the week, REMOVES the missed
    workout, and the NOTIFICATION carries the coach's own explanation. Done: `POST /auth/plans/handle-missed` detects a plan
    1–3 days past with no completion (local log by workoutId + intervals activity by day+sport), dedups via
    `plan.missedHandledAt` (stale >3d marked silently), and fires ONE coach task → reshape (move/drop) + `remove_workout`
    each missed + `notify` with what changed & why. Today calls it on load (server dedups). openapi updated. 308 tests.
    **Test (on prod):** have a planned session go 1 day past without completing it, open the app → within ~1 min the missed
    workout disappears from the calendar and a bell notification explains what the coach moved/dropped. gymapp-only.
155. 🧪 **Detail page must branch on session STATE + unify the "use your phone" messaging.** JM 2026-06-26 → chose "open
    the results page" 2026-07-03. Diagnosis: desktop-no-Play was ALREADY handled (`canPlayHere` shows the inline hint, not
    a Play button); the bug was a DONE workout showing "✓ Completed" AND the full plan + Play (a mix). Done: a completed
    plan now REDIRECTS to its results — ride/run → `/activity/:id` (analysis), gym → `/feedback/:id` (session summary);
    a past plan shows a brief loader until we know (no plan-flash); the inline completed block is removed (superseded).
    Copy unified — the inline phone hint now matches the full-page gate's sensor wording. So: planned/missed → plan; done →
    results. 308 tests. **Test (prod):** open a COMPLETED ride/run → lands on the analysis, not the plan; a completed gym →
    its summary; an upcoming plan → the plan + (mobile) Play / (desktop) phone hint. gymapp-only.
154. ⬜ **R4 feedback fields may not be mobile-friendly — chips, consider a dropdown.** The post-workout fields render
    as chip rows; with 6 fields × 6-8 options that's a lot of chips on a phone. JM: "not sure this is mobile friendly
    (dropdown?)". Evaluate chips vs a compact native `<select>` per field on mobile. JM 2026-06-26.
153. 🧪 **BUG: Today week strip shows the WRONG "today" (23 highlighted on June 26).** JM 2026-06-26. Root confirmed: a PWA
    left open across midnight captured `todayISO()` in `selDay` at mount and never re-anchored. FIXED: Today now re-anchors
    on `visibilitychange`/`focus` — when the date has rolled over it moves `selDay` to the new today (ONLY if the user was
    still viewing the old today, so a manually-picked day isn't clobbered) and reloads the week window. Self-heals without a
    hard refresh. JM to verify (leave the PWA open overnight, or verify a hard-refresh still shows the right day). gymapp-only.
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
149. ❌ CUT (JM 2026-07-03) — **Strava: confirm completed activities actually reach Strava.** JM's "morning run" was in intervals
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
145. 🧪 **REOPENED AGAIN #139 (JM 2026-07-11, prod screenshot) — "Ride now" still shows on desktop.** Root cause this
    time: the button IS gated (`canPlayHere` on CoachPlanDetail + PlanDetail), but `isMobileDevice()` returned TRUE on
    JM's Mac because of the `innerWidth < 820` clause — a NARROW DESKTOP WINDOW was treated as mobile. FIX: dropped that
    clause (real phones/tablets report `pointer:coarse`; a Mac desktop has a fine pointer + 0 touch points), gated the one
    remaining ungated launcher (CycleDetail), and pointed RidePlayer/RunPlayer at the shared `isMobileDevice()` (killed
    their inline `<820` copies). Gym "Start workout" stays open (gym works on desktop). Test flipped: narrow desktop ≠
    mobile. 🧪 **JM test (prod, after promote):** open a coach ride/template on desktop (even a narrow window) → NO "Ride
    now", shows "Open on your phone"; on your phone it still shows. Was 🧪 REOPENED #139 (JM 2026-06-26).
144. 🧪 **In-app Promote button → GitHub 403 — FIXED IN CODE.** The button POSTed a workflow_dispatch,
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
61. ❌ CUT (JM 2026-07-03) — **(ref) Xert-style weekly ride calendar** — inspiration for a richer Plan view (per-day score badge, mini map, power profile, weekly-stats bar).
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
122. 🧪 **BUILD #3 — indoor ride: capture stream + upload.** [BUILT, QA-verify] RidePlayer currently logs `duration` only + no push. Build: record per-second power/HR/cadence during the ride → on finish encode a FIT/activity → **upload to intervals when connected** (Strava optional), ALWAYS keep the Platyplus copy. Match-first (skip upload if a device already recorded it). (Replaces the false "indoor→FIT→Strava already works".)
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
163. ❌ CUT (JM 2026-07-03) — **intervals.icu "Connect" button (OAuth).** Needs OAuth creds **requested from the intervals dev** (not
    self-serve). Until then, the key-paste flow (friendlier UX, shipped) stands. For public launch. (source: UX-BACKLOG.)
164. ⬜ **Profile vs Settings split + section nav.** Profile = the person (avatar, name, account, passkeys,
    connections like Strava/intervals). Separate **Settings** page for small config (API tokens, units, diet,
    video stills, equipment list, etc.). Add a table-of-contents / section nav so Profile isn't one long scroll.
    Decide the split (judgement call). Design detail in 🎨 Design reference. (source: UX-BACKLOG "Profile vs Settings".)
165. ⬜ **Admin page — split out of Profile (admin-only).** "Admin · Users" becomes its own admin-only page. Keep
    it SIMPLE + admin-focused (no workout features). Mobile-first: user cards, role badges, "+Add user" sheet,
    per-user actions sheet (reset / change role / remove) with confirmations. Coach API token stays in Profile.
    (source: UX-BACKLOG Session-2.)
166. 🧪 **Calendar density + polish (centerpiece).** Big, modern, close to Google Calendar: Day/Week/Month/
    Schedule views; clean event blocks; today highlighted. Everything (workouts, rides, runs, meals, mind) is an
    event on a day. The current calendar still feels empty/sparse — needs density + polish. (source: UX-BACKLOG Calendar.)
    **Reviewed tab-by-tab with JM (mockups/calendar-tabs.html, Now vs Proposed).** JM verdict 2026-07-04: build Day/Week/Schedule,
    **keep Month as-is** (JM: "now is better" — the denser event-bar grid had uneven column widths, "stupid and ugly";
    root was `1fr` tracks stretching to nowrap bar text — a real bug, but he prefers the current grid+detail either way).
    Built: (a) **Day** — week scrubber strip (tap to hop days, per-day dots, today green) + Today badge on the count row;
    (b) **Week** — compact day-rows (name · count, today tinted), rest days collapse to one line → whole week fits;
    (c) **Schedule** — date-rail timeline (big day number, today badge, border-left column) + month separators.
    Files: `src/pages/Calendar.tsx` (WeekScrubber, week/schedule rewrites), `src/styles.css` (.cal-scrub/.cal-week/.cal-agenda). 313 tests. **On QA + prod.**
167. 🧪 **Gym player refinements (live workout screen).** [VERIFIED built — gym player already has add-set (＋ set) + pre-start reorder/insights; verify skip-set on prod] Pre-workout **time estimate** (total + per-exercise,
    reps × time-under-tension); **reorder exercises before starting**; **add-set / skip-set** in player + full
    set TABLE (JetFit-style); **history back-nav** returns to your position (today dumps to exercise 1); a
    **dedicated swipe gesture** to change exercise (currently arrows + dots). (source: UX-BACKLOG Session-4 gym player.)
168. 🧪 **Coach generation quality.** Generated workouts have **no warm-up / cool-down**; should **group similar
    exercises by equipment** so you don't move around (e.g. dumbbell+bench together) when it doesn't compromise
    the goal; **Pallof press should be represented both sides**. (cyclingcoach / via MCP.) (source: UX-BACKLOG.)
    **Diagnosis:** the coach-engine.md (l.339-348) AND the create_workout tool ALREADY require all three — but nothing
    enforced it (`upsertPlan` only defaulted tempo), so it drifted. **JM pick 2026-07-04: REJECT & retry** (not silent
    auto-fix) — "will the coach learn? he must be instructed to create the right things." Built a HARD gate in the COACH
    path only (`mcp/gym-guard.js` `validateGymWorkout` → `create_workout` throws the rejection): rejects a gym plan with no
    warm-up, no cool-down, or an unmarked single-side move — with an actionable message so the coach re-authors THAT turn.
    New `eachSide` field (schema + `plan.ts` + AdHocEx) renders "each side" in CoachPlanDetail + GymPlayer. Sharpened the
    tool description + coach-engine.md (notes the gate). Equipment-grouping stays strong INSTRUCTION (goal-dependent, JM's
    "when it doesn't compromise the goal" — not hard-rejected). NOT applied to the UI quick-add (a person adding one lift
    isn't blocked). 8 guard unit tests (`src/gym-guard.test.ts`), 321 total. **✅ SYNCED to the coach host** — rsynced
    `mcp/server.js` + `mcp/gym-guard.js` to `xps:/home/jmf/platyplus-chat/mcp/` (node --check OK, chowned jmf), which
    ALSO un-stuck the ~1-week-stale host MCP (brought #313/#341/#343/#332 tools live to the coach — see #350). MCP spawns
    per chat so it's live now on QA + prod. coach-engine.md ships in the container image (QA now, prod on promote). **On QA + prod (guard); coach-engine.md prod on promote.**
169. ⬜ **Eat: meal packs + shopping-list generator.** Eat list is built; REMAINING: **meal packs** (pre-packaged
    breakfast/lunch/snack "packs" that roll up kcal + protein — JM specifically likes this); **shopping-list
    generator** for selected days / a full week (consolidate from assigned meals + snacks). (source: UX-BACKLOG Eat.)
170. 🧪 **Train filters & sorting + equipment list.** [VERIFIED built — both list pages already filter by equipment/category/muscle + duration/level (intensity) + sort; done] Filter + sort **Workouts AND Exercises** by **equipment**,
    **time/duration**, **intensity**. Powered by a **Settings → equipment list** (what the user owns). (source:
    UX-BACKLOG 2026-06-23 session.)
171. ⬜ **Check-in history: collapse-when-done + Logs list.** Once all 3 (energy/sleep/freshness) are logged,
    collapse the Today check-in card to a one-line summary; full history in Logs. (source: UX-BACKLOG check-in.)
172. ⬜ **Remove the "(indoor)" tag shown on rides.** Small label cleanup. (source: UX-BACKLOG ride/strava session-3.)
173. ❌ CUT (JM 2026-07-03) — **BYO Strava (multi-provider activity source).** A user may not use intervals.icu at all — let them link
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

## 2026-07-17 — JM feedback batch (swim/tri + benchmarks + activity view)
### #560 — BIDIRECTIONAL benchmark sync (intervals ↔ Platyplus), all 3 sports 🧪 (built, to test)
Ask: "change a value in intervals → syncs to Platyplus, change in Platyplus → syncs to intervals. CRITICAL. running,
swimming, cycling. If you change the value after computed, it needs to be in intervals!! Platyplus = extension of
intervals (analytics), Platyplus = planning/execution." → intervals is the SYSTEM OF RECORD. PROD: push-on-edit +
intervals-wins pull = true two-way. QA shares athlete i28814 (can't write) → QA is a LOCAL SANDBOX (staging=ours-wins).
Consistent rule for all 3 sports. ⚠️ true bidirectional is PROD-only unless we give QA its own intervals athlete.
### #561 — "Curve" chip is unclear + inconsistent 🧪 (→ "Best-efforts")
"what does curve mean in running and cycling? lol" — the method chips (Curve / eFTP / VDOT / Race VDOT / CP model) are
jargon and inconsistent across sports. Make them plain + consistent.
### #562 — Make cycling/running pending copy as EXPLICIT as swimming ⬜
"swimming seems to be more explicit now than the 2 others" — bring cycling/running "add efforts to firm up" up to the
swim cards' explicit "needs a few hard efforts across distances" clarity. Consistency.
### #563 — Coach must KNOW + adapt when a benchmark changes (manual or from intervals) ⬜
"when manual change from intervals, how coach will know and adapt notifications?" — a benchmark change should trigger
coach awareness → re-plan / a notification acknowledging the new value.
### #564 — Add / delete a planned workout attached to a COMPLETED activity (synced to intervals) ⬜
"add, delete planned workout to a complete one in Platyplus (be sure works with intervals.icu)."
### #565 — BUG: "missing feedback" flags activities that HAVE feedback + were coach-reviewed ⬜
"Missing feedback (old ones, not showing activity details). Some flagged as missing but feedback is there and coach
reviewed." Fix the missing-feedback detection + old activities not showing details.
### #566 — Remove the map & flyby link 🧪
"remove map & flyby link" (activity detail Map/Flyby tab).
### #567 — Show BOTH avg power + NP on the card AND the detail ⬜
"cycling card shows avg power 160, open activity NP shows 164, but we don't see both on both levels." Show avg + NP
consistently on card + detail.
### #568 — BUG: warm-up power HIGHER than the endurance block ⬜
"warm-up higher than the endurance block??? Workout of July 17 in prod." Planned power-by-zone maps warm-up > endurance.
### #569 — Planned view from a completed activity: hide "Done?" + phone banner 🧪
"When an activity is done you see the attached planned workout; clicking it we should NOT see (Done?) nor 'Open
Platyplus on your phone to run'." (forcePlanned mode in CoachPlanDetail.)
### #570 — Thin TRIATHLON orchestration layer (leverages the 3 engines) 🧪 (built, to test)
"yes to a thin orchestration layer that leverages the three, do that." Limiter analysis (CSS/FTP/threshold vs race
demands) + combined multi-sport load view + race pacing. NOT a 4th benchmark engine — synthesis on top of the 3.
