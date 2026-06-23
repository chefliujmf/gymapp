# Platyplus â Feedback & Ideas Log (numbered, ordered)

**This is the master queue.** Every piece of feedback/idea JM gives gets a **number** and is
**appended at the END** when received. Claude **builds in sequence, top-to-bottom of the OPEN
queue, following it to the T unless JM says otherwise.** Status: â done Â· ð¨ building Â· â¬ todo.
Design detail for big items lives in `UX-BACKLOG.md`; this file is the ordered index.

> Rule (JM 2026-06-23): keep this log current; **append each new feedback/idea here (numbered)
> the moment it's given**, then work the OPEN queue in order. See skill `options-first` +
> memory `feedback-log-discipline`.

---

## â Done (this session, 2026-06-23) â record

1. â Pending prod ops â deleted jmfiset duplicate `origin=icu` plans + imported coach profile.
2. â One-click prod promotion â `promote-prod.yml` (Actions â Run after QA) + `PROMOTE_TOKEN` (non-expiry PAT). Tested green.
3. â Secrets = GitHub Secrets master, injected into the box at deploy (`AUTH_ENV_*`) + `--force-recreate`. Proven QA+prod.
4. â Remove all local secrets â `.secrets/` deleted.
5. â Check-in redesign â compact **1â5**, ALWAYS visible (no collapse), **SorenessâFreshness** (all rows higher=better), **emoji faces ðð©ððð¤©** (obvious+funny), green pop on pick.
6. â Fix â popover clipped by `.card` overflow (check-in info now shows).
7. â Fix black plan-card title (`.card-body h3` had no color â inherited button black).
8. â "Always research best practice first" â hardened as a skill rule (cite sources).
9. â "Options + mockups BEFORE building" â skill `options-first` + memory `show-options-and-mockups-first`.
10. â intervals planned-workouts investigation â root cause: my dupe cleanup deleted the SHARED events. Re-pushed, then reverted on request (cyclingcoach owns the intervals planning directly **for now**).
11. â Coach plan-authoring â design LOCKED + **P1a built** (server: plan structured fields + item `why`).
12. â cyclingcoach `AGENTS.md` + memory `platyplus-coach-engine` updated (author INTO Platyplus = master).
13. â Logged the full coach plan-authoring design in `UX-BACKLOG.md`.

## ð¨/â¬ OPEN QUEUE â build in this order

> **ð PHASE 1 (P1aâP1f) BUILT + on QA. Open P1 verify items under #18 (native-text mirror parity Â· host-MCP re-sync Â· CLI mapping Â· QA verify). Next NEW work: #19.
> schema), #14 P1b (intervals mirror + step-split #25) â both on QA. Resume at #15.

