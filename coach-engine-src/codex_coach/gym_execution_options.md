# Gym Execution Options

The coach plan remains the source of truth for training purpose, volume, intensity, and timing.

## Preferred Current Workflow: Centr

Use Centr when it gives a close match and keeps execution simple.

For each planned gym session, the coach should specify:
- exact coach-prescribed movement table;
- one suggested Centr workout/exercise link when a link has been verified;
- what to keep from the Centr workout;
- what to skip if it adds non-cycling fatigue.
- duration target: 60 minutes by default, never under 45 minutes, up to 75 minutes when useful.

Current preferred Centr matches:
- `Lifting: Lower Body`
- `Power Pro: Week 1, Day 3`
- `Multi-Gym Strength`
- `Strength for Sports`

Only publish these as exact Centr recommendations when a direct link has been verified. Otherwise, publish the coach-prescribed exercise table and write `No exact Centr link verified yet` rather than giving search keywords.

Selection rules:
- prefer lower-body plus pull over bodybuilding splits;
- require a squat or leg press pattern, hinge, single-leg support, pull, and core;
- avoid HIIT finishers, hard conditioning, and failure sets;
- keep the coach intensity cap, usually RPE 5-6 with 2-3 reps in reserve.

## Current Delivery Workflow: Intervals On Pixel

Until a gym app can be automated cleanly, Intervals.icu remains the delivery source for gym sessions.

On the Pixel 7:
- open the planned `WeightTraining` event in Intervals.icu;
- read the `Centr Selection` section first;
- execute the coach-prescribed exercise table from the same Intervals event;
- use Centr only for demos or if the selected Centr workout matches closely;
- let Centr write the completed workout to Health Connect / Google Fit when possible;
- record RPE and Feel in Intervals after the session;
- add loads/weights in the Intervals activity note only if Health Connect / Google Fit / Intervals does not capture them.

After the next gym session, verify in Intervals whether the Centr/Health Connect path produced:
- completed activity type;
- duration;
- HR or calories if available;
- exercise names, sets, reps, or loads;
- enough detail to reduce manual notes.

Minimum Intervals note after gym:

```text
Coach note:
Legs before:
Legs after:
Fueling/GI:
Pain/niggles:
Schedule/life:
Gym/Centr: workout used, main weights, skipped exercises
Other:
```

This is lower-friction than trying to push workouts into an app that cannot import or sync reliably.

## Fallback Workflow: Open-Source Strength Logger

If Centr is too awkward for creating repeatable gym sessions, use an open-source workout logger for execution and progression tracking.

Shortlist to evaluate:
- wger: open-source workout/nutrition manager with an API, better if self-hosting or structured automation matters.
- LibreFit: open-source, private workout tracker with real-time workout logging.
- OpenLift: open-source strength tracker focused on simple progression.
- LiftLog: simple open-source gym tracker for logging weights and sets, but not preferred if workout import/sync is awkward.

Decision rule:
- If the goal is coach automation/API integration, test wger first.
- If the goal is easiest phone execution without automation, test LibreFit or OpenLift.
- Do not spend time on LiftLog unless it can import workouts or the athlete is happy creating templates manually.
- Keep Centr for mobility, yoga, meals, and exercise demos even if strength logging moves elsewhere.

## Experiment Protocol

Test one app at a time using the same coach-created gym session.

Evaluation criteria:
- Can the workout be created in under 5 minutes?
- Can sets, reps, load, and rest be logged quickly during the session?
- Can the previous load be seen next time?
- Can data be exported or copied back into the coach note?
- Does the app avoid adding bodybuilding or conditioning bias?

Initial test order:
1. Intervals-only delivery on Pixel, with weights in the activity note.
2. wger for API-created routines if automation is worth the setup.
3. LibreFit or OpenLift if the priority is simple manual logging.
4. Keep Centr as the fallback demo/mobility/meal library even if lifting logs move elsewhere.

Coach export command:

```bash
python3 tools/export_gym_sessions.py markdown 'codex_coach/plans/archive/phase1_weeks_2_to_4_2026-05-22.json'
python3 tools/export_gym_sessions.py csv 'codex_coach/plans/archive/phase1_weeks_2_to_4_2026-05-22.json'
```

## What The Coach Needs From Any Gym App

Minimum useful export or manual note:
- workout name;
- exercise names;
- sets, reps, load;
- skipped exercises;
- RIR or effort if available;
- next-day soreness.

The app does not need to calculate cycling load. The coach interprets gym fatigue through next-day legs, soreness, and bike execution.
