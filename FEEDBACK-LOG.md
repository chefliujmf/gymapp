# Platyplus Ã¢ÂÂ Feedback & Ideas Log (numbered, ordered)

**This is the master queue.** Every piece of feedback/idea JM gives gets a **number** and is
**appended at the END** when received. Claude **builds in sequence, top-to-bottom of the OPEN
queue, following it to the T unless JM says otherwise.** Status: Ã¢ÂÂ done ÃÂ· Ã°ÂÂÂ¨ building ÃÂ· Ã¢Â¬Â todo.
Design detail for big items lives in `UX-BACKLOG.md`; this file is the ordered index.

> Rule (JM 2026-06-23): keep this log current; **append each new feedback/idea here (numbered)
> the moment it's given**, then work the OPEN queue in order. See skill `options-first` +
> memory `feedback-log-discipline`.

---

## Ã¢ÂÂ Done (this session, 2026-06-23) Ã¢ÂÂ record

1. Ã¢ÂÂ Pending prod ops Ã¢ÂÂ deleted jmfiset duplicate `origin=icu` plans + imported coach profile.
2. Ã¢ÂÂ One-click prod promotion Ã¢ÂÂ `promote-prod.yml` (Actions Ã¢ÂÂ Run after QA) + `PROMOTE_TOKEN` (non-expiry PAT). Tested green.
3. Ã¢ÂÂ Secrets = GitHub Secrets master, injected into the box at deploy (`AUTH_ENV_*`) + `--force-recreate`. Proven QA+prod.
4. Ã¢ÂÂ Remove all local secrets Ã¢ÂÂ `.secrets/` deleted.
5. Ã¢ÂÂ Check-in redesign Ã¢ÂÂ compact **1Ã¢ÂÂ5**, ALWAYS visible (no collapse), **SorenessÃ¢ÂÂFreshness** (all rows higher=better), **emoji faces Ã°ÂÂÂÃ°ÂÂÂ©Ã°ÂÂÂÃ°ÂÂÂÃ°ÂÂ¤Â©** (obvious+funny), green pop on pick.
6. Ã¢ÂÂ Fix Ã¢ÂÂ popover clipped by `.card` overflow (check-in info now shows).
7. Ã¢ÂÂ Fix black plan-card title (`.card-body h3` had no color Ã¢ÂÂ inherited button black).
8. Ã¢ÂÂ "Always research best practice first" Ã¢ÂÂ hardened as a skill rule (cite sources).
9. Ã¢ÂÂ "Options + mockups BEFORE building" Ã¢ÂÂ skill `options-first` + memory `show-options-and-mockups-first`.
10. Ã¢ÂÂ intervals planned-workouts investigation Ã¢ÂÂ root cause: my dupe cleanup deleted the SHARED events. Re-pushed, then reverted on request (cyclingcoach owns the intervals planning directly **for now**).
11. Ã¢ÂÂ Coach plan-authoring Ã¢ÂÂ design LOCKED + **P1a built** (server: plan structured fields + item `why`).
12. Ã¢ÂÂ cyclingcoach `AGENTS.md` + memory `platyplus-coach-engine` updated (author INTO Platyplus = master).
13. Ã¢ÂÂ Logged the full coach plan-authoring design in `UX-BACKLOG.md`.

## Ã°ÂÂÂ¨/Ã¢Â¬Â OPEN QUEUE Ã¢ÂÂ build in this order

> **Ã°ÂÂÂ PHASE 1 (P1aÃ¢ÂÂP1f) BUILT + on QA. Open P1 verify items under #18 (native-text mirror parity ÃÂ· host-MCP re-sync ÃÂ· CLI mapping ÃÂ· QA verify). Next NEW work: #19.
> schema), #14 P1b (intervals mirror + step-split #25) Ã¢ÂÂ both on QA. Resume at #15.

