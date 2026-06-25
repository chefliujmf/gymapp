# Data Sources

This file defines where the coach should look before asking the athlete for manual input.

## Current Source Priority

1. Intervals.icu completed activities and planned workouts
2. Intervals.icu wellness rows
3. Intervals.icu Premium context: advanced weather, route matching, full Strava history/archive imports, custom panels, custom zones, and uploaded/edited streams when present
4. Google Calendar availability
5. Athlete notes in the Intervals.icu activity Notes/comment thread
6. Manual chat/file feedback only when platform data is missing or ambiguous

## Intervals.icu Premium

Premium is active on the athlete account.

Use premium data sources as follows:
- weather analysis to interpret outdoor cost and decide whether imperfect power numbers still represent good execution;
- route matching and full Strava history for repeat-route progress, seasonal trends, durability context, and prior-best comparisons;
- Strava archive imports when API history is incomplete or a longer baseline is needed;
- custom activity panels and fields to keep coach-relevant metrics visible without putting private context in Strava-facing text;
- CSV stream upload/edit only for athlete-provided or device-derived corrections, never invented data;
- custom zones for additional streams when they support a specific coaching question.

## Intervals.icu Wellness

Use Intervals.icu wellness as the first recovery/body-mass source because it is already available through the same API as training data.

Fields to use when present:
- `weight`
- `restingHR`
- `hrv`
- `hrvSDNN`
- `sleepSecs`
- `sleepScore`
- `sleepQuality`
- `avgSleepingHR`
- `readiness`
- `fatigue`
- `stress`
- `mood`
- `soreness`
- `steps`
- `ctl`, `atl`, and calculated form

Current observed state:
- sleep duration is available for many days;
- resting HR is available for many days;
- body weight appears intermittently;
- HRV is available on at least some recent rows, so use it when populated and fall back to sleep/resting HR/activity response when missing.

## Coros

Best current path:
- let Coros sync recovery/wellness data into Intervals.icu if the integration supports it;
- read the resulting wellness rows from Intervals.icu;
- avoid building a separate Coros scraper unless Intervals cannot provide the needed fields.

If HRV remains missing:
- verify Coros is set to sync wellness/recovery metrics where possible;
- verify Intervals.icu receives those fields;
- if the platform still does not expose HRV, treat resting HR, sleep duration, activity response, RPE, and Feel as the reliable recovery inputs.

## Google Fit / Health Connect / Body Weight

Google Fit is configured as an Intervals.icu integration.

No direct Google Fit connector is currently available in this Codex session, so the preferred path is:
- Google Fit / Health Connect writes data;
- Intervals.icu imports it;
- the coach reads it from Intervals.icu wellness or completed activities.

Best current path:
- use Intervals.icu wellness `weight` if Google Fit, a scale, or manual entry syncs body weight there;
- use Intervals.icu completed activities if Health Connect or Google Fit forwards gym/mobility workouts there;
- otherwise import weight periodically from Google Fit export or manual CSV;
- do not ask the athlete to type weight daily unless the trend is important for a specific block.

Centr / Health Connect path:
- Centr should write completed gym sessions to Health Connect when possible;
- Health Connect / Google Fit should forward usable summaries into Intervals.icu if the integration supports it;
- after the next gym session, verify whether Intervals receives duration, type, HR, calories, and any strength details;
- if Intervals receives only a generic activity, keep the minimal gym note for exercises/weights/skips.

Wellness workflow:
- before weekly planning, read the last 7-14 days of Intervals.icu wellness;
- compare sleep, resting HR, HRV, body weight, CTL/ATL/form, and recent eFTP context;
- treat missing wellness fields as unknown, not neutral;
- do not ask the athlete to manually report wellness data already present in Intervals.icu.
- interpret HRV as a trend, not a single-day command. When enough data exists, compare the 7-day HRV pattern with the athlete's 30-60 day baseline.
- treat low HRV plus resting HR about 5 bpm above baseline for multiple days, especially with poor sleep, heavy legs, or high RPE, as a reason to reduce intensity.

Body weight should influence:
- watts/kg trend;
- nutrition/body-composition guidance;
- long-term performance context.

Body weight should not drive:
- day-to-day workout difficulty;
- aggressive calorie restriction during build weeks;
- FTP changes by itself.

## Google Calendar

Use Google Calendar availability to:
- protect family/work blocks;
- avoid key sessions after late evenings;
- identify real Friday PM and weekend windows;
- downgrade next-day intensity if the prior evening is heavily booked.
- account for physio, acupuncture, and similar appointments when the athlete adds them to the calendar.

Use busy/free windows by default. Read event details only when the title or context materially changes the training decision.
