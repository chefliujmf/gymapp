# Intervals.icu Instructions

This file defines how the coach should use Intervals.icu as the operational source of truth.

## Role of Intervals.icu

Intervals.icu is used for:
- reading recent training evidence;
- reading modeled metrics such as eFTP and load;
- publishing future planned workouts;
- receiving completed workout data for feedback and adaptation;
- tracking calendar continuity.

## Read priority

When evaluating the athlete, prioritize:
1. the last 14 days for freshness and current execution;
2. the last 42 days for trend and consistency;
3. the last 90 days for block-level context;
4. longer history only for seasonality or prior best-level comparison.

## Key metrics to read

- `icu_eftp`
- `icu_training_load`
- `icu_fatigue`
- `icu_fitness`
- `icu_intensity`
- `icu_normalized_watts`
- `icu_average_watts`
- `sweet_spot_secs`
- time in power zones
- recent workout titles and durations

## Premium capabilities

The athlete has Intervals.icu Premium. Use the extra capabilities when they add signal, not as busywork:

- Advanced weather analysis: use wind, rain, heat, cold, and other outdoor conditions to explain RPE, heart-rate drift, power/HR decoupling, pacing choices, route disruption, and whether an outdoor session should be credited as successful despite imperfect numbers.
- Full Strava history and archive import: use long history for baseline comparisons, seasonal patterns, route-specific progress, best-effort context, and durability trends. Do not overreact to old PRs without checking current training phase and conditions.
- Route matching: compare repeat routes against prior executions when judging progress, pacing, weather cost, and whether a commute or utility ride should be separated from training evidence.
- Activity layout and custom panels: when useful, recommend coach-facing fields/panels for execution score, weather impact, route comparison, fueling/recovery completion, cadence quality, L/R balance context, and planned-vs-completed notes.
- CSV stream upload/edit: use only to repair or add athlete-provided or device-derived streams such as power, heart rate, cadence, or L/R balance. Never fabricate missing data to make an activity look cleaner.
- Custom zones for any activity stream: create or recommend zones only when they answer a coaching question, such as cadence control, torque/low-cadence work, L/R balance monitoring, grade-specific pacing, or temperature/heat-response review.
- Annual training plan builder: use generated targets as season-level context for time, distance, and load, but keep the coach plan adaptive to family constraints, weather, recovery, and actual execution.
- Team and multi-athlete tools are irrelevant unless the athlete explicitly adds other athletes to this coaching setup.

## Metrics handling rules

- Treat configured FTP as an editable setting, not proof.
- Treat `icu_eftp` as a model output that must be compared against actual ride evidence.
- Use recent completed workouts to check whether the model is stale, optimistic, or conservative.
- Prefer repeated evidence over single-ride anomalies.

## Publishing rules

When a workout is ready for execution:
- represent it in the canonical workout schema first;
- publish it to Intervals.icu as a future planned workout;
- preserve structure, targets, and coaching intent;
- place it on the correct calendar day;
- assume the Wahoo sync path will consume the planned workout from Intervals.icu.

