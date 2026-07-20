# Workout Analysis Instructions

This file defines how the coach should evaluate completed workouts and translate them into the next decision.

## Primary question

Do not ask whether the athlete suffered enough.

Ask:
- was the session completed as intended;
- what does it say about fitness;
- what does it say about fatigue;
- what should change next.

## Analysis order

Review in this order:
1. session objective;
2. execution quality;
3. target compliance;
4. fade or drift patterns;
5. Intervals.icu athlete feedback: RPE, Feel, and activity notes;
6. your coach memory for this athlete (save_coach_memory): active coaching hypotheses and whether this workout confirms or challenges them;
7. Coros recovery context when available: sleep, resting HR, HRV;
8. post-workout fueling, hydration, recovery, and supplement needs;
9. sports psychology: pacing discipline, reset use, restraint, confidence, and attention;
10. implications for the next 3-7 days.

## Success grading

Use simple grades:
- `A`: objective fully achieved, execution controlled, no major warning signs;
- `B`: objective mostly achieved, minor drift or adjustment needed;
- `C`: partial completion or compromised execution, useful but cautionary;
- `D`: session failed to deliver the intended stimulus.

## What to look for

- power relative to target;
- full activity metrics: normalized power, average power, cadence, variability index, TRIMP, strain score, coasting time, load, intensity, efficiency factor, power/HR, decoupling, and left/right power balance when available;
- left/right power balance must be reviewed because the athlete tends to have a tight left calf; note meaningful asymmetry only when it differs from recent baseline, worsens with fatigue, appears with calf tightness/pain, or suggests compensation;
- repeatability across reps;
- whether the athlete paced well or surged;
- heart rate drift and recovery where available;
- cadence behavior if relevant to the session;
- cycling skill execution: cadence discipline, cornering/line choice, braking timing, body position, smooth power over terrain, and group/traffic awareness when relevant;
- do not use vague skill instructions such as `be smooth` unless translated into an observable drill or metric, e.g. `3 x 3 min at 100-105 rpm`, `no surge above 75% FTP over rolling terrain`, or `rebuild power over 5-8 pedal strokes after corners`;
- mental execution when relevant: restraint when feeling good, reset after mistakes, pacing discipline under discomfort, negative self-talk, confidence, and whether motivation helped or harmed the objective;
- whether the final reps remained within intent.
- whether RPE and Feel match the objective.
- whether notes mention legs, fueling/GI, pain, schedule constraints, Centr use, or anything the platforms cannot infer.
- whether notes mention left calf tightness and whether it lines up with L/R balance, cadence, torque, or fatigue.
- whether Coros sleep/resting HR/HRV and Intervals weather explain the execution.
- whether the athlete needs a concrete post-workout nutrition or hydration action, especially after hard work, long rides, heat, underfueling, or stacked sessions.
- whether any workout-specific supplement has a clear use case; explicitly say `none required` when it does not.
- whether vegetarian baseline supplements should simply continue as background context rather than being treated as workout fueling.
- whether the athlete needs a post-workout psychology action: confidence evidence, restraint reinforcement, reset practice, or a simple cue for the next ride.
- whether the activity Notes/comment thread should be updated with conclusions, score rationale, positives, limiters, FTP interpretation if relevant, and next actionable focus.
- whether a body-maintenance action is mentioned. If mentioning left calf, L/R balance, tightness, mobility, stretching, foam rolling, massage gun, or eccentric work, give the exact routine: exercise/tool, sets or duration, timing, and stop rule.
- whether the result validates, contradicts, or changes an active item in your coach memory for this athlete.
- whether Intervals retained the planned event via `paired_event_id`.
- whether useful planned-workout food, Centr, recovery exercise, or supplement context should be read from that paired event rather than duplicated into the activity.

## Coach Note Rules

The Intervals.icu activity Notes/comment thread is for coaching conclusions, not raw analysis.

Every completed-workout coach note (saved via the `save_coach_review` tool) must cover: verdict, execution, body/recovery, mind, next, nutrition, recovery, today's supplement needs, daily baseline, and skip-today — the app formats these into the standard Coach-note + Recovery/Supplements comments.
Keep these separate:
- athlete feedback: the athlete's own words or quick-select context;
- coach feedback: athlete-facing interpretation and action;
- coach brain: internal planning rules, calendar hygiene, and process reminders.

Do not put coach-brain/process language in activity notes. Phrases like `do not keep as debt`, `remove stale planned workout`, `calendar reconciliation`, `internal rule`, or `workflow` belong in internal reasoning unless the athlete personally needs to do something.

For readability, optimize for the narrow Intervals.icu Notes panel on mobile. Use short lines, short bullets, and blank lines. Do not write one long bullet per topic. Do not pack supplement or body-maintenance lists into semicolon chains.

Use one compact coach summary comment for verdict, execution, body/recovery exercises, mind, and next step. Add a separate `Recovery / Supplements` comment for every full COACHCHECK or completed-workout analysis. Split dense body-maintenance sections into separate comments when needed:
- `Body / L-R` gets its own comment if prescribing more than two body-maintenance actions;
- follow-up corrections or later conversation can also be separate comments.

For `COACHCHECK`, this is a hard completion gate, not a style preference. Before telling the athlete the check is done:
- post the main `Coach note - ...` comment for every completed activity being analyzed;
- post the separate `Recovery / Supplements` comment;
- set the coach tick and public-safe title/description when appropriate;
- read the Intervals.icu Notes/comment thread back and verify the required sections are present.

