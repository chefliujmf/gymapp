# Feedback Protocol

> **Owns:** the COACHCHECK workflow, the steps to run, and the completion gate. For note *layout* see `coach_feedback_format.md`; for compliance inputs see `coach_action_feedback.md`; for what to persist see `coach_feedback_memory.md`.

The feedback loop is part of the plan. Intervals.icu is the primary feedback source.

## Chat Trigger

When the athlete writes `COACHCHECK` in chat, acknowledge it as a coach check-in request and proceed without asking what it means. Treat obvious typos such as `COAHCHECK` the same way.

`COACHCHECK` is execution-first, not a full revalidation by default. The coach should check enough current evidence to act correctly, then execute the needed updates. Revalidate broader assumptions only when new evidence, athlete feedback, missing data, or a planned change actually requires it.

## Fast path (keep COACHCHECK quick)

Default to the minimum reads that let you act correctly. Network round-trips are the cost — each
`--include-details`/`--include-messages` adds API calls **per activity**, so never hydrate a wide
window.

- **Scope to what's new (may be plural):** analyze every activity completed since the last coach
  note — often one, sometimes several (multi-day gap, or two rides in a day). Identify the
  un-coached rides first (a cheap `read-activities` summary, no details), then hydrate detail only
  for **those specific activities** — `analyze-activity --activity-id <id>` per new ride, or
  `read-activities --limit N --include-details` where N = the number of new rides. Post a full coach
  note for **each** new activity (see the default action). Do **not** pull `--include-details` over a
  wide window of already-coached rides.
- **Wellness:** last ~7 days only. **Events:** current week only.
- **Memory:** read the "Currently Binding" summary at the top of `coach_feedback_memory.md`; only
  open dated rows if a specific decision depends on one. Don't scan the whole ledger.
- **Verify with one call:** confirm the completion gate with a single `read-activity-messages`
  read, not a re-pull of activities.
- **Network:** request escalated network access up front (see below) so calls don't fail-and-retry.

A one-ride COACHCHECK is ~3 read calls (activity+detail, wellness, events) + the writes + one
readback; add one detail call (and one note set) per extra new ride. Either way the window is the
**un-coached** rides, not a sweep of the last month.

Default action:
- read recent Intervals.icu activities, activity notes, RPE, Feel, and private feedback fields;
- read recent wellness/recovery data when available;
- read upcoming planned workouts;
- check `coach_feedback_memory.md` and `coach_action_feedback.md`;
- review execution, fatigue, nutrition, supplements, body maintenance, mental execution, and plan impact;
- update activity coach notes, coach tick, public-safe title/description, and calendar when needed;
- for every completed activity analyzed during COACHCHECK, post the full main coach note with an explicit `Score: x/10` and the separate `Recovery / Supplements` note before calling the check complete;
- read the activity Notes/comment thread back after posting and verify the required blocks are present;
- remove stale unpaired skipped workouts instead of treating them as debt;
- audit the affected plan horizon before the final answer: next workout, rest of current week, weekly annual target, and downstream block/year when the new evidence changes load, stimulus, recovery timing, or the September 1 300 W progression;
- give one clear default next action plus one downgrade/stop rule if needed.

Operational rule for Intervals.icu commands:
- Intervals.icu read/write commands require network access. In this Codex sandbox they commonly fail first with DNS errors when run without escalation. Use escalated network permission up front for `tools/intervals_icu_workouts.py` commands that read or write Intervals data instead of first running them in the sandbox and then narrating the DNS retry.
- If a command still fails, report the real failure. Do not turn the usual sandbox DNS restriction into repeated user-facing noise.

Avoid unnecessary revalidation:
- do not reread or relitigate stable profile, phase, cookbook, supplement, or long-term planning assumptions unless the current decision depends on them;
- do not produce a research-style review when the needed action is posting notes, cleaning stale workouts, updating the next workout, or making the next-day call;
- keep the chat response focused on what was done and what the athlete should do next.

Ask only for missing feedback that blocks the next decision, such as missing RPE/Feel or action feedback for a relevant food, supplement, calf, or recovery recommendation.

## Primary Workflow

After each completed activity, fill these in Intervals.icu:
- `RPE`
- `Feel`
- private structured feedback fields for quick-select context the platforms cannot infer
- Intervals.icu Notes/comment thread entries for free-text athlete context and coach replies
- no personal coaching context in the public activity title or description if it syncs to Strava

The coach should already read or infer:
- RPE and Feel from Intervals.icu fields
- sleep, resting HR, and HRV from the connected Coros data when available
- weather from Intervals.icu
- duration, load, power, HR, route, and compliance from the completed activity
- changed-vs-plan from the planned workout and completed workout comparison

Do not put personal coach notes in any activity title or description that appears on Strava. Use the private quick-select fields, the activity Notes/comment thread, chat, or `codex_coach/feedback_log.md` for private context.

