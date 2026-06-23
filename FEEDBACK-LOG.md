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
49. ⬜ **"History" lives at top-right, should sit next to Stats** — move the History entry point out of the top-right area to live with Stats (best-practice grouping). Decide placement + adjust.
50. ⬜ **Top-bar polish / Coach placement** — more space between Coach · 🔔 · profile; make the Coach button "more special", OR move Coach to a bottom-right FAB. Mobile-first, research best-of-breed. Folds into the nav/header set (#44/#45/#49).