How to write events (read this before any direct API call):
- **Publish through `tools/intervals_icu_workouts.py` (`publish` / `publish-week`), not hand-rolled API POSTs.** The tool builds the exact event shape Intervals models into a real workout. Hand-rolled writes repeatedly produced empty workouts (see below).
- **`time_target` (seconds) is mandatory on a ride/run event, not optional.** Intervals only *models* a planned workout (power chart, planned load, the steps Wahoo pulls) when the event carries `time_target` alongside `moving_time` and a structured `workout_doc`. An event with a valid `workout_doc` but **no `time_target`** is silently stored unmodeled: empty power chart, `icu_training_load: null`, and nothing usable by Wahoo. (Found 2026-06-22: a third-party fan-out — Platyplus's `planToIcuEvent` — wrote rides with `moving_time` but no `time_target`; every ride showed empty until deleted and republished via the tool. A `time_target`-only PUT does **not** retro-fix an already-broken event; it must be created (POST) correctly.)
- **Leaf `workout_doc` steps are `{duration, power:{start,end,units:"%ftp"}}` only** — put `text`/`reps` on repeat wrappers, not on leaf steps (mirror `build_workout_doc()`).
- **Ride/run planned workouts send BOTH native workout text and a `workout_doc` (settled 2026-06-23; matches the proven June-16 event).** The native text in the description (`## Warmup` / `4x` / `- 60m 58-66%`) renders the Intervals chart/watts and the readable structure; the `workout_doc` is the authoritative duration/structure that keeps `moving_time` correct and drives the Wahoo plan. **Do not drop the `workout_doc`** — without it Intervals adds the parsed-text duration on top of `moving_time` and a 5h ride shows as ~10h with an empty front. (Removing the native text instead kills the chart entirely.) The tool does this for you; keep ride steps ≤1h (auto-split handles `workout_doc`, and author specs in ≤1h blocks so the native text is clean too).
- For the Form/fatigue forecast, load auto-computes from the workout; set `icu_training_load` explicitly only if you need it before the async compute runs.
- **Intervals parses duration tokens out of the description (native AND prose) into phantom steps that double a long ride's chart.** The tool handles this: native step durations render in **minutes, never hours** (`- 60m`, not `- 1h`), and `_sanitize_description_prose()` spaces stray `Nh` tokens (a cue "do not force a 5h ride" was becoming a phantom 5h step) and em-dashes prose ` - `. If a long ride still doubles, diff a working vs broken event's `moving_time`/`zoneTimes`/`- <dur>` tokens — don't trust the chart.
- **Keep `source_context.phase` short** (e.g. `Aggressive June Build`, not a long parenthetical). The tool tags events `[folder, phase]`, and Intervals renders the phase as a hashtag on the title — a long phrase becomes a wall of hashtag text.
- **To change a published ride's structure/duration, delete the event and recreate it (POST) — do not rely on a PUT.** Intervals models the workout (chart, load, zones) only at create; a PUT updates the stored steps but leaves a stale render, so the old (wrong) chart persists. Planned load/expansion is computed by an Intervals background job on its own schedule, so a fresh event shows `icu_training_load: null` for a while — verify the steps + `time_target`, not the load, and hard-refresh the UI.
- **Planned load (`icu_training_load`) is computed server-side a short time after the write** — a freshly-published event reads `null` even when correct. Verify the *structure* (steps + `time_target`), not the load number, immediately after publishing; load populates later.

Strength / gym publishing rules:
- publish gym sessions as Intervals type `WeightTraining`, not `Other`;
- set both `moving_time` and `time_target` from `estimated_duration_sec`;
- render gym warmups, cooldowns, and exercise details as markdown tables, not native timed workout lines;
- do not create parsed `workout_doc` steps for gym sessions, because Intervals can otherwise display only the parsed warmup/cooldown duration instead of the intended full session length.

Bike publishing rules:
- publish ride sessions as Intervals type `Ride`;
- set `time_target` to the structured workout duration so reused calendar slots do not retain stale gym duration targets;
- let the native workout text define the parsed ride steps that sync to Wahoo.
- when the working FTP changes, update Intervals.icu Ride sport settings as well as future workout descriptions/specs, because `%ftp` workout steps resolve from the athlete sport FTP.
- for easy endurance or frequency rides, avoid absurdly low warmup/cooldown targets. Let the warmup ramp naturally into low endurance/Z2 and let cooldown stay easy endurance by feel unless recovery is the explicit purpose.
- planned rides must be at least 60 minutes. Do not publish 30-50 minute rides as workouts; use rest, mobility, strength, or an optional non-ride note instead unless the athlete explicitly reverses this rule.

Optional support notes:
- use Intervals category `NOTE`, not `WORKOUT`, for optional support work that should not become training debt if skipped;
- use this for discretionary upper-body support, mobility, recovery guidance, or conditional "if fresh" options;
- tag optional notes with clear intent such as `Optional` and `No Debt`;
- include skip conditions, the session cap, and the next key workout the note must protect;
- do not add load, time targets, or Wahoo-syncable workout structure to non-debt notes.

Standard planned-workout blocks:
- every published workout should include `Fueling / Meals / Supplements`;
- every published workout should include `Recovery Actions`;
- every published workout should include `Skill Focus`;
- every published workout should include `Mental Focus`;
- every published workout should include workout structure blocks: `Warmup`, `Main Set`, and `Cooldown`;
- every published workout should include `Private Feedback Fields`;
- use session-specific content when available, otherwise use conservative defaults.

## Feedback loop

After the athlete completes a workout:
- read the completed result from Intervals.icu;
- read athlete-entered `icu_rpe` and `feel`;
- read the private structured feedback fields for coach context when available;
- read the Intervals.icu Notes/comment thread shown below the activity description as coach feedback when present;
- read the legacy private `Feedbacks` value only if an older activity still returns it;
- read HRV, resting HR, and sleep when available before deciding whether to push, hold, or absorb;
- read `description` only for non-personal public notes, because it can appear on Strava;
- compare executed load and targets against the intended workout;
- decide whether the session was successful;
- set the Intervals.icu coach tick as the quick visible rating;
- post the coaching conclusion, score rationale, and next focus to the Notes/comment thread;
- update the next-best stimulus and weekly plan accordingly.

Completed activity handling:
- never publish a new planned workout on a day that already has the completed activity being analyzed;
- if a completed activity replaces a planned workout, reconcile the calendar so the old plan does not remain as training debt;
- for past mismatches, delete the stale planned workout or replace it with a short note only when context is needed;
- delete skipped past planned workouts that are unpaired and were not performed; do not leave them on the calendar, mark them as debt, or automatically move them forward;
- keep planned workouts that are paired to completed activities, because they are historical execution context rather than debt;
- for same-day changes before riding, update the planned workout to the new intent when practical;
- treat completed activities as evidence for adaptation, not as workout specs to republish;
- before publishing same-day changes, check Intervals events and activities separately to avoid duplicate calendar entries.

Coach tick handling:
- use `Amazing` only for excellent execution of the intended purpose with no meaningful caveat;
- use `Good` for successful execution or smart adaptation;
- use `Seen` when the activity is acknowledged but not a training success or failure;
- use `Poor` when execution missed the purpose or created avoidable fatigue;
- use `WTF?` only for clearly unsafe, incoherent, or severely counterproductive execution;
- do not add a coach tick comment unless explicitly useful; use the Notes/comment thread for coach rationale.

Public activity handling:
- every completed ride should get a short public-safe title instead of generic device titles such as `Sortie vélo dans l'après-midi`;
- titles should be specific, memorable, and tied to the ride's real character, but not expose private coaching context;
- prefer grounded titles over abstract slogans. Good pattern: `[context] + [ride type / purpose]`, e.g. `Post-Girona Reset Spin`, `Rain-Window Endurance`, `Easy Miles With Company`;
- avoid awkward comma-imperative constructions such as `Frequency Spin, Save Friday`; use natural titles like `Thursday Easy Spin` or `Pre-Anniversary Easy Spin`;
- avoid titles that sound clever but unclear, such as `Fresh Legs, Calm Hands`, unless the wording also communicates the actual ride context;
- every completed ride should get a short public-safe description when the athlete has not provided one;
- descriptions should be cool but restrained: 1-2 sentences about the actual workout, route, terrain, conditions, effort style, or ride feel;
- do not include health status, pain/niggles, knee/calf/back details, fatigue/recovery status, HRV/sleep, private constraints, coach score, or what the ride is meant to protect next;
- avoid phrases like `stay fresh for`, `protect Saturday`, `knee warning`, `health`, `recovery`, or `training debt` in Strava-visible text;
- use the activity Notes/comment thread for private context and coach rationale.

The athlete's primary feedback workflow is:
- fill `RPE` in Intervals.icu;
- fill `Feel` in Intervals.icu;
- expect the coach to add or revise a public-safe title and description for each completed ride;
- use private structured feedback fields for quick selects only;
- add free-text context in the Notes/comment thread, chat, or `codex_coach/feedback_log.md`, not in Strava-visible activity descriptions.

Do not ask the athlete to duplicate data that should already be available from connected platforms:
- sleep, resting HR, and HRV from Coros when available;
- weather from Intervals.icu;
- duration, load, power, HR, and changed-vs-plan from the completed activity and planned workout comparison.

Ask for private notes only for subjective context that the platforms cannot infer well:
- legs before and after;
- fueling/GI;
- pain/niggles;
- life or schedule constraint;
- mental state when relevant;
- Centr workout and gym substitutions.

If a completed activity is missing RPE or Feel:
- ask the athlete for the missing value before making strong conclusions;
- once provided, use it in the workout analysis;
- do not treat missing subjective feedback as neutral.

## Decision rules

- If execution is consistently stronger than the model suggests, test whether targets should rise.
- If execution degrades while model metrics stay high, favor fatigue management over chasing numbers.
- If a planned workout is missed, do not force catch-up by default.
- If the athlete asks to do more on a blank day, check recovery and next-key-session risk first; add a non-debt optional note only when it preserves the week objective.
- If a ride contains unusually strong long-duration power, check whether FTP assumptions need revision.

## Publishing folders and naming

Default folder or grouping label:
- `Codex Coach`

Default workout naming style:
- concise purpose first
- progression marker second
- avoid vague titles

Examples:
- `Threshold 4x8 Controlled`
- `Tempo Durability 2x20`
- `VO2 5x3 Repeatable`
- `Endurance Long Ride With Tempo Finish`