Use private feedback fields only for things the data cannot show well:
- `Legs Before`
- `Legs After`
- `Fuel/GI`
- `Pain/Niggles`
- `Life Constraint`
- `Mental State`

Use the Intervals.icu Notes/comment thread shown below the public description for short free-text context or back-and-forth coach comments. Public descriptions should be short, meaningful, and safe for Strava. Older custom text fields are redundant once Notes are working.

Keep athlete feedback and coach feedback distinct:
- athlete feedback is the athlete's raw context and should not be rewritten as if it came from the coach;
- coach feedback is the coach's concise interpretation, conclusion, and next action;
- internal coach-brain rules about calendar cleanup, stale plans, or process should not be pasted into the activity note.
- text marked with `***` is coach-improvement feedback unless it is clearly activity feedback; use it to update instructions/profile, not as something to paste into the athlete's activity note.
- coach-improvement feedback should also be logged in `coach_feedback_memory.md` when it changes how future advice should be delivered or tested.

Format coach feedback for scanning. Prefer one concise note with topic bullets over a single dense paragraph. Split into multiple comments only for later corrections or actual conversation.

Use [coach_feedback_format.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/coach_feedback_format.md>) for the activity-facing note. **That file is the single source of truth for the exact blocks a completed-workout note must contain** (see its "Required Content Rules"). Do not maintain a second block list here; the completion gate below only verifies those same blocks are present after posting.

COACHCHECK completion gate (block names are owned by `coach_feedback_format.md`):
- Do not summarize the check as done until the Intervals.icu activity thread has been read back and shows:
  - one `Coach note - ...` comment containing `Verdict` with `Score: x/10`, `Execution`, `Body / Recovery Exercises`, `Mind`, and `Next`;
  - one separate `Recovery / Supplements` comment containing `Nutrition`, `Food link`, `Recovery`, `Today's workout needs`, `Daily baseline`, and `Skip today`;
  - the coach tick and public-safe title/description updated when appropriate.
- If any block is missing, post the missing block immediately, then read the thread back again.
- Required blocks should stay useful, not repetitive. When the signal is stable, compress the block and add value through trend, readiness, plan impact, risk, or a specific next cue instead of repeating the same stock text.

The coach will then:
- read `codex_coach/coach_feedback_memory.md` for active coach-feedback rules and hypotheses
- read `codex_coach/coach_action_feedback.md` for food, supplement, recovery, stretching, and reset-cue compliance rules
- read the matching Intervals.icu activity if it exists
- read `icu_rpe`, `feel`, and activity notes
- compare actual load and power with your subjective feedback
- review nutrition, hydration, recovery, supplements, and mental execution as part of the completed-workout analysis
- give post-workout fueling and recovery actions when the ride or next 24 hours justify them
- include recovery food links from the cookbook and exact Centr recipe URLs when recommending meals, snacks, smoothies, or recovery food
- when completed feedback needs preserved planned-workout recipe, exercise, recovery, or supplement context, use Intervals' paired planned event as the source when available
- do not duplicate long planned workout text into custom activity fields; the paired event is the out-of-the-box Intervals trace
- state the workout-specific supplement decision, including `none required` when that is the correct decision
- include the daily baseline and skip-today supplement blocks consistently, even when the decision is simply to keep or skip
- include body/recovery exercises consistently, even when the action is `none required`
- avoid repeating identical supplement, calf, food, or mindset language across similar rides unless it is newly relevant
- decide whether to keep, reduce, move, or replace the next planned workout
- set the Intervals coach tick as the quick visual rating
- give the completed ride a short public-safe title and description
- do not run public title/description updates in parallel with coach tick updates; update public text first, then set the coach tick, then verify the raw activity readback still shows the tick
- post the coach conclusion and next action in the Notes/comment thread, not raw metric analysis
- update the Intervals.icu calendar when needed
- update `coach_feedback_memory.md` when athlete feedback shows a recommendation worked, failed, was confusing, or needs a different style

## Coach Action Feedback

For food, supplements, calf work, stretching, mobility, recovery actions, and mental cues, the platform cannot prove compliance. The athlete can simply tell the coach in chat or the Intervals.icu Notes/comment thread.

Short format:

```text
Coach actions:
Food: done / missed / changed
Protein: yes / no
Ride fuel: [g carbs/h or none], OK / GI issue / low energy
Hydration: OK / low / too much
Calf routine: done / skipped / worse
Supplements: baseline done / missed / changed
Reset cue: used / not needed / forgot / did not help
Issues: none / GI / pain / forgot / too much / not practical
```

The coach should treat missing action feedback as `unknown`, not failed. Ask only for missing items that affect the next training decision.

## Missing Feedback Rule

If I see a completed activity without RPE or Feel, I should ask you for the missing value before making strong conclusions.

Quick reply format:

```text
May 16 ride: RPE 3, Feel good.
```

If context matters:

```text
May 16 ride: legs heavy first 20 min then good, no pain, ate one bar, family schedule was easy.
```

## Structured Feedback Fields

