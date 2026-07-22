---
name: validate-athlete-types
description: A MANDATORY definition-of-done gate for EVERY decision that produces athlete-facing behavior — coach/plan/prescription, readiness, exercise/metric selection, or any UI that renders an athlete's data. Validate the change is CORRECT and individualized across the FULL matrix of user types (sex, repro-state, age, sport, objective, metrics, experience, equipment) — never just JM (male cyclist) and Xenia (pregnant runner). Platyplus is commercialized: it must adapt to WHOEVER signs up, so nothing may assume one household's profile, one sport, or one goal. Apply on every coach/plan/readiness/metrics/prescription change AND whenever a decision's output could differ by athlete.
---

# Validate for ALL user types — the universal adaptation gate

**Apply this to EVERY decision, not just coach code.** The core failure mode of this app is building for **one person** and shipping it as generic — JM's male-cyclist assumptions wrapped, not rewritten. The most recent instance: a cyclist got **3×10 leg work** (#648) because the rep-scheme was prompt-only and vague, so the LLM defaulted to hypertrophy — a mis-adaptation to sport + goal + the athlete's numbers. Before that: a pregnant athlete got 2 sweet-spot sessions despite "0 quality days."

**The one-line test:** *if you can't state what your change does for a pregnant runner, a 15-year-old, a masters swimmer, a female cyclist mid-luteal, and a beginner with no benchmarks — you haven't finished it.*

This gate is cheap to think through and expensive to skip. It is part of the definition of done (CLAUDE.md ▶ TESTING).


