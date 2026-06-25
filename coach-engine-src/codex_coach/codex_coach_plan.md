# Codex Coach Plan

## Objective

Build a personal cycling coach that:
- reads athlete history and current data from Intervals.icu;
- creates future structured workouts;
- publishes planned workouts to Intervals.icu;
- relies on Intervals.icu to sync planned workouts to the Wahoo ROAM;
- reads completed results back from Intervals.icu for coaching feedback.

## Near-term build order

1. Normalize the athlete profile.
2. Define the structured workout schema used by the coach.
3. Define Intervals.icu planning and readback workflows.
4. Add nutrition and recovery guidance layers.
5. Add sports psychology and mental-skills guidance layers.
6. Lock the fitness-estimation and workout-analysis rules.
7. Build plan-generation and workout-feedback loops around Intervals.icu evidence.

## Current state

- Intervals.icu is the sole planning and feedback platform.
- Wahoo ROAM is treated as a delivery endpoint fed by Intervals.icu planned workouts.
- Core operating modules now exist for Intervals.icu, fitness estimation, weekly planning, workout analysis, nutrition/recovery, and sports psychology.
- Single-workout publish and activity readback are implemented in `tools/intervals_icu_workouts.py`.

## Current constraints

- FTP remains a working estimate, not a fixed truth.
- Real life flexibility matters more than perfect periodization.
- The project should not depend on Final Surge or TrainingPeaks.

## Next implementation targets

1. Publish a full week of workouts from one plan file.
2. Standardize post-workout analysis output.
3. Turn recent Intervals activity summaries into coach-facing feedback artifacts.