Use these private Intervals.icu activity fields for quick-select ride and gym context. Put free text in the Notes/comment thread. If the fields are not available, use chat or `codex_coach/feedback_log.md` as a fallback, not public Strava-visible activity descriptions.

- `Legs Before`: `fresh`, `normal`, `relaxed`, `heavy`, `sore`, `flat`, `tired`
- `Legs After`: `strong`, `normal`, `tired OK`, `barely tired`, `heavy`, `sore`, `cooked`
- `Fuel/GI`: `not needed`, `water only OK`, `carbs OK`, `underfueled`, `GI issue`, `too much fuel`
- `Pain/Niggles`: `none`, `knee`, `back`, `neck/shoulder`, `foot`, `saddle`, `other`
- `Life Constraint`: `none`, `time cap`, `family`, `work`, `poor sleep`, `stress`, `weather`, `other`
- `Mental State`: `calm`, `focused`, `impatient`, `overexcited`, `doubtful`, `frustrated`, `checked out`

The coach should not inject these prompts into public activity descriptions or any field that syncs to Strava.

Chat fallback ride example:

```text
Legs: normal -> tired but OK | Fuel/GI: 40g carbs/h, stomach OK | Pain: none | Life: easy day | Other: no fade, could have done more
```

Chat fallback gym example:

```text
Legs: normal -> tired but OK | Fuel/GI: light snack before, OK | Pain: none | Life: normal | Other: Centr Power Pro W1D3, leg press 3x8 @ 180, RDL 3x8 @ 50, skipped finisher, left 2-3 reps in reserve
```

Minimum useful note:

```text
Legs: normal -> tired OK | Fuel/GI: fueled well | Pain: none | Life: no issue | Other: could do more
```

## Backup Chat Format

Use this directly in chat only when Intervals.icu structured feedback fields are missing or you want to add context:

```text
Feedback May 16: legs heavy first 20 min then better, no pain, ate one bar, no life constraint.
```

## File-Based Option

If you prefer not to type feedback in chat, add it to:

```text
codex_coach/feedback_log.md
```

Use one section per workout. The coach should review new entries in that file before changing the plan.

## Minimum Useful Feedback

If you only send one line, include only what the platforms cannot know:
- `date`
- `legs before/after`
- `fueling/GI`
- `pain`
- `schedule/life issue if any`
- `mind if relevant`
- `anything unusual`

Examples:
- `Feedback May 15: gym legs heavy before, better after, used Centr mobility, no pain.`
- `Feedback May 16: skipped because family dinner.`
- `Feedback May 23: rep 3 faded, legs heavy next morning, fueled normally, no pain.`

## Coach Response Rules

- Match subjective feedback against Intervals.icu data before changing load.
- Read HRV, resting HR, and sleep when available before making the next-load decision.
- Use the Notes/comment thread for conclusions and action only; do not paste raw analysis or metric dumps there.
- Completed-workout feedback must include a full coach decision layer: execution, fatigue, nutrition/recovery, supplement decision, mental execution, plan impact, and next action.
- Activity-facing notes must read like feedback to the athlete, not like a log of coach workflow decisions.
- Treat unexpectedly high RPE as important even if power looks normal.
- Treat poor sleep or late dinner as a reason to reduce next-day intensity.
- If a workout is missed, do not automatically squeeze it back in.
- If a completed activity differs from the planned workout, remove or update the stale planned item instead of treating it as debt.
- If a skipped planned workout is in the past and unpaired, delete it from Intervals.icu unless it should be replaced by a short context note.
- After any missed workout, availability change, unusually strong/weak execution, HRV/resting-HR/sleep signal, Form/Fitness shift, or objective change, proactively update the affected plan horizon. Use current wellness, RPE/Feel, activity execution, working FTP, CTL/ATL/Form, and the 300 W by September 1 objective; do not wait for the athlete to ask whether Friday, the week, or the annual plan should change.
- `Whole plan` means audit the whole plan context, not blindly rewrite every future workout. Change downstream annual targets only when the adaptation changes the block's load, stimulus, recovery timing, or target logic. If no downstream change is warranted, say that it was checked and why it stays unchanged.
- If the athlete asks whether a blank day should really be rest, answer as coach: check recovery, recent load, and the next key workout; if extra work is appropriate, add it as an optional non-debt note rather than a mandatory workout.
- Optional day-before-key-session work should protect the key session: upper body, trunk, mobility, or very easy aerobic only; no lower-body fatigue, calf fatigue, HIIT, or finishers.
- If a gym session creates leg soreness, reduce lower-body volume for the next 7 days.
- If easy rides produce freshness, progress duration before intensity.

## What To Monitor During Phase 1

- RPE drift on easy endurance rides
- power stability at low aerobic effort
- next-morning leg heaviness after gym sessions
- sleep quality after later dinners or family schedule disruptions
- ability to complete planned work without needing catch-up days
- rain-driven changes to outdoor ride execution
- whether Centr sessions help recovery or accidentally add fatigue
