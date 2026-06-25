# Workout Schema

This file defines the canonical structured workout format the coach should produce before publishing to Intervals.icu.

> **`power_pct_ftp` ranges must follow `training_zones.md`.** That file is the single source of
> truth for what every zone/intensity word means (Z2, tempo, sweet spot, threshold, VO2). Do not
> set interval percentages from memory — resolve them through the zone table.

## Design goals

- human-readable
- machine-transformable
- explicit enough for Wahoo delivery
- preserves coaching intent, not just interval math

## Schema

```yaml
workout_id: string
title: string
sport: cycling
discipline: bike
objective: string
why_now: string
source_context:
  week_objective: string
  phase: string
  target_system: string
  confidence: low|medium|high
constraints:
  indoor: true|false
  outdoor: true|false
  max_duration_min: number
  equipment: []
targets:
  primary: power|rpe|hr|cadence
  ftp_reference_w: number
  notes: string
skill_focus:
  - action: string
    why: string
mental_focus:
  intention: string
  cue: string
  reset: string
nutrition:
  pre: string
  during: string
  post: string
  cookbook_entry: coach-owned cookbook entry name when relevant
  centr_recipe: exact verified Centr URL or plain-food fallback
  centr_exercise: exact verified Centr URL when relevant
  centr_link: exact verified Centr URL when relevant
  supplements: string
centr_recommendation:
  primary: string
  library_entry: coach-owned exercise library entry name when relevant
  links:
    - exact verified Centr workout or exercise URL
  keep: []
  skip: []
  notes: string
warmup:
  - type: step|ramp|free_ride
    duration_sec: number
    target:
      power_pct_ftp: [low, high]
      rpe: [low, high]
    cadence:
      min: number
      max: number
    notes: string
main_set:
  - repeat: number
    steps:
      - type: work|recovery|cadence|sprint|free_ride
        duration_sec: number
        target:
          power_pct_ftp: [low, high]
          power_w: [low, high]
          rpe: [low, high]
          hr_zone: string
        cadence:
          min: number
          max: number
        notes: string
cooldown:
  - type: free_ride|step
    duration_sec: number
    target:
      power_pct_ftp: [low, high]
      rpe: [low, high]
    notes: string
execution_notes:
  pre_interval_cues: []
  during_workout_cues: []
  if_too_easy: string
  if_too_hard: string
  success_criteria: string
  post_workout_capture: []
publication:
  intervals_icu:
    folder: string
    planned_date: YYYY-MM-DD
    sync_to_wahoo: true|false
```

## Rules

- `title`, `objective`, and `why_now` are mandatory.
- Every duration must be explicit in seconds.
- Use `power_pct_ftp` for most cycling intervals unless absolute watts are specifically needed.
- Use `repeat + steps` for grouped interval blocks.
- Recovery steps must be explicit; do not infer them from prose.
- Use `skill_focus` (list of `action` + `why`) for the published **Skill Focus** block — concrete technique/drill cues (cadence, torque, position, fueling skill) each with a rationale. Every skill cue must include a `why` (`coach_feedback_memory.md`).
- Use `mental_focus` for key rides or sessions where pacing discipline, discomfort management, confidence, or restraint matters.
- Cues belong in `execution_notes`, not buried in interval names.
- Do not use `centr_search` or publish generic Centr keywords. Use exact verified Centr URLs in `nutrition.centr_recipe`, `nutrition.centr_exercise`, `nutrition.centr_link`, or `centr_recommendation.links`. If no exact link is verified, prescribe the food or exercise directly.
- Prefer coach-owned library references in `nutrition.cookbook_entry` and `centr_recommendation.library_entry` before introducing a new external source. If a new source is useful, capture it in the local cookbook or exercise library.

## Example

```yaml
workout_id: bike_threshold_4x8_2026-05-15
title: Threshold 4x8 Controlled
sport: cycling
discipline: bike
objective: Build sustainable threshold power without excessive fatigue.
why_now: Supports current focus on sustained power with limited weekly volume.
source_context:
  week_objective: Raise repeatable threshold work.
  phase: Build
  target_system: aerobic power
  confidence: medium
constraints:
  indoor: true
  outdoor: true
  max_duration_min: 70
  equipment:
    - power_meter
targets:
  primary: power
  ftp_reference_w: 248
  notes: Use lower end first if legs feel blocked.
warmup:
  - type: free_ride
    duration_sec: 900
    target:
      power_pct_ftp: [0.5, 0.7]
      rpe: [2, 4]
    cadence:
      min: 85
      max: 95
    notes: Build gradually.
main_set:
  - repeat: 4
    steps:
      - type: work
        duration_sec: 480
        target:
          power_pct_ftp: [0.96, 1.00]
          rpe: [7, 8]
        cadence:
          min: 85
          max: 95
        notes: Stay controlled and repeatable.
      - type: recovery
        duration_sec: 240
        target:
          power_pct_ftp: [0.45, 0.60]
          rpe: [1, 3]
        cadence:
          min: 85
          max: 95
        notes: Reset breathing before the next rep.
cooldown:
  - type: free_ride
    duration_sec: 600
    target:
      power_pct_ftp: [0.4, 0.55]
      rpe: [1, 2]
    notes: Finish easy.
execution_notes:
  pre_interval_cues:
    - Start controlled. Do not prove fitness in the first rep.
  during_workout_cues:
    - Check cadence and breathing before lifting power.
    - Keep the final two minutes smooth.
  if_too_easy: Lift only to the top of the target range.
  if_too_hard: Drop to 95 percent FTP and finish the set cleanly.
  success_criteria: All four reps completed with stable power and no major fade.
  post_workout_capture:
    - RPE
    - leg sensation
    - whether one more rep felt possible
publication:
  intervals_icu:
    folder: Codex Coach
    planned_date: 2026-05-15
    sync_to_wahoo: true
```
