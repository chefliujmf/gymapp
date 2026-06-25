# Platform Workflow

## Source of truth

`Intervals.icu` is the source of truth for:
- planned workouts;
- calendar state;
- recent training evidence;
- post-workout feedback inputs.

## Delivery flow

1. Coach creates a structured workout spec.
2. Workout spec is published to Intervals.icu.
3. Intervals.icu syncs the planned workout to Wahoo.
4. Athlete completes workout on Wahoo.
5. Completed activity flows back into Intervals.icu.
6. Coach reads results from Intervals.icu and updates the plan.

## Repo implementation

The current executable bridge is:
- [tools/intervals_icu_workouts.py](/Users/jmfiset/dev/cyclingcoach/tools/intervals_icu_workouts.py)

Current capabilities:
- render native Intervals.icu workout text from a JSON workout spec;
- publish a planned workout to the Intervals.icu calendar;
- read recent activity summaries back from Intervals.icu;
- read Intervals.icu wellness rows for weight, resting HR, sleep, HRV when available, CTL/ATL/form, and eFTP context.
- use Intervals.icu Premium context when available, including advanced weather, route matching, full Strava history/archive imports, custom panels, custom zones, and uploaded/edited activity streams.

Recovery and availability sources:
- Intervals.icu wellness is the first place to check for Coros/Google Fit derived recovery or body-weight data;
- Google Calendar availability is used to protect real-life schedule constraints;
- activity notes are reserved for subjective context the platforms cannot infer.

Operational planning rule:
- if weather makes an outdoor session impractical, the coach should revise the planned workout before execution rather than pretend the original format still stands;
- if the completed workout differs from the planned workout, reconcile the calendar afterward so stale planned workouts do not become training debt;
- if a planned workout is skipped and remains unpaired in the past, delete it from Intervals.icu instead of moving it forward by default;
- if the athlete can do optional support work but it should not create debt if skipped, publish an Intervals.icu `NOTE` rather than a `WORKOUT`.

Current example spec:
- [example_threshold_4x8_controlled.json](</Users/jmfiset/dev/cyclingcoach/codex_coach/example_threshold_4x8_controlled.json>)

## Out of scope

- Final Surge as a primary planning system
- TrainingPeaks as a primary planning system
- file-upload-only workflows for future workouts
