---
name: whole-app-audit
description: Run JM's full-blown, scored audit of the WHOLE app — every persona × every sport × the coach engines AND the UX/UI/flows (stats, profile, settings, nav, admin), mobile-first, in real Chrome on prod. Produces a scored scorecard artifact + a backlog of gaps. Use when JM asks to "re-audit", "full audit", "where are we at", or after a batch is promoted.
---

# Whole-app audit — the scored "where are we at" review

JM's standing ask (2026-07-22, restated): **"re-audit ALL sports for ALL personas in prod, score the results. Check the engine LOGIC, but ALSO the UX/UI steps and processes, the stats pages, navigation, profile, settings, the admin page — review the WHOLE app."** Run this AFTER a promote so it reflects what real users get.

This skill is the **review**; fixes it surfaces go to `FEEDBACK-LOG.md` (numbered) + the in-app backlog. It composes [[validate-athlete-types]] (the persona/engine matrix), [[coach-simulation]] (quality×cost), [[platyplus-testing]] + [[platyplus-browser-testing]] (the verification stack), [[platyplus-theme]] + [[options-first]]'s mobile rules (UX bar). Prior run: `mockups/whole-app-audit.html`, scored 62/100 — beat it or explain the regression.

## Scope — the WHOLE app, two halves

**A. Coach / engine LOGIC** (per [[validate-athlete-types]] — the world-class bar: individualized · evidence-based · CODE-ENFORCED · universal · safe):
- Dose (week-shape quality count + ceiling), variety (archetypes), periodization, rep-scheme/interval length from the athlete's OWN numbers, concurrent-training separation, enforcement level (prompt-only vs code-enforced-at-save).
- Safety + privacy by construction (teen loads, pregnancy maintenance + never-leak, masters recovery).
- Metrics actually DRIVE prescriptions (not decorative); degrade gracefully with NO benchmarks.

**B. UX / UI / product** (mobile-first, real Chrome):
- **Every athlete-facing screen**: Plan (Day/Week/Month/Schedule), the completed-activity views (ride/run/gym/swim), the coach chat, check-in, review flow, onboarding.
- **Stats pages**: per-sport (cycling/running/swim/tri/gym), the benchmark cards, charts (axes+labels+insight per [[platyplus-charts]]), Form/fatigue, season compare — is each one populated, correct, insightful, non-empty?
- **Navigation**: every tab + deep link reachable, no dead routes, no `navigate(-1)` dead-ends, back always works.
- **Profile · Settings · Admin**: every field saves + round-trips (verify in the DB, not "it looked saved"), units, connections, notifications, the admin/backlog page.
- **Theme + mobile hard rules**: theme tokens only (no off-theme hex), NO horizontal scroll, readable contrast, tap targets, empty/loading states.

## The persona × sport matrix (cover ALL — never one)

Run each relevant persona (real QA accounts where they exist, else create them — see [[coach-simulation]] setup):
1. Male cyclist, build (JM) · 2. Pregnant runner (Xenia) · 3. Teen runner · 4. Masters cyclist · 5. Swimmer · 6. Triathlete · 7. Beginner, NO benchmarks · 8. Non-pregnant female (cycle phase) · 9. Postpartum runner · 10. Endurance + wants-muscle (concurrent) · 11. Bodybuilder/strength.
Each × their sport(s). The one-line test: *if you can't state what the app does for each, you haven't finished.*

## How to run it

1. **Environment: PROD, real Chrome** (skill `platyplus-browser-testing`; JM signed in on QA+prod). Prod = what users actually get. Use QA only to trigger re-plans safely (read-only toward intervals) when a persona needs a fresh plan.
2. **Decompose + fan out.** This is big — if JM opted into orchestration (`ultracode`/"use a workflow"), run a Workflow: one agent per (persona×sport) for the engine half + one per screen-group for the UX half → each returns a scored, structured finding → synthesize. Otherwise walk it methodically yourself, persona by persona, screen by screen.
3. **Score each area 1–5** on: correctness · individualization · safety/privacy · UX/mobile · insight/value. Note the ENFORCEMENT level for every logic rule (prompt-only is a defect for anything structural/safety). Capture a screenshot per screen.
4. **Adversarially verify** the top findings before reporting (don't ship a plausible-but-wrong gap) — reproduce it on the actual screen/data.
5. **Produce the scorecard** as a rendered HTML artifact (`mockups/whole-app-audit.html`, dark theme) — per-area scores, an overall /100, the top gaps ranked, and what REGRESSED vs the last run. Show JM the artifact, not a wall of text.
6. **File the gaps**: every real gap → `FEEDBACK-LOG.md` (numbered) + the in-app backlog (`PUT /auth/admin/backlog/:n`), most-severe first, with the persona/screen it fails on. Don't fix during the audit — audit first, then work the queue in priority order.

## The bar (what "good" means, per area)

- **Engine**: world-class = individualized · evidence-based · code-enforced · universal · safe. 3/5 for "works for JM, generic for everyone else" is the failure to hunt.
- **UX**: mobile-first, theme-correct, no horizontal scroll, every list has filters+sort, every chart has axes+insight, every stat card is populated + says something, every field round-trips, no dead nav.
- **Honesty**: a screen that's empty/near-empty for a persona (e.g. Cycling stats with only manual FTP) is a FINDING, not "fine". Report what's missing, per persona, per screen — never imply coverage you didn't verify (definition-of-done).

## Red flags to hunt (from prior audits)
- A dose/intensity/rep rule that's prompt-only → will be ignored, mark it.
- A metric shown but never prescribed-from (decorative), or a prescription ignoring the athlete's own number.
- A path that only handles ride/run/gym (swim/tri dropped).
- A safety/privacy rule enforced only by asking the LLM.
- Crash/mis-default when a benchmark is ABSENT (new user).
- Off-theme hex, horizontal scroll, dead `/route`, `navigate(-1)` dead-end, a near-empty stats page, a Settings field that doesn't round-trip.
- "It works for me/JM" as the verification.

Ties: [[validate-athlete-types]] · [[coach-simulation]] · [[platyplus-testing]] · [[platyplus-browser-testing]] · [[platyplus-charts]] · [[platyplus-theme]] · [[options-first]] · [[verify-before-ready]] · [[definition-of-done-validate]].
