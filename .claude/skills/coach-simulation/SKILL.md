---
name: coach-simulation
description: Rigorously COMPARE coach configurations (model tier, prompt size, pass structure, gating) on QUALITY × COST before shipping — so cost/quality decisions are measured, not guessed. Run the coach across representative athlete PERSONAS (real QA users + purpose-built fake QA users for matrix coverage), score the output with a fixed rubric, measure the token cost per run, and pick the best quality at the lowest cost. Use whenever a change could trade coaching quality for cost (model downgrade, prompt trim, fewer passes) — JM: "best quality and lowest cost."
---

# Coach simulation — compare scenarios on quality × cost

Goal (JM 2026-07-21): find the **best quality at the lowest cost** by SIMULATING configs, not guessing. Pairs [[commercialization-cost]] (the COGS/margin target) with [[validate-athlete-types]] (the persona matrix) and the coach audit rubric.

## Setup
- **Environment:** QA only. QA (`IS_STAGING`) is READ-ONLY toward intervals, so simulations never touch real athletes' Garmin/plans. The `/api/coach/daily-adapt` endpoint accepts **`buildModel`** (#634) to override the build model per run; `COACH_CHEAP_MODEL` / `COACH_BUILD_MODEL` env vars set the tiers. Costs come from the coach transcripts (`~jmf/.claude/projects/-home-jmf-platyplus-chat/*.jsonl`, `usage` fields).
- **Personas** — cover the matrix (each an account on QA with a representative profile + benchmarks):
  1. Male cyclist, build (real: `jmfiset`) · 2. Pregnant runner (real: `xenia`) · 3. Teen runner · 4. Masters cyclist · 5. Swimmer · 6. Triathlete · 7. Beginner (low/no CTL) · 8. Non-pregnant female (cycle-phase).
  Real users already have intervals data; create fake QA users for the rest (set `sex`, `info.dob`, `info.goals`, `sports`, `sportSettings` benchmarks, `coachProfile`). Note: a fake user without an intervals key exercises the intervals-optional path (#606) — flag that its data-driven depth is limited vs a real connected athlete.
- **Variants** — the configs to compare, e.g. build model {Opus, Sonnet, Haiku}; cheap-pass model; prompt size; pass structure/gating.

## Run
For each persona × variant: clear the persona's future plans → trigger `/api/coach/daily-adapt` with the variant (`buildModel`) → wait for the coach process to finish → capture (a) the resulting plan (DB) and (b) the token usage from the newest transcript.

## Score — QUALITY rubric (1–5 each; from the audit + validate-athlete-types)
Grade the OUTPUT plan per persona:
- **Dose** correct for the persona (quality-day count + ceiling; pregnancy=0 quality/tempo; build=2/vo2; teen capped; etc.)
- **Variety** (no repeated shape; archetypes rotate; easy days differ)
- **Individualization** (sport-correct, sex/age/repro respected, reads THEIR numbers)
- **Periodization/progression** (build→peak→recovery visible; ramps; taper if racing)
- **Safety** (no contraindicated work — pregnancy sweet-spot/fartlek, teen 1-RM)
- **Coaching craft** (real structured steps, useful descriptions, plain language)
Average → a per-persona quality score; average across personas → the variant's quality.

## Measure — COST
Per run: `input×$in + cache_write×$cw + cache_read×$cr + output×$out` at the model's price. Sum a full adapt's transcripts. Report $/adapt and the projected $/user/month at the expected adapt cadence (gated ~weekly + cheap daily touches, see [[commercialization-cost]]).

## Decide
Build a table: **variant × (quality avg, $/adapt, $/user-mo)**. Pick the **highest quality that fits the COGS budget** (≤~$4/user-mo total at $10). Never pick a cheaper variant whose quality is visibly worse on any SAFETY dimension. Show JM the side-by-side plans + scores, not just the numbers — he judges the quality.

## Guardrails
- Simulate on QA; never on prod.
- Delete/clean fake QA users after (or keep a stable persona set for re-use).
- One variable at a time (change only the model, or only the prompt) so the comparison is clean.
- The code layer (dose/variety/periodization/enforcement) is the FRAME, not a skeleton — a cheaper model still authors individually within it; the sim measures whether that authoring holds up.
