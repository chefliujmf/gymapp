# Platyplus — Feedback & Ideas Log (numbered, ordered)

**This is the master queue.** Every feedback/idea JM gives gets a **number**, appended at the END
when received (its OWN entry — never merged). Build the OPEN queue **top-to-bottom, to the T**,
unless JM explicitly reprioritizes. Status: ✅ done · 🔨 building · ⬜ todo. Design detail for big
items → `UX-BACKLOG.md`. (Edit this file with Write/sed — NOT `perl -0pi`, which mangles the UTF-8.)

> **INTAKE PROTOCOL (agreed 2026-06-23) — fire-and-log.** JM dumps feedback freely, anytime, even
> mid-build. On EACH item: (1) immediately append it here with a number + a one-line ack, (2) do
> **NOT** stop the current build — keep working the queue in numbered order; implement the new item
> when it comes up — UNLESS JM tags it URGENT/now. The log is the durable store, so nothing is lost
> across context/sessions. Never make JM ask "are you logging this?" — logging is automatic & visible.

> **👉 YOU ARE HERE:** the coach feature (P1 + plan view), the whole equipment chain, and the
> post-workout flow are BUILT + on QA. OPEN: #18 P1-verify (pairs w/ live coach) · #23 (pairs w/
> coach) · #28 (week arrows) · #26 follow-ons (activity stats + intervals mirror). Next: #28 done. Open builds: #26 follow-ons (stats+mirror). Else pairs-with-coach (#18 verify, #23).

---

## ✅ Done — record

