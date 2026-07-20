---
name: validate-athlete-types
description: Before shipping ANY coach / plan-generation / readiness / dose change, validate it produces CORRECT, individualized output for the FULL matrix of athlete types — not just JM (male cyclist) and Xenia (pregnant runner). Platyplus is for commercialization: it must adapt to WHOEVER signs up, and nothing may assume one household's profile. Use on every change to weekShape / enforceShapeIntensity, buildSystemPrompt, the coach-engine*.md files, the daily-adapt, readiness, or the MCP plan tools.
---

# Validate for ALL athlete types — the commercialization gate

The single biggest failure mode of this coach has been building for **one person** and shipping it as generic (the whole "house of cards" was JM's cycling prompt wrapped, not rewritten). Every coach/plan change is "done" only when it's shown to adapt across the matrix below — **the coach must serve whoever signs up.**

Rule of thumb: **if you can't state what your change does for a pregnant runner, a 15-year-old, a masters swimmer, and a beginner — you haven't finished it.**

## The athlete dimensions (from `user.info` / `user`)

| Dimension | Field | Values that must each work |
|---|---|---|
| Sex | `user.sex` | male · female |
| Repro-state (female) | `info.pregnant` + `pregnancyStage`, `user.cyclePhase` | pregnant T1 / T2 / T3 / unknown-trimester · menstrual phase (follicular/luteal/PMS) · none |
| Age | `info.dob` → years | teen (<18) · adult · masters (55+) |
| Sport(s) | `user.sports` | cyclist · runner · swimmer · lifter/strength · triathlete · multi-sport · single-sport |
| Goal | `info.goals.focus` + `.notes` | build/performance · maintain/consistency · muscle/hypertrophy · general health |
| Fitness | `user.ctl` | beginner (low CTL / none) · intermediate · advanced |
| Frequency | `info.trainingDays` | low (2–3/wk) · high (6/wk) |
| Equipment | `info.equipment` | full gym · home (bands/DB/bodyweight) · bodyweight-only |
| Anthropometry | `info.heightCm` | short · very tall (paces/loads come from THEIR numbers, never assumed) |

## Personas to cover (the concrete test set)

Run a new/changed coach-plan behavior against **at least these**, and state the expected result for each:

1. **Male cyclist, build** (JM) — `build` week, ~2 quality (threshold/VO2/sweet-spot), varied ride archetypes, gym as support.
2. **Pregnant runner** (Xenia) — `maintenance`: 0 structured quality, ≤1 light tempo, ceiling ≤ tempo (T3 → endurance), no sweet-spot/threshold in segments OR titles, no supine gym in T2+, privacy (never "pregnant/trimester" in any title/description).
3. **Teen runner, performance** — technique-first, submaximal, ≤1 quality day, NO maximal/1-RM or VO2 grinding.
4. **Masters cyclist, health** — extra recovery, ease the very top end, `flat`/consistency, cycle-phase honored if female.
5. **Swimmer, performance** — real pool/CSS sets via `create_swim` (it exists and works), never substituted with a run/ride; swim TSS carried.
6. **Triathlete, race** — all three sports present, bricks, sane weekly distribution.
7. **Beginner, general fitness** — mostly easy, conservative volume, build slowly; no junk grey-zone.
8. **Female cyclist, non-pregnant** — menstrual-phase load bias applied (ease in late-luteal/PMS).

## How to validate (stack the layers — see `platyplus-testing`)

1. **Unit-test the PURE deciders across the matrix.** `weekShape(profile)` (and any dose/enforcement helper) must have one assertion per persona — pregnant→0 quality, build→2, teen→capped, etc. Model: `src/week-shape.test.ts`. This is the cheapest, strongest guard and it CANNOT be skipped for a dose/shape change.
2. **Enforce, don't instruct.** The LLM ignores prompt rules (proven: it gave a pregnant athlete 2 sweet-spots despite "0 quality days"). Anything safety- or dose-critical must be **enforced in code** (`enforceShapeIntensity` clamps + relabels + caps count; `planCapViolation` caps days) — and that code path must be tested for the maintenance personas, not just asserted in the prompt.
3. **Rebuild-verify 3–4 representative personas end-to-end** (a pregnant athlete, a build athlete, a swimmer, a teen) on QA or a scratch account: trigger the adapt, then check the resulting plan is (a) correctly DOSED, (b) SPORT-correct (only their sports), (c) VARIED (no repeated archetype), (d) within caps + privacy. Grep the plan titles/segments; read the `[shape-enforce]` log to confirm the guard fired.
4. **Never generalize a fix from one persona.** If a change is validated only on JM, it is NOT done.

## Red flags (a change that secretly serves only one type)

- Hard-coded assumptions of a sport (defaulting to cycling/FTP), a sex, an age, or a goal.
- A dose/intensity rule that lives ONLY in the prompt (it will be ignored — move it to code).
- A number tied to one athlete (a specific FTP, a place/season, "masters", a race date) baked into the shared engines.
- A new MCP/plan path that only handles ride/run/gym (swim/tri silently dropped — that's how `create_swim` was dead).
- "It works for me/Xenia" as the verification.

## Checklist before marking a coach/plan change done

- [ ] Named the expected result for each relevant persona above.
- [ ] Pure decider (weekShape / dose / readiness) unit-tested across the matrix.
- [ ] Safety/dose-critical behavior ENFORCED in code + tested, not just prompted.
- [ ] Rebuilt + eyeballed ≥3 representative personas (incl. a maintenance/pregnancy case) — dose, sport, variety, caps, privacy all correct.
- [ ] No sport/sex/age/goal/one-athlete assumption introduced into shared code or engines.
- [ ] `platyplus-testing` layers stacked (unit → type → DB/adapt → the enforce log).

Ties: `platyplus-testing`, `coach-token-thrift`, memory `platyplus-gym-engine`, `platyplus-readiness-model`.