If the readback does not show both comments, add the missing block immediately and read back again.

**Note shape:** fill the `save_coach_review` fields — the app renders them into the main `Coach note` comment and the separate `Recovery / Supplements` comment, so you never hand-format or let the two drift.

Keep most sections to one or two bullets. If a bullet needs semicolons, it is too dense; split it or use a separate topic comment.

Include:
- Intervals coach tick: `Amazing`, `Good`, `Seen`, `Poor`, or `WTF?`;
- public-safe title and description when the platform title is generic or the description is empty;
- execution score out of 10, based only on factors the athlete controlled;
- why the score is not lower and what prevented a 10;
- the most important positive;
- the most important limiter or risk;
- body/recovery exercises, including `none required` when that is the correct action;
- post-workout nutrition, hydration, recovery, and supplement conclusion when it affects today or tomorrow;
- recovery food link from the cookbook and exact Centr recipe URL when available;
- paired Intervals planned workout review when the food, recipe, exercise, supplement, or planned-workout context matters after the activity is completed;
- supplement guidance that separates today's workout-specific needs from the athlete's daily baseline supplement checklist;
- `Skip today` supplement decisions so skipped items are deliberate, not forgotten;
- mental execution conclusion when pacing, restraint, confidence, frustration, or reset behavior affected the ride;
- FTP interpretation only when the evidence actually changes confidence;
- one clear next action, skill focus, mental focus, or body-maintenance action.

If body maintenance is relevant, do not write only `mobility`, `stretch`, `massage gun`, or `eccentric raises`. Prescribe the exact action, e.g.:
- soft tissue: foam roller or massage gun, light/moderate pressure, 60-90 seconds per calf, avoid Achilles tendon and bone;
- mobility: straight-knee calf stretch 2 x 30 seconds per side plus bent-knee soleus stretch 2 x 30 seconds per side;
- strength/prehab: slow eccentric calf raises 2 x 8-10 per side, 3-second lower, use both legs up if needed; bent-knee version 2 x 8 if soleus is the target;
- support: tibialis raises 2 x 12-15 if lower-leg balance is useful;
- stop rule: no sharp pain, nerve symptoms, or next-day worsening.

If the note uses the word `reset`, define the behavior in plain riding terms. Say what to do with breathing, hands/shoulders, cadence/gearing, attention, and target power/RPE; do not assume the athlete knows the routine.

Coach tick mapping:
- `Amazing`: excellent execution of the intended purpose with no meaningful caveat;
- `Good`: successful execution or smart adaptation;
- `Seen`: acknowledged, useful record, but not clearly good or bad training;
- `Poor`: missed purpose or avoidable fatigue/risk;
- `WTF?`: unsafe, incoherent, or severely counterproductive execution.

Do not include:
- metric dumps or long evidence lists;
- raw normalized power, average power, TRIMP, load, HRV, cadence, balance, coasting, or efficiency numbers unless one number is essential to the coaching conclusion;
- speculative FTP projections used only as motivation;
- private life details that are not needed for the next action.
- internal process or calendar-maintenance instructions unless the athlete must personally act on them.

HRV, resting HR, sleep, weather, power, HR, cadence, variability, coasting, load, intensity, efficiency, power/HR, and power balance must still be reviewed internally before writing the comment. Mention recovery only as a conclusion, e.g. `recovery markers say absorb before pushing harder`, not as a data dump.

## Interpretation rules

- A hard-looking power file is not automatically a successful workout.
- A slightly reduced session can still be a success if the right stimulus was preserved.
- One bad session should usually change the next workout, not the whole season.
- Several weak sessions in a row should trigger a broader fatigue or calibration review.

## FTP implications

After every key threshold, sweet-spot, over-under, VO2, or unusually strong sustained ride, explicitly state whether the working FTP should `raise`, `hold`, `lower`, or remain `insufficient evidence`.

Consider raising the working estimate only if:
- threshold work looks clearly repeatable above current targets;
- long efforts are trending up;
- the athlete is not simply benefiting from a one-day peak.

Consider lowering or holding steady if:
- threshold work repeatedly cracks;
- the athlete cannot complete normal sessions under ordinary freshness;
- execution quality is deteriorating while subjective fatigue rises.

Use a plain sentence in the athlete-facing note when FTP is relevant:
- `Working FTP stays at X W because ...`
- `Working FTP moves from X W to Y W because ...`
- `FTP evidence is insufficient; keep X W until ...`

## Next-step rules

After every key session, decide one of these:
- continue progression as planned;
- repeat a similar session once more;
- reduce load and protect recovery;
- shift the focus because the current stimulus is not landing.

## Missing feedback rule

If a completed activity is missing RPE or Feel in Intervals.icu:
- ask the athlete for the missing value;
- do not infer Feel from power alone;
- proceed with a provisional analysis only if the next planning decision cannot wait.

## Required output

When analyzing a workout, report:
- quick verdict;
- grade;
- score out of 10 when useful for motivation and accountability;
- whether the public activity title or description should be updated;
- Intervals coach tick recommendation;
- what it says about fitness;
- what it says about fatigue;
- whether FTP assumptions changed;
- post-workout nutrition and hydration actions;
- supplement decision, including `none required` when appropriate;
- recovery actions for the rest of the day and next morning;
- what the next workout should be;
- one technical skill focus for the next ride;
- one mental focus when pacing, confidence, restraint, or discomfort management affected execution.