1. ✅ Pending prod ops — deleted duplicate icu plans + imported coach profile.
2. ✅ One-click prod promotion (`promote-prod.yml` + `PROMOTE_TOKEN`, tested).
3. ✅ Secrets = GitHub Secrets master, injected at deploy (`AUTH_ENV_*` + force-recreate). QA+prod.
4. ✅ Remove all local secrets (`.secrets/` deleted).
5. ✅ Check-in → compact 1–5, always-visible, Soreness→Freshness, emoji faces.
6. ✅ Fix ⓘ popover clipped by `.card` overflow.
7. ✅ Fix black plan-card title (`.card-body h3` color).
8. ✅ "Always research best practice first" — skill rule.
9. ✅ "Options + mockups before building" — `options-first` skill + memory.
10. ✅ intervals planned-workouts investigation (re-push then reverted — cyclingcoach owns intervals for now).
11. ✅ Coach P1a — plan structured fields + item `why`.
12. ✅ cyclingcoach `AGENTS.md` + `platyplus-coach-engine` memory updated.
13. ✅ Coach plan-authoring design logged in `UX-BACKLOG.md`.
14. ✅ Coach P1b — intervals mirror (brief + meal/mind refs) + split long steps + `time_target`.
15. ✅ Coach P1c — CoachPlanDetail UI (shell + sport body + grid meal chips + bottom-sheet why).
16. ✅ Coach P1d — recipe/session "Coach's pick" banner.
17. ✅ Coach P1e — MCP `search_recipes`/`search_sessions` + structured fields on create_*/schedule_*.
18. 🔨 Coach P1f — instructions DONE (cyclingcoach). REMAINING: native-text mirror parity · host-MCP re-sync · `publish_platyplus_plan.py` CLI mapping · QA verify WITH the live coach.
19. ✅ Check-in history (collapse-when-done on Today + list in Logs).
20. ✅ Train filters + sort — Workouts AND Exercises, by equipment (owned) · time · **level** · sort.
21. ✅ Settings → equipment list (owned, on profile).
22. ✅ Train back-arrow — resolved: root tab, no back by design (add only if JM wants).
23. ⬜ intervals indoor-completion labeling — confirm indoor-done reaches intervals labeled (pairs w/ coach + a real completion).
24. ✅ Skill: mockups in HTML, not ASCII.
25. ✅ Mirror must split long workout steps (folded into P1b).
26. ✅ Post-workout flow BUILT — `/feedback/:id`: coach notes + sport-dependent feedback + Save (stored on plan; coach reads it). FOLLOW-ON DONE: post-workout view now shows the completed-activity STATS (DoneStats). Remaining: intervals private-feedback MIRROR (backend, deprioritized).
27. ✅ Post-workout SPORT-DEPENDENT BUILT — ride/run legs/fuel/niggles · gym how-heavy/soreness/form.
28. ✅ **Week-strip prev/next arrows** — WeekStrip has ‹ This week › nav (offset state) + Today reset; Today fetch window widened to ~10 weeks so navigated weeks have data.
29. ✅ Post-workout tweaks BUILT — Save-only button (intervals push is backend); intervals "Feel" faces (Strong/Good/Normal/Poor/Weak).
30. ✅ Process: proactively update skills when logic changes (`keep-skills-current` memory).
31. ✅ Tag exercises with equipment — name + no-kit-category inference, 46%→91% (build-catalog).
32. ✅ Coach equipment-aware — `search_exercises` equipment filter + owned gear in the coach prompt.
33. ✅ Equipment 100% — reasoned classification for the residual (JM approved; marked not-source-truth).
34. ✅ Check-in collapse fixes — "Done" button to re-collapse + removed duplicate History.
35. ✅ **Host-MCP re-sync** (P1f solo part) — push repo `mcp/server.js` to the box `/home/jmf/platyplus-chat/mcp/server.js` + restart helpers so the LIVE coach gets search_recipes/search_sessions + equipment filter + structured fields.
36. ✅ **Native-text mirror parity** — Platyplus→intervals push now emits "## Workout" native text (- 10m 50-62%) alongside workout_doc. (Render parity verifies live under #18 — Platyplus push not active yet; coach pushes directly for now.)
37. ✅ **Dedup planned workout shown twice** — Today + Calendar now hide a Platyplus plan/event duplicate matched by day+sport+title (not just id-link), so an unlinked same workout (e.g. coach pushed straight to intervals + a Platyplus plan) shows ONCE.
38. ✅ **Make a DONE workout more obvious** — done cards get a green left bar + tinted border (.card--done) on Today (CoachPlanCard + PlanCard).
39. 🔨 **Coach-activity notifications** — when the coach does something (creates/adjusts the plan, reviews a workout), post a NOTIFICATION with a short note of what it did (e.g. "Tadej updated your plan: reviewed Monday, added a rest day…"). Needs: an MCP tool for the coach to post + storage + a bell/feed UI for the user.
40. ⬜ **Dietary preference governs ALL meals** — if the athlete is vegetarian, every coach-picked/suggested meal must be vegetarian; if vegan, all vegan; otherwise no restriction ("all"). Needs: a diet setting on the profile + coach prompt constraint + recipe search/filter honoring it. (Diet UI already exists in Settings → Preferences — see #42.)
41. ⬜ **No horizontal scroll, ever (mobile)** — the Settings equipment chips scroll sideways (chips off-screen). NEVER ship horizontal scroll; chips/rows must WRAP. Skill rule added. Fix the equipment chips (and audit other chip rows).
42. ⬜ **Diet setting appears twice** — find the duplicate Diet UI and keep ONE (Preferences).
43. ⬜ **Some exercise demos have no video** — investigate which exercises lack a demo video and what the UI shows (emoji fallback?); decide fix.
44. ⬜ **"More" tab vs top-right menu — redundant?** — bottom nav has a ••• More tab; top-right has the account menu + bell. Evaluate best practice; remove the redundancy.
45. ⬜ **Top-bar order: Coach · 🔔 · JM is a weird sequence** — reconsider where the notification bell sits (best practice: notifications usually left of the account avatar, or grouped). Decide + adjust.
46. ⬜ **Done-state still not obvious enough** — on the activity-linked Today plan card (the outdoor ride), "done" is only inferred from the intervals/Strava links + a small ✓; not obvious. Make it unmistakable (badge/banner). Also explain/handle the ⚠ icon shown next to "Outdoor".
47. ⬜ **In-app "Promote to prod" button (QA, admin)** — JM expected a promote button "at the top" in QA. Today promotion is a GitHub workflow_dispatch (#2). Consider an admin-only in-app button that triggers it (needs a GitHub token server-side) — or document where the GitHub button is. Decide.
48. 🔨 **Week-strip "Today" doesn't re-highlight today** — after browsing a past/future week then tapping "Today", the strip returns to this week but the selected day stays stale (e.g. body showed "Wed Jun 17" while strip showed 22–28, today 23 unhighlighted). FIX: "Today" now also resets the selection to today (`onSelect(today)`). Regression on #28.
49. ✅ **"History" moved out of Today's top-right → into Stats** — removed the History chip from Today's header (JM flagged it 3×); added a "History" item (→/logs) in the Stats hub next to Progress.
77. ⬜ **Don't bury Eat & Mind in "More" — surface them** — JM doesn't want Eat/Mind hidden under the More tab. Rethink the nav so they're directly accessible. Options/mockup needed (reopens #44/#50 nav IA).
50. ⬜ **Top-bar polish / Coach placement** — more space between Coach · 🔔 · profile; make the Coach button "more special", OR move Coach to a bottom-right FAB. Mobile-first, research best-of-breed. Folds into the nav/header set (#44/#45/#49).
51. ⬜ **Post-workout GPS map + animated flyby** — if the completed activity has GPS, show the route map and a Strava-style "flyby": a dot animating along the path from start to finish. Needs the activity's GPS stream (intervals/Strava) + a map render + replay animation.
52. 🔨 **"Completed" chip/✓ top-right of the activity card** — instead of inline ✓, put a clear "Completed" chip OR a checkmark in the card's top-right corner; make done unmistakable. Folds into the done-state work (#46/#38).
53. 🔨 **Respect the image/video demo preference + in-workout toggle** — Settings → Preferences already has a demos "exerciseStills" pref; when set to image, SHOW the image (not video). Also add a small on-screen toggle during a workout to flip image/video on the fly.
55. 🔨 **DoneStats hard to read — make them chips** — the completed-activity stat row (✓ Outdoor · 69 min · 34.3 km · 143 bpm · 157 W · 44 TSS · RPE · intervals↗ Strava↗) is low-contrast/cramped; render each stat as a chip/pill for legibility.
56. 🔨 **"Add" on Today bounces to Plan, needs a 2nd click** — the "+ Add" button on Today's plan navigates to /plan where you must click Add AGAIN. It should open the add flow directly (one tap).
58. 🔨 **Color-code the DoneStats chips** — chips look good; give them metric colors (intervals-style: HR red, power purple, distance blue, TSS orange, RPE green) so they read at a glance.
59. 🔨 **Emoji on the DoneStats chips** — add a metric emoji per chip (HR ❤️, power ⚡, distance 📍, time ⏱, load 🔥, RPE 😊). Folds with #58.
60. 🔨 **DoneStats layout: links + Outdoor/Completed on their own row** — put the intervals/Strava hyperlinks to the LEFT of the Outdoor/Completed label on a separate row, so all the metric chips fit on one line below.
61. ⬜ **Inspiration: Xert-style weekly ride calendar** — reference (screenshot) for a richer plan/calendar view: per-day workout cards with XSS/training-load score badge, mini route map, power profile, activity/forecast tags, plus a weekly-stats bar (training status ★, hours planned, distance, ramp rate, weekly focus). Design inspiration for the Plan view — pairs with #54.
68. ⬜ **"Full exercise" card: thumbnail is blank (no video/picture)** — the exercise row shows an empty placeholder instead of the demo image/thumbnail (e.g. Dumbbell goblet squat). Wire the catalog image/video lookup so the thumb shows. Same card as #67.
67. 🔨 **"Full exercise" card: weird, no padding, low contrast** — the exercise row (e.g. Dumbbell goblet squat · 4×8 · rest 120s · Full exercise →) has cramped padding and dark-grey-on-black text that's hard to read. Fix padding + contrast. RULE: avoid super-dark-grey on black anywhere (contrast) — added to the options-first skill.
66. 🔨 **Week-strip: tiny dot on days that have something** — show a little indicator under each day in the WeekStrip when that day has a plan/activity/item, so you can see at a glance which days are populated.
65. ⬜ **Check-in should auto-adapt today's workout (coach)** — the daily check-in isn't just a log: when it's poor (low energy/sleep/freshness), the coach should evaluate whether to change TODAY's workout and adjust the plan automatically (e.g. swap to recovery, cut intensity), ideally with a notification (#39) explaining what & why. Design the trigger/mechanism: on check-in save → coach reviews → optional auto-adjust + note. Ties check-in (#5/#63/#64) + coach + notifications.
64. ⬜ **Infer Sleep from intervals wellness** — when the athlete has intervals.icu connected (JM does), pull the sleep score from wellness and prefill/auto-fill the check-in Sleep instead of asking (still editable). Coach already reads wellness; surface it in the check-in.
63. 🔨 **Collapsed check-in summary still feels weird — mock it** — the done/collapsed check-in row ("Energy 🤩 Sleep 🤩 Freshness 🤩 … Edit") is better but still off. Design 2–3 options (HTML mockup) for the summary state and pick.
71. 🔨 **Remove "Coming up" from Today** — drop the upcoming-sessions list at the bottom of Today.
70. 🔨 **"Suggested fuel" — drop the date in the header + it's the coach's input area** — the section reads "Suggested fuel · Wednesday, Jun 24"; the date is redundant (shown right above). Remove it. Also: the Suggested fuel/reset sections are WHERE THE COACH'S PICKS land — they should reflect coach input (meals/mind the coach scheduled), not just generic daily suggestions.
73. 🔨 **Workout card: show the FULL description, better contrast** — the plan card truncates the description ("…sustained-power dura…"); show it in full. And the description text is dark-grey on black — use a higher-contrast color. (Contrast rule already added to the skill, #67.)
74. ⬜ **Check-in chips: add Sleep, HRV, Rest HR (from intervals, else manual)** — extend the check-in to also show Sleep / HRV / Resting HR as chips. Pull from intervals.icu wellness when connected (the coach already reads it); if not available, let the user input the value. Extends #64. (#63 chip UI is the home for these.)
75. ⬜ **Post-workout: RPE missing 1 & 10; feel vs form redundant?** — (a) the Effort (RPE) scale shows 2–9; it should be the full 1–10. (b) JM asks if "How did you feel?" (Strong/Good/Normal/Poor/Weak) and "Form" / the other gym fields are redundant — review & trim the post-workout gym questions so they don't overlap.
76. ⬜ **Coach triggers on post-workout feedback (review + adjust)** — when the athlete submits post-workout feedback, "trigger" the coach to review the session, give its feedback, and adjust the plan if needed (as the cyclingcoach project does). Pairs with #65 (check-in auto-adapt), #39 (notifications), #18 (coach→Platyplus). Design the server-side trigger → coach engine → plan update + note.
78. 🔨 **Promote-to-prod belongs in the header, not under Admin** — move the admin Promote button into the app header (near the DEV/env badge), admin-only, instead of burying it in the Admin page.
82. ⬜ **History: can't delete an entry** — the History/Logs list has no way to delete a logged session. Add a per-entry delete (with confirm), removing it locally + server-side.
83. ⬜ **Logs editor: no save button / saved indication** — editing a logged session gives no feedback that changes saved (it autosaves silently). Add a "Saved ✓" indicator (and/or an explicit Save).
84. ⬜ **History should group ALL of a day's elements together** — currently History lists workouts, with the daily check-in dumped at the very bottom. Reorganize History BY DAY so each day groups its workout(s) + check-in (+ meals/mind/items) in one place.
79. ⬜ **Logs editor shows "Exercise 1/2/3", not names** — the History/Logs session editor labels rows "Exercise 1, 2, 3…" so you can't tell what was done. Use the stored exNames to show the real exercise name per row.
80. ⬜ **No kg/lb control in the Logs editor** — weights are hardcoded "kg"; respect the Settings units (kg/lb) and/or add a toggle (with conversion).
81. ⬜ **Gym TSS theory → estimate + post-calc (cyclingcoach KB)** — capture a real methodology/book on training load for STRENGTH (gym TSS) into the cyclingcoach knowledge base, then use it to (a) estimate gym TSS pre-workout and (b) calculate it post-workout from logged sets (volume/intensity/RPE), replacing the current rough gymTSS heuristic. cyclingcoach is its own repo.
85. 🔨 **GLOBAL: dark-grey-on-black text is unreadable (3rd time)** — root cause: `--text-dim` was #9298a6 and `--muted` was undefined (so `var(--muted,#666)` rendered #666). Bumped `--text-dim`→#aab2c0 and defined `--muted`→#aab2c0 globally. This lifts ALL secondary text (.meta, .eyebrow, macros, tabs, etc.) at once. (Skill rule already added #67 — this is the global token fix.)
86. 🔨 **Progress ≠ History — Progress should be GRAPHS** — the Progress page (/progress) renders a History list/editor (duplicates /logs). Progress should show graphs of how things EVOLVED (e.g. est-1RM per lift over time, weekly volume, TSS trend). Remove the History section from Progress (it's in Stats→History now) and show progression charts.
87. 🔨 **Progress is thin/sad — mock up & beef up with real insights** — the Progress page is sparse. Mock a richer version with real insights: PRs, est-1RM trends per lift, weekly volume + TSS trends, muscle-group balance, consistency/streak, best efforts, week-over-week deltas, coach takeaways.
88. ✅ **Promote button must be QA-only** — the header Promote triggers dev→prod; it was showing on DEV too (would skip QA). Restricted to QA host only, so the real promotion is always from QA. On DEV it's hidden.
90. ⬜ **Progress must scale to 50–100 lifts** — a flat per-exercise trend list won't work at scale; needs a search bar + facets (muscle group, recently trained) + "top movers"/PRs surfacing so you don't scroll 100 cards. Bake into the #87 Progress design.
91. 🔨 **Coach takeaways = REAL cyclingcoach output (not heuristics)** — ARCH (JM, firm): the coach engine ALREADY exists in cyclingcoach (`COACHCHECK` → fixed format Verdict/Execution/Body/Mind/Next, `codex_coach/coach_feedback_format.md`). It used to post to intervals notes ONLY because that predated Platyplus. Redirect it: coach writes its review to **Platyplus** (planned #18 + post-workout), Platyplus **mirrors to intervals** + shows it in-app. Build: (a) Platyplus `POST /api/coach-review` store + `GET /auth/coach-reviews` [BUILDING] → (b) Progress/post-workout render the real review (replace heuristics) → (c) adapt cyclingcoach skill to POST there (its repo). Don't rebuild intelligence.
94. ✅ **Bluetooth found neither HR nor trainer** — root cause: pairing filtered by service UUID, but many HR straps/trainers don't advertise it → hidden from the chooser. Switched to `acceptAllDevices` + `optionalServices`. CAVEAT: Web Bluetooth needs a secure context — works on localhost/QA(https), NOT a raw-IP http DEV origin.
92. ✅ **(not a bug) mockup had sample data** — JM saw mockups/progress.html (Back Squat ×5 sessions) and asked if it's real; it's sample data. The shipped Progress computes from real logs (1 session → 1 point/lift, trends after 2+). Clarified.
93. ⬜ **Open a lift → full chart with X/Y axes** — tapping a strength-trend row should open a detail view with a proper labeled chart (dated X axis, weight Y axis, points/values), not just the inline sparkline. Mock it.
95. 🔨 **BT chooser lists mouse & earphones (acceptAllDevices too broad)** — #94's acceptAllDevices shows non-fitness BT (Rapoo mouse, soundcore earphones) and still didn't surface the HR/trainer (they weren't advertising). Fix: filter by fitness SERVICES or known fitness brand name-prefixes (Polar/Wahoo/KICKR/TICKR/Tacx/Garmin/Coros/HRM…) so junk is hidden but named fitness devices show. If a device still doesn't appear it's not advertising (off/worn/already-connected elsewhere).
96. ✅ **QA Bad Gateway (Chrome)** — transient 502 during a QA auto-redeploy (each dev push rebuilds+restarts QA → brief NPM 502). Container came back healthy; external HTTPS 200. Chrome cached the error/old SW (hard-refresh clears); Firefox loaded fresh → login. NOTE: while JM is actively testing, BATCH commits/pushes to avoid redeploy blips.
72. ⬜ **Ride thumbnail = flat blue block, doesn't match the workout** — Saturday "Recovery Spin at Skov" card shows an all-blue MiniProfile thumbnail, but the actual workout has a different profile. The card thumb (CoachPlanCard MiniProfile from p.segments) isn't reflecting the real workout structure — segments missing/flat. Fix the thumbnail to render the true profile (or fall back to a sport icon if no structure).
69. 🔨 **Post-GYM workout stats (mock it)** — strength analog of the ride analytics (#54): after a gym session is done, show post-workout stats (sets·reps·volume / tonnage, top sets, est. 1RM moves, PRs, muscle groups hit, duration) + suggestions. JM did Fri Jun 19 "Rainy Day Full-Body Strength"; it shows done but has no summary. Mock 2–3 options.
62. ⬜ **Inspiration: TrainerRoad in-workout + ride summary** — (screenshots) in-workout screen with BIG metrics (Power / Interval Time / HR / Target / Total Time / Cadence) over a power-profile graph + a live coaching-tip line; and a RIDE SUMMARY screen (power graph, TSS·IF·NP·Power·kJ·FTP stat row, "View Interval Data", Ride Notes). Inspiration for the ride player + post-workout summary (#54).
54. ⬜ **Clone rich post-workout RIDE analytics (intervals-style)** — for a completed ride, show the full analytics like intervals.icu: tabs TIMELINE (power/30s-power/HR/cadence/altitude streams) · POWER (zone dist, power curve, decoupling, best efforts) · HR (zone dist, HR curves) · ROUTE (map + speed/HR) · DATA. Big feature; pairs with #51 (route map + flyby) as a post-workout-analytics pass. Source data from intervals/Strava streams.
