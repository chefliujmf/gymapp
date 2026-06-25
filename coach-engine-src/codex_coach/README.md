# Codex Coach

This folder is the active working area for the cycling coach project.

Primary architecture:
- planning and feedback source of truth: `Intervals.icu`
- device delivery: `Wahoo ROAM`

This project no longer targets Final Surge or TrainingPeaks as primary workflow platforms.

Reference books now live in [knowledge_base](</Users/jmfiset/dev/cyclingcoach/knowledge_base>).
Athlete data files now live in [data](/Users/jmfiset/dev/cyclingcoach/data).

## Core files

- `codex_coach_plan.md`: active planning notes and implementation roadmap
- `athlete_profile.md`: normalized athlete profile
- `platform_workflow.md`: Intervals.icu and Wahoo workflow rules
- `data_sources.md`: source priority for Intervals wellness, Coros, Google Fit, and Google Calendar
- `knowledge_map.md`: what sources exist and how they should be used
- `workout_schema.md`: canonical structured workout format
- `coach_feedback_memory.md`: durable database of coach-feedback rules, hypotheses, and outcome checks
- `coach_feedback_format.md`: required Intervals.icu coach-note block format for completed-workout feedback
- `activity_recovery_trace.md`: rules for using Intervals paired planned events as the native planned-workout trace
- `secrets_workflow.md`: GitHub Actions secret names and local ignored fallback rules
- `instructions_intervals_icu.md`: Intervals.icu planning and feedback rules
- `instructions_fitness_estimation.md`: evidence weighting for current fitness
- `instructions_weekly_planning.md`: week-building rules under real-life constraints
- `instructions_workout_analysis.md`: post-workout evaluation rules
- `instructions_nutrition_recovery.md`: fueling, supplement, and recovery guidance rules
- `instructions_sports_psychology.md`: mental-skills, attention, confidence, and reset-routine rules
- `nutrition_centr_workflow.md`: how Centr meals and snacks are matched to workout demands
- `source_library_workflow.md`: how useful Centr links and book-derived ideas become coach-owned reusable library entries
- `cookbook.md`: the coach's reusable performance cookbook for athlete-specific meals, snacks, and recipe templates
- `exercise_library.md`: the coach's reusable exercise, mobility, prehab, and recovery library
- `instructions_weather.md`: weather-triggered trainer and gym fallback rules
- `instructions_strength.md`: cyclist-specific gym and progression rules
- `nutrition_recovery_notes.md`: notes derived from the added nutrition, supplements, and recovery books
- `centr_mapping.md`: Centr-friendly exercise mapping for gym sessions
- `centr_recommendations.md`: selected Centr sessions that match the current cycling phase
- `gym_execution_options.md`: Centr-first gym execution and open-source fallback options
- `plans/active/`: the current plan — macro annual targets, current block, and this week (see `plans/README.md`); superseded/past dated plans are in `plans/archive/`
- `feedback_protocol.md`: standard athlete feedback format and adaptation rules
- `coach_action_feedback.md`: short feedback format for food, supplements, stretching, calf work, recovery actions, and mental cues
- `feedback_log.md`: optional file-based inbox for athlete feedback
- `weekly_checkin.md`: short weekly human-context check-in template

## Execution layer

- [tools/intervals_icu_workouts.py](/Users/jmfiset/dev/cyclingcoach/tools/intervals_icu_workouts.py): publish planned workouts and read recent activity summaries
- [tools/export_gym_sessions.py](/Users/jmfiset/dev/cyclingcoach/tools/export_gym_sessions.py): export planned gym sessions for Centr or open-source gym tracker testing
- [example_threshold_4x8_controlled.json](</Users/jmfiset/dev/cyclingcoach/codex_coach/example_threshold_4x8_controlled.json>): sample workout spec for the executable bridge
- [example_week_plan.json](</Users/jmfiset/dev/cyclingcoach/codex_coach/example_week_plan.json>): sample week input for batch publishing
- [workout_analysis_template.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/workout_analysis_template.md>): standard post-workout review format
- [feedback_protocol.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/feedback_protocol.md>): simple subjective feedback format for adaptive planning

## Basic usage

```bash
mkdir -p .secrets
cp coach.env.example .secrets/coach.env
# Fill .secrets/coach.env with the real local values.

python3 tools/intervals_icu_workouts.py render 'codex_coach/example_threshold_4x8_controlled.json'
python3 tools/intervals_icu_workouts.py publish 'codex_coach/example_threshold_4x8_controlled.json'
python3 tools/intervals_icu_workouts.py read-activities --oldest 2026-05-01 --limit 5
python3 tools/intervals_icu_workouts.py read-wellness --oldest 2026-05-01 --limit 7
python3 tools/export_gym_sessions.py markdown 'codex_coach/plans/archive/phase1_weeks_2_to_4_2026-05-22.json'
```