14. â **Coach P1b** â `planToIcuEvent` renders structured text + meal/mind refs + both why-levels into the intervals description; splits long steps. (`time_target` = step `duration`; verify Wahoo parity vs cyclingcoach before fully closing.)
15. â **Coach P1c** â PlanDetail UI: universal shell (ObjectiveÂ·FuelÂ·MindÂ·RecoveryÂ·SuccessÂ·Cues) + sport body (ride/run profile Â· gym list Â· yoga/pilates class); **meal chips = 2-col grid (not scroll)**, variable count; **bottom-sheet "why"** (no inline slab).
16. â **Coach P1d** â recipe/session page "Coach's pick: â¦" banner (per-pick `why`).
17. â **Coach P1e** â MCP: add `search_recipes` + `search_sessions` (mirror `search_exercises`); add structured fields + `why` to `create_*`/`schedule_*`; update BYO-AI tool descriptions. *(First check the server can search the recipe/mind catalog.)*
18. ð¨ **Coach P1f** â instructions DONE (cyclingcoach SKILL + AGENTS â author into Platyplus, discovery tools, variable meals, per-sport). REMAINING: (a) Platyplusâintervals NATIVE workout text for full chart parity; (b) re-sync host MCP /home/jmf/platyplus-chat/mcp/ from repo; (c) publish_platyplus_plan.py CLI structured-field mapping; (d) end-to-end QA verify with the coach.
19. â **Check-in history** â once all 3 logged, collapse the Today card to a one-line summary; full history list in **Logs**.
20. â¬ **Train filters + sorting** â Workouts AND Exercises, by **equipment Â· time/duration Â· intensity**.
21. â¬ **Settings â equipment list** â define what you own; powers the equipment filter (#20).
22. â¬ **Train back-arrow** â confirm (it's a root tab; back absent by design) â add only if JM wants.
23. â¬ **intervals indoor-completion** â confirm an indoor-done Platyplus workout reaches intervals labeled clearly (FITâStravaâintervals).
24. â **Skill: mockups in HTML, not ASCII** â `options-first` should say render mockups as HTML (open in browser), since JM reads those far better than ASCII. (done in skill below.)
25. â **Mirror must split long workout steps** â a single >MAX-sec step makes the intervals workout render EMPTY (hit on the 60-min steady push). P1b workout_doc must split long steps like cyclingcoach (`split_long_doc_step`). [folded into P1b]
26. â¬ [MOCKUP APPROVED 2026-06-23 Â· apply #29 tweaks at build] **Post-ride / post-workout flow** â after a completed planned workout, show: (a) STATS linked to the plan (power/HR/load/IF/RPEâ¦), (b) the COACH NOTES (the brief/objective/recovery), (c) a FEEDBACK input form (Legs before/after, Fuel/GI, Pain/Niggles, Life constraint, Mental state + RPE/Feel + free text). Mirror the feedback INTO intervals.icu (private feedback fields + comment). **Flow to be MOCKED UP first** (HTML, per options-first).
27. â¬ [MOCKUP APPROVED — ride/run/gym/yoga] **Post-workout flow must be SPORT-DEPENDENT** (extends #26) â ride/run: power/HR/load + legs before/after + fuel/GI; gym: RPE + soreness/pump + volume/top sets + form; yoga/pilates: calm/down-regulation + flexibility + any strain. Mock each per sport (sport toggle).
28. â¬ **Week strip needs prev/next arrows** â the day strip is stuck on the current week (e.g. 22â28); add â¹ âº to page to past/future weeks (Today + wherever the WeekStrip is used).
29. â¬ **Post-workout mockup tweaks (refine #26/#27)** â (a) button = just **"Save"**; the intervals push is BACKEND, don't surface it in the UI. (b) ADD the intervals **"Feel"** field: 5 faces **STRONG Â· GOOD Â· NORMAL Â· POOR Â· WEAK** (coloured like intervals), distinct from RPE. Apply when #26/#27 is built.
30. â **Process: proactively update skills when logic changes/improves** â don't wait to be asked. Captured: memory `keep-skills-current` + options-first skill.
31. ⬜ **Tag exercises with equipment (name-inference)** — only 46% tagged; infer from the name in build-catalog.mjs → ~67%. The ~33% with NO equipment cue stay "unknown" (do NOT guess bodyweight). Needs catalog rebuild + re-sync (content pipeline).
32. ⬜ **Coach equipment-aware (#3 a+b, approved)** — (a) add `equipment` filter param + return tag on `search_exercises` (+ /api/exercises); (b) store owned-equipment on the user profile (the #21 setting writes it) so the coach filters picks to owned (or bodyweight); treat "unknown"-equipment exercises cautiously so it never prescribes gear you don't have.
33. ⬜ **Source-lookup equipment for the still-unknown ~33%** (extends #31) — don't leave them unknown; pull the equipment from the original source (e.g. MuscleWiki) per exercise. PREFER re-extracting from the already-downloaded source pages in `downloaded_pages/` (no new scraping, respects the media-independence gate — METADATA only, not media); fall back to a source fetch only if needed.
