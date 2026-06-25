# Coach Feedback Format

> **Owns:** the exact structure/layout of a completed-workout coach note. For *when* to run the loop and the completion gate see `feedback_protocol.md`; for what to persist see `coach_feedback_memory.md`.

Use this exact structure for every completed-workout coach note in the Intervals.icu Notes/comment thread.

The goal is consistency without boilerplate. Even when a section is brief, keep the block so the athlete can always find score, mind, recovery exercises, nutrition, supplements, and the next action in the same place. Do not repeat stock text when the data has no new signal.

## Comment Structure

Use one main coach comment plus one recovery/supplement comment.

Add a separate `Body / Recovery Exercises` comment only when the routine is long. Otherwise include it in the main comment.

## Main Coach Comment

```text
Coach note - [date or ride name]

Verdict
- Score: [x]/10. [One-line reason tied to objective and execution.]
- [Good/Amazing/Seen/Poor/WTF and one-line meaning.]
- [What this changes, if anything.]

Execution
- [What went well.]
- [Main limiter, risk, or why it was not a 10.]

Body / Recovery Exercises
- [Exact body-maintenance action, or "No new body issue; no routine needed today."]
- [Stop rule if any exercise is prescribed.]

Mind
- [Mental pattern observed: calm, impatient, doubtful, focused, overexcited, frustrated, etc.]
- Cue: [specific behavior, not a slogan alone.]

Next
- [Next prescribed workout or change.]
- [One downgrade/stop rule.]
```

## Recovery / Supplements Comment

Always add this as its own comment when doing a full COACHCHECK or completed-workout analysis.

> Not to be confused with the **Recovery Actions** block inside a *planned* workout
> (`instructions_intervals_icu.md`): that one is the pre-prescribed recovery published with the
> workout; this `Recovery / Supplements` comment is the post-ride coach note. They are intentionally
> distinct artifacts at different moments — the naming difference is deliberate, not drift.

```text
Recovery / Supplements

Nutrition
- [Carbs/protein/fluids for the rest of today, only as specific as the ride or next 24h requires.]
- Food link: [coach cookbook entry plus exact Centr link when available, or plain-food fallback.]
- Trace: [activity recovery trace entry saved, or "not needed for this note."]

Recovery
- [Sleep, mobility, walk, legs-up, easy spin, or rest action. Compress to one line when unchanged.]
- [Next morning check: legs, sleep, HRV/resting HR, pain, or readiness.]

Today's workout needs
- [Workout-specific supplement decision. Use "None required" when correct.]

Daily baseline
- [Use full detail only if something changed. If unchanged, one compact line naming creatine, B12, omega 3, vitamin D, protein powder, and glycine/magnesium is enough.]

Skip today
- EAA: [reason.]
- L-glutamine: [reason.]
- Taurine: [reason.]
- Collagen: [reason and vegetarian tradeoff if relevant.]
```

## Body / Recovery Exercises Comment

Use this separate comment when body work has more than two bullets.

```text
Body / Recovery Exercises

Routine
- [Tool/exercise]: [sets, reps, duration, side.]
- [Tool/exercise]: [sets, reps, duration, side.]

Stop if
- [Sharp pain, nerve symptoms, Achilles pain, next-day worsening, or other relevant stop rule.]
```

## Required Content Rules

- Every main coach note must include an explicit `Score: x/10` in `Verdict`.
- The score is an execution score for the workout's purpose, not a moral grade and not a pure load score.
- Coach tick should match the score and signal: `amazing` for 10/10 or unusually valuable execution, `good` for 8-9/10 solid execution with a limiter, `seen` for mixed/acceptable, `poor` for missed objective, `wtf` for unsafe or clearly counterproductive.
- Every note must add new value: trend vs the last relevant ride, readiness for the next key session, plan impact, risk, or one specific execution cue.
- If a section has no new signal, keep the label but compress the content. Do not paste the same calf routine, supplement list, food phrase, or mindset cue across consecutive similar rides.
- Always include `Mind`.
- Always include `Body / Recovery Exercises`, even if the action is `None required`.
- Always include `Nutrition`.
- Always include `Food link` under `Nutrition` when recommending any meal, snack, smoothie, or recovery food.
- Add `Trace` under `Nutrition` only when needed, pointing to Intervals' paired planned workout rather than duplicating the full plan.
- Do not put long planned workout text in custom activity fields.
- Always include `Recovery`.
- Always include `Today's workout needs`.
- Always include `Daily baseline`.
- Always include `Skip today`.
- Keep each bullet short enough for the narrow Intervals.icu notes panel.
- Put private coach reasoning, calendar cleanup, and process logic outside the activity note.

## Default Supplement Language

Use this when there is no special supplement need:

```text
Today's workout needs
- None required.

Daily baseline
- Unchanged: creatine monohydrate 3-5g/day if tolerated; B12 as vegetarian priority; algae omega 3 if aligned; vitamin D by sun/diet/bloodwork; protein powder only for convenience; glycine/magnesium only if sleep benefit is clear.

Skip today
- EAA: skip; normal protein is enough.
- L-glutamine: skip; no clear need today.
- Taurine: skip; no clear workout need today.
- Collagen: skip unless a specific connective-tissue rehab/prehab, joint-pain, or injury-management use case exists; not a vegetarian default.
```

## Default Food Link Language

Use a local cookbook entry first, then include an exact Centr link when available. Do not repeat the same Centr recipe across consecutive similar notes just because it is verified. If variety is needed and no direct recipe URL is verified, use a coach-owned cookbook fallback with quantities or cite a Centr collection link with the exact recipe title.

Examples:

```text
Nutrition
- Normal dinner with carbs and 25-35g protein is enough.
- Food link: Protein-Forward Recovery Smoothie Template from cookbook, or Salted Caramel Super Smoothie if dinner is delayed: https://centr.com/recipe/show/12693/salted-caramel-super-smoothie
- Trace: original plan is retained by the paired Intervals planned workout.
```

```text
Nutrition
- Carb-forward breakfast 2-4h before the next key ride.
- Food link: Swirled Banana & Oat Pots: https://centr.com/recipe/show/32848/swirled-banana-oat-pots
```

Fallback when no exact Centr link exists:

```text
Nutrition
- 25-35g protein plus normal carbs at dinner.
- Food link: No exact Centr link verified yet; use the cookbook protein-forward recovery template.
```

Fallback when only a Centr collection link is verified:

```text
Nutrition
- Normal dinner with carbs and 25-35g protein is enough.
- Food link: Centr collection recipe title: High-protein Lentil Braise with Flatbread, collection link: https://centr.com/blog/show/32824/10-high-protein-recipes-for-easy-meal-prep
```

## Default Body / Recovery Exercises

Use this when no body-maintenance issue is present:

```text
Body / Recovery Exercises
- No new body issue; no routine needed today.
- If the left calf tightens, use the saved calf routine and stop if symptoms worsen.
```

Use the full left-calf routine when calf tightness, L/R concern, or lower-leg maintenance is relevant:

```text
Body / Recovery Exercises

Routine
- Roller/gun: 60-90s per calf, light/moderate pressure.
- Straight-knee calf stretch: 2 x 30s per side.
- Bent-knee soleus stretch: 2 x 30s per side.
- Slow eccentric calf raise: 2 x 8-10 per side, 3s lower.
- Tibialis raise: 2 x 12-15.

Stop if
- Sharp pain.
- Nerve symptoms.
- Achilles pain.
- Worse next day.
```