14. Ã¢ÂÂ **Coach P1b** Ã¢ÂÂ `planToIcuEvent` renders structured text + meal/mind refs + both why-levels into the intervals description; splits long steps. (`time_target` = step `duration`; verify Wahoo parity vs cyclingcoach before fully closing.)
15. Ã¢ÂÂ **Coach P1c** Ã¢ÂÂ PlanDetail UI: universal shell (ObjectiveÃÂ·FuelÃÂ·MindÃÂ·RecoveryÃÂ·SuccessÃÂ·Cues) + sport body (ride/run profile ÃÂ· gym list ÃÂ· yoga/pilates class); **meal chips = 2-col grid (not scroll)**, variable count; **bottom-sheet "why"** (no inline slab).
16. Ã¢ÂÂ **Coach P1d** Ã¢ÂÂ recipe/session page "Coach's pick: Ã¢ÂÂ¦" banner (per-pick `why`).
17. Ã¢ÂÂ **Coach P1e** Ã¢ÂÂ MCP: add `search_recipes` + `search_sessions` (mirror `search_exercises`); add structured fields + `why` to `create_*`/`schedule_*`; update BYO-AI tool descriptions. *(First check the server can search the recipe/mind catalog.)*
18. Ã°ÂÂÂ¨ **Coach P1f** Ã¢ÂÂ instructions DONE (cyclingcoach SKILL + AGENTS Ã¢ÂÂ author into Platyplus, discovery tools, variable meals, per-sport). REMAINING: (a) PlatyplusÃ¢ÂÂintervals NATIVE workout text for full chart parity; (b) re-sync host MCP /home/jmf/platyplus-chat/mcp/ from repo; (c) publish_platyplus_plan.py CLI structured-field mapping; (d) end-to-end QA verify with the coach.
19. Ã¢ÂÂ **Check-in history** Ã¢ÂÂ once all 3 logged, collapse the Today card to a one-line summary; full history list in **Logs**.
20. Ã¢Â¬Â **Train filters + sorting** Ã¢ÂÂ Workouts AND Exercises, by **equipment ÃÂ· time/duration ÃÂ· intensity**.
21. Ã¢Â¬Â **Settings Ã¢ÂÂ equipment list** Ã¢ÂÂ define what you own; powers the equipment filter (#20).
22. Ã¢Â¬Â **Train back-arrow** Ã¢ÂÂ confirm (it's a root tab; back absent by design) Ã¢ÂÂ add only if JM wants.
23. Ã¢Â¬Â **intervals indoor-completion** Ã¢ÂÂ confirm an indoor-done Platyplus workout reaches intervals labeled clearly (FITÃ¢ÂÂStravaÃ¢ÂÂintervals).
24. Ã¢ÂÂ **Skill: mockups in HTML, not ASCII** Ã¢ÂÂ `options-first` should say render mockups as HTML (open in browser), since JM reads those far better than ASCII. (done in skill below.)
25. Ã¢ÂÂ **Mirror must split long workout steps** Ã¢ÂÂ a single >MAX-sec step makes the intervals workout render EMPTY (hit on the 60-min steady push). P1b workout_doc must split long steps like cyclingcoach (`split_long_doc_step`). [folded into P1b]
26. Ã¢Â¬Â [MOCKUP APPROVED 2026-06-23 ÃÂ· apply #29 tweaks at build] **Post-ride / post-workout flow** Ã¢ÂÂ after a completed planned workout, show: (a) STATS linked to the plan (power/HR/load/IF/RPEÃ¢ÂÂ¦), (b) the COACH NOTES (the brief/objective/recovery), (c) a FEEDBACK input form (Legs before/after, Fuel/GI, Pain/Niggles, Life constraint, Mental state + RPE/Feel + free text). Mirror the feedback INTO intervals.icu (private feedback fields + comment). **Flow to be MOCKED UP first** (HTML, per options-first).
27. Ã¢Â¬Â [MOCKUP APPROVED â ride/run/gym/yoga] **Post-workout flow must be SPORT-DEPENDENT** (extends #26) Ã¢ÂÂ ride/run: power/HR/load + legs before/after + fuel/GI; gym: RPE + soreness/pump + volume/top sets + form; yoga/pilates: calm/down-regulation + flexibility + any strain. Mock each per sport (sport toggle).
28. Ã¢Â¬Â **Week strip needs prev/next arrows** Ã¢ÂÂ the day strip is stuck on the current week (e.g. 22Ã¢ÂÂ28); add Ã¢ÂÂ¹ Ã¢ÂÂº to page to past/future weeks (Today + wherever the WeekStrip is used).
29. Ã¢Â¬Â **Post-workout mockup tweaks (refine #26/#27)** Ã¢ÂÂ (a) button = just **"Save"**; the intervals push is BACKEND, don't surface it in the UI. (b) ADD the intervals **"Feel"** field: 5 faces **STRONG ÃÂ· GOOD ÃÂ· NORMAL ÃÂ· POOR ÃÂ· WEAK** (coloured like intervals), distinct from RPE. Apply when #26/#27 is built.
30. Ã¢ÂÂ **Process: proactively update skills when logic changes/improves** Ã¢ÂÂ don't wait to be asked. Captured: memory `keep-skills-current` + options-first skill.
31. ð¨ [PROMOTED before #22 by JM 2026-06-23 — tag ALL exercises] **Tag exercises with equipment (name-inference)** â only 46% tagged; infer from the name in build-catalog.mjs â ~67%. The ~33% with NO equipment cue stay "unknown" (do NOT guess bodyweight). Needs catalog rebuild + re-sync (content pipeline).
32. â¬ **Coach equipment-aware (#3 a+b, approved)** â (a) add `equipment` filter param + return tag on `search_exercises` (+ /api/exercises); (b) store owned-equipment on the user profile (the #21 setting writes it) so the coach filters picks to owned (or bodyweight); treat "unknown"-equipment exercises cautiously so it never prescribes gear you don't have.
33. â¬ **Source-lookup equipment for the still-unknown ~33%** (extends #31) â don't leave them unknown; pull the equipment from the original source (e.g. MuscleWiki) per exercise. PREFER re-extracting from the already-downloaded source pages in `downloaded_pages/` (no new scraping, respects the media-independence gate â METADATA only, not media); fall back to a source fetch only if needed.
34. â **Check-in collapse fixes (defects in #19)** â (a) after tapping Edit there's no way to SAVE/re-collapse â add a "Done" button; (b) "History" appears BOTH on the check-in line and at the top of Today â remove it from the check-in line (keep one); JM: History belongs next to Stats, not on this line.
