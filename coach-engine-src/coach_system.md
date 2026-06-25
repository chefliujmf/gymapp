# Cycling Coach System Notes

> **Canonical entry point:** `.agents/skills/cycling-coach/SKILL.md`. This file documents repo
> architecture and the change policy only; it is not the operating prompt. Coaching philosophy and
> athlete defaults live in `instructions.md`; per-domain rules live in `codex_coach/instructions_*.md`.

This repository is the working knowledge base and prompt pack for a personal cycling coach.

## Current assets

- [instructions.md](/Users/jmfiset/dev/cyclingcoach/instructions.md)
- [archive/instructions.original.md](/Users/jmfiset/dev/cyclingcoach/archive/instructions.original.md)
- athlete questionnaire: [data/personal_cycling_coach_phase1_questionnaire.docx](</Users/jmfiset/dev/cyclingcoach/data/personal_cycling_coach_phase1_questionnaire.docx>)
- reference books in [knowledge_base](</Users/jmfiset/dev/cyclingcoach/knowledge_base>) (EPUB/PDF)
- historical FIT archive: [data/i28814_fit_files.zip](/Users/jmfiset/dev/cyclingcoach/data/i28814_fit_files.zip)
- Strava export: [data/strava_full_history.zip](/Users/jmfiset/dev/cyclingcoach/data/strava_full_history.zip)
- nutrition, supplements, and recovery references
- executable tools: [tools](/Users/jmfiset/dev/cyclingcoach/tools)
- coach workspace: [codex_coach](</Users/jmfiset/dev/cyclingcoach/codex_coach>)
- coach feedback memory: [codex_coach/coach_feedback_memory.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/coach_feedback_memory.md>)
- coach-owned cookbook: [codex_coach/cookbook.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/cookbook.md>)
- coach-owned exercise library: [codex_coach/exercise_library.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/exercise_library.md>)
- secrets workflow: [codex_coach/secrets_workflow.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/secrets_workflow.md>)

## Change policy

When coaching logic evolves:
- keep the active prompt in `instructions.md`;
- archive the prior version in `archive/`;
- create additional focused markdown files when a coaching subdomain gets complex enough to justify it;
- keep changes incremental and documented.

## Delivery architecture

Preferred stack:
- planning hub: `Intervals.icu`
- analytics hub: `Intervals.icu`
- head unit delivery: `Wahoo ROAM`

Rationale:
- Intervals.icu already contains the athlete history and modeled metrics used for coaching decisions.
- Intervals.icu is the source of truth for both reading results and publishing future workouts.
- Wahoo delivery should happen from Intervals.icu planned workouts directly.
- Final Surge and TrainingPeaks are intentionally out of scope unless a future blocker forces reconsideration.

## Recommended next modules

- `instructions_intervals_icu.md`: API fields, metrics to trust, cadence for refresh, direct planning rules.
- `instructions_fitness_estimation.md`: evidence weighting for eFTP, long efforts, HR, durability markers.
- `instructions_weekly_planning.md`: week templates by availability, fatigue, season, and recent compliance.
- `instructions_workout_analysis.md`: post-workout grading, feedback, and plan-adjustment rules.
- `instructions_wahoo.md`: sync expectations and Wahoo-specific caveats.
- `instructions_nutrition_recovery.md`: fueling, supplements, and recovery decision rules.
- `instructions_weather.md`: outdoor vs trainer vs gym adaptation rules.
- `athlete_profile.md`: normalized athlete profile distilled from questionnaire and future updates.
- `coach_feedback_memory.md`: durable memory of coach feedback, active hypotheses, and whether prior recommendations are working.

## Intervals.icu integration requirements

To use Intervals.icu programmatically, provide:
- API authentication method you want me to use;
- whether you want read-only analysis, workout planning, or both;
- which metrics you care about most: eFTP, load, compliance, wellness, power-duration, HR trends, etc.

Current project bias:
- Intervals.icu is the source of truth for the training calendar.
- Intervals.icu is the source of truth for post-workout feedback.
- Wahoo is a delivery endpoint, not a planning system.

## Additional knowledge domains

The repo now includes references for:
- sports nutrition;
- cycling fueling;
- plant-based sports nutrition;
- supplements;
- recovery.

These should be integrated into the coach only where they improve performance, recovery, consistency, or decision quality.
