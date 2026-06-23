# Platyplus — Feedback & Ideas Log (numbered, ordered)

**This is the master queue.** Every piece of feedback/idea JM gives gets a **number** and is
**appended at the END** when received. Claude **builds in sequence, top-to-bottom of the OPEN
queue, following it to the T unless JM says otherwise.** Status: ✅ done · 🔨 building · ⬜ todo.
Design detail for big items lives in `UX-BACKLOG.md`; this file is the ordered index.

> Rule (JM 2026-06-23): keep this log current; **append each new feedback/idea here (numbered)
> the moment it's given**, then work the OPEN queue in order. See skill `options-first` +
> memory `feedback-log-discipline`.

---

## ✅ Done (this session, 2026-06-23) — record

1. ✅ Pending prod ops — deleted jmfiset duplicate `origin=icu` plans + imported coach profile.
2. ✅ One-click prod promotion — `promote-prod.yml` (Actions → Run after QA) + `PROMOTE_TOKEN` (non-expiry PAT). Tested green.
3. ✅ Secrets = GitHub Secrets master, injected into the box at deploy (`AUTH_ENV_*`) + `--force-recreate`. Proven QA+prod.
4. ✅ Remove all local secrets — `.secrets/` deleted.
5. ✅ Check-in redesign — compact **1–5**, ALWAYS visible (no collapse), **Soreness→Freshness** (all rows higher=better), **emoji faces 💀😩😐😀🤩** (obvious+funny), green pop on pick.
6. ✅ Fix ⓘ popover clipped by `.card` overflow (check-in info now shows).
7. ✅ Fix black plan-card title (`.card-body h3` had no color → inherited button black).
8. ✅ "Always research best practice first" — hardened as a skill rule (cite sources).
9. ✅ "Options + mockups BEFORE building" — skill `options-first` + memory `show-options-and-mockups-first`.
10. ✅ intervals planned-workouts investigation — root cause: my dupe cleanup deleted the SHARED events. Re-pushed, then reverted on request (cyclingcoach owns the intervals planning directly **for now**).
11. ✅ Coach plan-authoring — design LOCKED + **P1a built** (server: plan structured fields + item `why`).
12. ✅ cyclingcoach `AGENTS.md` + memory `platyplus-coach-engine` updated (author INTO Platyplus = master).
13. ✅ Logged the full coach plan-authoring design in `UX-BACKLOG.md`.

## 🔨/⬜ OPEN QUEUE — build in this order

> **👉 YOU ARE HERE: #15 (P1c, PlanDetail UI).** Done so far this build: #11 P1a (plan/item
> schema), #14 P1b (intervals mirror + step-split #25) — both on QA. Resume at #15.

14. ✅ **Coach P1b** — `planToIcuEvent` renders structured text + meal/mind refs + both why-levels into the intervals description; splits long steps. (`time_target` = step `duration`; verify Wahoo parity vs cyclingcoach before fully closing.)
15. 🔨 **Coach P1c** — PlanDetail UI: universal shell (Objective·Fuel·Mind·Recovery·Success·Cues) + sport body (ride/run profile · gym list · yoga/pilates class); **meal chips = 2-col grid (not scroll)**, variable count; **bottom-sheet "why"** (no inline slab).
16. 🔨 **Coach P1d** — recipe/session page "Coach's pick: …" banner (per-pick `why`).
17. 🔨 **Coach P1e** — MCP: add `search_recipes` + `search_sessions` (mirror `search_exercises`); add structured fields + `why` to `create_*`/`schedule_*`; update BYO-AI tool descriptions. *(First check the server can search the recipe/mind catalog.)*
18. 🔨 **Coach P1f** — cyclingcoach `publish_platyplus_plan.py` sends structured fields + uses the discovery tools; instructions teach: variable meal count from the nutrition KB, select content from the catalog, per-sport (author ride/gym; SELECT a class for yoga/pilates).
19. ⬜ **Check-in history** — once all 3 logged, collapse the Today card to a one-line summary; full history list in **Logs**.
20. ⬜ **Train filters + sorting** — Workouts AND Exercises, by **equipment · time/duration · intensity**.
21. ⬜ **Settings → equipment list** — define what you own; powers the equipment filter (#20).
22. ⬜ **Train back-arrow** — confirm (it's a root tab; back absent by design) — add only if JM wants.
23. ⬜ **intervals indoor-completion** — confirm an indoor-done Platyplus workout reaches intervals labeled clearly (FIT→Strava→intervals).
24. ✅ **Skill: mockups in HTML, not ASCII** — `options-first` should say render mockups as HTML (open in browser), since JM reads those far better than ASCII. (done in skill below.)
25. ✅ **Mirror must split long workout steps** — a single >MAX-sec step makes the intervals workout render EMPTY (hit on the 60-min steady push). P1b workout_doc must split long steps like cyclingcoach (`split_long_doc_step`). [folded into P1b]