## Test across ALL personas — unit AND browser (JM 2026-07-21)
"Test it like crazy for all personas" means BOTH layers, every time, for any athlete-facing change:
- **Unit:** assert the pure output for EACH persona — a cyclist, a runner, a swimmer, a triathlete, a male, a female, a bodybuilder, a teen, a masters, a beginner-no-benchmarks, a pregnant/postpartum athlete. One assertion per persona, not just the happy path (model: `src/gym-split.test.ts` #687 assembler tests).
- **Browser (Chrome):** once the change reaches the app/plan, trigger a real re-plan per persona on QA and WALK the result in Chrome (skill `platyplus-browser-testing`) — see the actual session/plan render correctly for each. A pure function is unit-verified; it is only STELLAR once its output is seen in the app for every persona.
Never sign off "tested" on one persona or one layer.

## The bar: WORLD-CLASS

We are building a **world-class, data-driven coach** — one that reads the books and the science and applies them correctly to every individual, sport, and goal. "World-class" is a concrete, testable standard, not a slogan:

- **Individualized, not templated.** Every prescription scales from THIS athlete's own numbers (threshold, TTE, W′/D′, 1RM, CTL) — a short-TTE rider and a diesel get different interval lengths; a cyclist and a bodybuilder get different rep schemes. A fixed template applied to everyone is a fail.
- **Evidence-based.** Every rule traces to the science (Coggan, Daniels, Seiler polarized, Rønnestad/Beattie/Vikmoen concurrent strength, Schoenfeld volume, ACOG pregnancy, ACSM). If you can't cite why, it's not world-class — it's a guess.
- **Enforced, not hoped.** A world-class coach is CONSISTENT: the same athlete always gets a correct, safe, non-contradictory plan. That only holds if the structural + safety rules are CODE-ENFORCED (a clamp that can't be violated), because the LLM will ignore prose. "It usually does the right thing" is not world-class.
- **Adapts to everyone.** It serves whoever signs up — every sex, age, repro-state, sport, goal, experience level, equipment set — and degrades gracefully for a brand-new user with no data. A coach that's excellent for one persona and generic for the rest is not world-class; it's a demo.
- **Safe + private by construction.** Safety (teen loads, pregnancy limits) and privacy (never leak a medical state to a public feed) are guaranteed in code, never left to the model's goodwill.

Hold every change to this bar. If it doesn't move the coach toward *individualized · evidence-based · enforced · universal · safe*, it isn't done.

## When it applies

ANY change whose output can differ by athlete:
- coach engine / `buildSystemPrompt` / daily-adapt / MCP plan tools
- the PURE deciders: `week-shape.js`, `shape-enforce.js`, `archetypes.js`, `periodization.js`, `gym-split.js`, `cycle.js`, `readiness.js`, `strength.ts`
- **prescription dimensions**: dose · intensity/zones · variety · periodization · **rep-scheme/load** · **interval duration/rep length** · exercise selection/equipment · recovery
- **metrics**: anything that reads, computes, displays, or prescribes from CP/W′/TTE/EF/FTP · VDOT/threshold-pace/CS/D′ · CSS · 1RM/%1RM
- readiness / cycle / pregnancy / postpartum logic
- **any UI that renders athlete data** (units, zones, benchmarks, plan detail, player)

If the change is purely cosmetic and athlete-invariant (a typo, a color token), a one-line "invariant across athletes" note is enough. Otherwise run the matrix.

## The athlete dimensions (from `user.info` / `user`)

| Dimension | Field | Values that must each work |
|---|---|---|
| Sex | `user.sex` | male · female |
| Repro-state (female) | `info.pregnant` + `pregnancyStage`, `user.cyclePhase`, `info.postpartumSince` | pregnant T1/T2/T3 / unknown-trimester · postpartum <6wk / 6–12wk / ≥12wk · menstrual phase (follicular/luteal/PMS) · none |
| Age | `info.dob` → years | teen (<18) · adult · masters (55+) |
| Sport(s) + MAIN sport | `user.sports`, `info.mainSport` | cyclist · runner · swimmer · lifter/strength · triathlete · multi-sport |
| Objective | `info.goals.focus` + `.notes` | build/performance · maintain/consistency · muscle/hypertrophy · strength/1RM · general health · A-race (date) |
| **Metrics / benchmarks** | `ftp/eftp`, `runVdot/runPaceEst`, `sportSettings.*.thresholdPace`, CP/W′/TTE/EF, CS/D′, CSS, per-lift 1RM | present & confident · stale/unconfirmed · **absent (brand-new user)** — the change must degrade gracefully with NO numbers, and use the athlete's OWN numbers when present (never a generic default) |
| Experience | goal notes / load history | beginner/returning (ramp-in) · established |
| Frequency | `info.trainingDays` | low (2–3/wk) · high (6/wk) — a HARD weekly cap |
| Equipment | `info.equipment` | full gym · home (DB/KB/bands) · bodyweight-only — prescribe ONLY owned gear |
| Anthropometry | `info.heightCm`, `weight` | paces/loads/zones come from THEIR numbers, never assumed |

## Personas to cover (the concrete test set)

State the EXPECTED result for each relevant persona, then verify the actual output matches:

1. **Male cyclist, build** (JM) — `build` week, ~2 quality; gym = SUPPORT → **heavy low-rep (3–6) mains, fast concentric, not to failure** (#648), not 3×10.
2. **Pregnant runner** (Xenia) — `maintenance`: 0 structured quality, ≤1 light tempo, ceiling ≤ tempo; NO sweet-spot/threshold/fartlek/surge in segments OR titles; no supine gym T2+; **privacy — never "pregnant/trimester" in any title/description/public text.**
3. **Teen runner, performance** — technique-first, submaximal, ≤1 quality; NO maximal/1-RM (gym sets floored ≥5 reps); no VO2 grinding.
4. **Masters cyclist, health** — extra recovery, ease the very top end, gentler peak, `flat`/consistency; masters gym eased too.
5. **Swimmer, performance** — real pool/CSS sets via `create_swim`, never substituted with run/ride; swim metrics (CSS/TTE) drive the sets + send-off pace; swim intensity ceiling clamped on a capped week; swim TSS carried.
6. **Triathlete, race** — all three sports present WITH per-sport variety (not just the bike), bricks, sane weekly distribution, shared recovery budget, periodized to the A-race.
7. **Beginner, general fitness, NO benchmarks** — mostly easy, conservative volume, ramp in (≤1 quality early even with an ambitious goal); the plan must build with **no FTP/pace/1RM yet** and not crash or default to a stranger's numbers.
8. **Female cyclist, non-pregnant** — menstrual-phase load bias actually APPLIED to targets (ease late-luteal/PMS), not just mentioned.
9. **Postpartum runner** — graded return by weeks-since-birth (pelvic-floor early → maintenance → normal ≥12wk).
10. **Endurance athlete who ALSO wants muscle** (support_build) — coherent concurrent plan: heavy mains + dosed hypertrophy accessories, sport stays #1.

## The core check — CODE-ENFORCED vs PROMPT-ONLY (the #648/#620 lesson)

For every structural or safety rule the change touches, ask: **is it enforced in code, or only asked for in the prompt?** The LLM *ignores* prompt-only structural rules (proven repeatedly). Classify each rule into one of three levels, and push it up the ladder:

1. **PROMPT-ONLY** (asked in prose) — the LLM can silently violate it. This is a defect for anything structural/safety.
2. **CODE-INJECTED** (computed + handed to the LLM: weekShape dose, archetype assignment, gym `REP_SCHEME`) — better, but still not guaranteed.
3. **CODE-ENFORCED at save** (a clamp/guard/409 that CANNOT be violated: `enforceShape`, `planCapViolation`, `enforceTeenGym`, `gym-guard`) — the only level safe for a safety/dose-critical rule.

**Anything safety-critical (privacy, teen limits, pregnancy maintenance) or dose-defining (quality count, intensity ceiling, gym rep band) must reach level 3.** And the enforcement must run on EVERY save/adapt path (create, move, daily-adapt, manual, and the future-sweep), not just one — holes are how a MOVE onto a full day (#5014) or a stale session slipped through.

**Metrics corollary:** a metric that's computed and displayed but never wired into a concrete prescription is "decorative." If the change adds/uses a metric, verify it actually DRIVES a prescription (interval length from TTE, rep length from W′/D′, base from EF, paces from threshold, load from %1RM) for the athletes who have it — and degrades cleanly for those who don't.

## How to validate (stack the layers — see `platyplus-testing`)

1. **Unit-test the PURE deciders across the matrix.** One assertion per persona (pregnant→0 quality, build→2, teen→capped, cyclist-support→3–6 reps, runner "running"→support not health). Model: `src/{week-shape,shape-enforce,gym-split,periodization}.test.ts`. Cheapest, strongest guard — not skippable for a dose/shape/prescription change.
2. **Enforce, don't instruct** (see the core check). Test the enforcement path for the maintenance/teen/pregnancy personas, not just the prompt text.
3. **Rebuild-verify ≥3 representative personas end-to-end** on QA/scratch (a pregnant athlete, a build athlete, a swimmer or teen): trigger the adapt, then check the plan is correctly DOSED, SPORT-correct, VARIED, within caps + privacy, and PRESCRIBED from their own metrics. Grep titles/segments; read the `[shape-enforce]` log to confirm the guard fired. Browser-check the rendered result (skill `platyplus-browser-testing`).
4. **Never generalize a fix from one persona.** Validated only on JM ⇒ NOT done.

## Red flags (a change that secretly serves only one type)

- Hard-coded assumption of a sport (defaulting to cycling/FTP), a sex, an age, or a goal.
- A dose/intensity/**rep-scheme/duration** rule that lives ONLY in the prompt → it will be ignored, move it to code.
- A number tied to one athlete (a specific FTP, a place/season, a race date) baked into shared engines.
- A metric that's shown but never prescribed from (decorative) — or a prescription that ignores the athlete's own number and uses a generic default.
- A new MCP/plan path that only handles ride/run/gym (swim/tri silently dropped — that's how `create_swim` was dead, and how tri variety covers only the bike).
- A safety/privacy rule (pregnancy words, teen loads) enforced only by asking the LLM — it must be a code scrub/clamp.
- A change that **crashes or mis-defaults when a benchmark is ABSENT** (brand-new user).
- "It works for me/Xenia" as the verification.

## Checklist before marking ANY athlete-facing change done

- [ ] Stated the expected result for each RELEVANT persona above (incl. a maintenance/pregnancy case + a no-benchmarks beginner).
- [ ] Pure decider unit-tested across the matrix.
- [ ] Every structural/safety rule the change touches is at the right ENFORCEMENT level (safety/dose → code-enforced at save, on every path) — not prompt-only — and tested.
- [ ] Metrics the change uses actually DRIVE a prescription from the athlete's OWN numbers, and degrade cleanly when absent.
- [ ] Rebuilt + eyeballed ≥3 representative personas — dose, sport, variety, rep-scheme, caps, privacy all correct.
- [ ] No sport/sex/age/goal/metric/one-athlete assumption introduced into shared code or engines.
- [ ] `platyplus-testing` layers stacked (unit → type → DB/adapt → the enforce log → browser).

Ties: `platyplus-testing`, `platyplus-browser-testing`, `verify-before-ready`, `coach-token-thrift`, `options-first`; memories `platyplus-gym-engine`, `platyplus-coach-architecture`, `platyplus-readiness-model`, `platyplus-numbers-not-categories`, `definition-of-done-validate`.
