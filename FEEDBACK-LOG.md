# Platyplus — Feedback & Ideas Log (numbered, ordered)

**This is the master queue.** Every feedback/idea JM gives gets a **number**, appended at the END
when received (its OWN entry — never merged). Build the OPEN queue **top-to-bottom, to the T**,
unless JM explicitly reprioritizes. Status: ✅ done · 🔨 building · ⬜ todo. Design detail for big
items → `UX-BACKLOG.md`. (Edit this file with Write/sed — NOT `perl -0pi`, which mangles the UTF-8.)

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
26. ✅ Post-workout flow BUILT — `/feedback/:id`: coach notes + sport-dependent feedback + Save (stored on plan; coach reads it). FOLLOW-ONS: completed-activity STATS display + intervals private-feedback MIRROR (backend).
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
