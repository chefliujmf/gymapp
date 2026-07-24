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

## Interaction scenarios — test what a USER actually DOES (JM 2026-07-24, "test like crazy")
Plan GENERATION is only half the sim. The #765-class bugs (a chat reschedule silently reverted by the next adapt) only surface when you simulate real user interactions with the coach + then verify the END STATE survives. For EACH persona, drive these and assert the DB + intervals match the request AND still match after the next `daily-adapt`:
- **Move** a workout to another day ("move today's session to Friday") → it lands on the target day, the origin clears, and it's still there after an adapt (pinned, #765).
- **Delete / skip** a workout ("drop tomorrow's ride") → removed, not silently re-added by horizon-fill.
- **Substitute** ("do an easy ride instead of the threshold today") → today becomes the easy ride, the threshold moves/rebuilds elsewhere, both survive the adapt.
- **Rest-day onto a workout day** ("make tomorrow a rest day") → the session is cleared/moved, the rest sticks (set_rest_day), no session left stacked on a "rest" day.
- **Multiple workouts on one day** → the 2nd is REJECTED (max-per-day 409) → combine or move, never stack two.
- **Exceed the weekly training-days cap** → adding a session on a new day past the cap 409s.
- **Heavy gym adjacent to a quality endurance day** → concurrent-interference 409 (move ≥1 day clear).
- **Re-request a pinned change** → the coach releases the pin (pinned:false) then changes; the adapt still can't revert it otherwise.
The coach replying "done" is NOT a pass — VERIFY the calendar (list_schedule + the DB + intervals events) reflects it, and re-run the adapt to confirm it holds. A repeatable battery lives in `scripts/` (interaction guards: planCapViolation, trainingDays cap, rest-day guard, concurrent-interference, #765 pin). This is part of "test like crazy for all personas".
